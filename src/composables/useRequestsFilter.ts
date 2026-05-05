/**
 * @file useRequestsFilter.ts
 * @description Composable for the user-facing dashboard shift-request feed.
 *   Handles Firestore real-time listeners, filtering, sorting, ignore/restore,
 *   and offer submission logic extracted from ActiveRequestsCard.vue (§1.11).
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @modified 2026-05-05
 * @notes
 * - §1.11 decomposition from ActiveRequestsCard.vue (was 690 lines).
 * - All state is local to the composable instance.
 * - Offer submission sends notification to admins via NotificationService.
 * @dependencies
 * - firebase/firestore
 * - quasar (useQuasar, date)
 * - src/composables/useShiftLogic
 * - src/stores/authStore, scenarioStore, configStore
 * - src/services/NotificationService
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useShiftLogic } from './useShiftLogic';
import { useScenarioStore } from '../stores/scenarioStore';
import type { ShiftRequest, ShiftCode, CompatibleScenario } from '../types/models';
import { useQuasar, date as qDate } from 'quasar';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

/**
 * Composable for dashboard request feed.
 * Registers Firestore listeners in onMounted and stops them in onUnmounted.
 * Must be called inside a component's setup().
 */
export function useRequestsFilter() {
  const authStore = useAuthStore();
  const scenarioStore = useScenarioStore();
  const { getCompatibleScenarios } = useShiftLogic();
  const $q = useQuasar();

  // ─── State ──────────────────────────────────────────────────────────────────
  const activeTab = ref('opportunities');
  const requests = ref<ShiftRequest[]>([]); // OPEN opportunities
  const historyRequests = ref<ShiftRequest[]>([]); // My submitted offers
  const loading = ref(true);

  const sortBy = ref<'created' | 'date'>('created');
  const sortOptions = [
    { label: 'Più recenti', value: 'created', icon: 'new_releases' },
    { label: 'Data Turno', value: 'date', icon: 'calendar_today' },
  ];

  // Offer dialog
  const offerDialog = ref({ show: false, req: null as ShiftRequest | null });
  const loadingCompatibility = ref(false);
  const compatibleScenarios = ref<CompatibleScenario[]>([]);
  const selectedScenario = ref<CompatibleScenario | null>(null);
  const isSubmitting = ref(false);

  let opportunitiesUnsub: Unsubscribe | null = null;
  let historyUnsub: Unsubscribe | null = null;

  // ─── Computed ───────────────────────────────────────────────────────────────

  /** Shifts ±2 days around the dialog target date for context display */
  const surroundingShifts = computed(() => {
    if (!offerDialog.value.req || !authStore.currentOperator) return [];
    const targetDate = new Date(offerDialog.value.req.date);
    const result = [];
    for (let i = -2; i <= 2; i++) {
      const d = qDate.addToDate(targetDate, { days: i });
      const dStr = qDate.formatDate(d, 'YYYY-MM-DD');
      result.push({
        date: dStr,
        label: i === 0 ? 'OGGI' : qDate.formatDate(d, 'DD/MM'),
        shift: authStore.currentOperator.schedule?.[dStr] ?? 'R',
        isTarget: i === 0,
      });
    }
    return result;
  }); /*end surroundingShifts*/

  /** Requests where this operator is explicitly called by name */
  const urgentRequests = computed(() => {
    const myOpId = authStore.currentOperator?.id;
    if (!myOpId) return [];
    return requests.value.filter((r) => r.candidateIds?.includes(myOpId));
  }); /*end urgentRequests*/

  /** Non-urgent, non-hidden opportunities sorted by user preference */
  const otherRequests = computed(() => {
    const myOpId = authStore.currentOperator?.id;
    const uid = authStore.currentUser?.uid;
    const filtered = requests.value.filter((r) => {
      const isUrgent = myOpId ? (r.candidateIds?.includes(myOpId) ?? false) : false;
      const isHidden = uid ? (r.hiddenBy?.includes(uid) ?? false) : false;
      return !isUrgent && !isHidden;
    });
    if (sortBy.value === 'created') {
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      filtered.sort((a, b) => a.date.localeCompare(b.date));
    }
    return filtered;
  }); /*end otherRequests*/

  /** Requests this user marked as "not interested" */
  const ignoredRequests = computed(() => {
    const uid = authStore.currentUser?.uid;
    if (!uid) return [];
    return requests.value.filter((r) => r.hiddenBy?.includes(uid));
  }); /*end ignoredRequests*/

  const myHistoryRequests = computed(() => historyRequests.value);

  // ─── Listeners ──────────────────────────────────────────────────────────────

  function stopListeners(): void {
    opportunitiesUnsub?.();
    historyUnsub?.();
  } /*end stopListeners*/

  async function initListeners(): Promise<void> {
    const myOpId = authStore.currentOperator?.id;
    const activeConfigId = authStore.currentUser?.configId;
    if (!myOpId || !activeConfigId) return;

    stopListeners();
    loading.value = true;

    await scenarioStore.loadScenarios(activeConfigId);

    if (activeTab.value === 'opportunities') {
      const { isRequestExpired } = useShiftLogic();
      const q = query(collection(db, 'shiftRequests'), where('status', '==', 'OPEN'));

      opportunitiesUnsub = onSnapshot(q, (snapshot) => {
        const loaded: ShiftRequest[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ShiftRequest;
          if (data.configId && data.configId !== activeConfigId) return;
          if (isRequestExpired(data.date, data.originalShift)) return;
          const isMine = data.absentOperatorId === myOpId;
          const alreadyOffered = data.offeringOperatorIds?.includes(myOpId) ?? false;
          if (!isMine && !alreadyOffered) {
            const opShift = authStore.currentOperator?.schedule?.[data.date] ?? 'R';
            const compatible = getCompatibleScenarios(
              data.originalShift,
              opShift,
              data.date,
              authStore.currentOperator?.schedule,
            );
            if (compatible && compatible.length > 0) {
              loaded.push({ ...data, id: docSnap.id });
            }
          }
        });
        requests.value = loaded;
        loading.value = false;
      }, (err) => {
        logger.error('Opportunities listener error', err);
        loading.value = false;
      });
    }

    if (activeTab.value === 'history') {
      const qHistory = query(
        collection(db, 'shiftRequests'),
        where('offeringOperatorIds', 'array-contains', myOpId),
        orderBy('createdAt', 'desc'),
      );
      historyUnsub = onSnapshot(qHistory, (snapshot) => {
        historyRequests.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftRequest));
        loading.value = false;
      }, (err) => {
        logger.error('History listener error', err);
        loading.value = false;
      });
    }
  } /*end initListeners*/

  async function refreshDashboard(): Promise<void> {
    loading.value = true;
    stopListeners();
    await initListeners();
    $q.notify({ type: 'info', message: 'Dati aggiornati', icon: 'refresh', timeout: 1000 });
  } /*end refreshDashboard*/

  // ─── Ignore / Restore ───────────────────────────────────────────────────────

  async function toggleInterest(reqId: string, interested: boolean): Promise<void> {
    const uid = authStore.currentUser?.uid;
    if (!uid) return;
    try {
      const reqRef = doc(db, 'shiftRequests', reqId);
      if (!interested) {
        await updateDoc(reqRef, { hiddenBy: arrayUnion(uid) });
        $q.notify({ message: 'Spostato nelle ignorate', color: 'grey-7', icon: 'visibility_off', timeout: 1000 });
      } else {
        await updateDoc(reqRef, { hiddenBy: arrayRemove(uid) });
        $q.notify({ message: 'Ripristinato', color: 'primary', icon: 'visibility', timeout: 1000 });
      }
    } catch (e) {
      logger.error('Error toggling interest', e);
    }
  } /*end toggleInterest*/

  // ─── Offer Dialog ───────────────────────────────────────────────────────────

  function openOfferDialog(req: ShiftRequest): void {
    offerDialog.value = { show: true, req };
    loadingCompatibility.value = true;
    compatibleScenarios.value = [];
    selectedScenario.value = null;
    if (authStore.currentOperator) {
      const opShift = authStore.currentOperator.schedule?.[req.date] ?? 'R';
      compatibleScenarios.value = getCompatibleScenarios(
        req.originalShift,
        opShift,
        req.date,
        authStore.currentOperator.schedule,
      );
    }
    loadingCompatibility.value = false;
  } /*end openOfferDialog*/

  async function submitOffer(): Promise<void> {
    if (!offerDialog.value.req || !selectedScenario.value || !authStore.currentOperator) return;
    isSubmitting.value = true;
    try {
      const reqRef = doc(db, 'shiftRequests', offerDialog.value.req.id);
      const offer = {
        id: `offer-${Date.now()}`,
        operatorId: authStore.currentOperator.id,
        operatorName: authStore.currentOperator.name,
        scenarioLabel: `${selectedScenario.value.scenarioLabel} - ${selectedScenario.value.roleLabel}`,
        timestamp: Date.now(),
      };
      await updateDoc(reqRef, {
        offers: arrayUnion(offer),
        offeringOperatorIds: arrayUnion(authStore.currentOperator.id),
      });

      // Notify admins asynchronously (non-blocking)
      const { useConfigStore } = await import('../stores/configStore');
      const activeConfigId = useConfigStore().activeConfigId;
      if (activeConfigId) {
        const { notifyAdmins } = await import('../services/NotificationService');
        notifyAdmins(
          `L'operatore ${authStore.currentOperator.name} si è offerto per coprire il turno: ${offerDialog.value.req.date}`,
          offerDialog.value.req.id,
          activeConfigId,
        ).catch((err) => logger.error('Error notifying admins', err));
      }

      $q.notify({ type: 'positive', message: 'Candidatura inviata! Ti faremo sapere presto.' });
      offerDialog.value.show = false;
    } catch (e) {
      logger.error('Error submitting offer', e);
      $q.notify({ type: 'negative', message: "Errore durante l'invio" });
    } finally {
      isSubmitting.value = false;
    }
  } /*end submitOffer*/

  // ─── Formatters ─────────────────────────────────────────────────────────────

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  } /*end formatDate*/

  function formatDateLong(dt: string): string {
    return qDate.formatDate(dt, 'DD MMMM YYYY', {
      months: [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
      ],
    });
  } /*end formatDateLong*/

  function getShiftColor(code: ShiftCode): string {
    switch (code) {
      case 'M': return 'amber-8';
      case 'P': return 'orange-8';
      case 'N': return 'blue-10';
      default: return 'grey';
    }
  } /*end getShiftColor*/

  function formatFullDate(ts: number | string | undefined): string {
    if (!ts) return '';
    return new Date(ts).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } /*end formatFullDate*/

  // ─── History Offer Helpers ───────────────────────────────────────────────────

  function getMyOffer(req: ShiftRequest) {
    const myOpId = authStore.currentOperator?.id;
    if (!myOpId || !req.offers) return null;
    return req.offers.find((o) => o.operatorId === myOpId) ?? null;
  } /*end getMyOffer*/

  function getMyOfferTimestamp(req: ShiftRequest): number | undefined {
    return getMyOffer(req)?.timestamp;
  }

  function getMyOfferLabel(req: ShiftRequest): string {
    return getMyOffer(req)?.scenarioLabel ?? '';
  }

  function getMyOfferStatusLabel(req: ShiftRequest): string {
    const myOpId = authStore.currentOperator?.id;
    if (!myOpId) return 'Sconosciuto';
    if (req.status === 'CLOSED') {
      const myOffer = getMyOffer(req);
      return myOffer && req.acceptedOfferId === myOffer.id
        ? 'Approvata - Assegnato a te'
        : 'Rifiutata / Coperta da altri';
    }
    if (req.status === 'EXPIRED') return 'Scaduta / Annullata';
    if (getMyOffer(req)?.isRejected) return "Rifiutata dall'Admin";
    return 'In Valutazione';
  } /*end getMyOfferStatusLabel*/

  function getMyOfferStatusColor(req: ShiftRequest): string {
    const label = getMyOfferStatusLabel(req);
    if (label.includes('Approvata')) return 'positive';
    if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta')) return 'negative';
    if (label.includes('Valutazione')) return 'warning';
    return 'primary';
  }

  function getMyOfferIcon(req: ShiftRequest): string {
    const label = getMyOfferStatusLabel(req);
    if (label.includes('Approvata')) return 'check_circle';
    if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta')) return 'cancel';
    return 'hourglass_empty';
  }

  function getMyOfferAvatarColor(req: ShiftRequest): string {
    const label = getMyOfferStatusLabel(req);
    if (label.includes('Approvata')) return 'positive';
    if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta')) return 'red-1';
    return 'grey-2';
  }

  function getMyOfferAvatarTextColor(req: ShiftRequest): string {
    const label = getMyOfferStatusLabel(req);
    if (label.includes('Approvata')) return 'white';
    if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta')) return 'negative';
    return 'grey-7';
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  onMounted(() => { void initListeners(); });
  onUnmounted(() => { stopListeners(); });
  watch(() => authStore.currentOperator, () => { void initListeners(); });
  watch(activeTab, () => { void initListeners(); });

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    // State
    activeTab, loading, requests, historyRequests, sortBy, sortOptions,
    offerDialog, loadingCompatibility, compatibleScenarios, selectedScenario, isSubmitting,
    // Computed
    surroundingShifts, urgentRequests, otherRequests, ignoredRequests, myHistoryRequests,
    // Actions
    toggleInterest, openOfferDialog, submitOffer, refreshDashboard,
    // Formatters
    formatDate, formatDateLong, getShiftColor, formatFullDate,
    // History helpers
    getMyOfferTimestamp, getMyOfferLabel, getMyOfferStatusLabel,
    getMyOfferStatusColor, getMyOfferIcon, getMyOfferAvatarColor, getMyOfferAvatarTextColor,
  };
} /*end useRequestsFilter*/
