<script setup lang="ts">
/**
 * @file ConfigSelector.vue
 * @description Cartelle-aware department selector. Shows grouped configuration hierarchy
 *   in dropdown with folder headers. Used in the global header for admin navigation.
 * @author Nurse Hub Team
 * @created 2026-03-15
 * @modified 2026-05-14
 * @notes
 * - Source switches from availableConfigs to configsInActiveGroup (Phase 38) for cascading
 *   Group→Config navigation when GroupSelector is active.
 */
import { computed } from 'vue';
import { useConfigStore } from '../../stores/configStore';
import { useAuthStore } from '../../stores/authStore';

const configStore = useConfigStore();
const authStore = useAuthStore();

const props = defineProps({
  dense: { type: Boolean, default: true },
  outlined: { type: Boolean, default: true },
  label: { type: String, default: 'Reparto' },
  bgColor: { type: String, default: 'white' },
  style: { type: Object, default: () => ({ minWidth: '180px' }) },
});

type GroupHeader = { type: 'header'; label: string; id?: undefined; name?: undefined; profession?: undefined };
type ConfigItem = { type: 'item'; id: string; name: string; profession: string; group: string | null };
type SelectOption = GroupHeader | ConfigItem;

/** Whether any config in the current group-filtered list has a group set */
const hasGroups = computed<boolean>(() =>
  configStore.configsInActiveGroup.some((c) => c.group),
);

const flatGroupedOptions = computed<SelectOption[]>(() => {
  if (!hasGroups.value) {
    return configStore.configsInActiveGroup.map((c) => ({
      type: 'item' as const,
      id: c.id,
      name: c.name,
      profession: c.profession,
      group: c.group ?? null,
    }));
  }
  const grouped = new Map<string, typeof configStore.configsInActiveGroup>();
  configStore.configsInActiveGroup.forEach((c) => {
    const key = c.group || '';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  });
  const entries = Array.from(grouped.entries()).sort(([a], [b]) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
  const result: SelectOption[] = [];
  for (const [groupName, configs] of entries) {
    result.push({ type: 'header', label: groupName || 'Altre Configurazioni' });
    for (const c of configs) {
      result.push({ type: 'item', id: c.id, name: c.name, profession: c.profession, group: c.group ?? null });
    }
  }
  return result;
});

function getRoleIcon(profession: string): string {
  if (profession === 'Medico') return 'medical_services';
  if (profession === 'OSS') return 'volunteer_activism';
  return 'local_hospital';
}

function handleConfigChange(configId: string) {
  configStore.setActiveConfig(configId);
}
</script>

<template>
  <q-select
    v-if="authStore.isAnyAdmin && configStore.configsInActiveGroup.length > 0"
    :model-value="configStore.activeConfigId"
    :options="flatGroupedOptions"
    option-value="id"
    :option-label="(opt: SelectOption) => opt.type === 'item' ? opt.name! : opt.label"
    :option-disable="(opt: SelectOption) => opt.type === 'header'"
    emit-value
    map-options
    :dense="props.dense"
    :outlined="props.outlined"
    :label="props.label"
    :bg-color="props.bgColor"
    :style="props.style"
    class="config-selector"
    @update:model-value="handleConfigChange"
  >
    <template #prepend>
      <q-chip
        v-if="configStore.activeConfig?.group && hasGroups"
        dense
        square
        color="primary"
        text-color="white"
        size="xs"
        class="q-mr-xs q-ml-none"
      >
        {{ configStore.activeConfig.group }}
      </q-chip>
      <q-icon v-else name="swap_horiz" color="primary" size="xs" />
    </template>
    <template #option="scope">
      <!-- Group header (non-selectable) -->
      <q-item-label
        v-if="scope.opt.type === 'header'"
        header
        class="bg-blue-1 text-primary text-weight-bold q-py-xs"
      >
        <q-icon name="folder" size="xs" class="q-mr-xs" />{{ scope.opt.label }}
      </q-item-label>
      <!-- Selectable config item -->
      <q-item
        v-else
        v-bind="scope.itemProps"
        :class="hasGroups ? 'q-pl-lg' : ''"
      >
        <q-item-section avatar>
          <q-icon
            :name="getRoleIcon(scope.opt.profession)"
            :color="scope.opt.id === configStore.activeConfigId ? 'primary' : 'grey-6'"
            size="xs"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
          <q-item-label caption>{{ scope.opt.profession }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="scope.opt.id === configStore.activeConfigId" side>
          <q-icon name="check_circle" color="positive" size="xs" />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<style scoped>
.config-selector :deep(.q-field__native) {
  font-weight: 500;
}
</style>
