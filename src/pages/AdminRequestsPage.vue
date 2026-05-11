/** * @file AdminRequestsPage.vue * @description Admin page for managing absence/shift requests and
swap proposals. * Orchestrates useAdminRequests, useAdminSwaps, and smart-suggest logic. * Provides
reactive context to sub-components via Vue provide/inject. * @author Nurse Hub Team * @created
2026-03-22 * @modified 2026-05-05 * @notes * - §1.11 compliant: logic extracted to composables;
template panels to sub-components. * - Sub-components inject 'adminReqsContext',
'adminSwapsContext', 'adminSmartContext'. */
<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { doc, updateDoc } from 'firebase/firestore';
import { storeToRefs } from 'pinia';

import { db } from '../boot/firebase';
import { useAdminRequests } from '../composables/useAdminRequests';
import { useAdminSwaps } from '../composables/useAdminSwaps';
import { useShiftLogic } from '../composables/useShiftLogic';
import { useAdminStore } from '../stores/adminStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useConfigStore } from '../stores/configStore';
import { useSecureLogger } from '../utils/secureLogger';
import type { ShiftRequest, ShiftCode, Operator, ScenarioGroup, Suggestion } from '../types/models';

import GlobalSyncBtn from '../components/common/GlobalSyncBtn.vue';
import AppDateInput from '../components/common/AppDateInput.vue';
import PendingRequestsList from '../components/requests/PendingRequestsList.vue';
import SwapRequestsList from '../components/requests/SwapRequestsList.vue';
import HistoryRequestsList from '../components/requests/HistoryRequestsList.vue';

// ─── Setup ───────────────────────────────────────────────────────────────────
const $q = useQuasar();
const logger = useSecureLogger();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const adminStore = useAdminStore();
const scenarioStore = useScenarioStore();
const { suggestions, selectedSuggestions, calculating } = storeToRefs(adminStore);
const { isOperatorEligibleForRole, getOperatorDisplayName } = useShiftLogic();

// Active tab
const activeTab = ref('pending');

// ─── Composables ─────────────────────────────────────────────────────────────
const reqs = useAdminRequests();
const swaps = useAdminSwaps(reqs.syncToSheets, reqs.operators, reqs.filters);

// Destructure for easier template usage and to fix v-model Ref types
const { 
  showApprovalDialog, 
  adminApprovalNote, 
  syncMode, 
  approvalContext, 
  processApproval,
  showConflictDialog,
  conflicts,
  isVerifying,
  startApprovalVerification
} = reqs;

const {
  showSwapApprovalDialog,
  adminSwapNote,
  swapSyncMode,
  approvalSwapContext,
  processSwapApproval,
} = swaps;

// ─── Smart-Suggest Logic ──────────────────────────────────────────────────────

function hasRestInWindow(op: Operator, date: string, windowDays = 14): boolean {
  if (!op.schedule) return false;
  const target = new Date(date);
  for (let i = -windowDays; i <= windowDays; i++) {
    if (i === 0) continue;
    const d = new Date(target.getTime() + i * 86400000);
    if (op.schedule[d.toISOString().split('T')[0]!] === 'R') return true;
  }
  return false;
}

function calculatePriority(
  op: Operator,
  currentShift: ShiftCode,
  targetShift: ShiftCode,
  date: string,
): number {
  if (currentShift === 'R') return hasRestInWindow(op, date) ? 10 : 5;
  if (currentShift === 'P' && targetShift === 'M') return 8;
  return 1;
}

async function findSubstitutes(req: ShiftRequest): Promise<void> {
  calculating.value[req.id] = true;
  await new Promise((r) => setTimeout(r, 800));

  const groups: ScenarioGroup[] = [];
  scenarioStore.scenarios
    .filter((s) => s.targetShift === req.originalShift)
    .forEach((scen) => {
      const group: ScenarioGroup = {
        id: scen.id,
        label: scen.label,
        positions: scen.roles.map((role) => ({
          roleLabel: role.roleLabel,
          originalShift: role.originalShift,
          newShift: role.newShift,
          ...(role.isNextDay !== undefined ? { isNextDay: role.isNextDay } : {}),
          ...(role.requiredNextShift !== undefined
            ? { requiredNextShift: role.requiredNextShift }
            : {}),
          candidates: [],
        })),
      };

      group.positions.forEach((pos) => {
        Object.values(reqs.operators.value).forEach((op) => {
          if (op.id === req.absentOperatorId || op.id === req.creatorId) return;

          if (isOperatorEligibleForRole(req.date, req.originalShift, op, pos)) {
            const shiftCheck = pos.isNextDay 
              ? (op.schedule?.[new Date(new Date(req.date).getTime() + 86400000).toISOString().split('T')[0]!] || 'R')
              : (op.schedule?.[req.date] || 'R');

            pos.candidates.push({
              operatorId: op.id,
              name: getOperatorDisplayName(op),
              ...(op.phone ? { phone: op.phone } : {}),
              currentShift: shiftCheck,
              proposal: pos.roleLabel,
              priority: calculatePriority(op, shiftCheck, req.originalShift, req.date),
            });
          }
        });
        pos.candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      });
      groups.push(group);
    });

  adminStore.setSuggestions(req.id, groups);
  selectedSuggestions.value[req.id] = [];
  calculating.value[req.id] = false;
}

function getSuggestions(id: string): ScenarioGroup[] {
  return suggestions.value[id] ?? [];
}

function isAllSelected(reqId: string, cands: Suggestion[]): boolean {
  if (!cands.length) return false;
  const sel = selectedSuggestions.value[reqId] ?? [];
  return cands.every((c) => sel.includes(c.operatorId));
}

function isSomeSelected(reqId: string, cands: Suggestion[]): boolean {
  const sel = selectedSuggestions.value[reqId] ?? [];
  const n = cands.filter((c) => sel.includes(c.operatorId)).length;
  return n > 0 && n < cands.length;
}

function toggleAllInPosition(reqId: string, cands: Suggestion[], val: boolean | null): void {
  const set = new Set(selectedSuggestions.value[reqId] ?? []);
  cands.forEach((c) => (val ? set.add(c.operatorId) : set.delete(c.operatorId)));
  selectedSuggestions.value[reqId] = Array.from(set);
}

async function publishRequest(req: ShiftRequest): Promise<void> {
  const selected = selectedSuggestions.value[req.id] ?? [];
  if (!selected.length) return;

  // UNIFIED FILTERING BEFORE PUBLISHING (Anti-Noise Guard)
  const currentOperators = reqs.operators.value;
  const scenarios = scenarioStore.scenarios.filter((s) => s.targetShift === req.originalShift);

  const validSelectedIds = selected.filter((opId) => {
    const op = currentOperators[opId];
    if (!op) return false;
    return scenarios.some((scen) =>
      scen.roles.some((role) => isOperatorEligibleForRole(req.date, req.originalShift, op, role)),
    );
  });

  if (validSelectedIds.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Nessuno dei candidati selezionati è più idoneo (tempo scaduto o cambio turno).',
    });
    return;
  }

  try {
    await updateDoc(doc(db, 'shiftRequests', req.id), { candidateIds: validSelectedIds });
    $q.notify({
      type: 'positive',
      message: `Richiesta pubblicata a ${validSelectedIds.length} operatori!`,
    });
    if (validSelectedIds.length < selected.length) {
      $q.notify({
        type: 'info',
        message: `${selected.length - validSelectedIds.length} candidati esclusi perché non più idonei.`,
      });
    }
  } catch (e) {
    logger.error('Error publishing', e);
    $q.notify({ type: 'negative', message: 'Errore pubblicazione' });
  }
}

// ─── Provide context to sub-components ───────────────────────────────────────
provide('adminReqsContext', reqs);
provide('adminSwapsContext', swaps);
provide('adminSmartContext', {
  suggestions,
  selectedSuggestions,
  calculating,
  findSubstitutes,
  getSuggestions,
  isAllSelected,
  isSomeSelected,
  toggleAllInPosition,
  publishRequest,
  callCandidate: reqs.callCandidate,
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await reqs.fetchOperators();
  await reqs.fetchUsersMap();
  reqs.initRealtimeRequests();
  swaps.initRealtimeSwaps();
  if (configStore.activeConfigId) void scenarioStore.loadScenarios(configStore.activeConfigId);
});

watch(
  () => configStore.activeConfigId,
  async (v) => {
    if (v) {
      await reqs.fetchOperators();
      void scenarioStore.loadScenarios(v);
      
      // Re-initialize listeners for the new config context
      reqs.initRealtimeRequests();
      swaps.stopRealtimeSwaps();
      swaps.initRealtimeSwaps();
    }
  },
);

watch(
  () => scheduleStore.lastUpdated,
  () => void reqs.fetchOperators(),
);

onUnmounted(() => {
  reqs.stopRealtimeRequests();
  swaps.stopRealtimeSwaps();
});

// Searchable operator filter logic
const filteredOperatorOptions = ref(reqs.operatorOptions.value);

watch(() => reqs.operatorOptions.value, (newVal) => {
  filteredOperatorOptions.value = newVal;
});

function setPeriod(type: 'week' | 'month' | 'today' | 'next7') {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  if (type === 'today') {
    from = now;
    to = now;
  } else if (type === 'week') {
    from = now;
    to = new Date(now.getTime() + 7 * 86400000);
  } else if (type === 'next7') {
    from = now;
    to = new Date(now.getTime() + 7 * 86400000);
  } else if (type === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  reqs.filters.value.dateFrom = from.toISOString().split('T')[0]!;
  reqs.filters.value.dateTo = to.toISOString().split('T')[0]!;
}

function filterOperators(val: string, update: (fn: () => void) => void) {
  if (val === '') {
    update(() => {
      filteredOperatorOptions.value = reqs.operatorOptions.value;
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    filteredOperatorOptions.value = reqs.operatorOptions.value.filter(
      (v) => v.label.toLowerCase().indexOf(needle) > -1
    );
  });
}
</script>

<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold text-primary">Gestione Richieste</div>
      <GlobalSyncBtn size="sm" />
    </div>

    <!-- Filters -->
    <q-card flat bordered class="q-mb-md shadow-1 bg-white" style="border-radius: 12px">
      <q-card-section class="q-pb-sm">
        <div class="row items-center q-mb-md">
          <q-icon name="tune" color="primary" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1 text-weight-bold">Filtri di Ricerca</div>
          <q-space />
          <q-btn flat dense color="grey-7" label="Reset Filtri" icon="restart_alt" size="sm" 
            @click="reqs.filters.value = { dateFrom: '', dateTo: '', operators: [], withOffers: false }" />
        </div>
        
        <div class="row q-col-gutter-md items-end">
          <!-- Date Range -->
          <div class="col-12 col-sm-6 col-md-2">
            <AppDateInput v-model="reqs.filters.value.dateFrom" label="Dal giorno" />
          </div>
          <div class="col-12 col-sm-6 col-md-2">
            <AppDateInput v-model="reqs.filters.value.dateTo" label="Al giorno" />
          </div>

          <!-- Quick Periods -->
          <div class="col-12 col-md-3">
            <div class="flex q-gutter-xs no-wrap items-center" style="height: 40px">
              <q-btn flat dense color="primary" label="Oggi" @click="setPeriod('today')" class="q-px-sm" size="sm" border />
              <q-btn flat dense color="primary" label="+7gg" @click="setPeriod('next7')" class="q-px-sm" size="sm" />
              <q-btn flat dense color="primary" label="Mese" @click="setPeriod('month')" class="q-px-sm" size="sm" />
            </div>
          </div>
          
          <!-- Operator Multi-Select -->
          <div class="col-12 col-md-4">
            <q-select
              v-model="reqs.filters.value.operators"
              :options="filteredOperatorOptions"
              label="Operatori"
              multiple
              use-chips
              use-input
              dense
              outlined
              bg-color="white"
              emit-value
              map-options
              clearable
              @filter="filterOperators"
              class="operator-select"
            >
              <template v-slot:prepend>
                <q-icon name="group" color="primary" />
              </template>
            </q-select>
          </div>

          <!-- Sorting -->
          <div class="col-12 col-sm-6 col-md-2">
            <q-select
              v-model="reqs.sortBy.value"
              :options="reqs.sortOptions"
              label="Ordina"
              dense
              outlined
              bg-color="white"
              emit-value
              map-options
            >
              <template v-slot:prepend>
                <q-icon name="sort" color="primary" />
              </template>
            </q-select>
          </div>

          <!-- Offers Toggle -->
          <div class="col-12 col-sm-6 col-md-2">
            <div class="filter-toggle-box bg-blue-1 q-pa-xs rounded-borders flex items-center justify-between" style="height: 40px; border: 1px solid #bbdefb">
              <div class="text-caption text-weight-bold text-primary q-ml-sm">Solo offerte</div>
              <q-toggle v-model="reqs.filters.value.withOffers" color="primary" dense />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Bulk Actions -->
    <q-banner v-if="reqs.selectedRequests.value.length > 0" class="bg-primary text-white q-mb-md" dense>
      <template v-slot:avatar><q-icon name="check_circle" /></template>
      <div class="row items-center">
        <span class="col">{{ reqs.selectedRequests.value.length }} richieste selezionate</span>
        <q-btn flat label="Approva Tutte" icon="check" @click="reqs.bulkApprove()" />
        <q-btn flat label="Rifiuta Tutte" icon="close" @click="reqs.bulkReject()" />
        <q-btn flat round dense icon="clear" @click="reqs.selectedRequests.value = []" />
      </div>
    </q-banner>

    <!-- Tabs -->
    <div class="row items-center justify-between q-mb-xs">
      <q-tabs v-model="activeTab" dense class="text-grey col" active-color="primary" indicator-color="primary"
        align="justify" narrow-indicator>
        <q-tab name="pending" label="In Attesa" />
        <q-tab name="history" label="Storico" />
        <q-tab name="swaps" label="Cambi Turno" icon="swap_horiz">
          <q-badge v-if="swaps.pendingSwaps.value.length > 0" color="red" floating>
            {{ swaps.pendingSwaps.value.length }}
          </q-badge>
        </q-tab>
      </q-tabs>
      <q-btn flat round dense icon="refresh" color="primary" class="q-ml-xs"
        :loading="reqs.loading.value || swaps.swapLoading.value" @click="
          () => {
            reqs.initRealtimeRequests();
            swaps.stopRealtimeSwaps();
            swaps.initRealtimeSwaps();
          }
        ">
        <q-tooltip>Aggiorna</q-tooltip>
      </q-btn>
    </div>

    <q-separator />

    <q-tab-panels v-model="activeTab" animated class="bg-transparent">
      <q-tab-panel name="pending" class="q-pa-none">
        <PendingRequestsList />
      </q-tab-panel>

      <q-tab-panel name="history" class="q-pa-none">
        <HistoryRequestsList />
      </q-tab-panel>

      <q-tab-panel name="swaps" class="q-pa-none">
        <SwapRequestsList />
      </q-tab-panel>
    </q-tab-panels>

    <!-- Reject Dialog -->
    <q-dialog v-model="reqs.showRejectDialog.value">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Motivo del Rifiuto</div>
          <div class="text-caption text-grey">Campo obbligatorio</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="reqs.rejectionReason.value" type="textarea" label="Inserisci il motivo" rows="4" outlined
            autofocus :rules="[(val) => !!val || 'Motivo obbligatorio']" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn flat label="Conferma Rifiuto" color="negative" @click="reqs.confirmReject()"
            :disable="!reqs.rejectionReason.value" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Approval Dialog -->
    <q-dialog v-model="showApprovalDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-avatar icon="check_circle" color="positive" text-color="white" />
          <span class="q-ml-sm text-h6">Conferma Copertura</span>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="approvalContext?.offers?.length" class="q-mb-md">
            <div class="text-subtitle2 q-mb-xs">Operatori Sostituti:</div>
            <q-list dense bordered class="rounded-borders bg-blue-1">
              <q-item v-for="off in approvalContext.offers" :key="off.id">
                <q-item-section avatar>
                  <q-icon name="person" color="primary" size="xs" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-weight-bold">{{ off.operatorName }}</q-item-label>
                  <q-item-label caption>{{ off.roleLabel }} ({{ off.newShift }})</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div class="q-mt-sm text-caption text-grey-8">
              Stai confermando la copertura per <strong>{{ reqs.getOperatorName(approvalContext.req.absentOperatorId, approvalContext.req) }}</strong>.
            </div>
          </div>
          <div v-else-if="approvalContext?.req" class="q-mb-md">
            Stai confermando la copertura per 
            <strong>{{ reqs.getOperatorName(approvalContext.req.absentOperatorId, approvalContext.req) }}</strong>.
          </div>
          <div class="bg-grey-2 q-pa-md rounded-borders">
            <div class="text-subtitle2 q-mb-sm">Sincronizzazione Google Sheets</div>
            <q-btn-toggle v-model="syncMode" spread no-caps rounded unelevated toggle-color="primary" color="white"
              text-color="primary" :options="[
                { label: 'Automatica', value: 'auto' },
                { label: 'Manuale', value: 'manual' },
              ]" />
            <div class="text-caption text-grey-7 q-mt-sm">
              <span v-if="syncMode === 'auto'">Il turno verrà aggiornato automaticamente sul file Excel Master.</span>
              <span v-else>Dovrai aggiornare il file Excel Master manualmente in un secondo momento.</span>
            </div>
          </div>

          <!-- Admin Note Field -->
          <div class="q-mt-md">
            <q-input v-model="adminApprovalNote" filled dense label="Note per Excel (es. tipo timbratura)"
              hint="Opzionale: apparirà nella cella del turno su Excel" class="bg-white" />
          </div>
        </q-card-section>
        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn unelevated color="positive" label="Conferma & Chiudi" @click="startApprovalVerification()"
            :loading="isVerifying || reqs.loading.value" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Conflict Resolution Dialog (Expert System Step 1.2) -->
    <q-dialog v-model="showConflictDialog" persistent>
      <q-card style="min-width: 450px">
        <q-card-section class="bg-warning text-white row items-center">
          <q-icon name="warning" size="md" class="q-mr-sm" />
          <div class="text-h6">Incongruenza Turni Rilevata!</div>
        </q-card-section>

        <q-card-section class="q-pa-md">
          <div class="text-body1 q-mb-md">
            Il sistema ha rilevato che i turni su <strong>Excel</strong> non corrispondono a quelli dell'App.
          </div>

          <q-list bordered separator class="rounded-borders q-mb-md">
            <q-item v-for="(conflict, index) in conflicts" :key="index">
              <q-item-section avatar>
                <q-avatar color="grey-2" text-color="primary" icon="person" size="sm" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-bold">{{ conflict.operatorName }}</q-item-label>
                <q-item-label caption>Data: {{ reqs.formatDate(conflict.date) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row no-wrap items-center">
                  <q-badge color="grey-7" :label="conflict.expected" />
                  <q-icon name="arrow_forward" size="xs" class="q-mx-xs" />
                  <q-badge color="negative" :label="conflict.actual" class="text-weight-bolder" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="bg-red-1 q-pa-sm rounded-borders border-negative q-mb-sm">
            <div class="text-caption text-negative text-weight-bold">
              Procedendo con "Forza", il valore su Excel verrà sovrascritto.
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-gutter-sm q-pa-md">
          <q-btn flat label="Annulla" color="grey-8" v-close-popup />
          <q-btn unelevated label="Gestione Manuale" color="grey-3" text-color="black" 
            @click="processApproval('manual')" />
          <q-btn unelevated label="Forza Sovrascrittura" color="negative" 
            @click="processApproval('force')" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Swap Approval Dialog -->
    <q-dialog v-model="showSwapApprovalDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <q-avatar icon="swap_horiz" color="primary" text-color="white" />
          <span class="q-ml-sm text-h6">Conferma Approvazione Cambio</span>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="approvalSwapContext" class="q-mb-md">
            Stai confermando il cambio turno del
            <strong>{{ reqs.formatDate(approvalSwapContext.date) }}</strong><br />
            tra
            <strong>{{ approvalSwapContext.creatorName || approvalSwapContext.creatorId }}</strong>
            e
            <strong>{{
              approvalSwapContext.counterpartName ||
              approvalSwapContext.counterpartId ||
              'Assegnazione'
              }}</strong>.
          </div>
          <div class="bg-grey-2 q-pa-md rounded-borders">
            <div class="text-subtitle2 q-mb-sm">Sincronizzazione Google Sheets</div>
            <q-btn-toggle v-model="swapSyncMode" spread no-caps rounded unelevated toggle-color="primary" color="white"
              text-color="primary" :options="[
                { label: 'Automatica', value: 'auto' },
                { label: 'Manuale', value: 'manual' },
              ]" />
            <div class="text-caption text-grey-7 q-mt-sm">
              <span v-if="swapSyncMode === 'auto'">I turni invertiti verranno aggiornati automaticamente sul file Excel
                Master per
                entrambi gli operatori.</span>
              <span v-else> Dovrai aggiornare i turni degli operatori sul file Excel Master manualmente in un
                secondo momento. </span>
            </div>
          </div>

          <!-- Admin Note Field -->
          <div class="q-mt-md">
            <q-input v-model="adminSwapNote" filled dense label="Note per Excel (es. accordo verbale)"
              hint="Opzionale: apparirà nella cella del turno su Excel" class="bg-white" />
          </div>
        </q-card-section>
        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn unelevated color="positive" label="Approva & Applica" @click="processSwapApproval()"
            :loading="swaps.swapLoading.value" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
