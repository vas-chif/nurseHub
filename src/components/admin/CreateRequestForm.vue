/**
* @file CreateRequestForm.vue
* @description Admin form to create manual coverage requests.
* @author Nurse Hub Team
* @created 2026-03-25
*/
<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { ShiftCode, RequestReason } from '../../types/models';
import { useSecureLogger } from '../../utils/secureLogger';
import AppDateInput from '../common/AppDateInput.vue';

const logger = useSecureLogger();

const $q = useQuasar();
const loading = ref(false);

const form = reactive({
  date: '',
  shift: null as ShiftCode | null,
  profession: 'Infermiere',
  reason: 'SHORTAGE' as RequestReason,
});

const shiftOptions: ShiftCode[] = ['M', 'P', 'N', 'N11', 'N12'];
const professionOptions = ['Infermiere', 'OSS'];
const reasonOptions = [
  { label: 'Carenza Organico', value: 'SHORTAGE' },
  { label: 'Assenza Improvvisa', value: 'ABSENCE' },
];

function onSubmit() {
  loading.value = true;
  // Simulate API call
  setTimeout(() => {
    logger.info('Request created', form);
    $q.notify({
      color: 'positive',
      message: 'Richiesta creata con successo!',
      icon: 'check',
    });
    loading.value = false;
    // Reset form mostly
    form.shift = null;
  }, 1000);
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Nuova Richiesta Copertura</div>
    </q-card-section>

    <q-card-section>
      <q-form @submit="onSubmit" class="q-gutter-md">
        <AppDateInput v-model="form.date" label="Data Turno" :required="true" />

        <q-select v-model="form.shift" :options="shiftOptions" label="Turno Mancante" outlined
          :rules="[(val) => !!val || 'Seleziona un turno']" />

        <q-select v-model="form.profession" :options="professionOptions" label="Professione Richiesta" outlined
          :rules="[(val) => !!val || 'Seleziona una professione']" />

        <q-select v-model="form.reason" :options="reasonOptions" label="Motivo" outlined emit-value map-options />

        <div class="row justify-end q-mt-lg">
          <q-btn label="Crea Richiesta" type="submit" color="primary" icon="send" :loading="loading" />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>
