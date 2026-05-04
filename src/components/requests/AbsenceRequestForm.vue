/**
 * @file AbsenceRequestForm.vue
 * @description Two-step absence request form component.
 * Step 1 (form): fill in operator, date range, shift mode, reason.
 * Step 2 (preview): per-day table with scheduled shift, editable shift/reason,
 * conflict highlights, and exclude toggle — then confirm to submit.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-05-04
 * @notes
 * - All state and logic delegated to composables/useAbsenceForm.ts (§1.11).
 * - q-skeleton shown during preview generation (§1.10).
 * - Operator selector visible only when isAnyAdmin (from composable).
 * - Conflict rows highlighted in amber; excluded rows greyed out.
 * @dependencies
 * - useAbsenceForm composable
 * - AppDateInput component
 * - scheduleStore, configStore (Pinia — for operator sync)
 */
<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useConfigStore } from '../../stores/configStore';
import { useAbsenceForm } from '../../composables/useAbsenceForm';
import AppDateInput from '../common/AppDateInput.vue';

const scheduleStore = useScheduleStore();
const configStore = useConfigStore();

const emit = defineEmits<{ success: [] }>();

const {
  step,
  generatingPreview,
  submitting,
  selectedOperatorId,
  inputMode,
  formData,
  absenceOptions,
  shiftOptions,
  previewRows,
  previewActiveCount,
  filteredOperatorOptions,
  filterOperators,
  syncOperators,
  isAnyAdmin,
  generatePreview,
  confirmAndSubmit,
  backToForm,
  formatToItalian,
} = useAbsenceForm(() => emit('success'));

// Sync operators list whenever scheduleStore updates
watch(
  () => scheduleStore.operators,
  (list) => {
    if (list.length > 0) syncOperators(list);
  },
  { immediate: true },
);

onMounted(async () => {
  if (configStore.activeConfigId) {
    const list = await scheduleStore.loadOperators(configStore.activeConfigId);
    syncOperators(list);
  }
});
</script>

<template>
  <!-- ========= STEP 1: FORM ========= -->
  <q-card v-if="step === 'form'" flat bordered class="absence-form-card q-mb-md shadow-1">
    <q-card-section>
      <div class="text-subtitle1 text-weight-bold text-primary">Nuova Richiesta Assenza</div>
      <div class="text-caption text-grey-7">Compila il modulo e genera l'anteprima per giorno.</div>
    </q-card-section>

    <q-card-section class="q-gutter-md">
      <!-- Admin: Operator Selector -->
      <q-select
        v-if="isAnyAdmin"
        v-model="selectedOperatorId"
        :options="filteredOperatorOptions"
        option-label="name"
        option-value="id"
        label="Operatore (per conto di)"
        outlined
        dense
        emit-value
        map-options
        use-input
        clearable
        @filter="filterOperators"
        hint="Seleziona l'operatore per cui stai creando la richiesta"
      >
        <template #no-option>
          <q-item>
            <q-item-section class="text-grey">Nessun risultato</q-item-section>
          </q-item>
        </template>
        <template #prepend>
          <q-icon name="person" />
        </template>
      </q-select>

      <div class="row q-col-gutter-md items-start">
        <!-- Date Input -->
        <div class="col-12 col-md-4">
          <AppDateInput
            v-model="formData.date"
            label="Data Assenza"
            required
            :hint="formData.isRecurring ? 'Data inizio' : ''"
          />
        </div>

        <!-- Recurring Toggle -->
        <div class="col-12 col-md-4 flex items-center">
          <q-toggle
            v-model="formData.isRecurring"
            label="Più giorni"
            color="secondary"
            dense
          />
        </div>

        <!-- End Date (if recurring) -->
        <div v-if="formData.isRecurring" class="col-12 col-md-4">
          <AppDateInput v-model="formData.endDate" label="Data Fine" required />
        </div>

        <!-- Input Mode Toggle -->
        <div class="col-12">
          <div class="row items-center q-gutter-x-md">
            <span class="text-caption text-grey-7">Tipo selezione:</span>
            <q-btn-toggle
              v-model="inputMode"
              toggle-color="secondary"
              :options="[
                { label: 'Turno Intero', value: 'SHIFT' },
                { label: 'Fascia Oraria', value: 'TIME' },
              ]"
              dense
              outlined
              rounded
              unelevated
            />
          </div>
        </div>

        <!-- Shift Buttons (SHIFT mode) -->
        <div v-if="inputMode === 'SHIFT'" class="col-12">
          <q-btn-toggle
            v-model="formData.shift"
            toggle-color="primary"
            :options="[
              { label: 'Mattina (M)', value: 'M' },
              { label: 'Pomeriggio (P)', value: 'P' },
              { label: 'Notte (N)', value: 'N' },
            ]"
            spread
            dense
            outlined
            class="full-width"
          />
        </div>

        <!-- Time Range (TIME mode) -->
        <template v-else>
          <div class="col-12 col-md-6">
            <q-input v-model="formData.startTime" type="time" label="Dalle ore" outlined dense />
          </div>
          <div class="col-12 col-md-6">
            <q-input v-model="formData.endTime" type="time" label="Alle ore" outlined dense />
          </div>
        </template>
      </div>

      <!-- Absence Type -->
      <q-select
        v-model="formData.absenceLabel"
        :options="absenceOptions"
        label="Motivo Assenza"
        outlined
        dense
        emit-value
        map-options
      />

      <!-- Note -->
      <q-input
        v-model="formData.note"
        label="Note (opzionale)"
        outlined
        dense
        type="textarea"
        rows="2"
      />
    </q-card-section>

    <q-card-actions align="right" class="q-pb-md q-pr-md">
      <q-btn
        label="Genera Anteprima"
        color="primary"
        unelevated
        icon-right="preview"
        :loading="generatingPreview"
        @click="generatePreview"
      />
    </q-card-actions>
  </q-card>

  <!-- ========= STEP 2: PREVIEW ========= -->
  <q-card v-else flat bordered class="absence-form-card q-mb-md shadow-1">
    <q-card-section class="row items-center justify-between">
      <div>
        <div class="text-subtitle1 text-weight-bold text-primary">Anteprima Richieste</div>
        <div class="text-caption text-grey-7">
          {{ previewActiveCount }} giorn{{ previewActiveCount === 1 ? 'o' : 'i' }} selezionat{{
            previewActiveCount === 1 ? 'o' : 'i'
          }}. Modifica o escludi prima di confermare.
        </div>
      </div>
      <q-btn flat dense icon="arrow_back" label="Modifica" color="grey-7" @click="backToForm" />
    </q-card-section>

    <!-- Skeleton while generating -->
    <q-card-section v-if="generatingPreview" class="q-gutter-sm">
      <q-item v-for="n in 3" :key="n" class="q-mb-xs">
        <q-item-section>
          <q-skeleton type="text" width="30%" />
          <q-skeleton type="text" width="20%" />
        </q-item-section>
        <q-item-section><q-skeleton type="QInput" /></q-item-section>
        <q-item-section><q-skeleton type="QInput" /></q-item-section>
        <q-item-section side><q-skeleton type="QToggle" /></q-item-section>
      </q-item>
    </q-card-section>

    <!-- Preview rows list -->
    <q-card-section v-else class="q-pa-none">
      <q-list bordered separator>
        <q-item
          v-for="row in previewRows"
          :key="row.date"
          :class="{
            'bg-amber-1': row.conflict && !row.excluded,
            'bg-grey-2': row.excluded,
          }"
        >
          <!-- Date + conflict indicator -->
          <q-item-section style="min-width: 110px; max-width: 130px">
            <q-item-label class="text-weight-bold text-body2">
              {{ formatToItalian(row.date) }}
              <q-icon
                v-if="row.conflict && !row.excluded"
                name="warning"
                color="warning"
                size="xs"
                class="q-ml-xs"
              >
                <q-tooltip>Turno in calendario: {{ row.scheduledShift }}</q-tooltip>
              </q-icon>
            </q-item-label>
            <q-item-label caption>Cal: {{ row.scheduledShift ?? '—' }}</q-item-label>
          </q-item-section>

          <!-- Shift selector per row -->
          <q-item-section class="q-px-xs">
            <q-select
              v-model="row.selectedShift"
              :options="shiftOptions"
              emit-value
              map-options
              dense
              outlined
              label="Turno"
              :disable="row.excluded"
            />
          </q-item-section>

          <!-- Reason per row -->
          <q-item-section class="q-px-xs">
            <q-select
              v-model="row.absenceLabel"
              :options="absenceOptions"
              emit-value
              map-options
              dense
              outlined
              label="Motivo"
              :disable="row.excluded"
            />
          </q-item-section>

          <!-- Note per row (visible and editable for operator timbratura instructions) -->
          <q-item-section class="q-px-xs">
            <q-input
              v-model="row.note"
              dense
              outlined
              label="Note"
              :disable="row.excluded"
              clearable
            />
          </q-item-section>

          <!-- Exclude toggle -->
          <q-item-section side>
            <q-toggle
              v-model="row.excluded"
              color="negative"
              size="sm"
            >
              <q-tooltip>{{ row.excluded ? 'Riabilita' : 'Escludi questo giorno' }}</q-tooltip>
            </q-toggle>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-card-actions align="right" class="q-pb-md q-pr-md q-pt-md">
      <q-btn flat label="← Modifica" color="grey-7" @click="backToForm" :disable="submitting" />
      <q-btn
        :label="`Conferma e Invia (${previewActiveCount})`"
        color="positive"
        unelevated
        icon="send"
        :loading="submitting"
        :disable="previewActiveCount === 0"
        @click="confirmAndSubmit"
      />
    </q-card-actions>
  </q-card>
</template>

<style scoped>
.absence-form-card {
  border-radius: 12px;
}
</style>
