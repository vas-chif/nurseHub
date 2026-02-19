<template>
  <q-card flat bordered class="shift-calendar-card">
    <q-card-section class="row items-center justify-between">
      <div class="text-h6">I Tuoi Turni</div>
      <div style="min-width: 200px" v-if="authStore.isAdmin && hasSearchModule">
        <q-select
          v-model="selectedOperator"
          :options="operatorOptions"
          label="Seleziona Personale"
          dense
          outlined
          options-dense
          bg-color="white"
          multiple
          use-chips
          use-input
          option-label="name"
          @filter="filterOperators"
        >
          <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
            <q-item v-bind="itemProps">
              <q-item-section>
                <q-item-label>{{ opt.name }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
    </q-card-section>

    <!-- Loop through selected operators -->
    <div v-for="calendar in calendars" :key="calendar.operatorId">
      <q-separator />
      <q-card-section>
        <div class="text-subtitle2 q-mb-xs">Turni di: {{ calendar.operatorName }}</div>
        <q-scroll-area horizontal style="height: 110px; white-space: nowrap">
          <div class="row no-wrap q-gutter-md">
            <div
              v-for="(day, index) in calendar.days"
              :key="index"
              class="shift-day-column column flex-center q-pa-sm rounded-borders"
              :class="getShiftClass(day.shift)"
            >
              <div class="text-caption text-weight-bold">{{ day.dateFormatted }}</div>
              <div class="text-caption">{{ day.dayName }}</div>
              <q-badge :color="getShiftColor(day.shift)" class="q-mt-xs text-uppercase shadow-1">
                {{ day.shift }}
              </q-badge>
            </div>
          </div>
        </q-scroll-area>
      </q-card-section>
    </div>

    <q-card-section v-if="calendars.length === 0" class="text-center text-grey q-py-lg">
      Nessun operatore selezionato
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, watchEffect } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useSecureLogger } from '../../utils/secureLogger';
import type { Operator, ShiftCode } from '../../types/models';

const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const logger = useSecureLogger();

interface DayShift {
  date: string;
  dateFormatted: string;
  dayName: string;
  shift: ShiftCode;
}

interface OperatorCalendar {
  operatorId: string;
  operatorName: string;
  days: DayShift[];
}

const operatorOptions = ref<Operator[]>([]);
const filteredOptions = ref<Operator[]>([]);
const selectedOperator = ref<Operator[]>([]);
const hasSearchModule = ref(true);

// Fetch Operators
async function loadData(force = false) {
  // Use configStore.activeConfigId OR fallback to user's configId
  const configId = configStore.activeConfigId || authStore.currentUser?.configId;

  if (!configId) {
    logger.warn('No active config or user configId - cannot load operators for calendar');
    return;
  }

  try {
    const loadedOps = await scheduleStore.loadOperators(configId, force);
    // Sort by name
    const sortedOps = [...loadedOps].sort((a, b) => a.name.localeCompare(b.name));

    operatorOptions.value = sortedOps;
    filteredOptions.value = sortedOps;
  } catch (e) {
    console.error('Error loading operators for calendar', e);
  }
}

onMounted(async () => {
  await loadData();
});

// Re-load when config becomes ready
watch(
  () => [configStore.activeConfigId, authStore.currentUser?.configId],
  async ([newId, userConfigId]) => {
    if (newId || userConfigId) {
      await loadData();
    }
  },
  { deep: true },
);

// If cache is cleared externally (e.g. by SyncService), re-fetch
watch(
  () => scheduleStore.operators.length,
  (newLen) => {
    if (newLen === 0 && (configStore.activeConfigId || authStore.currentUser?.configId)) {
      logger.info('Schedule cache cleared, re-fetching data force-refresh...');
      void loadData(true);
    }
  },
);

// Unified auto-selection & data-refresh logic
watchEffect(() => {
  const options = operatorOptions.value;
  if (options.length === 0) return;

  const currentOp = authStore.currentOperator;
  const userOpId = authStore.currentUser?.operatorId;

  // Case 1: Initial auto-selection (Skip if admin)
  if (selectedOperator.value.length === 0 && !authStore.isAdmin) {
    const targetId = currentOp?.id || userOpId;
    if (targetId) {
      const match = options.find((o) => o.id === targetId);
      if (match) {
        logger.info('Auto-selected operator in calendar', { name: match.name });
        selectedOperator.value = [match];
      }
    }
  } else if (selectedOperator.value.length > 0) {
    // Case 2: Data refresh (Sync happened)
    const freshSelection = selectedOperator.value.map((sel) => {
      const match = options.find((o) => o.id === sel.id);
      return match || sel;
    });

    const needsUpdate = freshSelection.some((item, idx) => item !== selectedOperator.value[idx]);
    if (needsUpdate) {
      logger.info('Refreshing selected operator references after data update');
      selectedOperator.value = freshSelection;
    }
  }
});

function filterOperators(val: string, update: (fn: () => void) => void) {
  if (val === '') {
    update(() => {
      operatorOptions.value = filteredOptions.value;
    });
    return;
  }

  update(() => {
    const needle = val.toLowerCase();
    operatorOptions.value = filteredOptions.value.filter(
      (v) => v.name.toLowerCase().indexOf(needle) > -1,
    );
  });
}

// Compute Calendars based on Selected Operators
const calendars = computed<OperatorCalendar[]>(() => {
  return selectedOperator.value.map((op) => {
    const today = new Date();
    const days: DayShift[] = [];
    const schedule = op.schedule || {};

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      const code = schedule[dateKey as string];
      const shiftCode = (code as ShiftCode) || '';

      days.push(createDayObj(d, shiftCode));
    }

    return {
      operatorId: op.id,
      operatorName: op.name,
      days,
    };
  });
});

function createDayObj(d: Date, shift: string): DayShift {
  return {
    date: d.toISOString().split('T')[0] || '',
    dateFormatted: `${d.getDate()}/${d.getMonth() + 1}`,
    dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }),
    shift: shift as ShiftCode,
  };
}

function getShiftColor(code: ShiftCode): string {
  switch (code) {
    case 'M':
      return 'amber-8 text-black';
    case 'P':
      return 'orange-8 text-black';
    case 'N':
      return 'blue-10';
    case 'R':
      return 'grey-4 text-black';
    case 'A':
      return 'red-5';
    case 'S':
      return 'green-6';
    case '':
      return 'grey-2 text-grey-6';
    default:
      return 'primary';
  }
}

function getShiftClass(code: ShiftCode): string {
  return code === 'R' ? 'bg-grey-2' : 'bg-grey-1';
}
</script>

<style scoped>
.shift-day-column {
  width: 60px;
  border: 1px solid #e0e0e0;
}
</style>
