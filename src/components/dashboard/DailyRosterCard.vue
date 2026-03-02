<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { date } from 'quasar';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();

const loading = ref(false);

// Initialize selectedDate with today (YYYY-MM-DD format)
const today = new Date();
const selectedDate = ref(date.formatDate(today, 'YYYY-MM-DD'));

// Formatted date for display (e.g., "15 Marzo 2024")
const formattedSelectedDate = computed(() => {
  if (!selectedDate.value) return '';
  return date.formatDate(selectedDate.value, 'DD MMMM YYYY', {
    days: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
    daysShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
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
    monthsShort: [
      'Gen',
      'Feb',
      'Mar',
      'Apr',
      'Mag',
      'Giu',
      'Lug',
      'Ago',
      'Set',
      'Ott',
      'Nov',
      'Dic',
    ],
  });
});

// Calculate shifts for the selected date
const shifts = computed(() => {
  const result = { M: [] as string[], P: [] as string[], N: [] as string[] };

  if (!selectedDate.value || scheduleStore.operators.length === 0) return result;

  // Filter and sort operators alphabetically
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
    // Force refresh store from database
    await scheduleStore.loadOperators(configId, true);
    $q.notify({
      type: 'positive',
      message: 'Presenze aggiornate correttamente',
      icon: 'sync',
    });
  } catch (error) {
    console.error('Error refreshing roster:', error);
    $q.notify({
      type: 'negative',
      message: "Errore durante l'aggiornamento",
      icon: 'error',
    });
  } finally {
    loading.value = false;
  }
}

// Initial load if required
onMounted(() => {
  if (scheduleStore.operators.length === 0) {
    void refreshRoster();
  }
});
</script>

<template>
  <q-card flat bordered class="q-mt-sm">
    <q-card-section class="row items-center justify-between bg-primary text-white q-py-sm">
      <div class="text-subtitle1 text-weight-bold">
        <q-icon name="groups" size="sm" class="q-mr-xs" />
        Chi c'è in turno
      </div>
      <div>
        <q-btn flat dense round icon="event" class="q-mr-sm" title="Scegli data">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-date v-model="selectedDate" mask="YYYY-MM-DD">
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="Chiudi" color="primary" flat />
              </div>
            </q-date>
          </q-popup-proxy>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          title="Aggiorna presenze"
          :loading="loading"
          @click="refreshRoster"
        />
      </div>
    </q-card-section>

    <q-card-section class="q-pa-sm bg-grey-2 text-center text-caption text-weight-bold">
      {{ formattedSelectedDate }}
    </q-card-section>

    <q-card-section class="q-pa-md">
      <div v-if="loading" class="text-center q-pa-lg">
        <q-spinner color="primary" size="2em" />
        <div class="q-mt-sm text-grey">Sincronizzazione turni in corso...</div>
      </div>

      <div v-else class="row q-col-gutter-md">
        <!-- Mattina -->
        <div class="col-12 col-md-4">
          <q-card flat class="bg-amber-1 border-amber">
            <q-card-section class="q-pb-xs">
              <div class="text-subtitle2 text-black">
                <q-badge color="amber-8" class="q-mr-sm">M</q-badge> Mattina
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div v-if="shifts.M.length === 0" class="text-caption text-grey text-italic">
                Nessun operatore
              </div>
              <ul v-else class="q-pl-md q-ma-none text-caption text-black">
                <li v-for="name in shifts.M" :key="name">{{ name }}</li>
              </ul>
            </q-card-section>
          </q-card>
        </div>

        <!-- Pomeriggio -->
        <div class="col-12 col-md-4">
          <q-card flat class="bg-orange-1 border-orange">
            <q-card-section class="q-pb-xs">
              <div class="text-subtitle2 text-black">
                <q-badge color="orange-8" class="q-mr-sm">P</q-badge> Pomeriggio
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div v-if="shifts.P.length === 0" class="text-caption text-grey text-italic">
                Nessun operatore
              </div>
              <ul v-else class="q-pl-md q-ma-none text-caption text-black">
                <li v-for="name in shifts.P" :key="name">{{ name }}</li>
              </ul>
            </q-card-section>
          </q-card>
        </div>

        <!-- Notte -->
        <div class="col-12 col-md-4">
          <q-card flat class="bg-blue-1 border-blue">
            <q-card-section class="q-pb-xs">
              <div class="text-subtitle2 text-black">
                <q-badge color="blue-10" class="q-mr-sm">N</q-badge> Notte
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div v-if="shifts.N.length === 0" class="text-caption text-grey text-italic">
                Nessun operatore
              </div>
              <ul v-else class="q-pl-md q-ma-none text-caption text-black">
                <li v-for="name in shifts.N" :key="name">{{ name }}</li>
              </ul>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.border-amber {
  border: 1px solid #ffca28;
}
.border-orange {
  border: 1px solid #fb8c00;
}
.border-blue {
  border: 1px solid #1565c0;
}
</style>
