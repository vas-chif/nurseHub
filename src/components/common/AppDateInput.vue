/**
* @file AppDateInput.vue
* @description Standardized premium date input component with Italian localization.
* @author Nurse Hub Team
* @created 2026-05-03
* @notes
* - Uses itLocale from constants.
* - Handles conversion between display (DD/MM/YYYY) and model (YYYY-MM-DD) formats.
* - Premium design with rounded borders and clear interaction.
*/
<script setup lang="ts">
import { computed, ref } from 'vue';
import { itLocale } from '../../constants/locales';
import { date as quasarDate } from 'quasar';
import type { AppDateInputProps } from '../../types/components';
import { QPopupProxy } from 'quasar';

const props = withDefaults(defineProps<AppDateInputProps>(), {
  label: 'Seleziona Data',
  hint: 'Formato: GG/MM/AAAA',
  readonly: false,
  disable: false,
  required: false,
  dense: true,
  filled: true,
  icon: 'event',
  hideLabel: false,
  flat: false,
  borderless: false,
  hideInput: false
});

const emit = defineEmits(['update:modelValue']);

const dateProxy = ref<QPopupProxy | null>(null);

// Internal value for q-date (expects YYYY/MM/DD or YYYY-MM-DD)
// We standardize internal binding to YYYY/MM/DD for better Quasar compatibility
const internalDate = computed({
  get: () => {
    if (!props.modelValue) return '';
    return props.modelValue.replace(/-/g, '/');
  },
  set: (val: string) => {
    // Emit in standard DB format YYYY-MM-DD
    const dbFormat = val ? val.replace(/\//g, '-') : '';
    emit('update:modelValue', dbFormat);
  }
});

// Display value for the input field (DD/MM/YYYY) with manual editing support
const displayValue = computed({
  get: () => {
    if (!props.modelValue) return '';
    return quasarDate.formatDate(props.modelValue, 'DD/MM/YYYY');
  },
  set: (val: string) => {
    // Phase 38: Handle manual input filtering and conversion
    if (val && val.length === 10) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        const dbFormat = `${year}-${month}-${day}`;
        // Validate if it's a real date before emitting
        if (quasarDate.isValid(dbFormat)) {
          emit('update:modelValue', dbFormat);
        }
      }
    } else if (!val) {
      emit('update:modelValue', '');
    }
  }
});

function openPicker() {
  if (!props.disable && !props.readonly) {
    dateProxy.value?.show();
  }
}
</script>

<template>
  <q-input v-model="displayValue" :label="hideLabel ? undefined : label" :readonly="readonly" :disable="disable" :dense="dense"
    :filled="filled && !flat" :flat="flat" :borderless="borderless" mask="##/##/####" fill-mask
    :rules="required ? [val => !!val || 'Campo obbligatorio'] : []"
    :class="['app-date-input', { 'hide-input': hideInput }]" @click="openPicker">
    <template v-slot:append>
      <q-icon :name="icon" class="cursor-pointer">
        <q-popup-proxy ref="dateProxy" cover transition-show="scale" transition-hide="scale">
          <q-date v-model="internalDate" :locale="itLocale" today-btn mask="YYYY/MM/DD"
            @update:model-value="dateProxy?.hide()">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Chiudi" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<style scoped>
.app-date-input :deep(.q-field__control) {
  border-radius: 12px;
}

.app-date-input :deep(.q-field__native) {
  cursor: pointer;
}

.app-date-input.hide-input :deep(.q-field__native) {
  display: none;
}

.app-date-input.hide-input :deep(.q-field__append) {
  padding: 0;
  justify-content: center;
  width: 100%;
}

.app-date-input.hide-input :deep(.q-field__control) {
  padding: 0;
  min-height: unset;
}
</style>
