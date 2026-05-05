/** * @file UserRequestsPage.vue * @description Page for users to submit absence and shift swap
requests. * Displays two tabs: Assenza (delegates to AbsenceRequestForm component) and * Cambio
Turno (inline swap form). All Firestore queries are scoped by configId * and automatically reload
when activeConfigId changes (§Punto 1). * @author Nurse Hub Team * @created 2026-02-15 * @modified
2026-05-04 * @notes * - Absence form logic lives entirely in AbsenceRequestForm + useAbsenceForm
(§1.11). * - initRealtimeRequests and loadMySwaps filter by configId. * -
watch(configStore.activeConfigId) triggers query reload on config switch. * - q-skeleton shown while
requests load (§1.10). */
<script setup lang="ts">
import { ref, onUnmounted, computed, watch, watchEffect } from 'vue';
import { useQuasar } from 'quasar';
import {
  collection,
  addDoc,
  updateDoc,
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
import { notifySwapProposed } from '../services/NotificationService';
import { useShiftLogic } from '../composables/useShiftLogic';
import type { ShiftRequest, ShiftCode, ShiftSwap, ShiftSwapStatus } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import { useUiStore } from '../stores/uiStore';
import { useRoute } from 'vue-router';
import { formatToItalian, formatToDb } from '../utils/dateUtils';

const logger = useSecureLogger();
const $q = useQuasar();
const route = useRoute();
const authStore = useAuthStore();
const configStore = useConfigStore();
const uiStore = useUiStore();
const { isRequestExpired } = useShiftLogic();
const loading = ref(false);
let unsubscribe: (() => void) | undefined;

// ─── Tab state ────────────────────────────────────────────────────────────────
const defaultTab = authStore.isAnyAdmin ? 'absence' : 'swap';
const savedTab = uiStore.getActiveTab(route.path, defaultTab) as 'absence' | 'swap';

// Force 'swap' if 'absence' is selected but user is not admin
const initialTab = (savedTab === 'absence' && !authStore.isAnyAdmin) ? 'swap' : savedTab;
const pageTab = ref<'absence' | 'swap'>(initialTab);

watch(pageTab, (newVal) => {
  uiStore.setActiveTab(route.path, newVal);
});

// ─── Swap form ────────────────────────────────────────────────────────────────
const swapForm = ref({
  date: formatToDb(new Date()),
  offeredShift: 'M' as ShiftCode,
  desiredDate: formatToDb(new Date()),
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
} /*end getSwapStatusColor*/

async function submitSwap(): Promise<void> {
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
  if (isRequestExpired(swapForm.value.date, swapForm.value.offeredShift)) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'schedule',
      message: 'Turno già iniziato',
      caption: 'Non puoi proporre un cambio per un turno già iniziato o passato.',
      multiLine: true,
    });
    return;
  }
  if (isRequestExpired(swapForm.value.desiredDate, swapForm.value.desiredShift)) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'schedule',
      message: 'Turno desiderato già passato',
      caption: 'Non puoi richiedere un turno già iniziato o passato.',
      multiLine: true,
    });
    return;
  }
  if (swapForm.value.offeredShift === swapForm.value.desiredShift) {
    $q.notify({
      color: 'warning',
      textColor: 'dark',
      icon: 'warning',
      message: 'Turni identici',
      caption: 'Il turno da cedere e quello desiderato non possono essere uguali.',
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
      desiredDate: swapForm.value.desiredDate,
      desiredShift: swapForm.value.desiredShift,
      status: 'OPEN',
      createdAt: Date.now(),
      expireAt: new Date(swapForm.value.date).getTime() + 90 * 24 * 60 * 60 * 1000,
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
} /*end submitSwap*/

async function loadMySwaps(): Promise<void> {
  const uid = authStore.currentUser?.uid;
  const configId = configStore.activeConfigId;
  if (!uid || !configId) return;
  const q = query(
    collection(db, 'shiftSwaps'),
    where('creatorId', '==', uid),
    where('configId', '==', configId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  mySwaps.value = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap)
    .filter((s) => s.deletedByCreator !== true);
} /*end loadMySwaps*/

function deleteSwap(swap: ShiftSwap): void {
  $q.dialog({
    title: 'Elimina proposta',
    message: `Vuoi eliminare la proposta di cambio del ${formatToItalian(swap.date)}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await updateDoc(doc(db, 'shiftSwaps', swap.id), { deletedByCreator: true });
        mySwaps.value = mySwaps.value.filter((s) => s.id !== swap.id);
        $q.notify({ type: 'positive', message: 'Proposta eliminata.' });
      } catch (e) {
        logger.error('Error deleting swap', e);
        $q.notify({ type: 'negative', message: "Errore durante l'eliminazione" });
      }
    })();
  });
} /*end deleteSwap*/

// ─── Requests history ─────────────────────────────────────────────────────────
const requests = ref<ShiftRequest[]>([]);
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
const storageColor = computed(() =>
  archiveStorageLevel.value > 0.8
    ? 'negative'
    : archiveStorageLevel.value > 0.5
      ? 'warning'
      : 'positive',
);

// Re-subscribe whenever the authenticated user or active config becomes available.
// watchEffect runs immediately and re-runs on any reactive dependency change,
// fixing the race condition where currentUser/activeConfigId arrive after mount.
watchEffect(() => {
  const uid = authStore.currentUser?.uid;
  const configId = configStore.activeConfigId;
  if (!uid || !configId) return;
  if (unsubscribe) unsubscribe();
  initRealtimeRequests();
  void loadMySwaps();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

/**
 * Subscribes to real-time absence request updates filtered by creator + configId.
 * Emits in-app notifications on status changes.
 */
function initRealtimeRequests(): void {
  if (!authStore.currentUser?.uid) return;
  const configId = configStore.activeConfigId;
  if (!configId) return;
  loading.value = true;
  const q = query(
    collection(db, 'shiftRequests'),
    where('creatorId', '==', authStore.currentUser.uid),
    where('configId', '==', configId),
    orderBy('createdAt', 'desc'),
  );
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
    requests.value = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest)
      .filter((r) => r.deletedByCreator !== true);
    loading.value = false;
  });
} /*end initRealtimeRequests*/

async function manualRefresh(): Promise<void> {
  loading.value = true;
  if (unsubscribe) unsubscribe();
  initRealtimeRequests();
  await loadMySwaps();
  $q.notify({ type: 'info', message: 'Dati aggiornati', timeout: 1000 });
} /*end manualRefresh*/

function emptyArchive(): void {
  if (archivedRequests.value.length === 0) return;
  $q.dialog({
    title: 'Svuota Archivio',
    message: `Vuoi eliminare ${archivedRequests.value.length} richieste?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      loading.value = true;
      try {
        const batch = writeBatch(db);
        archivedRequests.value.forEach((req) => {
          batch.delete(doc(db, 'shiftRequests', req.id));
        });
        await batch.commit();
        $q.notify({ type: 'positive', message: 'Archivio svuotato' });
      } catch (e) {
        logger.error('Error emptying archive', e);
      } finally {
        loading.value = false;
      }
    })();
  });
} /*end emptyArchive*/

function getStatusColor(req: ShiftRequest): string {
  if (req.status === 'OPEN' && isRequestExpired(req.date, req.originalShift)) return 'negative';
  if (req.status === 'CLOSED' && req.rejectionReason) return 'negative';
  switch (req.status) {
    case 'OPEN':
      return 'primary';
    case 'CLOSED':
      return 'positive';
    default:
      return 'grey';
  }
} /*end getStatusColor*/
</script>

<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Le tue Richieste</div>

    <q-tabs
      v-model="pageTab"
      dense
      class="q-mb-md"
      active-color="primary"
      indicator-color="primary"
      align="justify"
    >
      <q-tab v-if="authStore.isAnyAdmin" name="absence" label="Assenza" icon="event_busy" />
      <q-tab name="swap" label="Cambio Turno" icon="swap_horiz" />
    </q-tabs>

    <!-- =========  ASSENZA TAB (admin only) ========= -->
    <template v-if="pageTab === 'absence' && authStore.isAnyAdmin">
      <AbsenceRequestForm @success="manualRefresh" />

      <!-- Archive widget -->
      <div
        v-if="archivedRequests.length > 0"
        class="row items-center q-mb-md bg-white q-pa-sm rounded-borders shadow-1"
      >
        <div class="col-grow">
          <div class="text-caption text-grey-8 text-weight-bold">
            <q-icon name="inventory_2" /> Archivio ({{ archivedRequests.length }})
          </div>
          <q-linear-progress
            :value="archiveStorageLevel"
            :color="storageColor"
            size="8px"
            rounded
          />
        </div>
        <q-btn flat dense color="negative" icon="delete_forever" @click="emptyArchive" size="sm" />
      </div>

      <div class="row items-center justify-between q-my-md">
        <div class="text-h6">Storico</div>
        <q-btn flat round icon="refresh" size="sm" @click="manualRefresh" :loading="loading" />
      </div>

      <!-- Skeleton while loading (§1.10) -->
      <div v-if="loading && requests.length === 0">
        <q-card v-for="n in 3" :key="n" flat bordered class="q-mb-sm rounded-borders">
          <q-item>
            <q-item-section>
              <q-skeleton type="text" width="35%" />
              <q-skeleton type="text" width="55%" />
            </q-item-section>
            <q-item-section side>
              <q-skeleton type="QChip" />
            </q-item-section>
          </q-item>
        </q-card>
      </div>

      <q-list v-else separator bordered class="bg-white rounded-borders">
        <q-expansion-item
          v-for="req in visibleRequests"
          :key="req.id"
          group="requests"
          :class="{ 'opacity-50 grayscale': isRequestExpired(req.date, req.originalShift) }"
        >
          <template #header>
            <q-item-section>
              <q-item-label class="text-weight-bold">
                {{ formatToItalian(req.date) }}
                <q-badge color="primary">{{ req.originalShift }}</q-badge>
              </q-item-label>
              <q-item-label caption>{{ req.requestNote ?? req.reason }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip :color="getStatusColor(req)" text-color="white" size="sm">
                {{ req.status }}
              </q-chip>
            </q-item-section>
          </template>
          <q-card flat>
            <q-card-section class="text-caption q-pt-none">
              <div v-if="req.rejectionReason" class="text-negative">
                <q-icon name="info" /> {{ req.rejectionReason }}
              </div>
              <div class="text-grey-7">
                Creata il
                {{ formatToItalian(new Date(req.createdAt).toISOString().substring(0, 10)) }}
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
        <q-item v-if="!loading && visibleRequests.length === 0">
          <q-item-section class="text-center text-grey-5 q-pa-xl">
            Nessuna richiesta di assenza per questa configurazione.
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- =========  CAMBIO TURNO TAB  ========= -->
    <div v-if="pageTab === 'swap'">
      <q-card flat bordered class="q-mb-lg shadow-2 rounded-borders overflow-hidden">
        <q-card-section class="bg-primary text-white q-py-sm">
          <div class="row items-center q-gutter-x-sm">
            <q-icon name="swap_horizontal_circle" size="sm" />
            <div class="text-subtitle1 text-weight-bold">Proponi un nuovo Cambio Turno</div>
          </div>
        </q-card-section>

        <q-card-section class="q-pa-md">
          <div class="row q-col-gutter-lg items-center">
            <!-- LEFT SIDE: WHAT I GIVE -->
            <div class="col-12 col-md-5">
              <div class="q-pa-md bg-orange-1 rounded-borders border-orange">
                <div class="text-overline text-orange-9 q-mb-sm">IL TUO TURNO (DA CEDERE)</div>
                <div class="column q-gutter-y-md">
                  <AppDateInput
                    v-model="swapForm.date"
                    label="Data turno da cedere"
                    required
                    dense
                    bg-color="white"
                  />
                  <q-select
                    v-model="swapForm.offeredShift"
                    :options="swapShiftOptions"
                    emit-value
                    map-options
                    label="Turno da cedere"
                    filled
                    dense
                    bg-color="white"
                  >
                    <template v-slot:prepend>
                      <q-icon name="outbound" color="orange" />
                    </template>
                  </q-select>
                </div>
              </div>
            </div>

            <!-- CENTER ICON -->
            <div class="col-12 col-md-2 text-center">
              <q-icon name="swap_horiz" size="xl" color="grey-4" class="gt-sm" />
              <q-icon name="south" size="md" color="grey-4" class="lt-md q-my-none" />
            </div>

            <!-- RIGHT SIDE: WHAT I WANT -->
            <div class="col-12 col-md-5">
              <div class="q-pa-md bg-green-1 rounded-borders border-green">
                <div class="text-overline text-green-9 q-mb-sm">TURNO DESIDERATO (IN CAMBIO)</div>
                <div class="column q-gutter-y-md">
                  <AppDateInput
                    v-model="swapForm.desiredDate"
                    label="Data turno desiderato"
                    required
                    dense
                    bg-color="white"
                  />
                  <q-select
                    v-model="swapForm.desiredShift"
                    :options="swapShiftOptions"
                    emit-value
                    map-options
                    label="Turno desiderato"
                    filled
                    dense
                    bg-color="white"
                  >
                    <template v-slot:prepend>
                      <q-icon name="login" color="green" />
                    </template>
                  </q-select>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="center" class="q-pa-md bg-grey-1">
          <q-btn
            label="Invia Proposta di Scambio"
            color="primary"
            icon="send"
            unelevated
            class="q-px-xl q-py-sm text-weight-bold"
            rounded
            @click="submitSwap"
            :loading="swapSubmitting"
          />
        </q-card-actions>
      </q-card>

      <div class="row items-center justify-between q-mb-sm">
        <div class="text-subtitle2 text-grey-8">Le tue proposte attive</div>
        <q-btn
          flat
          round
          icon="refresh"
          size="sm"
          color="primary"
          @click="manualRefresh"
          :loading="loading"
        />
      </div>

      <div
        v-if="mySwaps.length === 0"
        class="text-center q-pa-xl text-grey-5 border-dashed rounded-borders"
      >
        Non hai ancora inviato proposte di scambio.
      </div>

      <q-card
        v-for="swap in mySwaps"
        :key="swap.id"
        flat
        bordered
        class="q-mb-sm shadow-sm rounded-borders"
      >
        <q-card-section class="row items-center justify-between">
          <div class="column">
            <div class="text-weight-bold">{{ formatToItalian(swap.date) }}</div>
            <div class="text-caption q-mt-xs">
              <span class="text-grey-7">Cedo: </span>
              <q-badge color="orange-2" text-color="orange-10" class="q-mr-xs">{{
                swap.offeredShift
              }}</q-badge>
              <span class="text-caption text-grey-6">({{ formatToItalian(swap.date) }})</span>
              <span class="text-grey-7 q-mx-xs">→ ricevo: </span>
              <q-badge color="green-2" text-color="green-10">{{ swap.desiredShift }}</q-badge>
              <span class="text-caption text-grey-6 q-ml-xs"
                >({{ formatToItalian(swap.desiredDate) }})</span
              >
            </div>
            <div v-if="swap.counterpartName" class="text-caption text-grey-8 q-mt-xs">
              <q-icon name="person" size="xs" /> Con: <strong>{{ swap.counterpartName }}</strong>
            </div>
            <div v-else-if="swap.status === 'OPEN'" class="text-caption text-grey-5 q-mt-xs">
              <q-icon name="hourglass_empty" size="xs" /> In attesa di controparte
            </div>
          </div>
          <div class="column items-end q-gutter-y-xs">
            <q-badge :color="getSwapStatusColor(swap)" class="q-pa-xs">
              {{ swap.status }}
            </q-badge>
            <q-btn
              v-if="swap.status === 'OPEN'"
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="negative"
              @click="deleteSwap(swap)"
            >
              <q-tooltip>Elimina proposta</q-tooltip>
            </q-btn>
          </div>
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
.border-orange {
  border: 1px solid #ffb74d;
}
.border-green {
  border: 1px solid #81c784;
}
</style>
