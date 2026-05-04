/**
* @file DailyRosterCard.vue
* @description Dashboard component displaying the list of operators scheduled for the current day with premium design.
* @author Nurse Hub Team
* @created 2026-03-08
* @modified 2026-05-03
* @notes
* - Standardized using AppDateInput and centralized date utilities.
* - Enhanced aesthetics with large shift letters and consistent premium styling.
*/
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useSecureLogger } from '../../utils/secureLogger';
import { useScheduleStore } from '../../stores/scheduleStore';
import { date, useQuasar } from 'quasar';
import { formatToItalianLong, formatToDb } from '../../utils/dateUtils';
import AppDateInput from '../common/AppDateInput.vue';

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();
const expanded = ref(false);

const loading = ref(false);

// Initialize selectedDate with today (YYYY-MM-DD format)
const today = new Date();
const selectedDate = ref(formatToDb(today));

// Formatted date for display using centralized utility
const formattedSelectedDate = computed(() => formatToItalianLong(selectedDate.value));

// Calculate shifts for the selected date
const shifts = computed(() => {
  const result = { M: [] as string[], P: [] as string[], N: [] as string[] };
  if (!selectedDate.value || scheduleStore.operators.length === 0) return result;

  const sortedOps = [...scheduleStore.operators].sort((a, b) => a.name.localeCompare(b.name));
  sortedOps.forEach((op) => {
    const shiftCode = op.schedule?.[selectedDate.value];
    if (shiftCode) {
      if (shiftCode.startsWith('M')) result.M.push(op.name);
      else if (shiftCode.startsWith('P')) result.P.push(op.name);
      else if (shiftCode.startsWith('N')) result.N.push(op.name);
    }
  });
  return result;
});

async function refreshRoster() {
  const configId = configStore.activeConfigId || authStore.currentUser?.configId;
  if (!configId) return;
  loading.value = true;
  try {
    await scheduleStore.loadOperators(configId, true);
    $q.notify({ type: 'positive', message: 'Presenze aggiornate', icon: 'sync' });
  } catch (error) {
    logger.error('Error refreshing roster', error);
  } finally {
    loading.value = false;
  }
}

function changeDate(days: number) {
  const current = new Date(selectedDate.value);
  const newDate = date.addToDate(current, { days });
  selectedDate.value = formatToDb(newDate);
}

onMounted(() => {
  if (scheduleStore.operators.length === 0) void refreshRoster();
});

const shiftStyles = {
  M: { color: '#f59e0b', icon: 'light_mode', bg: 'rgba(245, 158, 11, 0.1)' },
  P: { color: '#ea580c', icon: 'wb_twilight', bg: 'rgba(234, 88, 12, 0.1)' },
  N: { color: '#1e3a8a', icon: 'dark_mode', bg: 'rgba(30, 58, 138, 0.1)' }
};
</script>

<template>
  <q-expansion-item v-model="expanded" label="Chi c'è in turno" icon="groups"
    header-class="bg-blue-1 text-primary text-weight-bold" class="rounded-borders overflow-hidden shadow-1">
    <q-card flat class="q-mt-xs">
      <!-- Date Navigation -->
      <q-card-section class="q-pa-sm bg-grey-1 row items-center justify-between border-bottom">
        <q-btn flat dense round icon="chevron_left" color="primary" @click="changeDate(-1)" />

        <div class="row items-center q-gutter-x-sm">
          <div class="text-subtitle2 text-weight-bold">{{ formattedSelectedDate }}</div>
          <div style="width: 30px">
            <AppDateInput v-model="selectedDate" dense flat borderless hide-lab />
          </div>
        </div>

        <q-btn flat dense round icon="chevron_right" color="primary" @click="changeDate(1)" />
      </q-card-section>

      <q-card-section class="q-pa-md">
        <div v-if="loading" class="q-gutter-y-sm">
          <q-skeleton v-for="n in 3" :key="n" type="rect" height="60px" class="rounded-borders" />
        </div>

        <div v-else class="row q-col-gutter-md">
          <!-- Mattina, Pomeriggio, Notte Cards -->
          <div v-for="(list, key) in shifts" :key="key" class="col-12 col-md-4">
            <q-card flat bordered class="roster-shift-card" :style="{ '--accent-color': shiftStyles[key].color }">
              <q-card-section class="q-pa-sm row no-wrap items-center bg-grey-1 border-bottom">
                <div class="shift-display-mini column items-center q-mr-md">
                  <div class="shift-letter-mini text-weight-bold" :style="{ color: shiftStyles[key].color }">
                    {{ key }}
                  </div>
                  <q-icon :name="shiftStyles[key].icon" :style="{ color: shiftStyles[key].color }" size="10px" />
                </div>
                <div class="column">
                  <span class="text-weight-bolder text-grey-9">{{ key === 'M' ? 'Mattina' : (key === 'P' ? 'Pomeriggio'
                    : 'Notte') }}</span>
                  <span class="text-caption text-grey-6">{{ list.length }} operatori</span>
                </div>
              </q-card-section>

              <q-card-section class="q-pa-sm roster-list">
                <div v-if="list.length === 0" class="text-caption text-grey-5 text-italic text-center q-py-sm">
                  Nessun operatore
                </div>
                <div v-else class="column q-gutter-y-xs">
                  <div v-for="name in list" :key="name" class="row items-center q-gutter-x-sm">
                    <q-icon name="person" size="10px" color="grey-4" />
                    <span class="text-caption text-grey-9">{{ name }}</span>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pb-md q-pr-md">
        <q-btn flat dense color="primary" icon="refresh" label="Aggiorna" :loading="loading" @click="refreshRoster"
          size="sm" />
      </q-card-actions>
    </q-card>
  </q-expansion-item>
</template>

<style scoped>
.border-bottom {
  border-bottom: 1px solid #f1f5f9;
}

.roster-shift-card {
  border-radius: 12px;
  height: 100%;
  border-top: 3px solid var(--accent-color);
  transition: transform 0.2s ease;
}

.roster-shift-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
}

.shift-letter-mini {
  font-size: 1.4rem;
  line-height: 1;
}

.roster-list {
  max-height: 150px;
  overflow-y: auto;
}

/* Custom Scrollbar for list */
.roster-list::-webkit-scrollbar {
  width: 4px;
}

.roster-list::-webkit-scrollbar-track {
  background: transparent;
}

.roster-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
