<template>
  <div class="q-mt-md">
    <!-- Section 1: Urgent Requests (Red Card) -->
    <q-card v-if="urgentRequests.length > 0" flat bordered class="bg-red-0 q-mb-md">
      <q-card-section class="q-pb-none">
        <div class="row items-center justify-between">
          <div class="text-h6 text-red-9">🚨 Richieste Urgenti</div>
          <q-badge color="red" text-color="white" :label="urgentRequests.length" />
        </div>
        <div class="text-caption text-red-7 q-mb-sm">
          L'amministratore ha richiesto la tua disponibilità per questi turni.
        </div>
      </q-card-section>

      <q-list separator>
        <q-item v-for="req in urgentRequests" :key="req.id" class="bg-white q-py-sm">
          <q-item-section avatar>
            <q-avatar icon="warning" color="red-1" text-color="red" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">
              {{ formatDate(req.date) }} -
              <q-badge :color="getShiftColor(req.originalShift)">{{ req.originalShift }}</q-badge>
            </q-item-label>
            <q-item-label caption lines="1">
              {{ req.reason === 'SHORTAGE' ? 'Carenza Personale' : 'Assenza' }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              unelevated
              size="sm"
              color="negative"
              label="Rispondi"
              icon="add_task"
              @click="openOfferDialog(req)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <!-- Section 2: Voluntary Offers (Blue/Grey Card) -->
    <q-card flat bordered class="bg-blue-0">
      <q-card-section class="q-pb-none">
        <div class="row items-center justify-between">
          <div class="text-h6 text-primary">🤝 Altre Proposte Copertura</div>
          <q-badge
            v-if="otherRequests.length > 0"
            color="primary"
            text-color="white"
            :label="otherRequests.length"
          />
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          Turni ancora scoperti nel reparto. Puoi offrirti volontariamente.
        </div>
      </q-card-section>

      <div v-if="loading" class="row justify-center q-pa-md">
        <q-spinner color="primary" size="2em" />
      </div>

      <div
        v-else-if="otherRequests.length === 0 && urgentRequests.length === 0"
        class="text-center text-grey q-pa-md text-caption"
      >
        Nessun turno disponibile per la copertura al momento.
      </div>

      <q-list v-else-if="otherRequests.length > 0" separator>
        <q-item v-for="req in otherRequests" :key="req.id" class="bg-white q-py-sm">
          <q-item-section avatar>
            <q-avatar icon="volunteer_activism" color="blue-1" text-color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">
              {{ formatDate(req.date) }} -
              <q-badge :color="getShiftColor(req.originalShift)">{{ req.originalShift }}</q-badge>
            </q-item-label>
            <q-item-label caption lines="1">
              {{ req.reason === 'SHORTAGE' ? 'Carenza Personale' : 'Assenza' }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              unelevated
              size="sm"
              color="primary"
              label="Offriti"
              icon="add_task"
              @click="openOfferDialog(req)"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else-if="urgentRequests.length > 0" class="text-center text-grey q-pa-md text-caption">
        Nessun'altra proposta disponibile.
      </div>
    </q-card>

    <!-- Offer Compatibility Dialog -->
    <q-dialog v-model="offerDialog.show" persistent>
      <!-- ... (Dialog remains the same) ... -->
      <q-card style="min-width: 350px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Candidatura Copertura</div>
          <div class="text-subtitle2">
            {{ formatDateLong(offerDialog.req?.date || '') }} - Turno
            {{ offerDialog.req?.originalShift }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-md">
          <div v-if="loadingCompatibility" class="row justify-center q-pa-md">
            <q-spinner color="primary" size="2em" />
            <div class="q-ml-sm">Verifica compatibilità...</div>
          </div>
          <div v-else-if="compatibleScenarios.length === 0">
            <q-banner class="bg-warning text-white" rounded>
              <template v-slot:avatar>
                <q-icon name="warning" />
              </template>
              Spiacenti, non sembri compatibile per la copertura di questo turno secondo le regole
              (riposo, smonto, ecc.).
            </q-banner>
          </div>
          <div v-else>
            <div class="text-subtitle2 q-mb-sm">Come vuoi coprire questo turno?</div>
            <q-list bordered separator>
              <q-item
                v-for="scenario in compatibleScenarios"
                :key="scenario.scenarioId + scenario.roleIndex"
                tag="label"
                v-ripple
                :active="selectedScenario === scenario"
                active-class="bg-blue-1"
              >
                <q-item-section avatar>
                  <q-radio v-model="selectedScenario" :val="scenario" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scenario.scenarioLabel }}</q-item-label>
                  <q-item-label caption>Incentivo: {{ scenario.incentive }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pb-md q-pr-md">
          <q-btn flat label="Annulla" color="grey" v-close-popup />
          <q-btn
            unelevated
            label="Invia"
            color="primary"
            :disable="!selectedScenario"
            @click="submitOffer"
            :loading="isSubmitting"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useShiftLogic } from '../../composables/useShiftLogic';
import type { ShiftRequest, ShiftCode, CompatibleScenario } from '../../types/models';
import { useQuasar, date as qDate } from 'quasar';

const authStore = useAuthStore();
const { getCompatibleScenarios } = useShiftLogic();
const $q = useQuasar();

const requests = ref<ShiftRequest[]>([]);
const loading = ref(true);

// Dialog State
const offerDialog = ref({
  show: false,
  req: null as ShiftRequest | null,
});
const loadingCompatibility = ref(false);
const compatibleScenarios = ref<CompatibleScenario[]>([]);
const selectedScenario = ref<CompatibleScenario | null>(null);
const isSubmitting = ref(false);

const urgentRequests = computed(() => {
  const myOpId = authStore.currentOperator?.id;
  if (!myOpId) return [];
  return requests.value.filter((r) => r.candidateIds?.includes(myOpId));
});

const otherRequests = computed(() => {
  const myOpId = authStore.currentOperator?.id;
  return requests.value.filter((r) => {
    const isUrgent = myOpId ? r.candidateIds?.includes(myOpId) : false;
    return !isUrgent;
  });
});

watch(
  () => authStore.currentOperator,
  (newOp) => {
    if (newOp) {
      void fetchRequests();
    }
  },
);

onMounted(async () => {
  await fetchRequests();
});

async function fetchRequests() {
  loading.value = true;
  try {
    const q = query(collection(db, 'shiftRequests'), where('status', '==', 'OPEN'));

    const snapshot = await getDocs(q);
    const loaded: ShiftRequest[] = [];
    const myOpId = authStore.currentOperator?.id;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as ShiftRequest;
      // Filter: Not mine, and I haven't offered yet
      const isMine = myOpId ? data.absentOperatorId === myOpId : false;
      const alreadyOffered = myOpId ? data.offers?.some((o) => o.operatorId === myOpId) : false;

      if (!isMine && !alreadyOffered) {
        const item = { ...data };
        item.id = docSnap.id;
        loaded.push(item);
      }
    });

    requests.value = loaded;
  } catch (e) {
    console.error('Error fetching active requests', e);
  } finally {
    loading.value = false;
  }
}

function openOfferDialog(req: ShiftRequest) {
  offerDialog.value.req = req;
  offerDialog.value.show = true;
  loadingCompatibility.value = true;
  compatibleScenarios.value = [];
  selectedScenario.value = null;

  if (authStore.currentOperator) {
    const opShift = authStore.currentOperator.schedule?.[req.date] || 'R';
    compatibleScenarios.value = getCompatibleScenarios(req.originalShift, opShift);
  }
  loadingCompatibility.value = false;
}

async function submitOffer() {
  if (!offerDialog.value.req || !selectedScenario.value || !authStore.currentOperator) return;

  isSubmitting.value = true;
  try {
    const reqRef = doc(db, 'shiftRequests', offerDialog.value.req.id);

    const offer = {
      id: `offer-${Date.now()}`,
      operatorId: authStore.currentOperator.id,
      operatorName: authStore.currentOperator.name,
      scenarioLabel: selectedScenario.value.scenarioLabel,
      timestamp: Date.now(),
    };

    await updateDoc(reqRef, {
      offers: arrayUnion(offer),
    });

    $q.notify({
      type: 'positive',
      message: 'Candidatura inviata! Ti faremo sapere presto.',
    });

    offerDialog.value.show = false;
    await fetchRequests();
  } catch (e) {
    console.error(e);
    $q.notify({ type: 'negative', message: "Errore durante l'invio" });
  } finally {
    isSubmitting.value = false;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

function formatDateLong(dt: string) {
  return qDate.formatDate(dt, 'DD MMMM YYYY', {
    months: [
      'Gennaio',
      'Febbraio',
      'Marzo',
      'Aprile',
      'Maggio',
      'Giugno',
      'Luglio',
      'Agosto',
      'Settembre',
      'Ottobre',
      'Novembre',
      'Dicembre',
    ],
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
    default:
      return 'grey';
  }
}
</script>
