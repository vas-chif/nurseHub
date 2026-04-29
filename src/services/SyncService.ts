/**
 * @file SyncService.ts
 * @description Orchestrates data synchronization between Google Sheets (Source of Truth) and Firestore.
 * @author Nurse Hub Team
 * @created 2026-02-15
 * @modified 2026-04-27
 * @notes
 * - Implements "Mirror Logic" for operators and schedules (Phase 25).
 * - Handles bulk batch writes and individual operator refreshes.
 * - Manages data ownership (UID-operator matching) during synchronization.
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
   * Performs a full sync from Sheets to Firestore.
   * Strategy: Sheets is the master for static data (Operators, Schedule).
   * Firestore is updated to reflect Sheets state.
   * @param configId - The system configuration ID to sync to
   */
  async syncOperatorsFromSheets(configId: string): Promise<void> {
    try {
      logger.info(`Starting sync from Sheets to config ${configId}...`);
      const operators = await this.sheetsService.fetchOperators();

      const batch = writeBatch(db);
      // Write to sub-collection: systemConfigurations/{configId}/operators
      const operatorsRef = collection(db, 'systemConfigurations', configId, 'operators');

      // Identify deletions (Phase 25 Mirror Logic)
      const currentSnap = await getDocs(operatorsRef);
      const existingIds = currentSnap.docs.map((d) => d.id);
      const incomingIds = new Set(operators.map((op) => op.id));

      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          batch.delete(doc(operatorsRef, id));
        }
      }

      // Upsert new/updated operators
      for (const op of operators) {
        const opDocRef = doc(operatorsRef, op.id);
        batch.set(
          opDocRef,
          {
            ...op,
            lastSync: serverTimestamp(),
          },
          { merge: true },
        );
      }

      await batch.commit();

      // Clear cache to force refresh in UI
      const scheduleStore = useScheduleStore();
      scheduleStore.clearCache();

      logger.info(`Synced ${operators.length} operators to config ${configId}.`);
    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  }

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
