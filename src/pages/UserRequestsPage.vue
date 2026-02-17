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
            <q-input v-model="formData.date" type="date" label="Data Assenza" outlined dense />
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
      <q-item v-for="req in requests" :key="req.id">
        <q-item-section>
          <q-item-label class="text-weight-bold">
            {{ formatDate(req.date) }}
            <span v-if="req.startTime && req.endTime" class="text-weight-regular text-grey-8">
              ({{ req.startTime }} - {{ req.endTime }})
            </span>
            <q-badge v-else color="primary" class="q-ml-sm">{{ req.originalShift }}</q-badge>
          </q-item-label>
          <q-item-label caption>{{ getReasonLabel(req.reason) }}</q-item-label>
          <q-item-label caption v-if="req.requestNote">Note: {{ req.requestNote }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-chip :color="getStatusColor(req.status)" text-color="white" size="sm">
            {{ req.status }}
          </q-chip>
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import type { ShiftRequest, ShiftCode, RequestReason, Operator } from '../types/models';

const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const submitting = ref(false);

const inputMode = ref<'SHIFT' | 'TIME'>('SHIFT');

const formData = ref({
  date: qDate.formatDate(new Date(), 'YYYY-MM-DD'),
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
const selectedOperatorId = ref(authStore.currentOperator?.id || '');
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

  await fetchRequests();
});

async function fetchRequests() {
  if (!authStore.currentUser?.uid) return;
  try {
    const q = query(
      collection(db, 'shiftRequests'),
      where('creatorId', '==', authStore.currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    requests.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest);
  } catch (e) {
    console.error('Error fetching requests', e);
  }
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

    const newReq: Omit<ShiftRequest, 'id'> = {
      date: formData.value.date,
      // If TIME mode, we might set originalShift to a dummy or keep it generic 'A'
      // But let's set M/P/N only if SHIFT mode
      originalShift: inputMode.value === 'SHIFT' ? formData.value.shift : 'A',
      reason: formData.value.reason,
      status: 'OPEN',
      creatorId: authStore.currentUser!.uid,
      absentOperatorId: targetOperatorId,
      createdAt: Date.now(),
      requestNote: formData.value.note,
      ...(inputMode.value === 'TIME' && formData.value.startTime
        ? { startTime: formData.value.startTime }
        : {}),
      ...(inputMode.value === 'TIME' && formData.value.endTime
        ? { endTime: formData.value.endTime }
        : {}),
    };

    await addDoc(collection(db, 'shiftRequests'), newReq);
    $q.notify({ type: 'positive', message: 'Richiesta inviata con successo' });

    // Reset form
    formData.value.note = '';
    formData.value.startTime = '';
    formData.value.endTime = '';
    await fetchRequests();
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

function getStatusColor(status: string) {
  if (status === 'OPEN') return 'green';
  if (status === 'CLOSED') return 'grey';
  return 'orange';
}
</script>
