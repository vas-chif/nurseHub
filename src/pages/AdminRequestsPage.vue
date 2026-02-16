<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">Gestione Richieste Assenza</div>

    <!-- Filters Section -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Filtri</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-3">
            <q-input
              v-model="filters.dateFrom"
              label="Da Data"
              type="date"
              dense
              outlined
              clearable
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input v-model="filters.dateTo" label="A Data" type="date" dense outlined clearable />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="filters.operators"
              :options="operatorOptions"
              label="Filtra Operatori"
              multiple
              use-chips
              dense
              outlined
              emit-value
              map-options
              clearable
            />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="sortBy"
              :options="sortOptions"
              label="Ordina per"
              dense
              outlined
              emit-value
              map-options
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Bulk Actions Toolbar -->
    <q-banner v-if="selectedRequests.length > 0" class="bg-primary text-white q-mb-md" dense>
      <template v-slot:avatar>
        <q-icon name="check_circle" />
      </template>
      <div class="row items-center">
        <span class="col">{{ selectedRequests.length }} richieste selezionate</span>
        <q-btn flat label="Approva Tutte" icon="check" @click="bulkApprove" />
        <q-btn flat label="Rifiuta Tutte" icon="close" @click="bulkReject" />
        <q-btn flat round dense icon="clear" @click="selectedRequests = []" />
      </div>
    </q-banner>

    <q-tabs
      v-model="activeTab"
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="justify"
      narrow-indicator
    >
      <q-tab name="pending" label="In Attesa" />
      <q-tab name="history" label="Storico" />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="activeTab" animated>
      <q-tab-panel name="pending">
        <div v-if="loading" class="row justify-center q-pa-md">
          <q-spinner color="primary" size="3em" />
        </div>

        <div v-else-if="filteredPendingRequests.length === 0" class="text-center text-grey q-pa-lg">
          Nessuna richiesta in attesa.
        </div>

        <div v-else class="q-gutter-md">
          <q-card v-for="req in filteredPendingRequests" :key="req.id" bordered flat>
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="row items-center">
                  <q-checkbox v-model="selectedRequests" :val="req.id" class="q-mr-sm" />
                  <div class="text-subtitle1 text-weight-bold">
                    {{ getOperatorName(req.absentOperatorId) }}
                  </div>
                </div>
                <q-badge color="orange" label="In Attesa" />
              </div>
              <div class="text-caption text-grey">
                Richiesto il: {{ formatDate(req.createdAt) }}
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div class="col-12 col-md-6">
                  <div class="text-caption text-grey-7">Data Assenza</div>
                  <div>{{ formatDate(req.date) }}</div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="text-caption text-grey-7">Turno Originale</div>
                  <q-badge :color="getShiftColor(req.originalShift)">
                    {{ req.originalShift }}
                  </q-badge>
                </div>
                <div class="col-12" v-if="req.startTime && req.endTime">
                  <div class="text-caption text-grey-7">Orario</div>
                  <div>{{ req.startTime }} - {{ req.endTime }}</div>
                </div>
                <div class="col-12" v-if="req.reason">
                  <div class="text-caption text-grey-7">Motivo</div>
                  <div class="text-capitalize">{{ req.reason }}</div>
                </div>
                <div class="col-12" v-if="req.requestNote">
                  <div class="text-caption text-grey-7">Note</div>
                  <div class="text-italic">{{ req.requestNote }}</div>
                </div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-actions align="right">
              <q-btn flat label="Rifiuta" color="negative" @click="rejectRequest(req)" />
              <q-btn flat label="Approva" color="positive" @click="approveRequest(req)" />
            </q-card-actions>
          </q-card>
        </div>
      </q-tab-panel>

      <q-tab-panel name="history">
        <div v-if="loading" class="row justify-center q-pa-md">
          <q-spinner color="primary" size="3em" />
        </div>
        <div v-else-if="filteredHistoryRequests.length === 0" class="text-center text-grey q-pa-lg">
          Nessuna richiesta nello storico.
        </div>
        <q-list v-else separator bordered class="rounded-borders">
          <q-item v-for="req in filteredHistoryRequests" :key="req.id">
            <q-item-section>
              <q-item-label>{{ getOperatorName(req.absentOperatorId) }}</q-item-label>
              <q-item-label caption
                >{{ formatDate(req.date) }} - {{ req.originalShift }}</q-item-label
              >
            </q-item-section>
            <q-item-section side>
              <q-chip :color="getStatusColor(req.status)" text-color="white" size="sm">
                {{ req.status }}
              </q-chip>
              <q-tooltip v-if="req.rejectionReason"> Motivo: {{ req.rejectionReason }} </q-tooltip>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Rejection Reason Modal -->
    <q-dialog v-model="showRejectDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Motivo del Rifiuto</div>
          <div class="text-caption text-grey">Campo obbligatorio</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="rejectionReason"
            type="textarea"
            label="Inserisci il motivo"
            rows="4"
            outlined
            autofocus
            :rules="[(val) => !!val || 'Motivo obbligatorio']"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn
            flat
            label="Conferma Rifiuto"
            color="negative"
            @click="confirmReject"
            :disable="!rejectionReason"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
import { collection, query, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { ShiftRequest, ShiftCode, Operator } from '../types/models';
import { notifyUser } from '../services/NotificationService';
import { useAuthStore } from '../stores/authStore';

const $q = useQuasar();
const authStore = useAuthStore();
const activeTab = ref('pending');
const loading = ref(false);
const requests = ref<ShiftRequest[]>([]);
const operators = ref<Record<string, Operator>>({});

// Phase 10.1: Filters, Sorting, Bulk Actions
const filters = ref({
  dateFrom: '',
  dateTo: '',
  operators: [] as string[],
});

type SortOption = 'date-asc' | 'date-desc' | 'name' | 'created';
const sortBy = ref<SortOption>('created');
const sortOptions = [
  { label: 'Data (crescente)', value: 'date-asc' },
  { label: 'Data (decrescente)', value: 'date-desc' },
  { label: 'Nome Operatore', value: 'name' },
  { label: 'Più recenti', value: 'created' },
];

const selectedRequests = ref<string[]>([]);
const showRejectDialog = ref(false);
const rejectionReason = ref('');
const requestToReject = ref<ShiftRequest | null>(null);
const isBulkReject = ref(false);

// Operator options for filter
const operatorOptions = computed(() => {
  return Object.values(operators.value).map((op) => ({
    label: op.name,
    value: op.id,
  }));
});

// Filtered and sorted requests
function applyFilters(reqs: ShiftRequest[]): ShiftRequest[] {
  let filtered = [...reqs];

  // Date range filter
  if (filters.value.dateFrom) {
    filtered = filtered.filter((r) => r.date >= filters.value.dateFrom);
  }
  if (filters.value.dateTo) {
    filtered = filtered.filter((r) => r.date <= filters.value.dateTo);
  }

  // Operator filter
  if (filters.value.operators.length > 0) {
    filtered = filtered.filter((r) => filters.value.operators.includes(r.absentOperatorId || ''));
  }

  // Sorting
  if (sortBy.value === 'date-asc') {
    filtered.sort((a, b) => a.date.localeCompare(b.date));
  } else if (sortBy.value === 'date-desc') {
    filtered.sort((a, b) => b.date.localeCompare(a.date));
  } else if (sortBy.value === 'name') {
    filtered.sort((a, b) =>
      getOperatorName(a.absentOperatorId).localeCompare(getOperatorName(b.absentOperatorId)),
    );
  } else {
    // 'created' - default
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  }

  return filtered;
}

const filteredPendingRequests = computed(() => {
  const pending = requests.value.filter((r) => r.status === 'OPEN');
  return applyFilters(pending);
});

const filteredHistoryRequests = computed(() => {
  const history = requests.value.filter((r) => r.status !== 'OPEN');
  return applyFilters(history);
});

onMounted(async () => {
  await fetchOperators();
  await fetchRequests();
});

async function fetchOperators() {
  try {
    const snap = await getDocs(collection(db, 'operators'));
    snap.forEach((doc) => {
      const op = doc.data() as Operator;
      operators.value[op.id] = op;
    });
  } catch (e) {
    console.error('Error fetching operators', e);
  }
}

async function fetchRequests() {
  loading.value = true;
  try {
    const q = query(collection(db, 'shiftRequests')); // Get all for admin
    const snap = await getDocs(q);
    const loaded: ShiftRequest[] = [];
    snap.forEach((doc) => {
      loaded.push(doc.data() as ShiftRequest);
    });
    requests.value = loaded;
  } catch (e) {
    console.error('Error fetching requests', e);
    $q.notify({ type: 'negative', message: 'Errore caricamento richieste' });
  } finally {
    loading.value = false;
  }
}

function getOperatorName(opId?: string) {
  if (!opId) return 'Utente Sconosciuto';
  return operators.value[opId]?.name || opId;
}

function formatDate(ts: number | string) {
  if (typeof ts === 'string') {
    // YYYY-MM-DD
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT');
  }
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getShiftColor(code: ShiftCode): string {
  switch (code) {
    case 'M':
      return 'amber-8';
    case 'P':
      return 'orange-8';
    case 'N':
      return 'blue-10';
    case 'R':
      return 'grey-5';
    default:
      return 'primary';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'CLOSED':
      return 'positive'; // Approata/Chiusa
    case 'EXPIRED':
      return 'grey'; // Rifiutata/Scaduta
    case 'PARTIAL':
      return 'warning';
    default:
      return 'grey';
  }
}

function rejectRequest(req: ShiftRequest) {
  requestToReject.value = req;
  isBulkReject.value = false;
  rejectionReason.value = '';
  showRejectDialog.value = true;
}

async function confirmReject() {
  if (!rejectionReason.value) return;

  loading.value = true;
  try {
    if (isBulkReject.value) {
      const batch = writeBatch(db);

      for (const reqId of selectedRequests.value) {
        const req = requests.value.find((r) => r.id === reqId);
        if (!req) continue;

        const reqRef = doc(db, 'shiftRequests', reqId);
        batch.update(reqRef, {
          status: 'CLOSED',
          rejectionReason: rejectionReason.value,
          rejectionTimestamp: Date.now(),
          adminId: authStore.currentUser?.uid,
        });

        await notifyUser(
          req.creatorId,
          'REQUEST_REJECTED',
          `Richiesta del ${req.date} rifiutata: ${rejectionReason.value}`,
          req.id,
        );
      }

      await batch.commit();
      selectedRequests.value = [];
      $q.notify({ type: 'warning', message: 'Richieste rifiutate' });
    } else {
      if (!requestToReject.value) return;

      const reqRef = doc(db, 'shiftRequests', requestToReject.value.id);
      await updateDoc(reqRef, {
        status: 'CLOSED',
        rejectionReason: rejectionReason.value,
        rejectionTimestamp: Date.now(),
        adminId: authStore.currentUser?.uid,
      });

      await notifyUser(
        requestToReject.value.creatorId,
        'REQUEST_REJECTED',
        `Richiesta del ${requestToReject.value.date} rifiutata: ${rejectionReason.value}`,
        requestToReject.value.id,
      );

      $q.notify({ type: 'warning', message: 'Richiesta rifiutata' });
    }

    showRejectDialog.value = false;
    await fetchRequests();
  } catch (e) {
    console.error('Error rejecting request', e);
    $q.notify({ type: 'negative', message: 'Errore durante il rifiuto' });
  } finally {
    loading.value = false;
  }
}

function approveRequest(req: ShiftRequest) {
  $q.dialog({
    title: 'Conferma Approvazione',
    message: `Approvare la richiesta di ${getOperatorName(req.absentOperatorId)} per il ${req.date}?`,
    cancel: true,
  }).onOk(() => {
    void (async () => {
      loading.value = true;
      try {
        const batch = writeBatch(db);

        const reqRef = doc(db, 'shiftRequests', req.id);
        batch.update(reqRef, {
          status: 'CLOSED',
          approvalTimestamp: Date.now(),
          adminId: authStore.currentUser?.uid,
        });

        if (req.absentOperatorId) {
          const opRef = doc(db, 'operators', req.absentOperatorId);
          batch.update(opRef, { [`schedule.${req.date}`]: 'A' });
        }

        await batch.commit();

        await notifyUser(
          req.creatorId,
          'REQUEST_APPROVED',
          `Richiesta del ${req.date} approvata`,
          req.id,
        );

        await fetchRequests();
        $q.notify({ type: 'positive', message: 'Richiesta approvata!' });
      } catch (e) {
        console.error('Error approving request', e);
        $q.notify({ type: 'negative', message: 'Errore durante approvazione' });
      } finally {
        loading.value = false;
      }
    })();
  });
}

function bulkApprove() {
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

          const reqRef = doc(db, 'shiftRequests', reqId);
          batch.update(reqRef, {
            status: 'CLOSED',
            approvalTimestamp: Date.now(),
            adminId: authStore.currentUser?.uid,
          });

          if (req.absentOperatorId) {
            const opRef = doc(db, 'operators', req.absentOperatorId);
            batch.update(opRef, { [`schedule.${req.date}`]: 'A' });
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
        await fetchRequests();
        $q.notify({ type: 'positive', message: 'Richieste approvate!' });
      } catch (e) {
        console.error('Error bulk approving', e);
        $q.notify({ type: 'negative', message: 'Errore durante approvazione multipla' });
      } finally {
        loading.value = false;
      }
    })();
  });
}

function bulkReject() {
  isBulkReject.value = true;
  rejectionReason.value = '';
  showRejectDialog.value = true;
}
</script>
