/**
 * @file UserRequestsPage.vue
 * @description Page for users to submit absence and shift swap requests.
 * @author Nurse Hub Team
 * @created 2026-02-15
 * @modified 2026-05-02
 * @notes
 * - Handles both absence and swap logic
 * - Integrated with push notifications
 * - Persistent tab state via uiStore
 */

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, watchEffect } from 'vue';
import { useQuasar, date as dateUtil } from 'quasar';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  writeBatch,
  getDocs,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import AbsenceRequestForm from '../components/requests/AbsenceRequestForm.vue';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { notifySwapProposed } from '../services/NotificationService';
import { useShiftLogic } from '../composables/useShiftLogic';
import type {
  ShiftRequest,
  ShiftCode,
  Operator,
  ShiftSwap,
  ShiftSwapStatus,
} from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import { useUiStore } from '../stores/uiStore';
import { useRoute } from 'vue-router';

const logger = useSecureLogger();

const itLocale = {
  days: 'Domenica_Lunedì_Martedì_Mercoledì_Giovedì_Venerdì_Sabato'.split('_'),
  daysShort: 'Dom_Lun_Mar_Mer_Gio_Ven_Sab'.split('_'),
  months: 'Gennaio_Febbraio_Marzo_Aprile_Maggio_Giugno_Luglio_Agosto_Settembre_Ottobre_Novembre_Dicembre'.split('_'),
  monthsShort: 'Gen_Feb_Mar_Apr_Mag_Giu_Lug_Ago_Set_Ott_Nov_Dic'.split('_'),
  firstDayOfWeek: 1,
  format24h: true,
  pluralDay: 'giorni'
};

const $q = useQuasar();
const route = useRoute();
const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const uiStore = useUiStore();
const { isRequestExpired } = useShiftLogic();
const loading = ref(false);
let unsubscribe: () => void;

// Page tab: absence | swap
const defaultTab = authStore.isAnyAdmin ? 'absence' : 'swap';
const savedTab = uiStore.getActiveTab(route.path, defaultTab) as 'absence' | 'swap';
const initialTab = (!authStore.isAnyAdmin && savedTab === 'absence') ? 'swap' : savedTab;
const pageTab = ref<'absence' | 'swap'>(initialTab);

// Watch and save tab changes
watch(pageTab, (newVal) => {
  uiStore.setActiveTab(route.path, newVal);
});

// Swap form state
const swapForm = ref({
  date: dateUtil.formatDate(new Date(), 'YYYY-MM-DD'),
  offeredShift: 'M' as ShiftCode,
  desiredShift: 'P' as ShiftCode,
});
const swapSubmitting = ref(false);
const mySwaps = ref<ShiftSwap[]>([]);

const swapShiftOptions = [
  { label: 'M - Mattina', value: 'M' },
  { label: 'P - Pomeriggio', value: 'P' },
  { label: 'N - Notte', value: 'N' },
  { label: 'S - Smonto', value: 'S' },
  { label: 'R - Riposo', value: 'R' },
];

function getSwapStatusColor(status: ShiftSwapStatus): string {
  const map: Record<ShiftSwapStatus, string> = {
    OPEN: 'primary',
    MATCHED: 'warning',
    PENDING_ADMIN: 'orange',
    APPROVED: 'positive',
    REJECTED: 'negative',
  };
  return map[status] || 'grey';
}
function getSwapStatusLabel(status: ShiftSwapStatus): string {
  const map: Record<ShiftSwapStatus, string> = {
    OPEN: 'Aperta',
    MATCHED: 'Accordo',
    PENDING_ADMIN: 'In revisione',
    APPROVED: 'Approvata',
    REJECTED: 'Rifiutata',
  };
  return map[status] || status;
}

async function submitSwap() {
  const uid = authStore.currentUser?.uid;
  const operatorId = authStore.currentOperator?.id;
  const configId = configStore.activeConfigId;
  if (!uid || !operatorId || !configId) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'sync_problem',
      message: 'Profilo non collegato',
      caption: 'Il tuo account non è ancora associato a un operatore. Vai nel Profilo e clicca su Sincronizza.',
      multiLine: true,
      progress: true,
    });
    return;
  }

  // VALIDAZIONE: Verifica che l'utente abbia effettivamente il turno che sta offrendo
  const realShift = authStore.currentOperator?.schedule?.[swapForm.value.date] || 'R';
  if (realShift !== swapForm.value.offeredShift) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'warning',
      message: 'Incongruenza Turno',
      caption: `Il ${formatDate(swapForm.value.date)} il tuo turno risulta essere "${realShift}". Non puoi offrire il turno "${swapForm.value.offeredShift}".`,
      multiLine: true,
      progress: true,
      actions: [{ icon: 'close', color: 'white', round: true, dense: true }]
    });
    return;
  }
  swapSubmitting.value = true;
  try {
    const creatorName =
      `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim() ||
      'Utente';
    const newSwap: Omit<ShiftSwap, 'id'> = {
      creatorId: uid,
      creatorOperatorId: operatorId,
      creatorName,
      configId,
      date: swapForm.value.date,
      offeredShift: swapForm.value.offeredShift,
      desiredShift: swapForm.value.desiredShift,
      status: 'OPEN',
      createdAt: Date.now(),
    };
    const docRef = await addDoc(collection(db, 'shiftSwaps'), newSwap);

    // Notify everyone (Admins + Eligible peers) in one go to prevent duplicates
    void notifySwapProposed(docRef.id, newSwap, configId);

    $q.notify({ type: 'positive', message: 'Proposta di cambio inviata!' });
    await loadMySwaps();
  } catch (e) {
    logger.error('Error submitting swap', e);
    $q.notify({ type: 'negative', message: "Errore durante l'invio della proposta" });
  } finally {
    swapSubmitting.value = false;
  }
}

async function loadMySwaps() {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;
  const q = query(
    collection(db, 'shiftSwaps'),
    where('creatorId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  mySwaps.value = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap)
    .filter((s) => s.deletedByCreator !== true);
}

function cancelSwap(swap: ShiftSwap) {
  $q.dialog({
    title: 'Cancella Proposta',
    message: `Sei sicuro di voler cancellare la proposta di cambio del ${formatDate(swap.date)}? (${swap.offeredShift} → ${swap.desiredShift})`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        const ref = doc(db, 'shiftSwaps', swap.id);
        if (swap.status === 'OPEN') {
          await deleteDoc(ref);
        } else {
          await updateDoc(ref, { deletedByCreator: true });
        }
        mySwaps.value = mySwaps.value.filter((s) => s.id !== swap.id);
        $q.notify({ type: 'info', message: 'Proposta cancellata', icon: 'delete' });
      } catch (e) {
        logger.error('Error cancelling swap', e);
        $q.notify({ type: 'negative', message: 'Errore durante la cancellazione' });
      }
    })();
  });
}

// Re-using the manualRefresh to trigger list reload after success
function onAbsenceSuccess() {
  void manualRefresh();
}

const requests = ref<ShiftRequest[]>([]);

const operators = ref<Record<string, Operator>>({});

// Archive Logic - Phase 18
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const cutoffDate = dateUtil.formatDate(threeMonthsAgo, 'YYYY-MM-DD');

const visibleRequests = computed(() => {
  if (!authStore.currentUser) return [];
  const uid = authStore.currentUser.uid;
  return requests.value.filter((req) => {
    const isHidden = req.hiddenBy?.includes(uid);
    const isArchived = req.date < cutoffDate;
    return !isHidden && !isArchived;
  });
});

const archivedRequests = computed(() => {
  return requests.value.filter((req) => req.date < cutoffDate);
});

const archiveStorageLevel = computed(() => {
  const count = archivedRequests.value.length;
  // Let's say 100 archived requests is "full" for visual bar
  return Math.min(count / 100, 1);
});

const storageColor = computed(() => {
  if (archiveStorageLevel.value > 0.8) return 'negative';
  if (archiveStorageLevel.value > 0.5) return 'warning';
  return 'positive';
});

onMounted(() => {
  // Ensure operators are loaded in the global store
  if (configStore.activeConfigId) {
    void scheduleStore.loadOperators(configStore.activeConfigId);
  }
  
  initRealtimeRequests();
  void loadMySwaps();
});

watchEffect(() => {
  const list = scheduleStore.operators;
  if (list.length > 0) {
    const record: Record<string, Operator> = {};
    list.forEach((op: Operator) => {
      record[op.id] = op;
    });
    operators.value = record;
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

function initRealtimeRequests() {
  if (!authStore.currentUser?.uid) return;
  loading.value = true;
  const q = query(
    collection(db, 'shiftRequests'),
    where('creatorId', '==', authStore.currentUser.uid),
    orderBy('createdAt', 'desc'),
  );

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      // Logic to detect changes for notifications
      if (!loading.value) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const newData = change.doc.data() as ShiftRequest;
            const oldData = requests.value.find((r) => r.id === change.doc.id);

            if (oldData && oldData.status !== newData.status) {
              $q.notify({
                message: `Stato richiesta del ${formatDate(newData.date)} aggiornato a: ${newData.status}`,
                color: newData.status === 'CLOSED' ? 'positive' : 'warning',
                icon: 'update',
                position: 'top',
              });
            }
          }
        });
      }

      requests.value = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest)
        .filter((r) => r.deletedByCreator !== true);
      loading.value = false;
    },
    (error) => {
      logger.error('Snapshot error', error);
      loading.value = false;
    },
  );
}

async function manualRefresh() {
  loading.value = true;
  if (unsubscribe) unsubscribe();
  initRealtimeRequests();
  await loadMySwaps();
  $q.notify({
    type: 'info',
    message: 'Dati aggiornati',
    icon: 'refresh',
    timeout: 1000
  });
}

// Phase 18/20/22: Delete Actions (Soft Delete)
function deleteRequest(req: ShiftRequest) {
  if (!authStore.currentUser) return;

  $q.dialog({
    title: 'Cancella Richiesta',
    message:
      "Sei sicuro di voler cancellare questa richiesta? L'azione rimuoverà la richiesta dalla tua lista.",
    cancel: true,
    persistent: true,
  }).onOk(() => {
    const performDelete = async () => {
      try {
        const ref = doc(db, 'shiftRequests', req.id);
        if (req.status === 'OPEN') {
          await deleteDoc(ref);
        } else {
          await updateDoc(ref, { deletedByCreator: true });
        }

        $q.notify({
          message: 'Richiesta cancellata',
          color: 'info',
          icon: 'delete',
        });
      } catch (e) {
        logger.error('Error deleting request', e);
        $q.notify({ type: 'negative', message: 'Errore durante eliminazione' });
      }
    };
    void performDelete();
  });
}

function emptyArchive() {
  if (archivedRequests.value.length === 0) return;

  $q.dialog({
    title: 'Svuota Archivio',
    message: `Vuoi eliminare definitivamente ${archivedRequests.value.length} richieste vecchie di oltre 3 mesi?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    performEmptyArchive();
  });
}

async function performEmptyArchive() {
  loading.value = true;
  try {
    const batch = writeBatch(db);
    archivedRequests.value.forEach((req) => {
      const ref = doc(db, 'shiftRequests', req.id);
      batch.delete(ref);
    });
    await batch.commit();
    $q.notify({
      type: 'positive',
      message: 'Archivio svuotato con successo',
      icon: 'delete_forever',
    });
  } catch (e) {
    logger.error('Error emptying archive', e);
    $q.notify({ type: 'negative', message: 'Errore durante lo svuotamento' });
  } finally {
    loading.value = false;
  }
}

function getResolutionDetails(req: ShiftRequest) {
  if (req.status !== 'CLOSED') return null;

  if (req.offers && req.offers.length > 0) {
    let accepted = null;
    if (req.acceptedOfferId) {
      accepted = req.offers.find((o) => o.id === req.acceptedOfferId);
    } else {
      // Fallback for older closed requests before acceptedOfferId was introduced
      // Since we don't know exactly which one, we assume the first/last offer in the array
      // or simply fallback to the first one available
      accepted = req.offers[0];
    }

    if (accepted) {
      return {
        who: accepted.operatorName || 'Collega',
        scenario: accepted.scenarioLabel || 'Generico',
      };
    }
  }

  // Fallback: Manually closed by Admin
  return {
    who: 'Admin / Manuale',
    scenario: 'Gestione manuale',
  };
}

function formatDate(dt: string) {
  return dateUtil.formatDate(dt, 'DD/MM/YYYY');
}

function getReasonLabel(reason: string) {
  if (reason === 'ABSENCE') return 'Assenza';
  if (reason === 'SHORTAGE') return 'Carenza';
  return reason;
}

function formatFullDate(dt: number | undefined) {
  if (!dt) return '';
  return dateUtil.formatDate(dt, 'DD/MM/YYYY HH:mm');
}

function getStatusColor(req: ShiftRequest) {
  if (req.status === 'CLOSED' && req.rejectionReason) return 'negative';
  switch (req.status) {
    case 'OPEN':
      return 'primary';
    case 'CLOSED':
      return 'positive';
    case 'PARTIAL':
      return 'warning';
    case 'EXPIRED':
      return 'negative';
    default:
      return 'grey';
  }
}

function getStatusLabel(req: ShiftRequest) {
  if (req.status === 'CLOSED' && req.rejectionReason) return 'RIFIUTATA';
  if (req.status === 'EXPIRED') return 'SCADUTA';
  return req.status; // OPEN, CLOSED, PARTIAL
}
</script>


<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Le tue Richieste</div>

    <!-- Page-level Tab Toggle: Assenza | Cambio Turno -->
    <q-tabs v-model="pageTab" dense class="q-mb-md" active-color="primary" indicator-color="primary" align="justify">
      <q-tab v-if="authStore.isAnyAdmin" name="absence" label="Assenza" icon="event_busy" />
      <q-tab name="swap" label="Cambio Turno" icon="swap_horiz" />
    </q-tabs>

    <!-- =========  ASSENZA TAB (Scomposto §1.11)  ========= -->
    <AbsenceRequestForm v-if="pageTab === 'absence'" :is-admin-mode="authStore.isAnyAdmin" @success="onAbsenceSuccess" />

    <!-- Archive Widget (Battery) -->
    <div v-if="pageTab === 'absence' && archivedRequests.length > 0">
      <div class="col-grow">
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-caption text-grey-8 text-weight-bold">
            <q-icon name="inventory_2" class="q-mr-xs" />
            Archivio (> 3 mesi)
          </div>
          <div class="text-caption text-grey-6">{{ archivedRequests.length }} elementi</div>
        </div>
        <q-linear-progress :value="archiveStorageLevel" :color="storageColor" size="8px" rounded track-color="grey-2" />
      </div>
      <div>
        <q-btn flat dense color="negative" icon="delete_forever" label="Svuota" @click="emptyArchive" size="sm" />
      </div>
    </div>

    <!-- List of visible requests -->
    <template v-if="pageTab === 'absence'">
      <div class="row items-center justify-between q-my-md">
        <div class="text-h6">Storico Richiesta</div>
        <q-btn flat round dense color="primary" icon="refresh" size="sm" @click="manualRefresh">
          <q-tooltip>Aggiorna storico</q-tooltip>
        </q-btn>
      </div>
      <div v-if="loading && visibleRequests.length === 0" class="q-gutter-y-sm">
        <q-card flat bordered v-for="n in 3" :key="`sk-abs-${n}`">
          <q-item>
            <q-item-section>
              <q-skeleton type="text" width="100px" />
              <q-skeleton type="text" width="60px" />
            </q-item-section>
            <q-item-section side>
              <q-skeleton type="rect" width="60px" height="20px" />
            </q-item-section>
          </q-item>
        </q-card>
      </div>

      <div v-else-if="visibleRequests.length === 0 && !loading" class="text-grey text-center q-py-lg">
        Nessuna richiesta visibile.
      </div>

      <q-list separator bordered class="bg-white rounded-borders" v-else>
        <q-expansion-item v-for="req in visibleRequests" :key="req.id" group="requests" header-class="q-pa-sm">
          <template v-slot:header>
            <q-item-section>
              <q-item-label class="text-weight-bold">
                {{ formatDate(req.date) }}
                <span v-if="req.startTime && req.endTime" class="text-weight-regular text-grey-8">
                  ({{ req.startTime }} - {{ req.endTime }})
                </span>
                <q-badge v-else color="primary" class="q-ml-sm">{{ req.originalShift }}</q-badge>
              </q-item-label>
              <q-item-label caption>{{ getReasonLabel(req.reason) }}</q-item-label>
              <q-item-label caption class="text-grey-7">Creata il: {{ formatFullDate(req.createdAt) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center">
                <q-chip :color="getStatusColor(req)" text-color="white" size="sm" class="q-mr-sm">
                  {{ getStatusLabel(req) }}
                </q-chip>
                <q-btn flat round dense icon="delete" color="grey-5" size="sm" @click.stop="deleteRequest(req)">
                  <q-tooltip>Sposta nel cestino</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </template>

          <q-card class="bg-grey-1">
            <q-card-section class="q-py-sm">
              <div v-if="req.requestNote" class="q-mb-sm">
                <div class="text-caption text-grey-7">Le tue note:</div>
                <div>{{ req.requestNote }}</div>
              </div>

              <q-separator v-if="req.requestNote && (req.status === 'CLOSED' || req.rejectionReason)" class="q-my-sm" />

              <!-- Closed / Approved Details -->
              <div v-if="req.status === 'CLOSED' && !req.rejectionReason" class="text-positive">
                <div class="row items-center q-mb-xs">
                  <q-icon name="check_circle" class="q-mr-xs" />
                  <span class="text-weight-bold">Approvata</span>
                  <span v-if="req.approvalTimestamp" class="q-ml-xs text-caption">
                    il {{ formatFullDate(req.approvalTimestamp) }}
                  </span>
                </div>
                <div class="bg-green-1 q-pa-sm rounded-borders text-caption text-black"
                  v-if="getResolutionDetails(req)">
                  <div><strong>Coperta da:</strong> {{ getResolutionDetails(req)?.who }}</div>
                  <div><strong>Scenario:</strong> {{ getResolutionDetails(req)?.scenario }}</div>
                </div>
              </div>

              <div v-if="req.status === 'EXPIRED' || (req.status === 'CLOSED' && req.rejectionReason)"
                class="text-negative">
                <div class="row items-center">
                  <q-icon name="cancel" class="q-mr-xs" />
                  <span class="text-weight-bold">
                    {{
                      req.status === 'CLOSED'
                        ? 'Rifiutata / Cancellata'
                        : 'Mancata Approvazione / Scaduta'
                    }}
                  </span>
                  <span v-if="req.rejectionTimestamp" class="q-ml-xs text-caption">
                    il {{ formatFullDate(req.rejectionTimestamp) }}
                  </span>
                </div>
                <div v-if="req.rejectionReason" class="q-mt-xs bg-red-1 q-pa-sm rounded-borders">
                  <strong>Motivo Admin:</strong> {{ req.rejectionReason }}
                </div>
              </div>

              <div v-if="req.status === 'PARTIAL'" class="text-warning">
                <div class="row items-center">
                  <q-icon name="hourglass_empty" class="q-mr-xs" />
                  <span class="text-weight-bold">Parzialmente Coperta</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </template>

    <!-- ====== CAMBIO TURNO TAB ====== -->
    <div v-if="pageTab === 'swap'">
      <!-- New Swap Form -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pb-none">
          <div class="text-subtitle1 text-weight-bold">
            <q-icon name="swap_horiz" color="primary" class="q-mr-xs" />
            Proponi un Cambio Turno
          </div>
          <div class="text-caption text-grey">
            Indica il turno che cedi e quello che vuoi in cambio. Il tuo nome sarà visibile solo
            dopo che un collega accetta.
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <q-input :model-value="formatDate(swapForm.date)" label="Data del turno" outlined dense readonly
                class="cursor-pointer">
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="swapForm.date" mask="YYYY-MM-DD" :locale="itLocale">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Chiudi" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-4">
              <q-select v-model="swapForm.offeredShift" :options="swapShiftOptions" label="Turno che cedi" outlined
                dense emit-value map-options />
            </div>
            <div class="col-12 col-md-4">
              <q-select v-model="swapForm.desiredShift" :options="swapShiftOptions" label="Turno che vuoi" outlined
                dense emit-value map-options />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn label="Proponi Cambio" color="primary" icon="swap_horiz" unelevated :loading="swapSubmitting" :disable="!swapForm.date ||
            !swapForm.offeredShift ||
            !swapForm.desiredShift ||
            swapForm.offeredShift === swapForm.desiredShift
            " @click="submitSwap" />
        </q-card-actions>
      </q-card>

      <!-- My Swap Requests History -->
      <div class="row items-center justify-between q-mb-sm q-mt-md">
        <div class="text-subtitle2 text-weight-bold">Le mie proposte di Cambio</div>
        <q-btn flat round dense color="primary" icon="refresh" size="sm" @click="manualRefresh">
          <q-tooltip>Aggiorna proposte</q-tooltip>
        </q-btn>
      </div>
      <div v-if="loading && mySwaps.length === 0" class="q-gutter-y-sm">
        <q-card flat bordered v-for="n in 2" :key="`sk-swp-${n}`">
          <q-card-section class="q-py-sm">
            <div class="row items-center justify-between">
              <div class="row q-gutter-sm">
                <q-skeleton type="rect" width="30px" height="20px" />
                <q-skeleton type="rect" width="30px" height="20px" />
                <q-skeleton type="text" width="80px" />
              </div>
              <q-skeleton type="rect" width="60px" height="20px" />
            </div>
            <q-skeleton type="text" width="150px" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>
      <div v-else-if="mySwaps.length === 0 && !loading" class="text-grey text-center q-pa-lg">
        <q-icon name="inbox" size="2em" />
        <div>Nessuna proposta di cambio turno ancora.</div>
      </div>
      <q-card v-for="swap in mySwaps" :key="swap.id" flat bordered class="q-mb-sm" :class="{
        'border-primary': swap.status === 'OPEN',
        'opacity-50 grayscale':
          swap.status === 'OPEN' && isRequestExpired(swap.date, swap.offeredShift),
      }">
        <q-card-section class="q-py-sm">
          <div class="row items-center justify-between">
            <div>
              <div class="row items-center q-gutter-sm">
                <q-chip color="amber-9" text-color="white" size="sm" dense>{{
                  swap.offeredShift
                  }}</q-chip>
                <q-icon name="arrow_forward" />
                <q-chip color="deep-orange-6" text-color="white" size="sm" dense>{{
                  swap.desiredShift
                  }}</q-chip>
                <span class="text-caption text-grey">{{ formatDate(swap.date) }}</span>
              </div>
              <div class="text-caption q-mt-xs">
                <span v-if="swap.status === 'OPEN'" class="text-primary">In attesa di un collega...</span>
                <span v-else-if="swap.status === 'MATCHED' || swap.status === 'PENDING_ADMIN'" class="text-warning">
                  <q-icon name="handshake" /> Accordo con
                  <strong>{{ swap.counterpartName || 'un collega' }}</strong> — in attesa di
                  approvazione admin
                </span>
                <span v-else-if="swap.status === 'APPROVED'" class="text-positive">
                  <q-icon name="check_circle" /> Approvato
                  <span class="text-grey-8 q-ml-xs text-caption" v-if="swap.counterpartName">
                    (Cambio con: <strong>{{ swap.counterpartName }}</strong>)
                  </span>
                  <span v-else>!</span>
                </span>
                <span v-else-if="swap.status === 'REJECTED'" class="text-negative">
                  <q-icon name="cancel" /> Rifiutato<span v-if="swap.adminNote">: {{ swap.adminNote }}</span>
                </span>
              </div>
            </div>
            <div class="column items-end q-gutter-xs">
              <q-badge :color="getSwapStatusColor(swap.status)" :label="getSwapStatusLabel(swap.status)" />
              <span class="text-weight-bold" :class="isRequestExpired(swap.date, swap.offeredShift) ? 'text-grey' : 'text-primary'
                " v-if="swap.status === 'OPEN'">
                {{ isRequestExpired(swap.date, swap.offeredShift) ? 'Scaduta' : 'Aperta' }}
              </span>
              <!-- Cancel only while still OPEN (nobody accepted yet) -->
              <q-btn v-if="swap.status === 'OPEN'" flat dense round icon="delete" color="negative" size="sm"
                @click="cancelSwap(swap)">
                <q-tooltip>Cancella proposta</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>
