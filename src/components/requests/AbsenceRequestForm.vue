/**
 * @file AbsenceRequestForm.vue
 * @description Extracted component for managing single and intelligent recurring absence requests.
 * @author Nurse Hub Team
 * @created 2026-05-02
 * @modified 2026-05-02
 */

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar, date as dateUtil } from 'quasar';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useShiftLogic } from '../../composables/useShiftLogic';
import { useSecureLogger } from '../../utils/secureLogger';
import { notifyAdmins, notifyEligibleOperators } from '../../services/NotificationService';
import type { ShiftRequest, ShiftCode, RequestReason } from '../../types/models';

const props = defineProps<{
  // If true, shows the operator selector (for admins)
  isAdminMode?: boolean;
}>();

const emit = defineEmits(['success']);

const $q = useQuasar();
const logger = useSecureLogger();
const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const { getShiftTimeRange, hasSignificantOverlap } = useShiftLogic();

// --- Form State ---
const inputMode = ref<'SHIFT' | 'TIME'>('SHIFT');
const formData = ref({
  date: dateUtil.formatDate(new Date(), 'YYYY-MM-DD'),
  isRecurring: false,
  endDate: dateUtil.formatDate(new Date(), 'YYYY-MM-DD'),
  shift: 'M' as ShiftCode,
  startTime: '',
  endTime: '',
  reason: 'ABSENCE' as RequestReason,
  note: '',
});

const selectedOperatorId = ref(props.isAdminMode ? '' : authStore.currentOperator?.id || '');
const filterText = ref('');
const submitting = ref(false);
const showPreview = ref(false);

// --- Options & Helpers ---
const itLocale = {
  days: 'Domenica_Lunedì_Martedì_Mercoledì_Giovedì_Venerdì_Sabato'.split('_'),
  daysShort: 'Dom_Lun_Mar_Mer_Gio_Ven_Sab'.split('_'),
  months: 'Gennaio_Febbraio_Marzo_Aprile_Maggio_Giugno_Luglio_Agosto_Settembre_Ottobre_Novembre_Dicembre'.split('_'),
  monthsShort: 'Gen_Feb_Mar_Apr_Mag_Giu_Lug_Ago_Set_Ott_Nov_Dic'.split('_'),
  firstDayOfWeek: 1,
  format24h: true,
  pluralDay: 'giorni'
};

const absenceOptions = [
  { label: 'Assenza Generica', value: 'ABSENCE' },
  { label: 'Malattia', value: 'ABSENCE' },
  { label: 'Congedo', value: 'ABSENCE' },
  { label: 'Ferie', value: 'ABSENCE' },
  { label: 'Altro', value: 'ABSENCE' },
];

const filteredOperatorOptions = computed(() => {
  const list = scheduleStore.operators.map((op) => ({
    id: op.id,
    name: op.name,
  }));
  if (!filterText.value) return list;
  const needle = filterText.value.toLowerCase();
  return list.filter((v) => v.name.toLowerCase().includes(needle));
});

function filterOperators(val: string, update: (callback: () => void) => void) {
  update(() => { filterText.value = val; });
}

function formatDate(d: string | undefined) {
  if (!d) return '';
  return dateUtil.formatDate(d, 'DD/MM/YYYY');
}

// --- Validation & Intelligence ---

const currentScheduledShift = computed(() => {
  const targetId = selectedOperatorId.value;
  if (!targetId) return null;
  const operator = scheduleStore.operators.find(op => op.id === targetId);
  return operator?.schedule?.[formData.value.date] || 'R';
});

const validationError = computed(() => {
  const targetId = selectedOperatorId.value;
  if (!targetId) return null;
  const operator = scheduleStore.operators.find(op => op.id === targetId);
  if (!operator) return null;

  const date = formData.value.date;
  const scheduledShift = operator.schedule?.[date] || 'R';
  const opName = operator.name;

  if (scheduledShift === 'R' || scheduledShift === 'S') {
    return `${opName} risulta a ${scheduledShift === 'R' ? 'RIPOSO' : 'SMONTO'} il ${formatDate(date)}.`;
  }
  if (scheduledShift === 'A') return `${opName} risulta già ASSENTE il ${formatDate(date)}.`;

  if (inputMode.value === 'SHIFT') {
    if (formData.value.shift !== scheduledShift) {
      return `${opName} il ${formatDate(date)} è di "${scheduledShift}". Seleziona il turno corretto per iniziare.`;
    }
  } else if (inputMode.value === 'TIME') {
    if (formData.value.startTime && formData.value.endTime) {
      const [sStart, sEnd] = getShiftTimeRange(scheduledShift as ShiftCode);
      if (!hasSignificantOverlap(sStart, sEnd, formData.value.startTime, formData.value.endTime)) {
        return `La fascia oraria non coincide con il turno di ${opName} (${sStart}-${sEnd}).`;
      }
    }
  }
  return null;
});

// --- Preview Generation ---
interface PreviewItem {
  date: string;
  shift: ShiftCode;
  note: string;
  skip: boolean;
  reason?: string;
}

const previewList = ref<PreviewItem[]>([]);

function generatePreview() {
  if (validationError.value) return;
  
  const targetId = selectedOperatorId.value;
  const operator = scheduleStore.operators.find(op => op.id === targetId);
  if (!operator) return;

  const list: PreviewItem[] = [];
  let current = new Date(formData.value.date);
  const end = new Date(formData.value.endDate);

  while (current <= end) {
    const dStr = dateUtil.formatDate(current, 'YYYY-MM-DD');
    const shift = (operator.schedule?.[dStr] || 'R');
    
    let skip = false;
    let reason = '';

    if (shift === 'R' || shift === 'S') {
      skip = true;
      reason = shift === 'R' ? 'Riposo' : 'Smonto';
    } else if (shift === 'A') {
      skip = true;
      reason = 'Già assente';
    }

    list.push({
      date: dStr,
      shift,
      note: formData.value.note,
      skip,
      reason
    });
    current = dateUtil.addToDate(current, { days: 1 });
  }

  previewList.value = list;
  showPreview.value = true;
}

// --- Submit Logic ---
async function submitRequests() {
  submitting.value = true;
  try {
    const targetId = selectedOperatorId.value;
    const operator = scheduleStore.operators.find(op => op.id === targetId);
    const creatorName = `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim();
    
    const itemsToSave = formData.value.isRecurring ? previewList.value.filter(i => !i.skip) : [{
      date: formData.value.date,
      shift: formData.value.shift,
      note: formData.value.note,
      skip: false
    }];

    const batch = itemsToSave.map(item => {
      const newReq: Omit<ShiftRequest, 'id'> = {
        date: item.date,
        originalShift: inputMode.value === 'SHIFT' ? item.shift : 'A',
        reason: formData.value.reason,
        status: 'OPEN',
        creatorId: authStore.currentUser!.uid,
        creatorName,
        absentOperatorId: targetId,
        absentOperatorName: operator?.name || 'Operatore',
        configId: configStore.activeConfigId || '',
        createdAt: Date.now(),
        requestNote: item.note,
        ...(inputMode.value === 'TIME' ? { startTime: formData.value.startTime, endTime: formData.value.endTime } : {})
      };
      return addDoc(collection(db, 'shiftRequests'), newReq);
    });

    const results = await Promise.all(batch);
    
    // Trigger Notifications for each created request
    results.forEach((docRef, index) => {
      const item = itemsToSave[index];
      if (!item) return; // Safety check for TS
      const configId = configStore.activeConfigId || '';
      
      // 1. Notify Admins
      const adminMsg = `Nuova richiesta di assenza da ${creatorName} per il ${formatDate(item.date)} (${item.shift})`;
      void notifyAdmins(adminMsg, docRef.id, configId);
      
      // 2. Notify Eligible Colleagues (for coverage)
      const partialReq = {
        id: docRef.id,
        date: item.date,
        originalShift: item.shift,
        absentOperatorId: targetId,
      } as unknown as ShiftRequest;
      void notifyEligibleOperators(partialReq, configId);
    });
    
    $q.notify({ type: 'positive', message: 'Richieste inviate con successo!' });
    emit('success');
    
    // Reset form
    showPreview.value = false;
    formData.value.note = '';
  } catch (e) {
    logger.error('Error submitting requests', e);
    $q.notify({ type: 'negative', message: 'Errore durante l\'invio' });
  } finally {
    submitting.value = false;
  }
}

function getShiftColor(code: ShiftCode) {
  if (code.startsWith('M')) return 'blue-7';
  if (code.startsWith('P')) return 'orange-8';
  if (code.startsWith('N')) return 'indigo-10';
  return 'primary';
}

function getShiftIcon(code: ShiftCode) {
  if (code.startsWith('M')) return 'light_mode';
  if (code.startsWith('P')) return 'wb_twilight';
  if (code.startsWith('N')) return 'dark_mode';
  return 'event';
}
</script>

<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section class="bg-primary text-white row items-center justify-between py-xs px-md">
      <div class="text-subtitle1 text-weight-bold">Nuova Richiesta Assenza</div>
      <q-icon name="event_busy" size="sm" />
    </q-card-section>

    <q-card-section class="q-gutter-md">
      <!-- Admin: Operator Selector -->
      <q-select v-if="isAdminMode" v-model="selectedOperatorId" :options="filteredOperatorOptions" option-label="name"
        option-value="id" label="Operatore (per conto di)" outlined dense emit-value map-options use-input clearable
        @filter="filterOperators" hint="Seleziona l'operatore per cui stai creando la richiesta">
        <template v-slot:prepend>
          <q-icon name="person" />
        </template>
      </q-select>

      <div class="row q-col-gutter-md items-start">
        <!-- Date Input -->
        <div class="col-12 col-md-4">
          <q-input :model-value="formatDate(formData.date)" label="Data Assenza" outlined dense readonly class="cursor-pointer">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="formData.date" mask="YYYY-MM-DD" :locale="itLocale" @update:model-value="showPreview = false">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Chiudi" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <!-- Recurrence Toggle & Current Shift -->
        <div class="col-12 col-md-4">
          <div class="column q-gutter-y-xs">
            <q-toggle v-model="formData.isRecurring" label="Più giorni (scansione automatica)" color="secondary" dense @update:model-value="showPreview = false" />
            <div v-if="currentScheduledShift" class="row items-center q-gutter-x-sm q-ml-xs">
              <span class="text-caption text-grey-7">Turno a tabellone:</span>
              <q-badge :color="currentScheduledShift === 'R' ? 'grey-7' : 'primary'" class="text-weight-bold">
                {{ currentScheduledShift }}
              </q-badge>
            </div>
          </div>
        </div>

        <!-- End Date Input (if recurring) -->
        <div v-if="formData.isRecurring" class="col-12 col-md-4">
          <q-input :model-value="formatDate(formData.endDate)" label="Fino al giorno" outlined dense readonly class="cursor-pointer">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="formData.endDate" mask="YYYY-MM-DD" :locale="itLocale" @update:model-value="showPreview = false">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Chiudi" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
      </div>

      <!-- Mode Toggle (Only if not recurring for now to keep it simple, or applied to all) -->
      <div class="row items-center q-gutter-x-md q-pt-xs">
        <span class="text-caption">Tipo Selezione:</span>
        <q-btn-toggle v-model="inputMode" toggle-color="secondary" :options="[
          { label: 'Turno Intero', value: 'SHIFT' },
          { label: 'Fascia Oraria', value: 'TIME' },
        ]" dense outlined rounded unelevated />
      </div>

      <!-- Shift Selection (if single request) -->
      <div v-if="inputMode === 'SHIFT' && !formData.isRecurring" class="q-mt-sm">
        <q-btn-toggle v-model="formData.shift" toggle-color="primary" :options="[
          { label: 'Mattina', value: 'M' },
          { label: 'Pomeriggio', value: 'P' },
          { label: 'Notte', value: 'N' },
        ]" spread dense outlined class="full-width" />
      </div>

      <!-- Time Range Input -->
      <div v-if="inputMode === 'TIME'" class="row q-col-gutter-md q-mt-xs">
        <div class="col-12 col-md-6">
          <q-input v-model="formData.startTime" type="time" label="Dalle ore" outlined dense />
        </div>
        <div class="col-12 col-md-6">
          <q-input v-model="formData.endTime" type="time" label="Alle ore" outlined dense />
        </div>
      </div>

      <!-- General Reason & Note -->
      <div class="row q-col-gutter-md q-mt-xs">
        <div class="col-12">
          <q-select v-model="formData.reason" :options="absenceOptions" label="Motivo Assenza" outlined dense emit-value map-options />
        </div>
        <div class="col-12">
          <q-input v-model="formData.note" label="Note (verranno applicate a tutti i giorni)" outlined dense type="textarea" rows="2" />
        </div>
      </div>

      <!-- Validation Error -->
      <q-slide-transition>
        <div v-if="validationError" class="q-mt-md">
          <q-banner dense class="bg-red-1 text-red-10 rounded-borders border-red-2">
            <template v-slot:avatar><q-icon name="warning" color="red" /></template>
            <div class="text-weight-medium">{{ validationError }}</div>
          </q-banner>
        </div>
      </q-slide-transition>
    </q-card-section>

    <!-- INTELLIGENT PREVIEW SECTION -->
    <q-card-section v-if="formData.isRecurring && !validationError" class="q-pt-none">
      <q-btn 
        label="Genera Anteprima Periodo" 
        color="secondary" 
        unelevated 
        class="full-width q-mb-md" 
        icon="analytics" 
        @click="generatePreview" 
      />
      
      <q-slide-transition>
        <div v-if="showPreview" class="preview-container q-pa-sm rounded-borders">
          <div class="row items-center justify-between q-mb-md q-px-sm">
            <div class="text-subtitle2 text-secondary text-weight-bold row items-center">
              <q-icon name="list_alt" class="q-mr-xs" />
              RIEPILOGO RICHIESTE ({{ previewList.filter(i => !i.skip).length }})
            </div>
            <div class="text-caption text-grey-6 italic">Gorni saltati: {{ previewList.filter(i => i.skip).length }}</div>
          </div>

          <div class="q-gutter-y-sm">
            <div v-for="item in previewList" :key="item.date" 
              class="preview-item row items-center q-pa-sm rounded-borders transition-all" 
              :class="item.skip ? 'item-skipped' : 'item-active shadow-1'">
              
              <!-- Date & Day Info -->
              <div class="col-4 column">
                <span class="text-weight-bold text-body2">{{ formatDate(item.date) }}</span>
                <span class="text-caption text-grey-7">{{ dateUtil.formatDate(item.date, 'dddd', itLocale) }}</span>
              </div>
              
              <!-- Shift Indicator -->
              <div class="col-2 text-center">
                <template v-if="!item.skip">
                  <q-chip 
                    dense 
                    :color="getShiftColor(item.shift)" 
                    text-color="white" 
                    class="text-weight-bold"
                    :icon="getShiftIcon(item.shift)"
                  >
                    {{ item.shift }}
                  </q-chip>
                </template>
                <q-badge v-else color="grey-4" text-color="grey-7" label="OFF" />
              </div>
              
              <!-- Note / Reason -->
              <div class="col-5 q-px-sm">
                <div v-if="item.skip" class="row items-center text-grey-6">
                  <q-icon name="block" size="xs" class="q-mr-xs" />
                  <span class="text-caption italic">{{ item.reason }}</span>
                </div>
                <q-input v-else v-model="item.note" dense borderless class="note-input" placeholder="Aggiungi nota..." hide-bottom-space>
                  <template v-slot:prepend>
                    <q-icon name="edit" size="xs" color="grey-4" />
                  </template>
                </q-input>
              </div>

              <!-- Action Toggle -->
              <div class="col-1 text-right">
                <q-checkbox 
                  v-model="item.skip" 
                  dense 
                  size="sm" 
                  :true-value="false" 
                  :false-value="true"
                  color="secondary"
                  keep-color
                >
                  <q-tooltip>{{ item.skip ? 'Includi' : 'Escludi' }}</q-tooltip>
                </q-checkbox>
              </div>
            </div>
          </div>
        </div>
      </q-slide-transition>
    </q-card-section>

    <q-card-actions align="right" class="q-pa-md">
      <q-btn 
        :label="formData.isRecurring ? 'Invia Tutte le Richieste' : 'Invia Richiesta'" 
        color="primary" 
        unelevated
        @click="submitRequests" 
        :loading="submitting"
        :disabled="!!validationError || (formData.isRecurring && !showPreview)"
      />
    </q-card-actions>
  </q-card>
</template>

<style scoped>
.preview-container {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
}
.preview-item {
  border: 1px solid transparent;
}
.item-active {
  background: white;
  border-color: #eee;
}
.item-active:hover {
  border-color: var(--q-primary);
}
.item-skipped {
  background: #f0f0f0;
  opacity: 0.7;
}
.note-input :deep(.q-field__native) {
  font-size: 11px;
}
.transition-all {
  transition: all 0.3s ease;
}
.border-red-2 {
  border: 1px solid #ffcdd2;
}
</style>
