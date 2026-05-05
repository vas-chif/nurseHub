/**
 * @file SwapRequestsList.vue
 * @description Sub-component for the Admin Requests page — renders the swaps tab panel.
 *   Receives composable state via Vue `inject` provided by AdminRequestsPage.vue.
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @notes
 * - §1.11 decomposition from AdminRequestsPage.vue.
 * - Uses inject('adminSwapsContext') for reactive state and actions.
 */
<script setup lang="ts">
import { inject } from 'vue';
import type { useAdminSwaps } from '../../composables/useAdminSwaps';

const ctx = inject<ReturnType<typeof useAdminSwaps>>('adminSwapsContext')!;
</script>

<template>
  <div class="q-pa-none">
    <!-- Archive widget -->
    <div v-if="ctx.archivedSwaps.value.length > 0"
      class="row items-center q-mb-md q-gutter-x-md bg-white q-pa-sm rounded-borders shadow-1">
      <div class="col-grow">
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-caption text-grey-8 text-weight-bold"><q-icon name="inventory_2" class="q-mr-xs" />Archivio Scambi</div>
          <div class="text-caption text-grey-6">{{ ctx.archivedSwaps.value.length }} elementi</div>
        </div>
        <q-linear-progress :value="ctx.archiveSwapStorageLevel.value" :color="ctx.storageSwapColor.value" size="8px" rounded track-color="grey-2" />
      </div>
      <div>
        <q-btn flat dense color="negative" icon="delete_forever" label="Svuota" @click="ctx.emptySwapArchive()" size="sm" />
      </div>
    </div>

    <div v-if="ctx.swapLoading.value" class="q-pa-md">
      <q-item v-for="n in 3" :key="n" class="q-mb-sm bg-white shadow-1">
        <q-item-section avatar><q-skeleton type="QAvatar" /></q-item-section>
        <q-item-section><q-skeleton type="text" width="40%" /><q-skeleton type="text" width="60%" /></q-item-section>
      </q-item>
    </div>

    <div v-else-if="ctx.pendingSwaps.value.length === 0 && ctx.allSwaps.value.length === 0" class="text-center text-grey q-pa-lg">
      Nessuno scambio turno presente.
    </div>

    <div v-else>
      <div class="text-h6 q-pa-md q-pb-sm">In Attesa ({{ ctx.pendingSwaps.value.length }})</div>
      <q-list v-if="ctx.pendingSwaps.value.length > 0" separator bordered class="rounded-borders q-mx-md">
        <q-expansion-item v-for="swap in ctx.pendingSwaps.value" :key="swap.id" group="swaps" header-class="q-py-md">
          <template v-slot:header>
            <q-item-section avatar>
              <q-avatar color="orange-7" text-color="white" icon="swap_horiz" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">Scambio Turno</q-item-label>
              <q-item-label caption>{{ swap.creatorName ?? swap.creatorId }} ↔ {{ swap.counterpartName ?? swap.counterpartId ?? '—' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="warning" label="In Attesa" />
            </q-item-section>
          </template>
          <q-card>
            <q-card-section>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <div class="text-subtitle2 q-mb-xs">Richiedente: {{ swap.creatorName ?? swap.creatorId }}</div>
                  <div>Data: {{ swap.date }} — Turno ceduto: {{ swap.offeredShift }}</div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="text-subtitle2 q-mb-xs">Controparte: {{ swap.counterpartName ?? swap.counterpartId ?? 'In attesa' }}</div>
                  <div>Turno richiesto: {{ swap.desiredShift }}</div>
                </div>
              </div>
            </q-card-section>
            <q-card-actions class="q-pa-md">
              <q-btn-group outline>
                <q-btn icon="close" color="negative" label="Rifiuta" @click="ctx.rejectSwap(swap)" />
                <q-btn icon="check" color="positive" label="Approva" @click="ctx.approveSwap(swap)" />
              </q-btn-group>
            </q-card-actions>
          </q-card>
        </q-expansion-item>
      </q-list>
      <div v-else class="text-center text-grey q-pa-md">Nessuno scambio in attesa.</div>

      <div class="text-h6 q-pa-md q-pb-sm q-pt-lg">Storico ({{ ctx.allSwaps.value.filter(s => s.status !== 'PENDING_ADMIN').length }})</div>
      <q-list separator bordered class="rounded-borders q-mx-md q-mb-lg">
        <q-item v-for="swap in ctx.allSwaps.value.filter(s => s.status !== 'PENDING_ADMIN')" :key="swap.id">
          <q-item-section avatar>
            <q-avatar :color="swap.status === 'APPROVED' ? 'positive' : 'negative'" text-color="white" icon="swap_horiz" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">{{ swap.creatorName ?? swap.creatorId }} ↔ {{ swap.counterpartName ?? swap.counterpartId ?? '—' }}</q-item-label>
            <q-item-label caption>{{ swap.date }} {{ swap.offeredShift }} / {{ swap.desiredShift }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge :color="swap.status === 'APPROVED' ? 'positive' : 'negative'">{{ swap.status }}</q-badge>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>
