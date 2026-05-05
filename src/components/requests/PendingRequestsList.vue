/**
 * @file PendingRequestsList.vue
 * @description Sub-component for the Admin Requests page — renders the pending and history tab panels.
 *   Receives composable state via Vue `inject` provided by AdminRequestsPage.vue.
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @notes
 * - §1.11 decomposition from AdminRequestsPage.vue.
 * - Uses inject('adminReqsContext') for reactive state and actions.
 * - Smart-suggest state (findSubstitutes, suggestions, etc.) injected via 'adminSmartContext'.
 */
<script setup lang="ts">
import { inject } from 'vue';
import type { useAdminRequests } from '../../composables/useAdminRequests';
import type { ShiftRequest, ShiftCode, ScenarioGroup, Suggestion } from '../../types/models';
import { useShiftLogic } from '../../composables/useShiftLogic';
import type { Ref } from 'vue';

const ctx = inject<ReturnType<typeof useAdminRequests>>('adminReqsContext')!;
const smart = inject<{
  suggestions: Ref<Record<string, ScenarioGroup[]>>;
  selectedSuggestions: Ref<Record<string, string[]>>;
  calculating: Ref<Record<string, boolean>>;
  findSubstitutes: (req: ShiftRequest) => void;
  getSuggestions: (id: string) => ScenarioGroup[];
  isAllSelected: (id: string, cands: Suggestion[]) => boolean;
  isSomeSelected: (id: string, cands: Suggestion[]) => boolean;
  toggleAllInPosition: (id: string, cands: Suggestion[], val: boolean | null) => void;
  publishRequest: (req: ShiftRequest) => void;
}>('adminSmartContext')!;

const { isRequestExpired } = useShiftLogic();

function getShiftChipColor(code: ShiftCode): string {
  const map: Record<string, string> = { M: 'amber-9', P: 'deep-orange-6', N: 'blue-8' };
  return map[code] ?? 'grey-7';
}
</script>

<template>
  <!-- ===== PENDING TAB ===== -->
  <q-tab-panel name="pending" class="q-pa-none">
    <div v-if="ctx.loading.value" class="q-pa-md">
      <q-item v-for="n in 3" :key="n" class="q-mb-sm bg-white shadow-1">
        <q-item-section avatar><q-skeleton type="QCheckbox" /></q-item-section>
        <q-item-section avatar><q-skeleton type="QAvatar" /></q-item-section>
        <q-item-section>
          <q-skeleton type="text" width="40%" />
          <q-skeleton type="text" width="60%" />
        </q-item-section>
      </q-item>
    </div>

    <div v-else-if="ctx.filteredPendingRequests.value.length === 0" class="text-center text-grey q-pa-lg">
      Nessuna richiesta in attesa.
    </div>

    <div v-else class="q-list--bordered">
      <q-expansion-item v-for="req in ctx.filteredPendingRequests.value" :key="req.id" group="requests"
        class="bg-white q-mb-sm shadow-1" header-class="q-py-md">
        <template v-slot:header>
          <q-item-section avatar>
            <q-checkbox v-model="ctx.selectedRequests.value" :val="req.id" @click.stop />
          </q-item-section>
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white">
              {{ ctx.getOperatorInitials(req.absentOperatorId ?? req.creatorId, req) }}
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-subtitle1 text-weight-bold">
              {{ ctx.getOperatorName(req.absentOperatorId ?? req.creatorId, req) }}
            </q-item-label>
            <q-item-label caption>
              Assenza: {{ ctx.formatDate(req.date) }} -
              <q-badge :color="ctx.getShiftColor(req.originalShift)" class="q-ml-xs">{{ req.originalShift }}</q-badge>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="text-caption text-grey">{{ ctx.formatDate(req.createdAt) }}</div>
            <div class="row items-center q-gutter-x-sm q-mt-xs">
              <q-badge v-if="ctx.getActiveOffersCount(req) > 0" color="secondary" rounded>
                {{ ctx.getActiveOffersCount(req) }} Offert{{ ctx.getActiveOffersCount(req) === 1 ? 'a' : 'e' }}
              </q-badge>
              <q-badge :color="ctx.getStatusColor(req)" :label="ctx.getStatusLabel(req)" />
            </div>
          </q-item-section>
        </template>

        <q-card>
          <q-card-section class="q-pt-none">
            <div class="row q-col-gutter-md">
              <!-- Request Details -->
              <div class="col-12 col-md-6">
                <div class="text-h6 q-mb-sm">Dettagli Richiesta</div>
                <q-list dense>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>Motivo</q-item-label>
                      <q-item-label>{{ req.reason }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item v-if="req.requestNote">
                    <q-item-section>
                      <q-item-label caption>Note</q-item-label>
                      <q-item-label class="text-italic">"{{ req.requestNote }}"</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item v-if="req.startTime">
                    <q-item-section>
                      <q-item-label caption>Orario Specifico</q-item-label>
                      <q-item-label>{{ req.startTime }} - {{ req.endTime }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- Offerte -->
              <div class="col-12">
                <div class="text-h6 q-mb-sm">Monitoraggio Offerte</div>
                <q-list separator bordered class="bg-grey-1 rounded-borders">
                  <div v-if="!req.offers?.length" class="q-pa-md text-grey text-center">Nessuna offerta recente.</div>
                  <q-item v-for="offer in req.offers ?? []" :key="offer.id">
                    <q-item-section avatar>
                      <q-avatar icon="person" color="grey-2" text-color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-weight-bold">{{ offer.operatorName ?? 'Operatore' }}</q-item-label>
                      <q-item-label caption>
                        Offerta per: {{ ctx.formatDate(req.date) }} - <q-badge :label="req.originalShift" color="primary" />
                      </q-item-label>
                      <q-item-label caption class="text-orange" v-if="offer.scenarioLabel">Scenario: {{ offer.scenarioLabel }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <div v-if="offer.isRejected" class="text-negative text-caption text-weight-bold">Rifiutata</div>
                      <div v-else class="row q-gutter-xs">
                        <q-btn round flat color="negative" icon="close" size="sm" @click="ctx.rejectOffer(req.id, offer.id)" :disable="isRequestExpired(req.date, req.originalShift)" />
                        <q-btn round flat color="positive" icon="check" size="sm" @click="ctx.acceptOffer(req.id, offer.id)" :disable="isRequestExpired(req.date, req.originalShift)" />
                      </div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- Gestione + Sostituti -->
              <div class="col-12 col-md-6" style="min-width: 100%">
                <div class="text-h6 q-mb-sm">Gestione</div>
                <div class="row q-gutter-sm q-mb-md">
                  <q-btn outline color="negative" label="Rifiuta (Abusiva)" @click="ctx.rejectRequest(req)" :disable="isRequestExpired(req.date, req.originalShift)" />
                  <q-btn unelevated color="positive" label="Approva (Coperto)" @click="ctx.approveRequest(req)" :disable="isRequestExpired(req.date, req.originalShift)" />
                </div>
                <q-separator class="q-my-md" />
                <div class="text-subtitle2 q-mb-xs">Sostituti Suggeriti</div>
                <div v-if="!smart.suggestions.value[req.id]" class="q-mb-sm">
                  <q-btn flat color="primary" label="Trova Sostituti" icon="search" @click="smart.findSubstitutes(req)"
                    :loading="smart.calculating.value[req.id]" :disable="isRequestExpired(req.date, req.originalShift)" />
                </div>
                <div v-else>
                  <div v-if="smart.getSuggestions(req.id).length === 0" class="text-grey text-caption">Nessun sostituto trovato.</div>
                  <div v-else>
                    <div v-for="scenario in smart.getSuggestions(req.id)" :key="scenario.id" class="q-mb-md bg-white shadow-1">
                      <div class="bg-primary text-white q-pa-sm text-weight-bold">{{ scenario.label }}</div>
                      <div class="row q-col-gutter-sm q-pa-sm">
                        <div v-for="(pos, pIdx) in scenario.positions" :key="pIdx" class="col-12 col-md">
                          <div class="row items-center justify-between q-mb-xs">
                            <div class="text-subtitle2 text-primary">Posizione {{ pIdx + 1 }}</div>
                            <q-checkbox
                              :model-value="smart.isAllSelected(req.id, pos.candidates)"
                              :indeterminate="smart.isSomeSelected(req.id, pos.candidates)"
                              @update:model-value="(val) => smart.toggleAllInPosition(req.id, pos.candidates, val)"
                              label="Seleziona Tutti" dense size="xs" color="secondary"
                              :disable="pos.candidates.length === 0" />
                          </div>
                          <div class="text-caption text-grey-8 q-mb-sm">{{ pos.roleLabel }}</div>
                          <q-list dense separator padding class="bg-grey-1 rounded-borders q-pa-none">
                            <q-item v-for="cand in pos.candidates" :key="cand.operatorId" class="q-py-xs">
                              <q-item-section avatar>
                                <q-checkbox v-model="smart.selectedSuggestions.value[req.id]" :val="cand.operatorId" />
                              </q-item-section>
                              <q-item-section>
                                <q-item-label class="text-weight-bold">
                                  <q-chip square color="blue-1" text-color="black" size="md" style="border-radius:4px;min-width:200px">{{ cand.name }}</q-chip>
                                  <q-chip v-if="cand.phone" square color="blue-1" text-color="black" size="md" style="border-radius:4px" class="q-ml-xl">
                                    {{ cand.phone }}
                                    <q-btn dense round flat icon="phone" @click="ctx.callCandidate(cand.phone)" />
                                  </q-chip>
                                </q-item-label>
                              </q-item-section>
                              <q-item-section side>
                                <q-badge :color="getShiftChipColor(cand.currentShift)" size="sm">{{ cand.currentShift }}</q-badge>
                              </q-item-section>
                            </q-item>
                            <div v-if="pos.candidates.length === 0" class="q-pa-sm text-caption text-grey italic">Nessun candidato idoneo.</div>
                          </q-list>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="q-mt-sm">
                    <q-btn size="sm" color="info" :label="`Invia a Selezionati (${smart.selectedSuggestions.value[req.id]?.length ?? 0})`" icon="send"
                      class="full-width" @click="smart.publishRequest(req)"
                      :disable="!smart.selectedSuggestions.value[req.id] || smart.selectedSuggestions.value[req.id]?.length === 0" />
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </div>
  </q-tab-panel>

  <!-- ===== HISTORY TAB ===== -->
  <q-tab-panel name="history">
    <!-- Archive Widget -->
    <div v-if="ctx.archivedRequests.value.length > 0"
      class="row items-center q-mb-md q-gutter-x-md bg-white q-pa-sm rounded-borders shadow-1">
      <div class="col-grow">
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-caption text-grey-8 text-weight-bold"><q-icon name="inventory_2" class="q-mr-xs" />Archivio (> 3 mesi)</div>
          <div class="text-caption text-grey-6">{{ ctx.archivedRequests.value.length }} elementi</div>
        </div>
        <q-linear-progress :value="ctx.archiveStorageLevel.value" :color="ctx.storageColor.value" size="8px" rounded track-color="grey-2" />
      </div>
      <div>
        <q-btn flat dense color="negative" icon="delete_forever" label="Svuota" @click="ctx.emptyArchive()" size="sm" />
      </div>
    </div>

    <div v-if="ctx.loading.value" class="q-pa-md">
      <q-item v-for="n in 5" :key="n" class="q-mb-sm">
        <q-item-section avatar><q-skeleton type="QAvatar" /></q-item-section>
        <q-item-section><q-skeleton type="text" width="30%" /><q-skeleton type="text" width="50%" /></q-item-section>
      </q-item>
    </div>
    <div v-else-if="ctx.visibleHistoryRequests.value.length === 0" class="text-center text-grey q-pa-lg">
      Nessuna richiesta visibile nello storico.
    </div>
    <q-list v-else separator bordered class="rounded-borders">
      <q-expansion-item v-for="req in ctx.visibleHistoryRequests.value" :key="req.id" group="history" header-class="q-pa-sm">
        <template v-slot:header>
          <q-item-section avatar><q-avatar icon="person" color="grey-2" text-color="primary" /></q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">{{ ctx.getOperatorName(req.absentOperatorId ?? req.creatorId, req) }}</q-item-label>
            <q-item-label caption>
              {{ ctx.formatDate(req.date) }} - <q-badge :color="ctx.getShiftColor(req.originalShift)" size="xs">{{ req.originalShift }}</q-badge>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row items-center">
              <q-chip :color="ctx.getStatusColor(req)" text-color="white" size="sm" class="q-mr-sm">{{ ctx.getStatusLabel(req) }}</q-chip>
              <q-btn flat round dense icon="delete" color="grey-5" size="sm" @click.stop="ctx.archiveRequest(req)">
                <q-tooltip>Elimina definitivamente</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </template>
        <q-card class="bg-grey-1">
          <q-card-section class="q-py-md">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 q-mb-xs">Dettagli Richiesta</div>
                <div class="q-mb-xs"><span class="text-grey-7">Data Turno:</span> {{ ctx.formatDate(req.date) }} ({{ req.originalShift }})</div>
                <div class="q-mb-xs"><span class="text-grey-7">Aperta il:</span> {{ ctx.formatFullDate(req.createdAt) }}</div>
                <div class="q-mb-xs"><span class="text-grey-7">Richiesto da:</span> {{ ctx.getOperatorName(req.creatorId, req) }}</div>
                <div class="q-mb-xs"><span class="text-grey-7">Motivo:</span> <q-badge outline color="secondary">{{ req.reason }}</q-badge></div>
                <div v-if="req.requestNote" class="q-mt-sm">
                  <div class="text-caption text-grey-7">Note Operatore:</div>
                  <div class="italic">"{{ req.requestNote }}"</div>
                </div>
              </div>
              <div class="col-12 col-md-6 border-left">
                <div class="text-subtitle2 q-mb-xs">Stato & Chiusura</div>
                <div class="q-mb-xs"><span class="text-grey-7">Stato:</span> <q-chip :color="ctx.getStatusColor(req)" text-color="white" dense size="sm">{{ ctx.getStatusLabel(req) }}</q-chip></div>
                <div v-if="req.approvalTimestamp" class="q-mb-xs"><span class="text-grey-7">Gestita il:</span> {{ ctx.formatFullDate(req.approvalTimestamp) }}</div>
                <div v-if="req.adminId" class="q-mb-xs text-caption"><span class="text-grey-7">Gestita da:</span> {{ ctx.getAdminName(req.adminId) }}</div>
                <q-separator class="q-my-sm" />
                <div v-if="req.status === 'CLOSED'" class="text-positive">
                  <div class="text-weight-bold">Sostituzione Completata</div>
                  <div v-if="ctx.getResolutionDetails(req)" class="bg-green-1 q-pa-sm rounded-borders text-caption text-black q-mt-xs">
                    <div><strong>Coperta da:</strong> {{ ctx.getResolutionDetails(req)?.who }}</div>
                    <div><strong>Scenario:</strong> {{ ctx.getResolutionDetails(req)?.scenario }}</div>
                  </div>
                </div>
                <div v-if="req.rejectionReason" class="text-negative">
                  <div class="text-weight-bold">Rifiutata / Cancellata</div>
                  <div class="bg-red-1 q-pa-sm rounded-borders q-mt-xs"><strong>Motivo Admin:</strong> {{ req.rejectionReason }}</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>
  </q-tab-panel>
</template>
