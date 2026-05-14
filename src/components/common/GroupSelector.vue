<script setup lang="ts">
/**
 * @file GroupSelector.vue
 * @description RAM-only group (Reparto/Cartella) selector for the global header.
 *   Filters the downstream ConfigSelector to show only configs belonging to the chosen group.
 *   Visible only when at least 2 distinct groups exist in availableConfigs (Phase 38).
 *   No extra Firebase reads — pure client-side filter aligned with Phase 30.1 Filtro Maestro.
 * @author Nurse Hub Team
 * @created 2026-05-14
 * @modified 2026-05-14
 * @notes
 * - Respects managedConfigIds via groupOptions which derives from availableConfigs (already role-fenced).
 * - Clearable: deselecting a group restores the full config list in ConfigSelector.
 * - JWT is never altered — activeGroupName is a presentation-layer filter only (same as viewMode Phase 34).
 */
import { computed } from 'vue';
import { useConfigStore } from '../../stores/configStore';
import { useAuthStore } from '../../stores/authStore';
import { useSecureLogger } from '../../utils/secureLogger';

const configStore = useConfigStore();
const authStore = useAuthStore();
const logger = useSecureLogger();

const props = defineProps({
  dense: { type: Boolean, default: true },
  outlined: { type: Boolean, default: true },
  bgColor: { type: String, default: 'white' },
  style: { type: Object, default: () => ({ minWidth: '160px' }) },
});

/** Only render when the user manages configs across at least 2 different groups */
const visible = computed<boolean>(
  () => authStore.isAnyAdmin && configStore.groupOptions.length > 1,
);

function handleGroupChange(group: string | null) {
  logger.info('Group filter changed', { group });
  configStore.setActiveGroup(group);
}
</script>

<template>
  <q-select
    v-if="visible"
    :model-value="configStore.activeGroupName"
    :options="configStore.groupOptions"
    clearable
    :dense="props.dense"
    :outlined="props.outlined"
    :bg-color="props.bgColor"
    :style="props.style"
    label="Reparto"
    class="group-selector"
    @update:model-value="handleGroupChange"
    @clear="handleGroupChange(null)"
  >
    <template #prepend>
      <q-icon name="apartment" color="primary" size="xs" />
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-icon
            name="folder"
            :color="scope.opt === configStore.activeGroupName ? 'primary' : 'grey-6'"
            size="xs"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt }}</q-item-label>
          <q-item-label caption>
            {{ configStore.availableConfigs.filter((c) => c.group === scope.opt).length }} config
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="scope.opt === configStore.activeGroupName" side>
          <q-icon name="check_circle" color="positive" size="xs" />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<style scoped>
.group-selector :deep(.q-field__native) {
  font-weight: 500;
}
</style>
