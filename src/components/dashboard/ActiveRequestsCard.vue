/**
 * @file ActiveRequestsCard.vue
 * @description Dashboard card — user-facing feed for open shift-request opportunities
 *   and personal application history. Business logic lives in useRequestsFilter.ts (§1.11).
 * @author Nurse Hub Team
 * @created 2026-03-10
 * @modified 2026-05-05
 * @notes
 * - §1.11 decomposition: was 690 lines, now thin orchestrator.
 * - All state / listeners / computeds delegated to useRequestsFilter composable.
 * - HiddenRequestsArchive sub-component renders the "ignored" expansion panel.
 */
<script setup lang="ts">
import { useRequestsFilter } from '../../composables/useRequestsFilter';
import HiddenRequestsArchive from './HiddenRequestsArchive.vue';

const {
  activeTab, loading, sortBy, sortOptions,
  offerDialog, loadingCompatibility, compatibleScenarios, selectedScenario, isSubmitting,
  surroundingShifts, urgentRequests, otherRequests, ignoredRequests, myHistoryRequests,
  toggleInterest, openOfferDialog, submitOffer, refreshDashboard,
  formatDate, formatDateLong, getShiftColor, formatFullDate,
  getMyOfferTimestamp, getMyOfferLabel, getMyOfferStatusLabel,
  getMyOfferStatusColor, getMyOfferIcon, getMyOfferAvatarColor, getMyOfferAvatarTextColor,
} = useRequestsFilter();
</script>

<template>
  <div class="q-mt-md">
    <q-card flat bordered class="bg-white">
      <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary"
        align="justify" narrow-indicator>
        <q-tab name="opportunities">
          <div class="row items-center no-wrap">
            <q-icon name="campaign" class="q-mr-sm" />
            <div>Opportunità</div>
            <q-badge v-if="urgentRequests.length + otherRequests.length > 0" color="red" floating rounded
              class="q-ml-xs">
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
                  <q-btn unelevated size="sm" color="negative" label="Rispondi" icon="add_task"
                    @click="openOfferDialog(req)" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Other Requests Section -->
          <div class="q-pa-sm">
            <div class="row items-center justify-between q-px-sm q-py-xs">
              <div class="row items-center q-gutter-x-sm">
                <div class="text-subtitle2 text-primary">🤝 Altre Proposte</div>
                <q-btn-dropdown flat dense size="sm" color="grey-7" :icon="sortOptions.find(o => o.value === sortBy)?.icon">
                  <q-list dense>
                    <q-item v-for="opt in sortOptions" :key="opt.value" clickable v-close-popup @click="sortBy = opt.value as 'created' | 'date'">
                      <q-item-section avatar>
                        <q-icon :name="opt.icon" size="xs" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ opt.label }}</q-item-label>
                      </q-item-section>
                      <q-item-section side v-if="sortBy === opt.value">
                        <q-icon name="check" color="primary" size="xs" />
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
              <q-btn flat round dense color="primary" icon="refresh" size="sm" @click="refreshDashboard">
                <q-tooltip>Aggiorna proposte</q-tooltip>
              </q-btn>
            </div>

            <div v-if="loading" class="q-pa-sm">
              <q-item v-for="n in 2" :key="n" class="q-mb-xs">
                <q-item-section avatar>
                  <q-skeleton type="QAvatar" size="32px" />
                </q-item-section>
                <q-item-section>
                  <q-skeleton type="text" width="50%" />
                  <q-skeleton type="text" width="30%" />
                </q-item-section>
                <q-item-section side>
                  <q-skeleton type="rect" width="60px" height="24px" />
                </q-item-section>
              </q-item>
            </div>

            <div v-else-if="otherRequests.length === 0 && urgentRequests.length === 0"
              class="text-center text-grey q-pa-md text-caption">
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
                <q-item-section side class="q-gutter-x-xs">
                  <div class="row no-wrap items-center q-gutter-x-xs">
                    <q-btn flat round size="sm" color="grey-6" icon="visibility_off" @click.stop="toggleInterest(req.id, false)">
                      <q-tooltip>Non mi interessa</q-tooltip>
                    </q-btn>
                    <q-btn unelevated size="sm" color="primary" label="Offriti" icon="add_task"
                      @click="openOfferDialog(req)" />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Ignored Section — delegated to sub-component -->
            <HiddenRequestsArchive
              :ignored-requests="ignoredRequests"
              @restore="(id) => toggleInterest(id, true)"
              @offer="openOfferDialog"
            />
          </div>
        </q-tab-panel>

        <!-- TAB 2: Le mie Candidature (History) -->
        <q-tab-panel name="history" class="q-pa-none">
          <div v-if="loading" class="q-pa-md">
            <q-item v-for="n in 3" :key="n" class="q-mb-sm">
              <q-item-section avatar>
                <q-skeleton type="QAvatar" />
              </q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="40%" />
                <q-skeleton type="text" width="60%" />
              </q-item-section>
            </q-item>
          </div>
          <div v-else-if="myHistoryRequests.length === 0" class="text-center text-grey q-pa-lg">
            Nessuna candidatura inviata di recente.
          </div>
          <q-list v-else separator>
            <q-item v-for="req in myHistoryRequests" :key="req.id" class="q-py-md">
              <q-item-section avatar>
                <q-avatar :icon="getMyOfferIcon(req)" :color="getMyOfferAvatarColor(req)"
                  :text-color="getMyOfferAvatarTextColor(req)" />
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
                <div v-for="day in surroundingShifts" :key="day.date"
                  class="flex column items-center q-pa-xs rounded-borders"
                  :class="day.isTarget ? 'bg-primary-1 border-primary' : 'bg-grey-2'"
                  style="min-width: 60px; border: 1px solid transparent">
                  <div class="text-caption text-weight-bold">{{ day.label }}</div>
                  <q-badge :color="getShiftColor(day.shift)" size="md">{{ day.shift }}</q-badge>
                </div>
              </div>
            </div>

            <div class="text-subtitle2 q-mb-sm">Come vuoi coprire questo turno?</div>
            <q-list bordered separator>
              <q-item v-for="scenario in compatibleScenarios" :key="scenario.scenarioId + scenario.roleIndex"
                tag="label" v-ripple :active="selectedScenario === scenario" active-class="bg-blue-1">
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
          <q-btn unelevated label="Invia" color="primary" :disable="!selectedScenario" @click="submitOffer"
            :loading="isSubmitting" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>
