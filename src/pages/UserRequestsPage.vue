/**
 * @file UserRequestsPage.vue
 * @description Page for users to submit absence and shift swap requests.
 * @author Nurse Hub Team
 * @created 2026-02-15
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized dateUtils.
 * - Unified Italian date display (DD/MM/YYYY) across both absence and swap tabs.
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, watchEffect } from 'vue';
import { useQuasar } from 'quasar';
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
} from 'firebase/firestore';
import AbsenceRequestForm from '../components/requests/AbsenceRequestForm.vue';
import AppDateInput from '../components/common/AppDateInput.vue';
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
import { formatToItalian, formatToDb } from '../utils/dateUtils';

const logger = useSecureLogger();
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

watch(pageTab, (newVal) => {
  uiStore.setActiveTab(route.path, newVal);
});

// Swap form state
const swapForm = ref({
  date: formatToDb(new Date()),
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

function getSwapStatusColor(swap: ShiftSwap): string {
  if (swap.status === 'OPEN' && isRequestExpired(swap.date, swap.offeredShift)) return 'negative';
  const map: Record<ShiftSwapStatus, string> = {
    OPEN: 'primary',
    MATCHED: 'warning',
    PENDING_ADMIN: 'orange',
    APPROVED: 'positive',
    REJECTED: 'negative',
  };
  return map[swap.status] || 'grey';
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
      caption: 'Associa il tuo account nel Profilo.',
      multiLine: true,
    });
    return;
  }

  const realShift = authStore.currentOperator?.schedule?.[swapForm.value.date] || 'R';
  if (realShift !== swapForm.value.offeredShift) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'warning',
      message: 'Incongruenza Turno',
      caption: `Il ${formatToItalian(swapForm.value.date)} il tuo turno è "${realShift}".`,
      multiLine: true,
    });
    return;
  }
  swapSubmitting.value = true;
  try {
    const creatorName = `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim() || 'Utente';
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
      expireAt: new Date(swapForm.value.date).getTime() + (90 * 24 * 60 * 60 * 1000),
    };
    const docRef = await addDoc(collection(db, 'shiftSwaps'), newSwap);
    void notifySwapProposed(docRef.id, newSwap, configId);
    $q.notify({ type: 'positive', message: 'Proposta inviata!' });
    await loadMySwaps();
  } catch (e) {
    logger.error('Error submitting swap', e);
    $q.notify({ type: 'negative', message: "Errore durante l'invio" });
  } finally {
    swapSubmitting.value = false;
  }
}

async function loadMySwaps() {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;
  const q = query(collection(db, 'shiftSwaps'), where('creatorId', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  mySwaps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap).filter((s) => s.deletedByCreator !== true);
}

function onAbsenceSuccess() { void manualRefresh(); }
const requests = ref<ShiftRequest[]>([]);
const operators = ref<Record<string, Operator>>({});
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const cutoffDate = formatToDb(threeMonthsAgo);

const visibleRequests = computed(() => {
  if (!authStore.currentUser) return [];
  const uid = authStore.currentUser.uid;
  return requests.value.filter((req) => {
    const isHidden = req.hiddenBy?.includes(uid);
    const isArchived = req.date < cutoffDate;
    return !isHidden && !isArchived;
  });
});

const archivedRequests = computed(() => requests.value.filter((req) => req.date < cutoffDate));
const archiveStorageLevel = computed(() => Math.min(archivedRequests.value.length / 100, 1));
const storageColor = computed(() => archiveStorageLevel.value > 0.8 ? 'negative' : (archiveStorageLevel.value > 0.5 ? 'warning' : 'positive'));

onMounted(() => {
  if (configStore.activeConfigId) void scheduleStore.loadOperators(configStore.activeConfigId);
  initRealtimeRequests();
  void loadMySwaps();
});

watchEffect(() => {
  const list = scheduleStore.operators;
  if (list.length > 0) {
    const record: Record<string, Operator> = {};
    list.forEach((op: Operator) => { record[op.id] = op; });
    operators.value = record;
  }
});

onUnmounted(() => { if (unsubscribe) unsubscribe(); });

function initRealtimeRequests() {
  if (!authStore.currentUser?.uid) return;
  loading.value = true;
  const q = query(collection(db, 'shiftRequests'), where('creatorId', '==', authStore.currentUser.uid), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, (snapshot) => {
    if (!loading.value) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const newData = change.doc.data() as ShiftRequest;
          $q.notify({
            message: `Richiesta del ${formatToItalian(newData.date)} aggiornata a: ${newData.status}`,
            color: newData.status === 'CLOSED' ? 'positive' : 'warning',
          });
        }
      });
    }
    requests.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest).filter((r) => r.deletedByCreator !== true);
    loading.value = false;
  });
}

async function manualRefresh() {
  loading.value = true;
  if (unsubscribe) unsubscribe();
  initRealtimeRequests();
  await loadMySwaps();
  $q.notify({ type: 'info', message: 'Dati aggiornati', timeout: 1000 });
}

function emptyArchive() {
  if (archivedRequests.value.length === 0) return;
  $q.dialog({ title: 'Svuota Archivio', message: `Vuoi eliminare ${archivedRequests.value.length} richieste?`, cancel: true, persistent: true })
    .onOk(() => {
      void (async () => {
        loading.value = true;
        try {
          const batch = writeBatch(db);
          archivedRequests.value.forEach((req) => { batch.delete(doc(db, 'shiftRequests', req.id)); });
          await batch.commit();
          $q.notify({ type: 'positive', message: 'Archivio svuotato' });
        } catch (e) {
          logger.error('Error emptying', e);
        } finally {
          loading.value = false;
        }
      })();
    });
}

function getStatusColor(req: ShiftRequest) {
  if (req.status === 'OPEN' && isRequestExpired(req.date, req.originalShift)) return 'negative';
  if (req.status === 'CLOSED' && req.rejectionReason) return 'negative';
  switch (req.status) {
    case 'OPEN': return 'primary';
    case 'CLOSED': return 'positive';
    default: return 'grey';
  }
}
</script>

<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Le tue Richieste</div>
    
    <q-tabs v-model="pageTab" dense class="q-mb-md" active-color="primary" indicator-color="primary" align="justify">
      <q-tab v-if="authStore.isAnyAdmin" name="absence" label="Assenza" icon="event_busy" />
      <q-tab name="swap" label="Cambio Turno" icon="swap_horiz" />
    </q-tabs>

    <AbsenceRequestForm v-if="pageTab === 'absence'" @success="onAbsenceSuccess" @cancel="pageTab = 'swap'" />

    <template v-if="pageTab === 'absence'">
      <div v-if="archivedRequests.length > 0" class="row items-center q-mb-md bg-white q-pa-sm rounded-borders shadow-1">
        <div class="col-grow">
          <div class="text-caption text-grey-8 text-weight-bold">
            <q-icon name="inventory_2" /> Archivio ({{ archivedRequests.length }})
          </div>
          <q-linear-progress :value="archiveStorageLevel" :color="storageColor" size="8px" rounded />
        </div>
        <q-btn flat dense color="negative" icon="delete_forever" @click="emptyArchive" size="sm" />
      </div>

      <div class="row items-center justify-between q-my-md">
        <div class="text-h6">Storico</div>
        <q-btn flat round icon="refresh" size="sm" @click="manualRefresh" />
      </div>

      <q-list separator bordered class="bg-white rounded-borders">
        <q-expansion-item v-for="req in visibleRequests" :key="req.id" group="requests"
          :class="{ 'opacity-50 grayscale': isRequestExpired(req.date, req.originalShift) }">
          <template v-slot:header>
            <q-item-section>
              <q-item-label class="text-weight-bold">
                {{ formatToItalian(req.date) }} 
                <q-badge color="primary">{{ req.originalShift }}</q-badge>
              </q-item-label>
              <q-item-label caption>{{ req.reason }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip :color="getStatusColor(req)" text-color="white" size="sm">
                {{ req.status }}
              </q-chip>
            </q-item-section>
          </template>
        </q-expansion-item>
      </q-list>
    </template>

    <div v-if="pageTab === 'swap'">
      <q-card flat bordered class="q-mb-md shadow-1 rounded-borders">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold text-primary">Proponi Cambio Turno</div>
          <div class="text-caption text-grey-7">Seleziona la data e i turni che desideri scambiare.</div>
        </q-card-section>

        <q-card-section class="row q-col-gutter-md">
          <div class="col-12 col-md-4">
            <AppDateInput
              v-model="swapForm.date"
              label="Data del cambio"
              required
            />
          </div>
          <div class="col-6 col-md-4">
            <q-select v-model="swapForm.offeredShift" :options="swapShiftOptions" label="Turno da cedere" filled dense />
          </div>
          <div class="col-6 col-md-4">
            <q-select v-model="swapForm.desiredShift" :options="swapShiftOptions" label="Turno desiderato" filled dense />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pb-md q-pr-md">
          <q-btn label="Invia Proposta" color="primary" unelevated @click="submitSwap" :loading="swapSubmitting" />
        </q-card-actions>
      </q-card>

      <div class="row items-center justify-between q-mb-sm">
        <div class="text-subtitle2 text-grey-8">Le tue proposte attive</div>
        <q-btn flat round icon="refresh" size="sm" color="primary" @click="manualRefresh" :loading="loading" />
      </div>
      
      <div v-if="mySwaps.length === 0" class="text-center q-pa-xl text-grey-5 border-dashed rounded-borders">
        Non hai ancora inviato proposte di scambio.
      </div>
      
      <q-card v-for="swap in mySwaps" :key="swap.id" flat bordered class="q-mb-sm shadow-sm rounded-borders">
        <q-card-section class="row items-center justify-between">
          <div class="column">
            <div class="text-weight-bold">{{ formatToItalian(swap.date) }}</div>
            <div class="text-caption">
              Scambio: <q-badge color="orange-2" text-color="orange-10">{{ swap.offeredShift }}</q-badge> 
              → <q-badge color="green-2" text-color="green-10">{{ swap.desiredShift }}</q-badge>
            </div>
          </div>
          <q-badge :color="getSwapStatusColor(swap)" class="q-pa-xs">
            {{ swap.status }}
          </q-badge>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.rounded-borders {
  border-radius: 12px;
}
.border-dashed {
  border: 1px dashed #cbd5e1;
}
</style>
