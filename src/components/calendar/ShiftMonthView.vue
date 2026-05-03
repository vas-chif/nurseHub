/**
 * @file ShiftMonthView.vue
 * @description Custom grid-based monthly calendar with "Elite" cell styling matching the Home Dashboard.
 * @author Nurse Hub Team
 * @created 2026-05-03
 * @notes
 * - Grid implementation for full month view.
 * - Cell style: White card, top color bar, colored letter + icon (matches Home style).
 */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useSecureLogger } from '../../utils/secureLogger';
import { date as quasarDate } from 'quasar';
import type { ShiftStyle } from '../../types/components';

const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const logger = useSecureLogger();

const currentMonthDate = ref(new Date());

// Navigation
function nextMonth() {
  currentMonthDate.value = quasarDate.addToDate(currentMonthDate.value, { months: 1 });
}
function prevMonth() {
  currentMonthDate.value = quasarDate.addToDate(currentMonthDate.value, { months: -1 });
}

// Data Loading
async function loadData(force = false) {
  const configId = authStore.isAnyAdmin
    ? (configStore.activeConfigId || authStore.currentUser?.configId)
    : authStore.currentUser?.configId;
  if (!configId) return;
  try {
    await scheduleStore.loadOperators(configId, force);
  } catch (e) {
    logger.error('Error loading operators for ShiftMonthView', e);
  }
}

onMounted(() => { void loadData(); });
watch(() => configStore.activeConfigId, () => { void loadData(); });

// Current Operator Schedule
const currentOperator = computed(() => {
  const targetId = authStore.currentOperator?.id || authStore.currentUser?.operatorId;
  return scheduleStore.operators.find(op => op.id === targetId) || authStore.currentOperator;
});

const shiftStyles = computed(() => configStore.activeConfig?.shiftStyles || {});

// Grid Generation
const dayNames = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

const calendarDays = computed(() => {
  const year = currentMonthDate.value.getFullYear();
  const month = currentMonthDate.value.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startPadding = firstDay.getDay() - 1;
  if (startPadding === -1) startPadding = 6;
  
  const days = [];
  for (let i = 0; i < startPadding; i++) {
    const d = quasarDate.addToDate(firstDay, { days: -(startPadding - i) });
    days.push({ date: d, isCurrentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = quasarDate.addToDate(lastDay, { days: i });
    days.push({ date: d, isCurrentMonth: false });
  }
  return days;
});

function getShiftForDate(d: Date) {
  if (!currentOperator.value) return null;
  const key = quasarDate.formatDate(d, 'YYYY-MM-DD');
  return currentOperator.value.schedule?.[key] || null;
}

function getShiftStyles(code: string | null): ShiftStyle {
  const map: Record<string, ShiftStyle> = {
    'M': { color: '#f59e0b', icon: 'light_mode', label: 'Mattina', bg: 'rgba(245, 158, 11, 0.1)' },
    'P': { color: '#ea580c', icon: 'wb_twilight', label: 'Pomeriggio', bg: 'rgba(234, 88, 12, 0.1)' },
    'N': { color: '#1e3a8a', icon: 'dark_mode', label: 'Notte', bg: 'rgba(30, 58, 138, 0.1)' },
    'R': { color: '#64748b', icon: 'hotel', label: 'Riposo', bg: 'rgba(100, 116, 139, 0.05)' },
    'S': { color: '#16a34a', icon: 'logout', label: 'Smonto', bg: 'rgba(22, 163, 74, 0.1)' },
    'A': { color: '#dc2626', icon: 'event_busy', label: 'Assenza', bg: 'rgba(220, 38, 38, 0.1)' },
    '':  { color: '#94a3b8', icon: 'help_outline', label: 'N/D', bg: 'transparent' }
  };

  if (!code) return map['']!;
  const custom = shiftStyles.value[code];
  if (custom) return { color: custom.color, icon: custom.icon, label: code, bg: custom.bg || 'rgba(0,0,0,0.05)' };
  
  const char = code.charAt(0).toUpperCase();
  return (map[char] || map[''])!;
}
</script>

<template>
  <div class="shift-month-grid">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-sm header-nav shadow-1">
      <q-btn flat round dense icon="chevron_left" @click="prevMonth" color="primary" />
      <div class="text-subtitle1 text-weight-bolder text-grey-9 text-capitalize">
        {{ currentMonthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }}
      </div>
      <q-btn flat round dense icon="chevron_right" @click="nextMonth" color="primary" />
    </div>

    <!-- Day Names -->
    <div class="calendar-grid-header q-mb-xs">
      <div v-for="day in dayNames" :key="day" class="text-center text-caption text-weight-bold text-grey-6 q-py-xs">
        {{ day }}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <div 
        v-for="(day, index) in calendarDays" 
        :key="index" 
        class="calendar-cell"
        :class="{ 'not-current': !day.isCurrentMonth }"
      >
        <div 
          class="elite-shift-card full-height relative-position shadow-1"
          :style="{ 
            '--shift-color': getShiftStyles(getShiftForDate(day.date)).color,
            '--shift-bg': getShiftStyles(getShiftForDate(day.date)).bg
          }"
        >
          <!-- Day Number -->
          <div class="day-num text-weight-bold text-grey-8">{{ day.date.getDate() }}</div>
          
          <!-- Shift Display (Letter + Icon) -->
          <div class="shift-info column items-center justify-center full-width" v-if="getShiftForDate(day.date)">
            <div class="shift-letter text-weight-bolder" :style="{ color: getShiftStyles(getShiftForDate(day.date)).color }">
              {{ getShiftForDate(day.date) }}
            </div>
            <q-icon 
              :name="getShiftStyles(getShiftForDate(day.date)).icon" 
              size="12px" 
              :style="{ color: getShiftStyles(getShiftForDate(day.date)).color }"
              class="q-mt-xs"
            />
          </div>
          <div v-else class="flex-grow"></div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="row justify-center q-mt-md q-gutter-sm">
      <q-badge rounded color="amber-8" label="M" class="q-px-sm" />
      <q-badge rounded color="orange-8" label="P" class="q-px-sm" />
      <q-badge rounded color="blue-10" label="N" class="q-px-sm" />
      <q-badge rounded color="grey-5" label="R" class="q-px-sm" />
      <q-badge rounded color="green-6" label="S" class="q-px-sm" />
      <q-badge rounded color="red-6" label="A" class="q-px-sm" />
    </div>
  </div>
</template>

<style scoped>
.shift-month-grid {
  width: 100%;
}

.header-nav {
  background: white;
  padding: 8px 16px;
  border-radius: 16px;
  margin-bottom: 16px;
}

.calendar-grid-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-cell {
  /* Maintaining a good aspect ratio on desktop */
  aspect-ratio: 1 / 1;
  min-height: 100px;
}

.elite-shift-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.elite-shift-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--shift-color, transparent);
  opacity: 0.9;
}

.elite-shift-card:hover {
  transform: translateY(-4px);
  background: var(--shift-bg, #ffffff);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.not-current {
  opacity: 0.25;
}

.day-num {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 0.85rem;
  line-height: 1;
}

.shift-info {
  flex-grow: 1;
  padding-top: 12px;
}

.shift-letter {
  font-size: 2.2rem;
  line-height: 1;
  letter-spacing: -1.5px;
}

@media (max-width: 1024px) {
  .shift-letter {
    font-size: 1.8rem;
  }
  .calendar-cell {
    min-height: 80px;
  }
}

@media (max-width: 600px) {
  .calendar-grid {
    gap: 4px;
  }
  .elite-shift-card {
    border-radius: 10px;
  }
  .shift-letter {
    font-size: 1.3rem;
  }
  .calendar-cell {
    aspect-ratio: 1 / 1.2;
    min-height: 60px;
  }
  .day-num {
    top: 4px;
    right: 6px;
    font-size: 0.65rem;
  }
  .shift-info {
    padding-top: 4px;
  }
}
</style>
