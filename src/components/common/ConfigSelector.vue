<script setup lang="ts">
/**
 * @file ConfigSelector.vue
 * @description Reusable component for selecting the active system configuration (Department).
 * Used in the Global Header and potentially other administrative views.
 */
import { useConfigStore } from '../../stores/configStore';
import { useAuthStore } from '../../stores/authStore';

const configStore = useConfigStore();
const authStore = useAuthStore();

const props = defineProps({
  dense: { type: Boolean, default: true },
  outlined: { type: Boolean, default: true },
  label: { type: String, default: 'Reparto' },
  bgColor: { type: String, default: 'white' },
  style: { type: Object, default: () => ({ minWidth: '180px' }) }
});

function handleConfigChange(configId: string) {
  configStore.setActiveConfig(configId);
}
</script>

<template>
  <q-select
    v-if="authStore.isAnyAdmin && configStore.availableConfigs.length > 0"
    v-model="configStore.activeConfigId"
    :options="configStore.availableConfigs"
    option-value="id"
    option-label="name"
    emit-value
    map-options
    :dense="props.dense"
    :outlined="props.outlined"
    :label="props.label"
    :bg-color="props.bgColor"
    :style="props.style"
    @update:model-value="handleConfigChange"
    class="config-selector"
  >
    <template v-slot:prepend>
      <q-icon name="swap_horiz" color="primary" size="xs" />
    </template>
    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-icon :name="scope.opt.id === configStore.activeConfigId ? 'check_circle' : 'circle'" 
                  :color="scope.opt.id === configStore.activeConfigId ? 'positive' : 'grey-4'" size="xs" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
          <q-item-label caption>{{ scope.opt.profession }}</q-item-label>
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
