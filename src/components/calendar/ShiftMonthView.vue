<template>
  <div class="shift-month-view">
    <!-- Header Controls -->
    <div class="row justify-between items-center q-mb-md">
      <q-btn flat round icon="chevron_left" @click="prevMonth" />
      <div class="text-h6 text-capitalize">{{ currentMonthLabel }}</div>
      <q-btn flat round icon="chevron_right" @click="nextMonth" />
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <!-- Days Header -->
      <div
        v-for="day in weekDays"
        :key="day"
        class="text-center text-dark text-caption q-pb-sm text-weight-bold"
      >
        {{ day }}
      </div>

      <!-- Days Cells -->
      <div
        v-for="(dateObj, index) in calendarDays"
        :key="index"
        class="calendar-cell relative-position q-pa-xs cursor-pointer column justify-between"
        :class="getCellClass(dateObj)"
        @click="onDayClick(dateObj)"
      >
        <div class="text-caption text-right" :class="{ 'text-weight-bold': isToday(dateObj.date) }">
          {{ dateObj.day }}
        </div>

        <div v-if="dateObj.shift" class="shift-indicator q-mt-xs text-center">
          <q-badge
            :color="getShiftColor(dateObj.shift)"
            :label="dateObj.shift"
            class="full-width shadow-2 text-center text-weight-bold text-white"
            style="min-height: 40px"
            :class="{ 'dimmed-badge': !dateObj.isCurrentMonth }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { date as qDate } from 'quasar';
import type { ShiftCode } from '../../types/models';
import { useAuthStore } from '../../stores/authStore';

const authStore = useAuthStore();

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  shift?: ShiftCode | undefined;
}

const currentDate = ref(new Date());

const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

const currentMonthLabel = computed(() => {
  return qDate.formatDate(currentDate.value, 'MMMM YYYY', {
    months: [
      'Gennaio',
      'Febbraio',
      'Marzo',
      'Aprile',
      'Maggio',
      'Giugno',
      'Luglio',
      'Agosto',
      'Settembre',
      'Ottobre',
      'Novembre',
      'Dicembre',
    ],
  });
});

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Adjust for Monday start (0=Sun, 1=Mon in JS, we want 0=Mon)
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days: CalendarDay[] = [];

  // Helper to get shift
  const getShift = (d: Date): ShiftCode | undefined => {
    if (!authStore.currentOperator || !authStore.currentOperator.schedule) return undefined;
    const key = qDate.formatDate(d, 'YYYY-MM-DD');
    return authStore.currentOperator.schedule[key];
  };

  // Previous month padding
  for (let i = 0; i < startDay; i++) {
    const d = qDate.subtractFromDate(firstDayOfMonth, { days: startDay - i });
    days.push({
      date: d,
      dateStr: qDate.formatDate(d, 'YYYY-MM-DD'),
      day: d.getDate(),
      isCurrentMonth: false,
      shift: getShift(d),
    });
  }

  // Current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({
      date: d,
      dateStr: qDate.formatDate(d, 'YYYY-MM-DD'),
      day: i,
      isCurrentMonth: true,
      shift: getShift(d),
    });
  }

  // Next month padding
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = qDate.addToDate(lastDayOfMonth, { days: i });
    days.push({
      date: d,
      dateStr: qDate.formatDate(d, 'YYYY-MM-DD'),
      day: d.getDate(),
      isCurrentMonth: false,
      shift: getShift(d),
    });
  }

  return days;
});

function prevMonth() {
  currentDate.value = qDate.subtractFromDate(currentDate.value, { month: 1 });
}

function nextMonth() {
  currentDate.value = qDate.addToDate(currentDate.value, { month: 1 });
}

function isToday(d: Date): boolean {
  const today = new Date();
  return qDate.isSameDate(d, today, 'day');
}

function getCellClass(day: CalendarDay) {
  const classes = [];
  if (!day.isCurrentMonth) {
    classes.push('bg-grey-1 text-grey-6'); // Darken padding days slightly
  } else {
    classes.push('bg-white');
  }

  if (isToday(day.date)) {
    classes.push('today-cell');
  }

  return classes.join(' ');
}

function getShiftColor(code: ShiftCode): string {
  switch (code) {
    case 'M':
      return 'amber-8';
    case 'P':
      return 'orange-8';
    case 'N':
      return 'blue-10';
    case 'R':
      return 'grey-5';
    case 'A':
      return 'red-5';
    case 'S':
      return 'green-6';
    case 'MP':
      return 'purple-6';
    default:
      return 'primary';
  }
}

function onDayClick(day: CalendarDay) {
  // Can trigger details or day view
  console.log('Clicked', day);
}
</script>

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
