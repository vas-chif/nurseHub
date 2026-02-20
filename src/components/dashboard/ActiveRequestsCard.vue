<template>
  <div class="q-mt-md">
    <q-card flat bordered class="bg-white">
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <q-tab name="opportunities">
          <div class="row items-center no-wrap">
            <q-icon name="campaign" class="q-mr-sm" />
            <div>Opportunità</div>
            <q-badge
              v-if="urgentRequests.length + otherRequests.length > 0"
              color="red"
              floating
              rounded
              class="q-ml-xs"
            >
              {{ urgentRequests.length + otherRequests.length }}
            </q-badge>
          </div>
        </q-tab>
        <q-tab name="history" icon="history" label="Le mie Candidature" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- TAB 1: Opportunità (Urgent + Other) -->
        <q-tab-panel name="opportunities" class="q-pa-none">
          <!-- Urgent Requests Section -->
          <div v-if="urgentRequests.length > 0" class="bg-red-0 q-pa-sm">
            <div class="row items-center justify-between q-px-sm q-py-xs">
              <div class="text-subtitle2 text-red-9">🚨 Richieste Urgenti</div>
            </div>
            <q-list separator class="bg-white rounded-borders">
              <q-item v-for="req in urgentRequests" :key="req.id" class="q-py-sm">
                <q-item-section avatar>
                  <q-avatar icon="warning" color="red-1" text-color="red" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold">
                    {{ formatDate(req.date) }} -
                    <q-badge :color="getShiftColor(req.originalShift)">{{
                      req.originalShift
                    }}</q-badge>
                  </q-item-label>
                  <q-item-label caption lines="1">
                    {{ req.reason === 'SHORTAGE' ? 'Carenza Personale' : 'Assenza' }}
                  </q-item-label>
                  <q-item-label v-if="req.requestNote" caption class="text-italic">
                    "{{ req.requestNote }}"
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
          </div>

          <!-- Other Requests Section -->
          <div class="q-pa-sm">
            <div class="row items-center justify-between q-px-sm q-py-xs">
              <div class="text-subtitle2 text-primary">🤝 Altre Proposte</div>
              <q-btn
                flat
                round
                dense
                color="primary"
                icon="refresh"
                :loading="loading"
                @click="fetchRequests"
              >
                <q-tooltip>Aggiorna</q-tooltip>
              </q-btn>
            </div>

            <div v-if="loading" class="row justify-center q-pa-md">
              <q-spinner color="primary" size="2em" />
            </div>

            <div
              v-else-if="otherRequests.length === 0 && urgentRequests.length === 0"
              class="text-center text-grey q-pa-md text-caption"
            >
              Nessun turno disponibile al momento.
            </div>

            <q-list v-else-if="otherRequests.length > 0" separator class="bg-white rounded-borders">
              <q-item v-for="req in otherRequests" :key="req.id" class="q-py-sm">
                <q-item-section avatar>
                  <q-avatar icon="volunteer_activism" color="blue-1" text-color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold">
                    {{ formatDate(req.date) }} -
                    <q-badge :color="getShiftColor(req.originalShift)">{{
                      req.originalShift
                    }}</q-badge>
                  </q-item-label>
                  <q-item-label caption lines="1">
                    {{ req.reason === 'SHORTAGE' ? 'Carenza Personale' : 'Assenza' }}
                  </q-item-label>
                  <q-item-label v-if="req.requestNote" caption class="text-italic">
                    "{{ req.requestNote }}"
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
          </div>
        </q-tab-panel>

        <!-- TAB 2: Le mie Candidature (History) -->
        <q-tab-panel name="history" class="q-pa-none">
          <div v-if="loading" class="row justify-center q-pa-md">
            <q-spinner color="primary" size="2em" />
          </div>
          <div v-else-if="myHistoryRequests.length === 0" class="text-center text-grey q-pa-lg">
            Nessuna candidatura inviata di recente.
          </div>
          <q-list v-else separator>
            <q-item v-for="req in myHistoryRequests" :key="req.id" class="q-py-md">
              <q-item-section avatar>
                <q-avatar
                  :icon="getMyOfferIcon(req)"
                  :color="getMyOfferAvatarColor(req)"
                  :text-color="getMyOfferAvatarTextColor(req)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold">
                  Assenza: {{ formatDate(req.date) }} - Turno {{ req.originalShift }}
                </q-item-label>
                <q-item-label caption>
                  Creata il: {{ formatFullDate(req.createdAt) }}
                </q-item-label>
                <q-item-label caption v-if="getMyOfferTimestamp(req)">
                  Candidatura del: {{ formatFullDate(getMyOfferTimestamp(req)) }}
                </q-item-label>
                <q-item-label caption v-if="getMyOfferLabel(req)">
                  Proposta: <span class="text-italic">{{ getMyOfferLabel(req) }}</span>
                </q-item-label>
                <div class="q-mt-xs">
                  <q-badge :color="getMyOfferStatusColor(req)">
                    {{ getMyOfferStatusLabel(req) }}
                  </q-badge>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <!-- Offer Compatibility Dialog -->
    <q-dialog v-model="offerDialog.show" persistent>
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
            <!-- Shift Preview Section -->
            <div class="q-mb-md">
              <div class="text-subtitle2 q-mb-xs">Il tuo turno attuale:</div>
              <div class="row q-gutter-xs justify-center no-wrap">
                <div
                  v-for="day in surroundingShifts"
                  :key="day.date"
                  class="flex column items-center q-pa-xs rounded-borders"
                  :class="day.isTarget ? 'bg-primary-1 border-primary' : 'bg-grey-2'"
                  style="min-width: 60px; border: 1px solid transparent"
                >
                  <div class="text-caption text-weight-bold">{{ day.label }}</div>
                  <q-badge :color="getShiftColor(day.shift)" size="md">{{ day.shift }}</q-badge>
                </div>
              </div>
            </div>

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
                  <q-item-label>{{ scenario.roleLabel }}</q-item-label>
                  <q-item-label caption>{{ scenario.incentive }}</q-item-label>
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
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useShiftLogic } from '../../composables/useShiftLogic';
import type { ShiftRequest, ShiftCode, CompatibleScenario, Operator } from '../../types/models';
import { useQuasar, date as qDate } from 'quasar';

const authStore = useAuthStore();
const { getCompatibleScenarios } = useShiftLogic();
const $q = useQuasar();

const activeTab = ref('opportunities');
const requests = ref<ShiftRequest[]>([]); // Open Opportunities
const historyRequests = ref<ShiftRequest[]>([]); // My History
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
const surroundingShifts = computed(() => {
  if (!offerDialog.value.req || !authStore.currentOperator) return [];
  const targetDateStr = offerDialog.value.req.date;
  const targetDate = new Date(targetDateStr);
  const result = [];

  for (let i = -2; i <= 2; i++) {
    const d = qDate.addToDate(targetDate, { days: i });
    const dStr = qDate.formatDate(d, 'YYYY-MM-DD');
    const label = i === 0 ? 'OGGI' : qDate.formatDate(d, 'DD/MM');
    result.push({
      date: dStr,
      label,
      shift: authStore.currentOperator.schedule?.[dStr] || 'R',
      isTarget: i === 0,
    });
  }
  return result;
});

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

const myHistoryRequests = computed(() => historyRequests.value);

watch(
  () => authStore.currentOperator,
  (newOp: Operator | null) => {
    if (newOp) {
      void fetchRequests();
    }
  },
);

watch(activeTab, () => {
  void fetchRequests();
});

onMounted(async () => {
  await fetchRequests();
});

async function fetchRequests() {
  const myOpId = authStore.currentOperator?.id;
  if (!myOpId) return;

  loading.value = true;
  try {
    // 1. Fetch Opportunities (OPEN requests)
    if (activeTab.value === 'opportunities') {
      const q = query(collection(db, 'shiftRequests'), where('status', '==', 'OPEN'));
      const snapshot = await getDocs(q);
      const loaded: ShiftRequest[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ShiftRequest;
        // Filter: Not mine, and I haven't offered yet
        const isMine = myOpId ? data.absentOperatorId === myOpId : false;
        // Check new field OR legacy array scan (client side check for safety)
        const alreadyOffered =
          data.offeringOperatorIds?.includes(myOpId) ||
          data.offers?.some((o) => o.operatorId === myOpId) ||
          false;

        if (!isMine && !alreadyOffered) {
          const item = { ...data };
          item.id = docSnap.id;
          loaded.push(item);
        }
      });
      requests.value = loaded;
    }

    // 2. Fetch History (My offers)
    // We try to use the new field efficient query.
    if (activeTab.value === 'history') {
      // Primary query: explicit offeringOperatorIds (new requests)
      // For existing history, we might miss them if we didn't migrate.
      // Assuming 'offeringOperatorIds' is populated from now on.
      const qHistory = query(
        collection(db, 'shiftRequests'),
        where('offeringOperatorIds', 'array-contains', myOpId),
        orderBy('createdAt', 'desc'),
      );
      const histSnap = await getDocs(qHistory);
      const loadedHist: ShiftRequest[] = [];
      histSnap.forEach((d) => loadedHist.push({ id: d.id, ...d.data() } as ShiftRequest));

      historyRequests.value = loadedHist;
    }
  } catch (e) {
    console.error('Error fetching requests', e);
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
    compatibleScenarios.value = getCompatibleScenarios(
      req.originalShift,
      opShift,
      req.date,
      authStore.currentOperator.schedule,
    );
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
      scenarioLabel: `${selectedScenario.value.scenarioLabel} - ${selectedScenario.value.roleLabel}`,
      timestamp: Date.now(),
    };

    await updateDoc(reqRef, {
      offers: arrayUnion(offer),
      offeringOperatorIds: arrayUnion(authStore.currentOperator.id), // Add to lookup array
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

function formatFullDate(ts: number | string | undefined) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMyOffer(req: ShiftRequest) {
  const myOpId = authStore.currentOperator?.id;
  if (!myOpId || !req.offers) return null;
  return req.offers.find((o) => o.operatorId === myOpId) || null;
}

function getMyOfferTimestamp(req: ShiftRequest) {
  const offer = getMyOffer(req);
  return offer?.timestamp;
}

function getMyOfferLabel(req: ShiftRequest) {
  return getMyOffer(req)?.scenarioLabel || '';
}

function getMyOfferStatusLabel(req: ShiftRequest) {
  const myOpId = authStore.currentOperator?.id;
  if (!myOpId) return 'Sconosciuto';

  if (req.status === 'CLOSED') {
    const myOffer = getMyOffer(req);
    // Use the acceptedOfferId explicitly if available
    if (myOffer && req.acceptedOfferId === myOffer.id) {
      return 'Approvata - Assegnato a te';
    } else {
      return 'Rifiutata / Coperta da altri';
    }
  }
  if (req.status === 'EXPIRED') return 'Scaduta / Annullata';

  const myOffer = getMyOffer(req);
  if (myOffer?.isRejected) return "Rifiutata dall'Admin";

  return 'In Valutazione';
}

function getMyOfferStatusColor(req: ShiftRequest) {
  const label = getMyOfferStatusLabel(req);
  if (label.includes('Approvata')) return 'positive';
  if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta'))
    return 'negative';
  if (label.includes('Valutazione')) return 'warning';
  return 'primary';
}

function getMyOfferIcon(req: ShiftRequest) {
  const label = getMyOfferStatusLabel(req);
  if (label.includes('Approvata')) return 'check_circle';
  if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta'))
    return 'cancel';
  return 'hourglass_empty';
}

function getMyOfferAvatarColor(req: ShiftRequest) {
  const label = getMyOfferStatusLabel(req);
  if (label.includes('Approvata')) return 'positive';
  if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta'))
    return 'red-1';
  return 'grey-2';
}

function getMyOfferAvatarTextColor(req: ShiftRequest) {
  const label = getMyOfferStatusLabel(req);
  if (label.includes('Approvata')) return 'white';
  if (label.includes('Rifiutata') || label.includes('Scaduta') || label.includes('Coperta'))
    return 'negative';
  return 'grey-7';
}
</script>
