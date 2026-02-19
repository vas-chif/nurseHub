<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Le tue Richieste</div>

    <q-card flat bordered class="q-mb-md">
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

    <!-- List of previous requests -->
    <div class="text-h6 q-my-md">Storico Richiesta</div>
    <div v-if="requests.length === 0" class="text-grey text-center q-py-lg">
      Nessuna richiesta effettuata.
    </div>

    <q-list separator bordered class="bg-white rounded-borders" v-else>
      <q-expansion-item
        v-for="req in requests"
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
          </q-item-section>
          <q-item-section side>
            <q-chip :color="getStatusColor(req.status)" text-color="white" size="sm">
              {{ req.status }}
            </q-chip>
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

            <div v-if="req.status === 'CLOSED'" class="text-positive">
              <div class="row items-center">
                <q-icon name="check_circle" class="q-mr-xs" />
                <span class="text-weight-bold">Approvata</span>
                <span v-if="req.approvalTimestamp" class="q-ml-xs text-caption">
                  il {{ formatFullDate(req.approvalTimestamp) }}
                </span>
              </div>
            </div>

            <div v-if="req.status === 'EXPIRED'" class="text-negative">
              <div class="row items-center">
                <q-icon name="cancel" class="q-mr-xs" />
                <span class="text-weight-bold">Mancata Approvazione / Scaduta</span>
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import type { Unsubscribe } from 'firebase/firestore';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import type { ShiftRequest, ShiftCode, RequestReason, Operator } from '../types/models';

const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const submitting = ref(false);
const loading = ref(false);
let unsubscribe: Unsubscribe | null = null;

const inputMode = ref<'SHIFT' | 'TIME'>('SHIFT');

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
      batch.push(addDoc(collection(db, 'shiftRequests'), newReq));
    }

    await Promise.all(batch);

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

function getStatusColor(status: string) {
  switch (status) {
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
</script>
