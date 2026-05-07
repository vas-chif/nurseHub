/**
 * @file SyncService.ts
 * @description Orchestrates data synchronization between Google Sheets (Source of Truth) and Firestore.
 * @author Nurse Hub Team
 * @created 2026-02-15
 * @modified 2026-05-07
 * @notes
 * - Implements "Mirror Logic" for operators and schedules (Phase 25).
 * - Handles bulk batch writes and individual operator refreshes.
 * - Manages data ownership (UID-operator matching) during synchronization.
 * - syncOperatorsFromSheets() uses name-based upsert strategy: never overwrites userId,
 *   migrates legacy op-N documents to stable slug IDs, and heals user.operatorId links.
 */
import type { FieldValue } from 'firebase/firestore';
import { collection, doc, getDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { GoogleSheetsService } from './GoogleSheetsService';
import type { ShiftRequest, Operator } from '../types/models';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export class SyncService {
  private sheetsService: GoogleSheetsService;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
  }

  /**
   * Performs a full sync from Sheets to Firestore using name-based upsert strategy.
   *
   * Strategy (Sheets is master for schedule data):
   * - Operators are matched by NAME (not by row index or legacy ID).
   * - If a matching name already exists in Firestore: schedule is updated, userId is PRESERVED.
   * - If a legacy op-N document exists with the same name: it is migrated to the new slug ID,
   *   userId is preserved, and users/{uid}.operatorId is repaired automatically.
   * - If an operator is in Firestore but not in Sheets:
   *     - Has userId → kept as orphan (cannot safely delete a user-linked record)
   *     - No userId  → deleted (safe mirror cleanup)
   *
   * @param configId - The system configuration ID to sync to
   */
  async syncOperatorsFromSheets(configId: string): Promise<void> {
    try {
      logger.info(`Starting name-based sync from Sheets to config ${configId}...`);
      const incomingOps = await this.sheetsService.fetchOperators();
      // incomingOps[i].id is now a stable slug (e.g. "vasile-chifeac")

      const operatorsRef = collection(db, 'systemConfigurations', configId, 'operators');
      const usersRef = collection(db, 'users');

      // --- Build reconciliation maps from current Firestore state ---
      const currentSnap = await getDocs(operatorsRef);

      // Map: docId → { name, userId }
      const byId = new Map<string, { name: string; userId?: string }>();
      // Map: normalizedName → docId  (for finding legacy op-N by name)
      const byNormalizedName = new Map<string, string>();

      for (const d of currentSnap.docs) {
        const data = d.data() as Operator & { userId?: string };
        byId.set(d.id, { name: data.name, ...(data.userId ? { userId: data.userId } : {}) });
        byNormalizedName.set((data.name || '').toUpperCase().trim(), d.id);
      }

      // Set of incoming slugs — used later for orphan detection
      const incomingSlugs = new Set(incomingOps.map((op) => op.id));

      // Batches (Firestore max 500 ops per batch — split if needed)
      const opsBatch = writeBatch(db);
      const usersBatch = writeBatch(db);
      let userMigrationsCount = 0;

      for (const op of incomingOps) {
        const slug = op.id; // already a stable slug from GoogleSheetsService
        const normalizedName = op.name.toUpperCase().trim();

        if (byId.has(slug)) {
          // --- CASE A: document with slug already exists → update schedule, preserve userId ---
          const existing = byId.get(slug)!;
          opsBatch.set(
            doc(operatorsRef, slug),
            {
              name: op.name,
              schedule: op.schedule,
              email: op.email ?? existing.name, // keep fields that may exist
              phone: op.phone,
              lastSync: serverTimestamp(),
              // userId is intentionally NOT included here — merge:true preserves it
            },
            { merge: true },
          );
        } else {
          // Check if a legacy document (op-N) with the same name exists
          const legacyDocId = byNormalizedName.get(normalizedName);

          if (legacyDocId) {
            // --- CASE B: legacy op-N found by name → migrate to slug, repair user links ---
            const legacyData = byId.get(legacyDocId)!;
            const preservedUserId = legacyData.userId;

            // 1. Create new slug document, carrying over userId from legacy
            opsBatch.set(doc(operatorsRef, slug), {
              ...op,
              ...(preservedUserId ? { userId: preservedUserId } : {}),
              lastSync: serverTimestamp(),
            });

            // 2. Delete the old legacy document
            opsBatch.delete(doc(operatorsRef, legacyDocId));

            // 3. Repair all users that pointed to the old legacy ID.
            // Use set+merge so it never throws even if the user doc is missing (e.g. SuperAdmin
            // accounts created outside the normal registration flow).
            if (preservedUserId) {
              usersBatch.set(doc(usersRef, preservedUserId), {
                operatorId: slug,
                updatedAt: Date.now(),
              }, { merge: true });
              userMigrationsCount++;
              logger.info('Migrating legacy operator ID → slug', {
                legacyId: legacyDocId,
                newSlug: slug,
              });
            }
          } else {
            // --- CASE C: completely new operator not in Firestore yet → create ---
            opsBatch.set(doc(operatorsRef, slug), {
              ...op,
              lastSync: serverTimestamp(),
            });
          }
        }
      }

      // --- Orphan cleanup: Firestore operators not present in the incoming sheet ---
      for (const [docId, data] of byId) {
        if (!incomingSlugs.has(docId)) {
          if (data.userId) {
            // Has a user linked — do NOT delete, log a warning instead
            logger.warn('Orphaned operator with userId — skipping deletion to preserve user link', {
              docId,
            });
          } else {
            // Safe to delete — no user is connected
            opsBatch.delete(doc(operatorsRef, docId));
          }
        }
      }

      // Commit operators first, then user pointer repairs
      await opsBatch.commit();
      if (userMigrationsCount > 0) {
        await usersBatch.commit();
        logger.info(`Repaired ${userMigrationsCount} user operatorId pointer(s) during sync.`);
      }

      // Clear cache to force refresh in UI
      const scheduleStore = useScheduleStore();
      scheduleStore.clearCache();

      logger.info(`Sync complete for config ${configId}: ${incomingOps.length} operators processed, ${userMigrationsCount} user(s) healed.`);
    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  } /*end syncOperatorsFromSheets*/

  /**
   * Syncs a single operator's schedule from Sheets to Firestore.
   * @param configId - The system configuration ID
   * @param operatorId - The ID of the operator to sync
   */
  async syncIndividualOperator(configId: string, operatorId: string): Promise<void> {
    const authStore = useAuthStore();
    try {
      logger.info(`Starting individual sync for operator ${operatorId} in config ${configId}...`);

      // We still need to fetch all to find the specific one by name or fuzzy index
      // Alternatively, GoogleSheetsService could be optimized, but for now we fetch and filter
      const allOperators = await this.sheetsService.fetchOperators();

      // Find the operator in the fresh data from Sheets
      // We use name matching since IDs are generated from row indices and might shift
      const firestoreOpRef = doc(db, 'systemConfigurations', configId, 'operators', operatorId);
      const currentOpSnap = await getDoc(firestoreOpRef);

      if (!currentOpSnap.exists()) {
        throw new Error(`Operator ${operatorId} not found in Firestore`);
      }

      const currentOpData = currentOpSnap.data() as Operator & { userId?: string };
      const freshOpData = allOperators.find((op) => op.name === currentOpData.name);

      if (!freshOpData) {
        throw new Error(`Operator ${currentOpData.name} not found in Google Sheets`);
      }

      // Update Firestore with the fresh schedule and other data
      const updateData: Partial<Operator & { userId?: string | null; lastSync: FieldValue }> = {
        ...freshOpData,
        lastSync: serverTimestamp(),
      };

      // Only "claim" the operator if the current user IS this operator
      // This prevents admins from accidentally "stealing" ownership during maintenance
      if (
        !currentOpData.userId &&
        authStore.currentUser?.uid &&
        authStore.currentUser?.operatorId === operatorId
      ) {
        updateData.userId = authStore.currentUser.uid;
      }

      await writeBatch(db).set(firestoreOpRef, updateData, { merge: true }).commit();

      // Clear cache to force refresh in UI
      const scheduleStore = useScheduleStore();
      scheduleStore.clearCache();

      logger.info(`Successfully synced schedule for ${currentOpData.name}`);
    } catch (error) {
      logger.error('Individual sync failed', error);
      throw error;
    }
  }

  /**
   * Retrieves an operator by ID from Firestore.
   * @deprecated Use OperatorsService.getOperatorById(configId, operatorId) instead
   */
  getOperator(): null {
    // This method is now deprecated - operators are in sub-collections
    // Use OperatorsService.getOperatorById() instead
    logger.warn('getOperator is deprecated. Use OperatorsService.getOperatorById() instead.');
    return null;
  }

  /**
   * Validates if a request is still valid based on current data.
   */
  async validateRequest(requestId: string): Promise<boolean> {
    const docRef = doc(db, 'requests', requestId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;

    const data = docSnap.data() as ShiftRequest;
    return data.status === 'OPEN';
  }

  /**
   * Pushes a single shift update to Google Sheets
   * Used when an offer is accepted or a request is approved.
   */
  async syncShiftUpdate(operatorName: string, date: string, newShift: string, note?: string): Promise<boolean> {
    try {
      return await this.sheetsService.updateShiftOnSheets(operatorName, date, newShift, note);
    } catch (error) {
      logger.error('Failed to sync shift update to Sheets', error);
      return false;
    }
  }
}
