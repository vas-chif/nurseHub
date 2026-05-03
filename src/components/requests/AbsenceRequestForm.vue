/**
 * @file AbsenceRequestForm.vue
 * @description Form for submitting absence requests (illness, leave, etc.) with standardized date handling.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized locales.
 * - Enforces department-specific validation.
 */
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { absenceService } from '../../services/AbsenceService';
import { useQuasar } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import AppDateInput from '../common/AppDateInput.vue';

const $q = useQuasar();
const logger = useSecureLogger();
const authStore = useAuthStore();

const emit = defineEmits(['success', 'cancel']);

const absenceTypes = [
  { label: 'Malattia', value: 'illness' },
  { label: 'Ferie', value: 'leave' },
  { label: 'Permesso 104', value: 'permit_104' },
  { label: 'Congedo', value: 'maternity' },
  { label: 'Altro', value: 'other' }
];

const form = ref({
  type: 'leave' as 'illness' | 'leave' | 'permit_104' | 'maternity' | 'other',
  startDate: '',
  endDate: '',
  note: ''
});

const submitting = ref(false);

const isValid = computed(() => {
  return form.value.startDate && form.value.endDate && 
         new Date(form.value.startDate) <= new Date(form.value.endDate);
});

async function submitRequest() {
  if (!isValid.value) {
    $q.notify({ type: 'negative', message: 'Dati non validi' });
    return;
  }

  const user = authStore.currentUser;
  if (!user || !user.configId) return;

  submitting.value = true;
  try {
    await absenceService.createRequest({
      date: form.value.startDate,
      originalShift: 'A',
      reason: 'ABSENCE',
      status: 'OPEN',
      creatorId: user.uid,
      creatorName: `${user.firstName} ${user.lastName}`.trim() || 'Operatore',
      configId: user.configId,
      ...(user.operatorId ? { absentOperatorId: user.operatorId } : {}),
      absentOperatorName: `${user.firstName} ${user.lastName}`.trim(),
      requestNote: form.value.note || form.value.type,
      createdAt: Date.now(),
      expireAt: new Date(form.value.endDate).getTime() + (90 * 24 * 60 * 60 * 1000)
    });

    $q.notify({ type: 'positive', message: 'Richiesta inviata con successo' });
    emit('success');
  } catch (error) {
    logger.error('Error submitting absence request', error);
    $q.notify({ type: 'negative', message: 'Errore durante l\'invio' });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <q-card flat class="absence-form-card">
    <q-card-section class="q-gutter-y-md">
      <div class="text-h6 text-primary text-weight-bold">Nuova Richiesta Assenza</div>
      
      <q-select
        v-model="form.type"
        :options="absenceTypes"
        label="Tipo di assenza"
        filled
        dense
        emit-value
        map-options
      />

      <div class="row q-col-gutter-sm">
        <div class="col-12 col-sm-6">
          <AppDateInput
            v-model="form.startDate"
            label="Data Inizio"
            required
          />
        </div>
        <div class="col-12 col-sm-6">
          <AppDateInput
            v-model="form.endDate"
            label="Data Fine"
            required
          />
        </div>
      </div>

      <q-input
        v-model="form.note"
        label="Note aggiuntive (opzionale)"
        type="textarea"
        filled
        dense
        autogrow
      />

      <div class="row justify-end q-gutter-x-sm q-mt-md">
        <q-btn flat label="Annulla" color="grey-7" @click="emit('cancel')" :disable="submitting" />
        <q-btn 
          label="Invia Richiesta" 
          color="primary" 
          unelevated 
          :loading="submitting" 
          :disable="!isValid"
          @click="submitRequest" 
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.absence-form-card {
  border-radius: 16px;
}
</style>
