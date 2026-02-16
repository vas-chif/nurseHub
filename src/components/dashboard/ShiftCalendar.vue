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
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { operatorsService } from '../../services/OperatorsService';
import type { Operator, ShiftCode } from '../../types/models';
import { useSecureLogger } from '../../utils/secureLogger';

const authStore = useAuthStore();
const configStore = useConfigStore();
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
const selectedOperator = ref<Operator[]>([]); // Multi-select, now correctly Operator[]
const hasSearchModule = ref(true);

// Fetch Operators on Mount
onMounted(async () => {
  if (!configStore.activeConfigId) {
    logger.warn('No active config - cannot load operators for calendar');
    return;
  }

  try {
    const loadedOps = await operatorsService.getOperatorsByConfig(configStore.activeConfigId);
    // Sort by name
    loadedOps.sort((a, b) => a.name.localeCompare(b.name));

    operatorOptions.value = loadedOps;
    filteredOptions.value = loadedOps;

    // Default Selection Logic
    if (authStore.currentOperator) {
      // If logged in user is an operator, select them
      const found = loadedOps.find((op) => op.id === authStore.currentOperator?.id);
      if (found) {
        selectedOperator.value = [found];
      }
    }
  } catch (e) {
    console.error('Error loading operators for calendar', e);
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
    // op is now the Operator object directly
    const today = new Date();
    const days: DayShift[] = [];
    const schedule = op.schedule || {};

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // Format YYYY-MM-DD
      const dateKey = d.toISOString().split('T')[0];
      // Fix index access safely
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
      return 'grey-2 text-grey-6'; // Empty shift
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
