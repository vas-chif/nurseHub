/**
 * @file HistoryRequestsList.vue
 * @description Sub-component for the Admin Requests page — renders the history list.
 * @author Nurse Hub Team
 * @created 2026-05-05
 */
<script setup lang="ts">
import { inject } from 'vue';
import type { useAdminRequests } from '../../composables/useAdminRequests';
import { useShiftLogic } from '../../composables/useShiftLogic';

const ctx = inject<ReturnType<typeof useAdminRequests>>('adminReqsContext')!;
const { isRequestExpired } = useShiftLogic();
</script>

<template>
  <div class="q-pa-none">
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
      <q-expansion-item v-for="req in ctx.visibleHistoryRequests.value" :key="req.id" group="history" header-class="q-pa-sm"
        :class="{ 'opacity-50 grayscale': isRequestExpired(req.date, req.originalShift) }">
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
  </div>
</template>
