/**
* @file ShiftMonthView.vue
* @description Monthly calendar view for user shifts.
* @author Nurse Hub Team
* @created 2026-02-11
* @modified 2026-04-20
*/


<script setup lang="ts">
import { ref, computed } from 'vue';
import { date as qDate } from 'quasar';
import type { ShiftCode } from '../../types/models';
import { useAuthStore } from '../../stores/authStore';
import GlobalSyncBtn from '../common/GlobalSyncBtn.vue';
import { useSecureLogger } from '../../utils/secureLogger';

const logger = useSecureLogger();

const authStore = useAuthStore();

interface CalendarDay {
  date: Date;
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  shift?: ShiftCode | undefined;
}

const currentDate = ref(new Date());
const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

const currentMonthLabel = computed(() => {
  return qDate.formatDate(currentDate.value, 'MMMM YYYY', {
    months: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
  });
});

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days: CalendarDay[] = [];
  const getShift = (d: Date): ShiftCode | undefined => {
    if (!authStore.currentOperator?.schedule) return undefined;
    return authStore.currentOperator.schedule[qDate.formatDate(d, 'YYYY-MM-DD')];
  };

  for (let i = 0; i < startDay; i++) {
    const d = qDate.subtractFromDate(firstDayOfMonth, { days: startDay - i });
    days.push({ date: d, dateStr: qDate.formatDate(d, 'YYYY-MM-DD'), day: d.getDate(), isCurrentMonth: false, shift: getShift(d) });
  }
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, dateStr: qDate.formatDate(d, 'YYYY-MM-DD'), day: i, isCurrentMonth: true, shift: getShift(d) });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = qDate.addToDate(lastDayOfMonth, { days: i });
    days.push({ date: d, dateStr: qDate.formatDate(d, 'YYYY-MM-DD'), day: d.getDate(), isCurrentMonth: false, shift: getShift(d) });
  }
  return days;
});

function prevMonth() { currentDate.value = qDate.subtractFromDate(currentDate.value, { month: 1 }); }
function nextMonth() { currentDate.value = qDate.addToDate(currentDate.value, { month: 1 }); }
function isToday(d: Date): boolean { return qDate.isSameDate(d, new Date(), 'day'); }

function getCellClass(day: CalendarDay) {
  const classes = [day.isCurrentMonth ? 'bg-white' : 'bg-grey-1 text-grey-6'];
  if (isToday(day.date)) classes.push('today-cell');
  return classes.join(' ');
}

function getShiftColor(code: ShiftCode): string {
  const map: Record<string, string> = { M: 'amber-8', P: 'orange-8', N: 'blue-10', R: 'grey-5', A: 'red-5', S: 'green-6', MP: 'purple-6' };
  return map[code] || 'primary';
}

function onDayClick(day: CalendarDay) { logger.debug('Day clicked', { date: day.dateStr }); }
</script>

<template>
  <div class="shift-month-view">
    <!-- Header Controls -->
    <div class="row justify-between items-center q-mb-lg bg-white q-pa-sm rounded-borders shadow-1">
      <q-btn flat round dense size="sm" icon="chevron_left" color="grey-7" @click="prevMonth" />

      <div class="row items-center no-wrap q-gutter-sm">
        <div class="text-h6 text-weight-bold text-primary">
          {{ currentMonthLabel.split(' ')[0] }}
          <span class="text-weight-light text-grey-8">{{ currentMonthLabel.split(' ')[1] }}</span>
        </div>

        <!-- Componente Centralizzato Sincronizzazione -->
        <GlobalSyncBtn size="sm" />
      </div>

      <q-btn flat round dense size="sm" icon="chevron_right" color="grey-7" @click="nextMonth" />
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <div v-for="day in weekDays" :key="day" class="text-center text-dark text-caption q-pb-sm text-weight-bold">
        {{ day }}
      </div>

      <div v-for="(dateObj, index) in calendarDays" :key="index"
        class="calendar-cell relative-position q-pa-xs cursor-pointer column justify-between"
        :class="getCellClass(dateObj)" @click="onDayClick(dateObj)">
        <div class="text-caption text-right" :class="{ 'text-weight-bold': isToday(dateObj.date) }">
          {{ dateObj.day }}
        </div>

        <div v-if="dateObj.shift" class="shift-indicator q-mt-xs text-center">
          <q-badge :color="getShiftColor(dateObj.shift)" :label="dateObj.shift"
            class="full-width shadow-2 text-center text-weight-bold text-white" style="min-height: 40px"
            :class="{ 'dimmed-badge': !dateObj.isCurrentMonth }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  background-color: #e0e0e0;
  border: 1px solid #e0e0e0;
  padding: 1px;
}

.calendar-cell {
  min-height: 80px;
  border-radius: 4px;
}

.today-cell {
  border: 2px solid var(--q-primary);
  font-weight: bold;
}

.dimmed-badge {
  opacity: 0.6;
}
</style>
