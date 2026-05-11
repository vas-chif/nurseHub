/**
 * @file useAdminRequests.ts
 * @description Composable for admin management of absence/shift-request documents.
 *   Handles Firestore real-time subscription, approval flow, rejection flow,
 *   bulk actions, archive management, and helper utilities.
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @notes
 * - Extracted from AdminRequestsPage.vue (§1.11 decomposition).
 * - All state is local to the composable instance (not shared via Pinia).
 *   Import in the page component and pass reactive refs as props to sub-components.
 * - Depends on: useConfigStore, useAuthStore, useNotificationStore, useShiftLogic.
 * @dependencies
 * - firebase/firestore
 * - quasar (useQuasar, date)
 * - src/services/NotificationService
 * - src/services/GoogleSheetsService, SyncService
 */

import { ref, computed } from 'vue';
import { useQuasar, date as dateUtil } from 'quasar';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useConfigStore } from '../stores/configStore';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import { useShiftLogic } from './useShiftLogic';
import { notifyUser } from '../services/NotificationService';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { SyncService } from '../services/SyncService';
import { DEFAULT_SHEETS_CONFIG } from '../config/sheets';
import { operatorsService } from '../services/OperatorsService';
import { formatToItalian } from '../utils/dateUtils';
import { useSecureLogger } from '../utils/secureLogger';
import type { ShiftRequest, ShiftCode, Operator } from '../types/models';

const logger = useSecureLogger();

/**
 * Composable for admin requests management.
 * Call once per page instance.
 */
export function useAdminRequests() {
  const $q = useQuasar();
  const authStore = useAuthStore();
  const configStore = useConfigStore();
  const syncStore = useSyncStore();
  const notificationStore = useNotificationStore();
  const { isRequestExpired } = useShiftLogic();

  // --- State ---
  const loading = ref(false);
  const requests = ref<ShiftRequest[]>([]);
  const operators = ref<Record<string, Operator>>({});
  const userNames = ref<Record<string, string>>({});
  const selectedRequests = ref<string[]>([]);

  // Filters & sort
  const filters = ref({ dateFrom: '', dateTo: '', operators: [] as string[], withOffers: false });
  type SortOption = 'date-asc' | 'date-desc' | 'name' | 'created';
  const sortBy = ref<SortOption>('created');
  const sortOptions = [
    { label: 'Data (crescente)', value: 'date-asc' },
    { label: 'Data (decrescente)', value: 'date-desc' },
    { label: 'Nome Operatore', value: 'name' },
    { label: 'Più recenti', value: 'created' },
  ];

  // Reject dialog
  const showRejectDialog = ref(false);
  const rejectionReason = ref('');
  const requestToReject = ref<ShiftRequest | null>(null);
  const isBulkReject = ref(false);

  // Approval dialog
  const showApprovalDialog = ref(false);
  const syncMode = ref<'auto' | 'manual'>('auto');
  const adminApprovalNote = ref('');
  const approvalContext = ref<{
    req: ShiftRequest;
    offer?: {
      id: string;
      operatorId?: string | undefined;
      operatorName?: string | undefined;
      scenarioLabel?: string | undefined;
      roleLabel?: string | undefined;
    };
  } | null>(null);

  // Conflict handling
  const showConflictDialog = ref(false);
  const conflicts = ref<{ operatorName: string; date: string; expected: string; actual: string }[]>(
    [],
  );
  const isVerifying = ref(false);

  let unsubscribeRequests: (() => void) | undefined;

  // --- Computed ---

  const operatorOptions = computed(() =>
    Object.values(operators.value).map((op) => ({ label: op.name, value: op.id })),
  );

  function applyFilters(reqs: ShiftRequest[]): ShiftRequest[] {
    let filtered = [...reqs];
    if (configStore.activeConfigId) {
      filtered = filtered.filter((r) => r.configId === configStore.activeConfigId);
    }
    if (filters.value.dateFrom) filtered = filtered.filter((r) => r.date >= filters.value.dateFrom);
    if (filters.value.dateTo) filtered = filtered.filter((r) => r.date <= filters.value.dateTo);
    if (filters.value.operators.length > 0) {
      filtered = filtered.filter((r) => {
        const opId = r.absentOperatorId || r.creatorId;
        return filters.value.operators.includes(opId);
      });
    }
    if (filters.value.withOffers) {
      filtered = filtered.filter((r) => (r.offers?.length ?? 0) > 0);
    }
    if (sortBy.value === 'date-asc') filtered.sort((a, b) => a.date.localeCompare(b.date));
    else if (sortBy.value === 'date-desc') filtered.sort((a, b) => b.date.localeCompare(a.date));
    else if (sortBy.value === 'name') {
      filtered.sort((a, b) =>
        getOperatorName(a.creatorId).localeCompare(getOperatorName(b.creatorId)),
      );
    } else {
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
    return filtered;
  } /*end applyFilters*/

  const filteredPendingRequests = computed(() =>
    applyFilters(requests.value.filter((r) => r.status === 'OPEN')),
  );
  const filteredHistoryRequests = computed(() =>
    applyFilters(requests.value.filter((r) => r.status !== 'OPEN')),
  );

  const cutoffDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0] ?? '';
  })();

  const visibleHistoryRequests = computed(() => {
    const uid = authStore.currentUser?.uid;
    return filteredHistoryRequests.value.filter((req) => {
      const isHidden = uid ? (req.hiddenBy?.includes(uid) ?? false) : false;
      return !isHidden && req.date >= cutoffDate;
    });
  });

  const archivedRequests = computed(() =>
    requests.value.filter((req) => req.status !== 'OPEN' && req.date < cutoffDate),
  );

  const archiveStorageLevel = computed(() => Math.min(archivedRequests.value.length / 100, 1));

  const storageColor = computed(() => {
    if (archiveStorageLevel.value > 0.8) return 'negative';
    if (archiveStorageLevel.value > 0.5) return 'warning';
    return 'positive';
  });

  // --- Helpers ---

  function getOperatorName(id?: string, req?: ShiftRequest): string {
    if (!id) return 'Utente Sconosciuto';
    if (req) {
      if (
        id === req.absentOperatorId &&
        req.absentOperatorName &&
        req.absentOperatorName !== 'Operatore'
      )
        return req.absentOperatorName;
      if (id === req.creatorId && req.creatorName && req.creatorName !== 'Utente')
        return req.creatorName;
    }
    const op = operators.value[id];
    if (op?.name) return op.name;
    const uName = userNames.value[id];
    if (uName) return uName;
    if (req && id === req.absentOperatorId && req.creatorName && req.creatorName !== 'Utente')
      return req.creatorName;
    return 'Operatore';
  } /*end getOperatorName*/

  function getOperatorInitials(id?: string, req?: ShiftRequest): string {
    return getOperatorName(id, req).slice(0, 2).toUpperCase();
  }

  function getAdminName(adminId: string): string {
    if (!adminId) return 'Admin';
    return userNames.value[adminId] || `Admin (${adminId})`;
  }

  function formatDate(ts: number | string | undefined): string {
    return formatToItalian(ts);
  }

  function formatFullDate(ts: number | string | undefined): string {
    if (!ts) return '';
    return dateUtil.formatDate(ts, 'DD/MM/YYYY HH:mm');
  }

  function getShiftColor(code: ShiftCode): string {
    const map: Record<string, string> = { M: 'amber-8', P: 'orange-8', N: 'blue-10', R: 'green' };
    return map[code] ?? 'grey';
  }

  function getStatusColor(req: ShiftRequest): string {
    if (req.status === 'OPEN' && isRequestExpired(req.date, req.originalShift)) return 'negative';
    const map: Record<string, string> = {
      CLOSED: 'positive',
      EXPIRED: 'negative',
      PARTIAL: 'warning',
      OPEN: 'primary',
    };
    return map[req.status] ?? 'grey';
  }

  function getStatusLabel(req: ShiftRequest): string {
    if (req.status === 'OPEN' && isRequestExpired(req.date, req.originalShift)) return 'SCADUTA';
    if (req.status === 'CLOSED' && req.rejectionReason) return 'RIFIUTATA';
    if (req.status === 'EXPIRED') return 'SCADUTA';
    return req.status;
  }

  function getActiveOffersCount(req: ShiftRequest): number {
    return req.offers?.filter((o) => !o.isRejected).length ?? 0;
  }

  function getResolutionDetails(req: ShiftRequest): { who: string; scenario: string } | null {
    if (req.status !== 'CLOSED') return null;

    // Priority 1: New Snapshot Metadata (Step 1.3)
    if (req.resolutionMetadata) {
      return {
        who: req.resolutionMetadata.substituteName || 'Admin',
        scenario: req.resolutionMetadata.scenarioLabel || 'Manuale',
      };
    }

    // Fallback: Legacy logic (lookup in offers)
    if (req.offers && req.offers.length > 0) {
      const accepted = req.acceptedOfferId
        ? req.offers.find((o) => o.id === req.acceptedOfferId)
        : req.approvalTimestamp
          ? req.offers.find(
              (o) => Math.abs((o.timestamp ?? 0) - (req.approvalTimestamp ?? 0)) < 5000,
            )
          : null;
      if (accepted)
        return {
          who: accepted.operatorName ?? 'Collega',
          scenario: accepted.scenarioLabel ?? 'Generico',
        };
    }
    return { who: 'Admin / Manuale', scenario: 'Gestione manuale' };
  }

  // --- Google Sheets sync ---

  async function syncToSheets(
    operatorName: string,
    date: string,
    newShift: string,
    note?: string,
  ): Promise<void> {
    if (!configStore.activeConfigId) return;
    const appConfig = {
      ...DEFAULT_SHEETS_CONFIG,
      spreadsheetUrl:
        configStore.activeConfig?.spreadsheetUrl ?? DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
      gasWebUrl: configStore.activeConfig?.gasWebUrl ?? '',
    };
    const sheetsService = new GoogleSheetsService(appConfig);
    const syncService = new SyncService(sheetsService);
    try {
      await syncService.syncShiftUpdate(operatorName, date, newShift, note);
      logger.info('Synced shift update to Sheets', { date, newShift });
    } catch (e) {
      logger.error('Failed to sync to sheets', e);
    }
  } /*end syncToSheets*/

  // --- Data Loading ---

  async function fetchOperators(): Promise<void> {
    if (!configStore.activeConfigId) return;
    try {
      const list = await operatorsService.getOperatorsByConfig(configStore.activeConfigId);
      list.forEach((op) => {
        operators.value[op.id] = op;
      });
    } catch (e) {
      logger.error('Error fetching operators', e);
    }
  } /*end fetchOperators*/

  async function fetchUsersMap(): Promise<void> {
    try {
      const snapshot = await getDocs(query(collection(db, 'users')));
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const fullName = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();
        userNames.value[docSnap.id] = fullName || d.email || docSnap.id;
      });
    } catch (e) {
      logger.error('Error fetching users map', e);
    }
  } /*end fetchUsersMap*/

  function initRealtimeRequests(): void {
    if (unsubscribeRequests) {
      unsubscribeRequests();
    }

    loading.value = true;
    let q;
    if (authStore.isSuperAdmin) {
      q = query(collection(db, 'shiftRequests'));
    } else if (authStore.isAdmin && authStore.managedConfigIds.length > 0) {
      q = query(
        collection(db, 'shiftRequests'),
        where('configId', 'in', authStore.managedConfigIds),
      );
    } else if (authStore.currentUser?.configId) {
      q = query(
        collection(db, 'shiftRequests'),
        where('configId', '==', authStore.currentUser.configId),
      );
    } else {
      loading.value = false;
      return;
    }

    unsubscribeRequests = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ShiftRequest[] = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ShiftRequest,
        );
        loaded.sort((a, b) => b.createdAt - a.createdAt);

        if (!loading.value) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const nd = change.doc.data() as ShiftRequest;
              if (nd.status === 'OPEN') {
                $q.notify({
                  message: `Nuova richiesta da ${getOperatorName(nd.absentOperatorId ?? nd.creatorId, nd)}`,
                  color: 'primary',
                  icon: 'notifications',
                  position: 'top',
                });
                notificationStore.incrementUnread();
              }
            }
          });
        }

        const pendingCount = loaded.filter((r) => r.status === 'OPEN').length;
        requests.value = loaded;
        notificationStore.setPendingRequestsCount(pendingCount);
        loading.value = false;
      },
      (error) => {
        logger.error('Snapshot error', error);
        loading.value = false;
        $q.notify({ type: 'negative', message: 'Errore real-time: ricarica la pagina' });
      },
    );
  } /*end initRealtimeRequests*/

  function stopRealtimeRequests(): void {
    if (unsubscribeRequests) unsubscribeRequests();
  } /*end stopRealtimeRequests*/

  // --- Actions ---

  function rejectRequest(req: ShiftRequest): void {
    requestToReject.value = req;
    isBulkReject.value = false;
    rejectionReason.value = '';
    showRejectDialog.value = true;
  }

  async function confirmReject(): Promise<void> {
    if (!rejectionReason.value) return;
    loading.value = true;
    try {
      if (isBulkReject.value) {
        const batch = writeBatch(db);
        for (const reqId of selectedRequests.value) {
          batch.update(doc(db, 'shiftRequests', reqId), {
            status: 'CLOSED',
            rejectionReason: rejectionReason.value,
            rejectionTimestamp: Date.now(),
            adminId: authStore.currentUser?.uid,
          });
        }
        await batch.commit();
        selectedRequests.value = [];
      } else {
        if (!requestToReject.value) return;
        await updateDoc(doc(db, 'shiftRequests', requestToReject.value.id), {
          status: 'CLOSED',
          rejectionReason: rejectionReason.value,
          rejectionTimestamp: Date.now(),
          adminId: authStore.currentUser?.uid,
        });
        await notifyUser(
          requestToReject.value.creatorId,
          'REQUEST_REJECTED',
          `Rifiutata: ${rejectionReason.value}`,
          requestToReject.value.id,
        );
      }
      showRejectDialog.value = false;
      $q.notify({ type: 'warning', message: 'Richiesta Rifiutata' });
    } catch (e) {
      logger.error('Error rejecting', e);
    } finally {
      loading.value = false;
    }
  } /*end confirmReject*/

  async function closeAsExpired(req: ShiftRequest): Promise<void> {
    try {
      await updateDoc(doc(db, 'shiftRequests', req.id), { status: 'EXPIRED' });
      $q.notify({ type: 'info', message: 'Richiesta segnata come scaduta' });
    } catch (e) {
      logger.error('Error closing as expired', e);
    }
  }

  function approveRequest(req: ShiftRequest): void {
    // Safety check: Cannot approve expired requests
    if (isRequestExpired(req.date, req.originalShift)) {
      $q.notify({
        type: 'negative',
        message: 'Impossibile approvare: il turno è già iniziato o passato.',
      });
      return;
    }

    approvalContext.value = { req };
    syncMode.value = 'auto';
    adminApprovalNote.value = '';
    showApprovalDialog.value = true;
  }

  function acceptOffer(requestId: string, offerId: string): void {
    const req = requests.value.find((r) => r.id === requestId);
    if (!req) return;
    const offer = req.offers?.find((o) => o.id === offerId);
    if (!offer) return;
    approvalContext.value = {
      req,
      offer: {
        id: offer.id,
        operatorId: offer.operatorId,
        operatorName: offer.operatorName,
        scenarioLabel: offer.scenarioLabel,
        roleLabel: offer.roleLabel,
      },
    };
    syncMode.value = 'auto';
    adminApprovalNote.value = '';
    showApprovalDialog.value = true;
  }

  async function startApprovalVerification(): Promise<void> {
    if (!approvalContext.value) return;
    const { req, offer } = approvalContext.value;
    isVerifying.value = true;
    conflicts.value = [];

    try {
      // 1. Fetch fresh data from Sheets
      const appConfig = {
        ...DEFAULT_SHEETS_CONFIG,
        spreadsheetUrl:
          configStore.activeConfig?.spreadsheetUrl ?? DEFAULT_SHEETS_CONFIG.spreadsheetUrl,
        gasWebUrl: configStore.activeConfig?.gasWebUrl ?? '',
      };
      const sheetsService = new GoogleSheetsService(appConfig);
      const freshOperators = await sheetsService.fetchOperators();
      const opMap = Object.fromEntries(freshOperators.map((op) => [op.id, op]));

      // 2. Check Absent Operator
      if (req.absentOperatorId) {
        const freshOp = opMap[req.absentOperatorId];
        const actualShift = freshOp?.schedule?.[req.date] || 'R';
        if (actualShift !== req.originalShift) {
          conflicts.value.push({
            operatorName: freshOp?.name || req.absentOperatorName || 'Assente',
            date: req.date,
            expected: req.originalShift,
            actual: actualShift,
          });
        }
      }

      // 3. Check Substitute (if present)
      if (offer?.operatorId) {
        const freshOp = opMap[offer.operatorId];
        const actualShift = freshOp?.schedule?.[req.date] || 'R';
        // We expect the substitute to be in 'R' or a specific shift defined by logic
        // For simplicity, we check if it matches what our app currently thinks they have
        const expectedShift = operators.value[offer.operatorId]?.schedule?.[req.date] || 'R';

        if (actualShift !== expectedShift) {
          conflicts.value.push({
            operatorName: freshOp?.name || offer.operatorName || 'Sostituto',
            date: req.date,
            expected: expectedShift,
            actual: actualShift,
          });
        }
      }

      if (conflicts.value.length > 0) {
        showConflictDialog.value = true;
      } else {
        // No conflicts, proceed to execution
        await processApproval();
      }
    } catch (e) {
      logger.error('Verification Error', e);
      $q.notify({ type: 'negative', message: 'Errore durante la verifica con Excel' });
    } finally {
      isVerifying.value = false;
    }
  }

  async function processApproval(forceMode: 'auto' | 'manual' | 'force' = 'auto'): Promise<void> {
    if (!approvalContext.value) return;
    const { req, offer } = approvalContext.value;

    // Final safety check before commit
    if (isRequestExpired(req.date, req.originalShift)) {
      $q.notify({
        type: 'negative',
        message: 'Errore: La richiesta è scaduta durante elaborazione.',
      });
      showConflictDialog.value = false;
      return;
    }

    const nextDate = dateUtil.formatDate(dateUtil.addToDate(req.date, { days: 1 }), 'YYYY-MM-DD');
    loading.value = true;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'shiftRequests', req.id), {
        status: 'CLOSED',
        approvalTimestamp: Date.now(),
        adminId: authStore.currentUser?.uid,
        ...(offer ? { acceptedOfferId: offer.id } : {}),
      });
      if (req.absentOperatorId && configStore.activeConfigId) {
        batch.update(
          doc(
            db,
            'systemConfigurations',
            configStore.activeConfigId,
            'operators',
            req.absentOperatorId,
          ),
          { [`schedule.${req.date}`]: 'A' },
        );
      }
      if (offer?.operatorId && configStore.activeConfigId) {
        const updates: Record<string, string> = { [`schedule.${req.date}`]: req.originalShift };
        if (req.originalShift === 'N') {
          updates[`schedule.${nextDate}`] = 'S';
        }
        batch.update(
          doc(
            db,
            'systemConfigurations',
            configStore.activeConfigId,
            'operators',
            offer.operatorId,
          ),
          updates,
        );
      }
      await batch.commit();

      const notificationMsg = offer
        ? `La tua richiesta per il ${req.date} è stata coperta da ${offer.operatorName}`
        : `La tua richiesta per il ${req.date} è stata approvata.`;
      await notifyUser(
        req.creatorId,
        offer ? 'OFFER_ACCEPTED' : 'REQUEST_APPROVED',
        notificationMsg,
        req.id,
      );

      if (offer?.operatorId) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const subDoc = usersSnap.docs.find((d) => d.data().operatorId === offer.operatorId);
        if (subDoc) {
          await notifyUser(
            subDoc.id,
            'OFFER_ACCEPTED',
            `La tua offerta di sostituzione per il ${req.date} è stata accettata!`,
            req.id,
          );
        }
      }

      if (forceMode !== 'manual' && syncMode.value === 'auto') {
        const adminName = authStore.currentUser
          ? `${authStore.currentUser.firstName || ''} ${authStore.currentUser.lastName || ''}`.trim()
          : 'Admin';
        const separator = '-------------------------';

        const scenarioInfo = offer?.scenarioLabel
          ? `📋 Scenario: ${offer.scenarioLabel}`
          : forceMode === 'force'
            ? '📋 Scenario: Gestione Forzata'
            : '';
        const roleInfo = offer?.roleLabel ? `📍 Ruolo: ${offer.roleLabel}` : '';

        if (req.absentOperatorId) {
          const absName = operators.value[req.absentOperatorId]?.name || req.absentOperatorName;
          const fullNote = [
            separator,
            `👤 Operatore: ${absName}`,
            req.requestNote ? `📝 Nota Op: ${req.requestNote}` : '',
            offer ? `🤝 Sostituito da: ${offer.operatorName}` : '',
            scenarioInfo,
            roleInfo,
            adminApprovalNote.value ? `✍️ Nota Admin: ${adminApprovalNote.value}` : '',
            `✅ Approvato da: ${adminName}`,
          ]
            .filter(Boolean)
            .join('\n');

          if (absName) void syncToSheets(absName, req.date, 'A', fullNote);
        }

        if (offer?.operatorName) {
          const fullNote = [
            separator,
            `🛡️ Copertura: ${offer.operatorName}`,
            req.requestNote ? `📝 Nota Op: ${req.requestNote}` : '',
            scenarioInfo,
            roleInfo,
            adminApprovalNote.value ? `✍️ Nota Admin: ${adminApprovalNote.value}` : '',
            `✅ Approvato da: ${adminName}`,
          ]
            .filter(Boolean)
            .join('\n');

          void syncToSheets(offer.operatorName, req.date, req.originalShift, fullNote);

          if (req.originalShift === 'N') {
            void syncToSheets(
              offer.operatorName,
              nextDate,
              'S',
              `${separator}\n💤 Smonto automatico post-notte\n${scenarioInfo}\n${roleInfo}\n✅ Approvato da: ${adminName}`.trim(),
            );
          }
        }
      }

      // 1.3 Snapshot di Chiusura (Storico)
      const resolution = {
        substituteId: offer?.operatorId || null,
        substituteName: offer?.operatorName || (forceMode === 'manual' ? 'Manuale' : 'Admin'),
        scenarioLabel: offer?.scenarioLabel || (forceMode === 'force' ? 'Forzata' : 'Manuale'),
        closedBy: authStore.currentUser?.uid,
        closedAt: Date.now(),
      };

      await updateDoc(doc(db, 'shiftRequests', req.id), {
        resolutionMetadata: resolution,
      });

      showApprovalDialog.value = false;
      showConflictDialog.value = false;
      if (configStore.activeConfigId) {
        void syncStore.recordSync(configStore.activeConfigId);
      }
      $q.notify({
        type: 'positive',
        message:
          syncMode.value === 'auto'
            ? 'Approvata e sincronizzata con Excel'
            : 'Approvata (Sincronizzazione manuale richiesta)',
      });
    } catch (e) {
      logger.error('Approval Error', e);
      $q.notify({ type: 'negative', message: "Errore durante l'approvazione" });
    } finally {
      loading.value = false;
    }
  } /*end processApproval*/

  function rejectOffer(requestId: string, offerId: string): void {
    $q.dialog({
      title: 'Conferma Rifiuto',
      message: 'Rifiutare questa offerta?',
      cancel: true,
    }).onOk(() => {
      void (async () => {
        try {
          const req = requests.value.find((r) => r.id === requestId);
          if (!req?.offers) return;
          const updatedOffers = req.offers.map((o) =>
            o.id === offerId ? { ...o, isRejected: true } : o,
          );
          await updateDoc(doc(db, 'shiftRequests', requestId), { offers: updatedOffers });
          const rejectedOffer = req.offers.find((o) => o.id === offerId);
          if (rejectedOffer?.operatorId) {
            const snap = await getDocs(collection(db, 'users'));
            const sub = snap.docs.find((d) => d.data().operatorId === rejectedOffer.operatorId);
            if (sub) {
              await notifyUser(
                sub.id,
                'REQUEST_REJECTED',
                `La tua offerta di sostituzione per il ${req.date} purtroppo è stata rifiutata.`,
                req.id,
              );
            }
          }
          $q.notify({ type: 'info', message: 'Offerta rifiutata' });
        } catch (e) {
          logger.error('Error', e);
          $q.notify({ type: 'negative', message: 'Errore durante il rifiuto' });
        }
      })();
    });
  } /*end rejectOffer*/

  function bulkApprove(): void {
    $q.dialog({
      title: 'Conferma',
      message: `Approvare ${selectedRequests.value.length} richieste?`,
      cancel: true,
    }).onOk(() => {
      void (async () => {
        loading.value = true;
        try {
          const batch = writeBatch(db);
          for (const reqId of selectedRequests.value) {
            const req = requests.value.find((r) => r.id === reqId);
            if (!req) continue;
            batch.update(doc(db, 'shiftRequests', reqId), {
              status: 'CLOSED',
              approvalTimestamp: Date.now(),
              adminId: authStore.currentUser?.uid,
            });
            if (req.absentOperatorId && configStore.activeConfigId) {
              batch.update(
                doc(
                  db,
                  'systemConfigurations',
                  configStore.activeConfigId,
                  'operators',
                  req.absentOperatorId,
                ),
                { [`schedule.${req.date}`]: 'A' },
              );
            }
            await notifyUser(
              req.creatorId,
              'REQUEST_APPROVED',
              `Richiesta del ${req.date} approvata`,
              req.id,
            );
          }
          await batch.commit();
          selectedRequests.value = [];
          $q.notify({ type: 'positive', message: 'Richieste approvate!' });
        } catch (e) {
          logger.error('Error bulk approving', e);
          $q.notify({ type: 'negative', message: 'Errore durante approvazione multipla' });
        } finally {
          loading.value = false;
        }
      })();
    });
  } /*end bulkApprove*/

  function bulkReject(): void {
    isBulkReject.value = true;
    rejectionReason.value = '';
    showRejectDialog.value = true;
  }

  function archiveRequest(req: ShiftRequest): void {
    $q.dialog({
      title: 'Elimina Definitivamente',
      message:
        "Sei sicuro di voler eliminare definitivamente questa richiesta? L'azione non può essere annullata.",
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void (async () => {
        try {
          await deleteDoc(doc(db, 'shiftRequests', req.id));
          $q.notify({
            message: 'Richiesta eliminata definitivamente',
            color: 'info',
            icon: 'delete_forever',
          });
        } catch (e) {
          logger.error('Error', e);
          $q.notify({ type: 'negative', message: 'Errore durante eliminazione' });
        }
      })();
    });
  } /*end archiveRequest*/

  function emptyArchive(): void {
    if (archivedRequests.value.length === 0) return;
    $q.dialog({
      title: 'Svuota Archivio',
      message: `Vuoi eliminare definitivamente ${archivedRequests.value.length} richieste vecchie di oltre 3 mesi?`,
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void performEmptyArchive();
    });
  }

  async function performEmptyArchive(): Promise<void> {
    loading.value = true;
    try {
      const batch = writeBatch(db);
      archivedRequests.value.forEach((req) => {
        batch.delete(doc(db, 'shiftRequests', req.id));
      });
      await batch.commit();
      $q.notify({
        type: 'positive',
        message: 'Archivio svuotato con successo',
        icon: 'delete_forever',
      });
    } catch (e) {
      logger.error('Error', e);
      $q.notify({ type: 'negative', message: 'Errore durante lo svuotamento' });
    } finally {
      loading.value = false;
    }
  } /*end performEmptyArchive*/

  function callCandidate(phone?: string): void {
    if (!phone) {
      $q.notify({ type: 'warning', message: 'Numero di telefono non disponibile' });
      return;
    }
    window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
  }

  return {
    // State
    loading,
    requests,
    operators,
    userNames,
    selectedRequests,
    filters,
    sortBy,
    sortOptions,
    showRejectDialog,
    rejectionReason,
    requestToReject,
    isBulkReject,
    showApprovalDialog,
    syncMode,
    adminApprovalNote,
    approvalContext,
    showConflictDialog,
    conflicts,
    isVerifying,
    // Computed
    operatorOptions,
    filteredPendingRequests,
    filteredHistoryRequests,
    visibleHistoryRequests,
    archivedRequests,
    archiveStorageLevel,
    storageColor,
    // Helpers
    getOperatorName,
    getOperatorInitials,
    getAdminName,
    formatDate,
    formatFullDate,
    getShiftColor,
    getStatusColor,
    getStatusLabel,
    getActiveOffersCount,
    getResolutionDetails,
    // Actions
    fetchOperators,
    fetchUsersMap,
    initRealtimeRequests,
    stopRealtimeRequests,
    rejectRequest,
    confirmReject,
    approveRequest,
    acceptOffer,
    startApprovalVerification,
    processApproval,
    rejectOffer,
    bulkApprove,
    bulkReject,
    archiveRequest,
    emptyArchive,
    callCandidate,
    syncToSheets,
    closeAsExpired,
  };
} /*end useAdminRequests*/
