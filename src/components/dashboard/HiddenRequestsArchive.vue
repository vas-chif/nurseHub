/**
 * @file HiddenRequestsArchive.vue
 * @description Collapsible list of shift-request opportunities the user has ignored.
 *   Allows restoring (show again) or applying anyway from the ignored archive.
 * @author Nurse Hub Team
 * @created 2026-05-05
 * @notes
 * - §1.11 decomposition from ActiveRequestsCard.vue.
 * - Receives state via props; emits restore and offer-click events up.
 */
<script setup lang="ts">
import type { ShiftRequest } from '../../types/models';

/** Props */
const props = defineProps<{
  ignoredRequests: ShiftRequest[];
}>();

/** Emits */
const emit = defineEmits<{
  /** User clicked "restore" — show this request again in the main feed */
  restore: [reqId: string];
  /** User clicked "apply anyway" from the ignored archive */
  offer: [req: ShiftRequest];
}>();

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
} /*end formatDate*/
</script>

<template>
  <q-expansion-item
    v-if="props.ignoredRequests.length > 0"
    icon="visibility_off"
    label="Opportunità ignorate"
    header-class="text-grey-7 text-caption"
    dense
    class="q-mt-md"
  >
    <q-list separator dense>
      <q-item
        v-for="req in props.ignoredRequests"
        :key="req.id"
        class="q-py-xs bg-grey-1"
      >
        <q-item-section>
          <q-item-label class="text-caption">
            {{ formatDate(req.date) }} — {{ req.originalShift }}
            ({{ req.reason === 'SHORTAGE' ? 'Carenza' : 'Assenza' }})
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row q-gutter-x-xs">
            <q-btn
              flat round size="xs" color="primary" icon="visibility"
              @click="emit('restore', req.id)"
            >
              <q-tooltip>Ripristina</q-tooltip>
            </q-btn>
            <q-btn
              flat round size="xs" color="secondary" icon="add_task"
              @click="emit('offer', req)"
            >
              <q-tooltip>Offriti comunque</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </q-expansion-item>
</template>
