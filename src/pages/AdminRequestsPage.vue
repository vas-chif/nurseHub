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
const { checkCompliance } = useShiftLogic();

// Active tab
const activeTab = ref('pending');

// ─── Composables ─────────────────────────────────────────────────────────────
const reqs = useAdminRequests();
const swaps = useAdminSwaps(reqs.syncToSheets, reqs.operators);

// Destructure for easier template usage and to fix v-model Ref types
const { showApprovalDialog, adminApprovalNote, syncMode, approvalContext, processApproval } = reqs;

const {
  showSwapApprovalDialog,
  adminSwapNote,
  swapSyncMode,
  approvalSwapContext,
  processSwapApproval,
} = swaps;

// ─── Smart-Suggest Logic ──────────────────────────────────────────────────────
const EXCLUDED_KEYWORDS = ['SUB INTENSIVA', 'PS', 'BLOCCO OPERATORIO', 'IFC', 'COORDINATORE'];

function isExcluded(op: Operator): boolean {
  const n = op.name.toUpperCase();
  return EXCLUDED_KEYWORDS.some((k) => n.includes(k));
}

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
          if (op.id === req.absentOperatorId || op.id === req.creatorId || isExcluded(op)) return;
          const nextDate = new Date(new Date(req.date).getTime() + 86400000)
            .toISOString()
            .split('T')[0]!;
          const cur = op.schedule?.[req.date] ?? 'R';
          const nxt = op.schedule?.[nextDate] ?? 'R';
          let match = pos.isNextDay ? nxt === pos.originalShift : cur === pos.originalShift;
          if (match && pos.requiredNextShift && nxt !== pos.requiredNextShift) match = false;
          if (match) {
            const shiftCheck = pos.isNextDay ? nxt : cur;
            const compliance = checkCompliance(shiftCheck, pos.newShift);
            if (compliance.allowed) {
              pos.candidates.push({
                operatorId: op.id,
                name: op.name,
                ...(op.phone ? { phone: op.phone } : {}),
                currentShift: shiftCheck,
                proposal: pos.roleLabel,
                priority: calculatePriority(op, cur, req.originalShift, req.date),
              });
            }
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
  try {
    await updateDoc(doc(db, 'shiftRequests', req.id), { candidateIds: selected });
    $q.notify({
      type: 'positive',
      message: `Richiesta pubblicata a ${selected.length} operatori!`,
    });
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
      // Re-subscribe swaps with the now-available configId
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
</script>

<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold text-primary">Gestione Richieste</div>
      <GlobalSyncBtn size="sm" />
    </div>

    <!-- Filters -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">Filtri</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-3">
            <AppDateInput v-model="reqs.filters.value.dateFrom" label="Da Data" hint="Filtra da" />
          </div>
          <div class="col-12 col-md-3">
            <AppDateInput v-model="reqs.filters.value.dateTo" label="A Data" hint="Filtra a" />
          </div>
          <div class="col-12 col-md-3">
            <q-select v-model="reqs.filters.value.operators" :options="reqs.operatorOptions.value"
              label="Filtra Operatori" multiple use-chips dense outlined emit-value map-options clearable />
          </div>
          <div class="col-12 col-md-3">
            <q-select v-model="reqs.sortBy.value" :options="reqs.sortOptions" label="Ordina per" dense outlined
              emit-value map-options />
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
          <div v-if="approvalContext?.offer" class="q-mb-md">
            Stai accettando l'offerta di <strong>{{ approvalContext.offer.operatorName }}</strong>.
          </div>
          <div v-else-if="approvalContext?.req" class="q-mb-md">
            Stai confermando la copertura per
            <strong>{{
              reqs.getOperatorName(approvalContext.req.absentOperatorId, approvalContext.req)
              }}</strong>.
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
          <q-btn unelevated color="positive" label="Conferma & Chiudi" @click="processApproval()"
            :loading="reqs.loading.value" />
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
