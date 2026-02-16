<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Nuova Richiesta Copertura</div>
    </q-card-section>

    <q-card-section>
      <q-form @submit="onSubmit" class="q-gutter-md">
        <q-input
          v-model="form.date"
          type="date"
          label="Data Turno"
          stack-label
          outlined
          :rules="[(val) => !!val || 'Data obbligatoria']"
        />

        <q-select
          v-model="form.shift"
          :options="shiftOptions"
          label="Turno Mancante"
          outlined
          :rules="[(val) => !!val || 'Seleziona un turno']"
        />

        <q-select
          v-model="form.role"
          :options="roleOptions"
          label="Ruolo Richiesto"
          outlined
          :rules="[(val) => !!val || 'Seleziona un ruolo']"
        />

        <q-select
          v-model="form.reason"
          :options="reasonOptions"
          label="Motivo"
          outlined
          emit-value
          map-options
        />

        <div class="row justify-end q-mt-lg">
          <q-btn
            label="Crea Richiesta"
            type="submit"
            color="primary"
            icon="send"
            :loading="loading"
          />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { ShiftCode, RequestReason } from '../../types/models';

const $q = useQuasar();
const loading = ref(false);

const form = reactive({
  date: '',
  shift: null as ShiftCode | null,
  role: 'Infermiere',
  reason: 'SHORTAGE' as RequestReason,
});

const shiftOptions: ShiftCode[] = ['M', 'P', 'N', 'N11', 'N12'];
const roleOptions = ['Infermiere', 'OSS'];
const reasonOptions = [
  { label: 'Carenza Organico', value: 'SHORTAGE' },
  { label: 'Assenza Improvvisa', value: 'ABSENCE' },
];

function onSubmit() {
  loading.value = true;
  // Simulate API call
  setTimeout(() => {
    console.log('Request created:', form);
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
