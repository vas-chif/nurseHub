<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Le tue Richieste</div>

    <!-- Page-level Tab Toggle: Assenza | Cambio Turno -->
    <q-tabs
      v-model="pageTab"
      dense
      class="q-mb-md"
      active-color="primary"
      indicator-color="primary"
      align="left"
    >
      <q-tab name="absence" label="Assenza" icon="event_busy" />
      <q-tab name="swap" label="Cambio Turno" icon="swap_horiz" />
    </q-tabs>

    <!-- =========  ASSENZA TAB  ========= -->
    <q-card flat bordered class="q-mb-md" v-if="pageTab === 'absence'">
      <q-card-section>
        <div class="text-subtitle1">Nuova Richiesta Assenza</div>
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <!-- Admin: Operator Selector -->
        <div v-if="authStore.isAdmin" class="q-mb-md">
          <q-select
            v-model="selectedOperatorId"
            :options="filteredOperatorOptions"
            option-label="name"
            option-value="id"
            label="Operatore (per conto di)"
            outlined
            dense
            emit-value
            map-options
            use-input
            @filter="filterOperators"
            :hint="'Seleziona l\'operatore per cui stai creando la richiesta'"
          >
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey"> Nessun risultato </q-item-section>
              </q-item>
            </template>
            <template v-slot:prepend>
              <q-icon name="person" />
            </template>
          </q-select>
        </div>

        <div class="row q-col-gutter-md items-start q-ml-md">
          <!-- Date Input -->
          <div class="col-12 col-md-4">
            <q-input
              v-model="formData.date"
              type="date"
              label="Data Assenza"
              outlined
              dense
              :hint="formData.isRecurring ? 'Data inizio' : ''"
            />
          </div>

          <!-- Recurrence Toggle -->
          <div class="col-12 col-md-4">
            <q-toggle
              v-model="formData.isRecurring"
              label="Ripeti richiesta"
              color="secondary"
              dense
              class="q-mt-sm"
            />
          </div>

          <!-- End Date Input (if recurring) -->
          <div v-if="formData.isRecurring" class="col-12 col-md-4">
            <q-input
              v-model="formData.endDate"
              type="date"
              label="Data Fine"
              outlined
              dense
              :rules="[
                (val) => !!val || 'Obbligatorio',
                (val) => val >= formData.date || 'Deve essere dopo la data inizio',
              ]"
            />
          </div>

          <!-- Mode Toggle -->
          <div class="col-12 col-md-8">
            <div class="row items-center q-gutter-x-md q-pt-xs">
              <span class="text-caption">Tipo Selezione:</span>
              <q-btn-toggle
                v-model="inputMode"
                toggle-color="secondary"
                :options="[
                  { label: 'Turno Intero', value: 'SHIFT' },
                  { label: 'Fascia Oraria', value: 'TIME' },
                ]"
                dense
                outlined
                rounded
                unelevated
              />
            </div>
          </div>

          <!-- Shift Logic -->
          <div class="col-12" v-if="inputMode === 'SHIFT'">
            <q-btn-toggle
              v-model="formData.shift"
              toggle-color="primary"
              :options="[
                { label: 'Mattina', value: 'M' },
                { label: 'Pomeriggio', value: 'P' },
                { label: 'Notte', value: 'N' },
              ]"
              spread
              dense
              outlined
              class="full-width"
            />
          </div>

          <!-- Time Range Logic -->
          <template v-else>
            <div class="col-12 col-md-6">
              <q-input v-model="formData.startTime" type="time" label="Dalle ore" outlined dense />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="formData.endTime" type="time" label="Alle ore" outlined dense />
            </div>
          </template>
        </div>

        <div class="row q-mt-md">
          <div class="col-12 q-mb-md">
            <q-select
              v-model="formData.reason"
              :options="absenceOptions"
              label="Motivo Assenza"
              outlined
              dense
              emit-value
              map-options
            />
          </div>

          <div class="col-12">
            <q-input
              v-model="formData.note"
              label="Note Aggiuntive"
              outlined
              dense
              type="textarea"
              rows="3"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          label="Invia Richiesta"
          color="primary"
          @click="submitRequest"
          :loading="submitting"
        />
      </q-card-actions>
    </q-card>

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
        <q-linear-progress
          :value="archiveStorageLevel"
          :color="storageColor"
          size="8px"
          rounded
          track-color="grey-2"
        />
      </div>
      <div>
        <q-btn
          flat
          dense
          color="negative"
          icon="delete_forever"
          label="Svuota"
          @click="emptyArchive"
          size="sm"
        />
      </div>
    </div>

    <!-- List of visible requests -->
    <template v-if="pageTab === 'absence'">
      <div class="text-h6 q-my-md">Storico Richiesta</div>
      <div v-if="visibleRequests.length === 0" class="text-grey text-center q-py-lg">
        Nessuna richiesta visibile.
      </div>

      <q-list separator bordered class="bg-white rounded-borders" v-else>
        <q-expansion-item
          v-for="req in visibleRequests"
          :key="req.id"
          group="requests"
          header-class="q-pa-sm"
        >
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
              <q-item-label caption class="text-grey-7"
                >Creata il: {{ formatFullDate(req.createdAt) }}</q-item-label
              >
            </q-item-section>
            <q-item-section side>
              <div class="row items-center">
                <q-chip :color="getStatusColor(req)" text-color="white" size="sm" class="q-mr-sm">
                  {{ getStatusLabel(req) }}
                </q-chip>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="grey-5"
                  size="sm"
                  @click.stop="archiveRequest(req)"
                >
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

              <q-separator
                v-if="req.requestNote && (req.status === 'CLOSED' || req.rejectionReason)"
                class="q-my-sm"
              />

              <!-- Closed / Approved Details -->
              <div v-if="req.status === 'CLOSED' && !req.rejectionReason" class="text-positive">
                <div class="row items-center q-mb-xs">
                  <q-icon name="check_circle" class="q-mr-xs" />
                  <span class="text-weight-bold">Approvata</span>
                  <span v-if="req.approvalTimestamp" class="q-ml-xs text-caption">
                    il {{ formatFullDate(req.approvalTimestamp) }}
                  </span>
                </div>
                <div
                  class="bg-green-1 q-pa-sm rounded-borders text-caption text-black"
                  v-if="getResolutionDetails(req)"
                >
                  <div><strong>Coperta da:</strong> {{ getResolutionDetails(req)?.who }}</div>
                  <div><strong>Scenario:</strong> {{ getResolutionDetails(req)?.scenario }}</div>
                </div>
              </div>

              <div
                v-if="req.status === 'EXPIRED' || (req.status === 'CLOSED' && req.rejectionReason)"
                class="text-negative"
              >
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
              <q-input v-model="swapForm.date" type="date" label="Data del turno" outlined dense />
            </div>
            <div class="col-12 col-md-4">
              <q-select
                v-model="swapForm.offeredShift"
                :options="swapShiftOptions"
                label="Turno che cedi"
                outlined
                dense
                emit-value
                map-options
              />
            </div>
            <div class="col-12 col-md-4">
              <q-select
                v-model="swapForm.desiredShift"
                :options="swapShiftOptions"
                label="Turno che vuoi"
                outlined
                dense
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            label="Proponi Cambio"
            color="primary"
            icon="swap_horiz"
            unelevated
            :loading="swapSubmitting"
            :disable="
              !swapForm.date ||
              !swapForm.offeredShift ||
              !swapForm.desiredShift ||
              swapForm.offeredShift === swapForm.desiredShift
            "
            @click="submitSwap"
          />
        </q-card-actions>
      </q-card>

      <!-- My Swap Requests History -->
      <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-md">Le mie proposte di Cambio</div>
      <div v-if="mySwaps.length === 0" class="text-grey text-center q-pa-lg">
        <q-icon name="inbox" size="2em" />
        <div>Nessuna proposta di cambio turno ancora.</div>
      </div>
      <q-card v-for="swap in mySwaps" :key="swap.id" flat bordered class="q-mb-sm">
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
                <span v-if="swap.status === 'OPEN'" class="text-primary"
                  >In attesa di un collega...</span
                >
                <span
                  v-else-if="swap.status === 'MATCHED' || swap.status === 'PENDING_ADMIN'"
                  class="text-warning"
                >
                  <q-icon name="handshake" /> Accordo con
                  <strong>{{ swap.counterpartName || 'un collega' }}</strong> — in attesa di
                  approvazione admin
                </span>
                <span v-else-if="swap.status === 'APPROVED'" class="text-positive">
                  <q-icon name="check_circle" /> Approvato!
                </span>
                <span v-else-if="swap.status === 'REJECTED'" class="text-negative">
                  <q-icon name="cancel" /> Rifiutato<span v-if="swap.adminNote"
                    >: {{ swap.adminNote }}</span
                  >
                </span>
              </div>
            </div>
            <div class="column items-end q-gutter-xs">
              <q-badge
                :color="getSwapStatusColor(swap.status)"
                :label="getSwapStatusLabel(swap.status)"
              />
              <!-- Cancel only while still OPEN (nobody accepted yet) -->
              <q-btn
                v-if="swap.status === 'OPEN'"
                flat
                dense
                round
                icon="delete"
                color="negative"
                size="sm"
                @click="cancelSwap(swap)"
              >
                <q-tooltip>Cancella proposta</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import type { Unsubscribe } from 'firebase/firestore';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  writeBatch,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import type {
  ShiftRequest,
  ShiftCode,
  RequestReason,
  Operator,
  ShiftSwap,
  ShiftSwapStatus,
} from '../types/models';

const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const submitting = ref(false);
const loading = ref(false);
let unsubscribe: Unsubscribe | null = null;

// Page tab: absence | swap
const pageTab = ref<'absence' | 'swap'>('absence');

// Swap form state
const swapForm = ref({
  date: qDate.formatDate(new Date(), 'YYYY-MM-DD'),
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

const inputMode = ref<'SHIFT' | 'TIME'>('SHIFT');

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
    $q.notify({ type: 'warning', message: 'Profilo operatore non collegato' });
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
    await addDoc(collection(db, 'shiftSwaps'), newSwap);
    $q.notify({ type: 'positive', message: 'Proposta di cambio inviata!' });
    await loadMySwaps();
  } catch (e) {
    console.error(e);
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
  mySwaps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap);
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
        await deleteDoc(doc(db, 'shiftSwaps', swap.id));
        mySwaps.value = mySwaps.value.filter((s) => s.id !== swap.id);
        $q.notify({ type: 'info', message: 'Proposta cancellata', icon: 'delete' });
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: 'Errore durante la cancellazione' });
      }
    })();
  });
}

const formData = ref({
  date: qDate.formatDate(new Date(), 'YYYY-MM-DD'),
  isRecurring: false,
  endDate: qDate.formatDate(new Date(), 'YYYY-MM-DD'),
  shift: 'M' as ShiftCode,
  startTime: '',
  endTime: '',
  reason: 'ABSENCE' as RequestReason,
  note: '',
});

const absenceOptions = [
  { label: 'Assenza Generica', value: 'ABSENCE' },
  { label: 'Malattia', value: 'ABSENCE' },
  { label: 'Congedo', value: 'ABSENCE' },
  { label: 'Ferie', value: 'ABSENCE' },
  { label: 'Altro', value: 'ABSENCE' },
];

const requests = ref<ShiftRequest[]>([]);

// Admin: Operator selection
const selectedOperatorId = ref(authStore.isAdmin ? '' : authStore.currentOperator?.id || '');
const operators = ref<Record<string, Operator>>({});
const filterText = ref('');

// Archive Logic - Phase 18
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const cutoffDate = qDate.formatDate(threeMonthsAgo, 'YYYY-MM-DD');

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

const filteredOperatorOptions = computed(() => {
  const list = Object.values(operators.value).map((op) => ({
    id: op.id,
    name: op.name,
  }));

  if (!filterText.value) return list;

  const needle = filterText.value.toLowerCase();
  return list.filter((v) => v.name.toLowerCase().includes(needle));
});

function filterOperators(val: string, update: (callback: () => void) => void) {
  update(() => {
    filterText.value = val;
  });
}

onMounted(async () => {
  // Fetch operators if admin
  if (authStore.isAdmin && configStore.activeConfigId) {
    try {
      const operatorsList = await operatorsService.getOperatorsByConfig(configStore.activeConfigId);
      operatorsList.forEach((op) => {
        operators.value[op.id] = op;
      });
    } catch (e) {
      console.error('Error fetching operators', e);
    }
  }
  initRealtimeRequests();
  void loadMySwaps();
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
                position: 'bottom-right',
              });
            }
          }
        });
      }

      requests.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest);
      loading.value = false;
    },
    (error) => {
      console.error('Snapshot error:', error);
      loading.value = false;
    },
  );
}

async function submitRequest() {
  if (!formData.value.date) {
    $q.notify({ type: 'warning', message: 'Seleziona una data' });
    return;
  }

  if (inputMode.value === 'TIME' && (!formData.value.startTime || !formData.value.endTime)) {
    $q.notify({ type: 'warning', message: 'Specifica Orario Inizio e Fine' });
    return;
  }

  submitting.value = true;
  try {
    // Use selected operator ID (for admin) or current user's operator ID
    const targetOperatorId = authStore.isAdmin
      ? selectedOperatorId.value
      : authStore.currentOperator?.id || '';

    if (!targetOperatorId) {
      $q.notify({ type: 'warning', message: 'Operatore non selezionato' });
      return;
    }

    const absentOperatorName = operators.value[targetOperatorId]?.name || 'Operatore';
    const creatorName =
      `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim() ||
      'Utente';

    // Calculate dates to process
    const datesToProcess: string[] = [];
    if (formData.value.isRecurring && formData.value.endDate) {
      let current = new Date(formData.value.date);
      const end = new Date(formData.value.endDate);
      while (current <= end) {
        datesToProcess.push(qDate.formatDate(current, 'YYYY-MM-DD'));
        current = qDate.addToDate(current, { days: 1 });
      }
    } else {
      datesToProcess.push(formData.value.date);
    }

    if (datesToProcess.length > 31) {
      $q.notify({
        type: 'negative',
        message: 'Massimo 31 giorni per volta per le richieste ricorrenti',
      });
      return;
    }

    const batch = [];
    const batchData: Omit<ShiftRequest, 'id'>[] = [];
    for (const date of datesToProcess) {
      const newReq: Omit<ShiftRequest, 'id'> = {
        date: date,
        originalShift: inputMode.value === 'SHIFT' ? formData.value.shift : 'A',
        reason: formData.value.reason,
        status: 'OPEN',
        creatorId: authStore.currentUser!.uid,
        creatorName,
        absentOperatorId: targetOperatorId,
        absentOperatorName,
        createdAt: Date.now(),
        requestNote: formData.value.note,
        ...(inputMode.value === 'TIME' && formData.value.startTime
          ? { startTime: formData.value.startTime }
          : {}),
        ...(inputMode.value === 'TIME' && formData.value.endTime
          ? { endTime: formData.value.endTime }
          : {}),
      };
      batchData.push(newReq);
      batch.push(addDoc(collection(db, 'shiftRequests'), newReq));
    }

    const savedRequests = await Promise.all(batch);

    // Phase 19: trigger push notifications to eligible users for each new request
    const { notifyEligibleOperators } = await import('../services/NotificationService');
    const activeConfigId = configStore.activeConfigId;
    if (activeConfigId) {
      for (let i = 0; i < savedRequests.length; i++) {
        const docRef = savedRequests[i];
        if (docRef?.id) {
          const simulatedRequest = { ...batchData[i], id: docRef.id } as ShiftRequest;
          notifyEligibleOperators(simulatedRequest, activeConfigId).catch(console.error);
        }
      }
    }

    $q.notify({
      type: 'positive',
      message:
        datesToProcess.length > 1
          ? `${datesToProcess.length} richieste inviate con successo`
          : 'Richiesta inviata con successo',
    });

    // Reset form
    formData.value.note = '';
    formData.value.startTime = '';
    formData.value.endTime = '';
    formData.value.isRecurring = false;
  } catch (e) {
    console.error(e);
    $q.notify({ type: 'negative', message: "Errore durante l'invio" });
  } finally {
    submitting.value = false;
  }
}

// Phase 18/20: Delete Actions
function archiveRequest(req: ShiftRequest) {
  if (!authStore.currentUser) return;

  $q.dialog({
    title: 'Elimina Definitivamente',
    message:
      "Sei sicuro di voler eliminare definitivamente questa richiesta? L'azione non può essere annullata.",
    cancel: true,
    persistent: true,
  }).onOk(() => {
    const performArchive = async () => {
      try {
        const ref = doc(db, 'shiftRequests', req.id);
        await deleteDoc(ref);
        $q.notify({
          message: 'Richiesta eliminata definitivamente',
          color: 'info',
          icon: 'delete_forever',
        });
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: 'Errore durante eliminazione' });
      }
    };
    void performArchive();
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
    console.error(e);
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
  return qDate.formatDate(dt, 'DD/MM/YYYY');
}

function getReasonLabel(reason: string) {
  if (reason === 'ABSENCE') return 'Assenza';
  if (reason === 'SHORTAGE') return 'Carenza';
  return reason;
}

function formatFullDate(dt: number | undefined) {
  if (!dt) return '';
  return qDate.formatDate(dt, 'DD/MM/YYYY HH:mm');
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
