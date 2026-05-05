/**
 * @file useAdminSwaps.ts
 * @description Composable for admin management of shift-swap (cambio turno) documents.
 *   Handles real-time subscription, approval/rejection flows, archive management.
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @notes
 * - Extracted from AdminRequestsPage.vue (§1.11 decomposition).
 * - Depends on syncToSheets utility passed in from useAdminRequests (or re-called via configStore).
 * @dependencies
 * - firebase/firestore
 * - quasar (useQuasar, date)
 * - src/services/NotificationService
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
  orderBy,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useConfigStore } from '../stores/configStore';
import { useAuthStore } from '../stores/authStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { notifyUser } from '../services/NotificationService';
import { useSecureLogger } from '../utils/secureLogger';
import type { ShiftSwap, Operator } from '../types/models';

const logger = useSecureLogger();

/**
 * Composable for admin swap management.
 * @param syncToSheets - Injected sync-to-sheets helper from useAdminRequests or standalone
 * @param operators - Reactive map of operators (shared from useAdminRequests)
 */
export function useAdminSwaps(
  syncToSheets: (operatorName: string, date: string, newShift: string, note?: string) => Promise<void>,
  operators: { value: Record<string, Operator> }
) {
  const $q = useQuasar();
  const authStore = useAuthStore();
  const configStore = useConfigStore();
  const scheduleStore = useScheduleStore();

  // --- State ---
  const rawSwaps = ref<ShiftSwap[]>([]);
  const swapLoading = ref(false);
  const showSwapApprovalDialog = ref(false);
  const swapSyncMode = ref<'auto' | 'manual'>('auto');
  const approvalSwapContext = ref<ShiftSwap | null>(null);

  let unsubscribeSwaps: (() => void) | undefined;

  // --- Computed ---

  const allSwaps = computed(() => {
    if (configStore.activeConfigId) {
      return rawSwaps.value.filter((s) => s.configId === configStore.activeConfigId);
    }
    return rawSwaps.value;
  });

  const pendingSwaps = computed(() => allSwaps.value.filter((s) => s.status === 'PENDING_ADMIN'));

  const archivedSwaps = computed(() => {
    const cutoffDate = dateUtil.formatDate(
      dateUtil.subtractFromDate(new Date(), { days: 90 }),
      'YYYY-MM-DD',
    );
    return allSwaps.value.filter((swap) => swap.status !== 'OPEN' && swap.date < cutoffDate);
  });

  const archiveSwapStorageLevel = computed(() => Math.min(archivedSwaps.value.length / 200, 1));

  const storageSwapColor = computed(() => {
    const level = archiveSwapStorageLevel.value;
    if (level > 0.8) return 'negative';
    if (level > 0.5) return 'warning';
    return 'primary';
  });

  // --- Real-time subscription ---

  function initRealtimeSwaps(): void {
    swapLoading.value = true;
    const colRef = collection(db, 'shiftSwaps');
    let q;
    if (authStore.isSuperAdmin) {
      q = query(colRef, orderBy('createdAt', 'desc'));
    } else if (authStore.isAdmin && authStore.managedConfigIds.length > 0) {
      q = query(colRef, where('configId', 'in', authStore.managedConfigIds), orderBy('createdAt', 'desc'));
    } else if (authStore.currentUser?.configId) {
      q = query(colRef, where('configId', '==', authStore.currentUser.configId), orderBy('createdAt', 'desc'));
    } else if (configStore.activeConfigId) {
      q = query(colRef, where('configId', '==', configStore.activeConfigId), orderBy('createdAt', 'desc'));
    } else {
      swapLoading.value = false;
      return;
    }

    unsubscribeSwaps = onSnapshot(
      q,
      (snapshot) => {
        rawSwaps.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftSwap));
        swapLoading.value = false;
      },
      (error) => {
        logger.error('Error loading swaps snapshot', error);
        swapLoading.value = false;
      },
    );
  } /*end initRealtimeSwaps*/

  function stopRealtimeSwaps(): void {
    if (unsubscribeSwaps) unsubscribeSwaps();
  }

  // --- Actions ---

  function approveSwap(swap: ShiftSwap): void {
    approvalSwapContext.value = swap;
    swapSyncMode.value = 'auto';
    showSwapApprovalDialog.value = true;
  }

  async function processSwapApproval(): Promise<void> {
    if (!approvalSwapContext.value) return;
    const swap = approvalSwapContext.value;
    swapLoading.value = true;

    try {
      await updateDoc(doc(db, 'shiftSwaps', swap.id), {
        status: 'APPROVED',
        adminId: authStore.currentUser?.uid,
        resolvedAt: Date.now(),
      });

      if (swap.creatorOperatorId && configStore.activeConfigId) {
        await updateDoc(
          doc(db, 'systemConfigurations', configStore.activeConfigId, 'operators', swap.creatorOperatorId),
          { [`schedule.${swap.date}`]: swap.desiredShift },
        );
      }
      if (swap.counterpartOperatorId && configStore.activeConfigId) {
        await updateDoc(
          doc(db, 'systemConfigurations', configStore.activeConfigId, 'operators', swap.counterpartOperatorId),
          { [`schedule.${swap.date}`]: swap.offeredShift },
        );
      }

      if (swapSyncMode.value === 'auto') {
        const creatorName = swap.creatorName ?? (swap.creatorOperatorId ? operators.value[swap.creatorOperatorId]?.name : '') ?? '';
        const counterName = swap.counterpartName ?? (swap.counterpartOperatorId ? operators.value[swap.counterpartOperatorId]?.name : '') ?? '';
        if (creatorName) void syncToSheets(creatorName, swap.date, swap.desiredShift);
        if (counterName) void syncToSheets(counterName, swap.date, swap.offeredShift);
      }

      if (configStore.activeConfigId) {
        void scheduleStore.loadOperators(configStore.activeConfigId, true);
      }

      const targetSwap = rawSwaps.value.find((s) => s.id === swap.id);
      if (targetSwap) targetSwap.status = 'APPROVED';

      void notifyUser(
        swap.creatorId,
        'SWAP_APPROVED',
        `Cambio Approvato! Il cambio turno del ${swap.date} (${swap.offeredShift} ↔ ${swap.desiredShift}) è stato approvato dal coordinatore.`,
        swap.id,
      );
      if (swap.counterpartId) {
        void notifyUser(
          swap.counterpartId,
          'SWAP_APPROVED',
          `Cambio Approvato! Il cambio turno del ${swap.date} (${swap.desiredShift} ↔ ${swap.offeredShift}) è stato approvato dal coordinatore.`,
          swap.id,
        );
      }

      showSwapApprovalDialog.value = false;
      $q.notify({
        type: 'positive',
        message: swapSyncMode.value === 'auto' ? 'Cambio approvato e sincronizzato con Excel!' : 'Cambio approvato (Sincronizzazione manuale richiesta)',
      });
    } catch (e) {
      logger.error('Error approving swap', e);
      $q.notify({ type: 'negative', message: "Errore durante l'approvazione" });
    } finally {
      swapLoading.value = false;
    }
  } /*end processSwapApproval*/

  function rejectSwap(swap: ShiftSwap): void {
    $q.dialog({
      title: 'Rifiuta Cambio Turno',
      message: 'Specifica il motivo del rifiuto:',
      prompt: { model: '', type: 'text', label: 'Motivazione' },
      cancel: true,
      persistent: true,
    }).onOk((adminNote: string) => {
      void (async () => {
        try {
          await updateDoc(doc(db, 'shiftSwaps', swap.id), {
            status: 'REJECTED',
            adminId: authStore.currentUser?.uid,
            adminNote: adminNote || "Rifiutato dall'admin",
            resolvedAt: Date.now(),
          });
          const targetSwap = rawSwaps.value.find((s) => s.id === swap.id);
          if (targetSwap) targetSwap.status = 'REJECTED';

          const noteText = adminNote ? ` Motivo: ${adminNote}` : '';
          void notifyUser(swap.creatorId, 'SWAP_REJECTED', `Cambio Rifiutato. Il cambio turno del ${swap.date} è stato rifiutato dal coordinatore.${noteText}`, swap.id);
          if (swap.counterpartId) {
            void notifyUser(swap.counterpartId, 'SWAP_REJECTED', `Cambio Rifiutato. Il cambio turno del ${swap.date} a cui avevi aderito è stato rifiutato dal coordinatore.${noteText}`, swap.id);
          }
          $q.notify({ type: 'info', message: 'Cambio turno rifiutato' });
        } catch (e) {
          logger.error('Error rejecting swap', e);
          $q.notify({ type: 'negative', message: 'Errore durante il rifiuto' });
        }
      })();
    });
  } /*end rejectSwap*/

  function emptySwapArchive(): void {
    if (archivedSwaps.value.length === 0) return;
    $q.dialog({
      title: 'Svuota Archivio Cambi',
      message: `Vuoi eliminare definitivamente ${archivedSwaps.value.length} cambi turno vecchi di oltre 3 mesi?`,
      cancel: true,
      persistent: true,
    }).onOk(() => {
      void performEmptySwapArchive();
    });
  }

  async function performEmptySwapArchive(): Promise<void> {
    swapLoading.value = true;
    try {
      const batch = writeBatch(db);
      archivedSwaps.value.forEach((swap) => { batch.delete(doc(db, 'shiftSwaps', swap.id)); });
      await batch.commit();
      $q.notify({ type: 'positive', message: 'Archivio Cambi svuotato con successo', icon: 'delete_forever' });
      rawSwaps.value = rawSwaps.value.filter((s) => !archivedSwaps.value.some((as) => as.id === s.id));
    } catch (e) {
      logger.error('Error emptying swap archive', e);
      $q.notify({ type: 'negative', message: 'Errore durante lo svuotamento' });
    } finally {
      swapLoading.value = false;
    }
  } /*end performEmptySwapArchive*/

  return {
    // State
    rawSwaps, swapLoading,
    showSwapApprovalDialog, swapSyncMode, approvalSwapContext,
    // Computed
    allSwaps, pendingSwaps, archivedSwaps, archiveSwapStorageLevel, storageSwapColor,
    // Actions
    initRealtimeSwaps, stopRealtimeSwaps,
    approveSwap, processSwapApproval, rejectSwap, emptySwapArchive,
  };
} /*end useAdminSwaps*/
