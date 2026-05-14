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
import { ref, computed } from 'vue';
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

/** Only render when the user manages at least one group or set of configurations */
const visible = computed<boolean>(() => authStore.isAnyAdmin && configStore.groupOptions.length >= 1);

const filterText = ref('');
const filterFn = (val: string, update: (callback: () => void) => void) => {
  update(() => {
    filterText.value = val.toLowerCase();
  });
};

const displayedGroups = computed(() => {
  if (!filterText.value) return configStore.groupOptions;
  return configStore.groupOptions.filter((g) => g.toLowerCase().includes(filterText.value));
});

function handleGroupChange(group: string | null) {
  logger.info('Group filter changed', { group });
  configStore.setActiveGroup(group);
}
</script>

<template>
  <q-select
    v-if="visible"
    :model-value="configStore.activeGroupName"
    :options="displayedGroups"
    clearable
    use-input
    hide-selected
    fill-input
    @filter="filterFn"
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
          {{
            scope.opt === 'Altre Configurazioni'
              ? configStore.availableConfigs.filter((c) => !c.group).length
              : configStore.availableConfigs.filter((c) => c.group === scope.opt).length
          }} config
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
