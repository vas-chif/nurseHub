/**
 * @file ShiftCalendar.vue
 * @description Monthly calendar view with premium, compact design.
 * @author Nurse Hub Team
 * @created 2026-03-12
 * @modified 2026-05-03
 * @notes
 * - Complies with §1.4 by using centralized types.
 */
<script setup lang="ts">
import { ref, computed, onMounted, watch, watchEffect } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useSecureLogger } from '../../utils/secureLogger';
import { useScheduleStore } from '../../stores/scheduleStore';
import type { Operator, ShiftCode } from '../../types/models';
import type { DayShift, OperatorCalendar, ShiftStyle } from '../../types/components';

import { date as dateUtil } from 'quasar';
const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const logger = useSecureLogger();

const operatorOptions = ref<Operator[]>([]);
const filteredOptions = ref<Operator[]>([]);
const selectedOperator = ref<Operator[]>([]);
const hasSearchModule = ref(true);

// Fetch Operators
async function loadData(force = false) {
  const configId = authStore.isAnyAdmin
    ? (configStore.activeConfigId || authStore.currentUser?.configId)
    : authStore.currentUser?.configId;

  if (!configId) return;

  try {
    const loadedOps = await scheduleStore.loadOperators(configId, force);
    const sortedOps = [...loadedOps].sort((a, b) => a.name.localeCompare(b.name));
    operatorOptions.value = sortedOps;
    filteredOptions.value = sortedOps;
  } catch (e) {
    logger.error('Error loading operators for calendar', e);
  }
}

onMounted(() => { void loadData(); });

watch(() => [configStore.activeConfigId, authStore.currentUser?.configId], async ([newAdminId, userConfigId]) => {
  const relevantId = authStore.isAnyAdmin ? newAdminId : userConfigId;
  if (relevantId) await loadData();
}, { deep: true });

watch(() => scheduleStore.operators.length, (newLen) => {
  if (newLen === 0 && (configStore.activeConfigId || authStore.currentUser?.configId)) void loadData(true);
});

watchEffect(() => {
  const options = operatorOptions.value;
  if (options.length === 0 || !authStore.isAuthenticated) return;
  const targetId = authStore.currentOperator?.id || authStore.currentUser?.operatorId;
  if (selectedOperator.value.length === 0 && !authStore.isAnyAdmin && targetId) {
    const match = options.find((o) => o.id === targetId);
    if (match) selectedOperator.value = [match];
  }
});

function filterOperators(val: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = val.toLowerCase();
    operatorOptions.value = filteredOptions.value.filter(v => v.name.toLowerCase().includes(needle));
  });
}

const calendars = computed<OperatorCalendar[]>(() => {
  return selectedOperator.value.map((op) => {
    const today = new Date();
    const days: DayShift[] = [];
    const schedule = op.schedule || {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateKey = dateUtil.formatDate(d, 'YYYY-MM-DD');
      days.push({
        date: dateKey,
        dateFormatted: `${d.getDate()}/${d.getMonth() + 1}`,
        dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }),
        shift: (schedule[dateKey] as ShiftCode) || '',
      });
    }
    return { operatorId: op.id, operatorName: op.name, days };
  });
});

function getShiftStyles(code: ShiftCode): ShiftStyle {
  const map: Record<string, ShiftStyle> = {
    'M': { color: '#f59e0b', icon: 'light_mode', label: 'Mattina', bg: 'rgba(245, 158, 11, 0.1)' },
    'P': { color: '#ea580c', icon: 'wb_twilight', label: 'Pomeriggio', bg: 'rgba(234, 88, 12, 0.1)' },
    'N': { color: '#1e3a8a', icon: 'dark_mode', label: 'Notte', bg: 'rgba(30, 58, 138, 0.1)' },
    'R': { color: '#64748b', icon: 'hotel', label: 'Riposo', bg: 'rgba(100, 116, 139, 0.05)' },
    'S': { color: '#16a34a', icon: 'logout', label: 'Smonto', bg: 'rgba(22, 163, 74, 0.1)' },
    'A': { color: '#dc2626', icon: 'event_busy', label: 'Assenza', bg: 'rgba(220, 38, 38, 0.1)' },
    '':  { color: '#94a3b8', icon: 'help_outline', label: 'N/D', bg: 'transparent' }
  };
  const char = code.charAt(0);
  return (map[char] || map['']) as ShiftStyle;
}

function onSwipe() {}
</script>

<template>
  <q-card flat bordered class="shift-calendar-card overflow-hidden">
    <q-card-section class="row items-center justify-between bg-white q-py-sm">
      <div class="row items-center q-gutter-x-sm">
        <q-icon name="calendar_today" color="primary" size="xs" />
        <div class="text-subtitle1 text-weight-bolder text-grey-9">I Tuoi Turni</div>
      </div>
      <div style="min-width: 200px" v-if="authStore.isAnyAdmin && hasSearchModule">
        <q-select v-model="selectedOperator" :options="operatorOptions" label="Cerca" dense outlined
          options-dense rounded bg-color="white" multiple use-chips use-input option-label="name" @filter="filterOperators">
          <template v-slot:append><q-icon name="search" size="xs" /></template>
        </q-select>
      </div>
    </q-card-section>

    <div v-if="calendars.length > 0">
      <div v-for="calendar in calendars" :key="calendar.operatorId" class="q-pb-sm">
        <q-separator />
        <q-card-section class="q-py-sm">
          <div class="row items-center q-mb-sm">
            <q-avatar size="24px" color="primary-1" text-color="primary" class="q-mr-sm shadow-1">
              {{ calendar.operatorName.charAt(0) }}
            </q-avatar>
            <div class="column">
              <span class="text-caption text-grey-6 uppercase letter-spacing-1" style="font-size: 0.6rem">Programmazione</span>
              <span class="text-subtitle2 text-weight-bold text-grey-9" style="line-height: 1">{{ calendar.operatorName }}</span>
            </div>
          </div>
          
          <div class="scroll-container q-py-xs" v-touch-swipe.horizontal.stop="onSwipe">
            <div v-for="(day, index) in calendar.days" :key="index"
              class="shift-card column items-center justify-between q-pa-xs"
              :style="{ 
                '--shift-color': getShiftStyles(day.shift as ShiftCode).color, 
                '--shift-bg': getShiftStyles(day.shift as ShiftCode).bg 
              }">
              
              <div class="column items-center">
                <span class="day-num text-weight-bolder">{{ day.dateFormatted.split('/')[0] }}</span>
                <span class="day-name text-caption text-uppercase" style="font-size: 0.55rem">{{ day.dayName }}</span>
              </div>

              <div class="shift-display column items-center">
                <div class="shift-letter text-weight-bold" :class="day.shift ? 'active' : ''">
                  {{ day.shift || '-' }}
                </div>
                <q-icon :name="getShiftStyles(day.shift as ShiftCode).icon" 
                  :style="{ color: getShiftStyles(day.shift as ShiftCode).color }" size="12px" />
              </div>

              <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 8]">
                {{ getShiftStyles(day.shift as ShiftCode).label }}
              </q-tooltip>
            </div>
          </div>
        </q-card-section>
      </div>
    </div>

    <q-card-section v-else-if="!scheduleStore.loading" class="text-center text-grey-5 q-pa-lg">
      <q-icon name="history_toggle_off" size="40px" class="q-mb-sm opacity-2" />
      <div class="text-subtitle2 opacity-5">Nessun turno</div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.shift-calendar-card {
  border-radius: 12px;
  background: #ffffff;
}

.scroll-container {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 4px 2px 8px 2px;
  scroll-snap-type: x mandatory;
}

.shift-card {
  min-width: 64px;
  height: 95px;
  background: white;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  scroll-snap-align: start;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.shift-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--shift-color);
  opacity: 0.8;
}

.shift-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px var(--shift-bg);
}

.day-num {
  font-size: 0.95rem;
  color: #1e293b;
  margin-top: 2px;
}

.day-name {
  color: #64748b;
  font-weight: 600;
}

.shift-letter {
  font-size: 1.5rem;
  line-height: 1;
  color: #94a3b8;
}

.shift-letter.active {
  color: var(--shift-color);
}

.letter-spacing-1 {
  letter-spacing: 1px;
}

.scroll-container::-webkit-scrollbar {
  height: 4px;
}
.scroll-container::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.scroll-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.opacity-2 { opacity: 0.2; }
.opacity-5 { opacity: 0.5; }
</style>
