<template>
  <div class="column full-height col">
    <!-- Filters Header -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-md-4">
        <q-select
          v-model="selectedOperators"
          :options="operatorOptions"
          label="Filtra Personale"
          dense
          outlined
          multiple
          use-chips
          use-input
          emit-value
          map-options
          option-value="id"
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

      <div class="col-12 col-md-3">
        <q-input v-model="startDate" label="Data Inizio" type="date" dense outlined />
      </div>

      <div class="col-6 col-md-2">
        <q-input
          v-model.number="daysToShow"
          label="Giorni da mostrare"
          type="number"
          dense
          outlined
        />
      </div>

      <div class="col-6 col-md-3">
        <q-select
          v-model="selectedShiftCodes"
          :options="shiftCodeOptions"
          label="Filtra Turni (es. M, P, N)"
          dense
          outlined
          multiple
          use-chips
        />
      </div>

      <div class="col-6 col-md-2 flex flex-center q-gutter-x-sm">
        <q-btn
          icon="cloud_download"
          round
          flat
          dense
          color="secondary"
          @click="syncData"
          :loading="syncing"
        >
          <q-tooltip>Sincronizza da Google Sheets</q-tooltip>
        </q-btn>
        <q-btn icon="refresh" round flat dense color="primary" @click="fetchData">
          <q-tooltip>Ricarica Dati</q-tooltip>
        </q-btn>
        <q-btn icon="info" round flat dense color="info" @click="showLegend = true">
          <q-tooltip>Legenda Turni</q-tooltip>
        </q-btn>
      </div>
    </div>
    <!-- Table -->
    <div class="col relative-position">
      <q-table
        title="Calendario Turni Completo"
        :rows="filteredRows"
        :columns="columns"
        row-key="id"
        :pagination="pagination"
        dense
        separator="cell"
        class="sticky-header-table absolute-full"
        flat
        bordered
        virtual-scroll
        :rows-per-page-options="[0]"
      >
        <!-- Custom Header -->
        <template v-slot:header="props">
          <q-tr :props="props">
            <!-- Operator Name Header -->
            <q-th
              key="operatorName"
              :props="props"
              class="sticky-column"
              style="z-index: 4; background: white"
            >
              Personale
            </q-th>

            <!-- Dynamic Date Headers -->
            <q-th
              v-for="col in dateColumns"
              :key="col.name"
              :props="props"
              class="text-center q-pa-xs"
              :class="{ 'bg-red-1': col.isHoliday, 'bg-grey-1': !col.isHoliday }"
            >
              <div class="column items-center" style="line-height: 1.1">
                <div class="text-bold text-subtitle2">{{ col.dayNum }}</div>
                <div class="text-uppercase text-caption" style="font-size: 0.65rem">
                  {{ col.month }}
                </div>
                <div class="text-lowercase text-caption text-grey-7" style="font-size: 0.65rem">
                  {{ col.weekday }}
                </div>
              </div>
            </q-th>
          </q-tr>
        </template>

        <!-- Custom Body -->
        <template v-slot:body="props">
          <q-tr
            :props="props"
            :class="{
              'bg-amber-1': props.row.id === 'validation-M',
              'bg-deep-orange-1': props.row.id === 'validation-P',
              'bg-blue-1': props.row.id === 'validation-N',
            }"
          >
            <q-td
              key="operatorName"
              :props="props"
              class="sticky-column text-weight-bold"
              :class="{
                'bg-amber-1': props.row.id === 'validation-M',
                'bg-deep-orange-1': props.row.id === 'validation-P',
                'bg-blue-1': props.row.id === 'validation-N',
              }"
            >
              <div
                class="text-weight-bold ellipsis"
                style="max-width: 190px"
                :title="props.row.operatorName"
              >
                {{ props.row.operatorName }}
              </div>
            </q-td>

            <q-td
              v-for="col in dateColumns"
              :key="col.name"
              :props="props"
              class="text-center q-pa-none"
              :class="{
                'bg-red-1': col.isHoliday && !props.row.id.startsWith('validation-'),
                'bg-amber-1': props.row.id === 'validation-M',
                'bg-deep-orange-1': props.row.id === 'validation-P',
                'bg-blue-1': props.row.id === 'validation-N',
              }"
              style="padding: 1px !important"
            >
              <!-- Validation Row Cell -->
              <span
                v-if="props.row.id.startsWith('validation-')"
                :class="{
                  'text-red-8 text-weight-bold': Number(props.row[col.name]) !== 6,
                  'text-amber-9':
                    props.row.id === 'validation-M' && Number(props.row[col.name]) === 6,
                  'text-deep-orange-6':
                    props.row.id === 'validation-P' && Number(props.row[col.name]) === 6,
                  'text-blue-10':
                    props.row.id === 'validation-N' && Number(props.row[col.name]) === 6,
                }"
              >
                {{ props.row[col.name] || 0 }}
              </span>

              <!-- Regular Operator Cell -->
              <template v-else>
                <!-- Highlight badge only if it matches filter or no filter set -->
                <q-badge
                  v-if="props.row[col.name] && isShiftVisible(props.row[col.name])"
                  :color="getShiftColor(props.row[col.name])"
                  class="cursor-pointer shadow-1 full-width flex flex-center"
                  style="height: 24px; font-size: 0.75rem; border-radius: 4px"
                >
                  {{ props.row[col.name] }}
                </q-badge>
                <!-- Empty spacer or grey text if filtered out -->
                <span v-else-if="props.row[col.name]" class="text-grey-3 text-caption"> - </span>
              </template>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>

    <!-- Legend Dialog -->
    <q-dialog v-model="showLegend">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Legenda Turni</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="column q-gutter-sm">
            <div class="row items-center">
              <q-badge color="amber-9" class="text-black" style="width: 40px">M</q-badge>
              <span class="q-ml-md"
                >Mattina (tutti i codici che iniziano con M: M, MRDN, etc.)</span
              >
            </div>
            <div class="row items-center">
              <q-badge color="deep-orange-6" class="text-white" style="width: 40px">P</q-badge>
              <span class="q-ml-md">Pomeriggio (tutti i codici che iniziano con P)</span>
            </div>
            <div class="row items-center">
              <q-badge color="blue-10" class="text-white" style="width: 40px">N</q-badge>
              <span class="q-ml-md">Notte (tutti i codici che iniziano con N)</span>
            </div>
            <div class="row items-center">
              <q-badge color="green-6" class="text-white" style="width: 40px">S</q-badge>
              <span class="q-ml-md">Smonto (tutti i codici che iniziano con S: SDRN, etc.)</span>
            </div>
            <div class="row items-center">
              <q-badge color="grey-4" class="text-black" style="width: 40px">R</q-badge>
              <span class="q-ml-md"
                >Riposo (tutti i codici che iniziano con R: R, RRDG, RDM, etc.)</span
              >
            </div>
            <div class="row items-center">
              <q-badge color="yellow-7" class="text-black" style="width: 40px">A</q-badge>
              <span class="q-ml-md">Assenza/Ferie (tutti i codici che iniziano con A)</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Chiudi" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import type { ShiftCode, Operator } from '../../types/models';
import { date as qDate, useQuasar, type QTableColumn } from 'quasar';
import { GoogleSheetsService } from '../../services/GoogleSheetsService';
import { SyncService } from '../../services/SyncService';
import { smartEnv } from '../../config/smartEnvironment';
import { useSecureLogger } from '../../utils/secureLogger';

interface TableRow {
  id: string;
  operatorName: string;
  schedule: Record<string, string>; // Keep raw schedule for filtering
  [key: string]: string | number | Record<string, string>; // Index signature
}

interface DateColumn {
  name: string;
  label: string;
  field: string;
  align: string;
  dayNum: string;
  month: string;
  weekday: string;
  isHoliday: boolean;
}

const $q = useQuasar();
const rawOperators = ref<Operator[]>([]);
const operatorOptions = ref<Operator[]>([]);
const selectedOperators = ref<string[]>([]); // Array of IDs

const startDate = ref(qDate.formatDate(new Date(), 'YYYY-MM-DD'));
const daysToShow = ref(30);

const selectedShiftCodes = ref<string[]>([]);
const shiftCodeOptions = ['M', 'P', 'N', 'R', 'A', 'S'];

const pagination = ref({ rowsPerPage: 0 }); // Show all rows for virtual scroll
const showLegend = ref(false);

// Generate Date Columns dynamically based on startDate and daysToShow
const dateColumns = computed<DateColumn[]>(() => {
  const cols: DateColumn[] = [];
  const start = new Date(startDate.value);

  for (let i = 0; i < daysToShow.value; i++) {
    const d = qDate.addToDate(start, { days: i });
    const dateKey = qDate.formatDate(d, 'YYYY-MM-DD');
    const dayNum = qDate.formatDate(d, 'DD');
    const month = d.toLocaleDateString('it-IT', { month: 'short' });
    const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' });

    // Check for holidays (Sundays + fixed dates)
    const isSunday = d.getDay() === 0;
    const dayMonth = qDate.formatDate(d, 'DD-MM');
    // Fixed Italian Holidays
    const fixedHolidays = [
      '01-01',
      '06-01',
      '25-04',
      '01-05',
      '02-06',
      '15-08',
      '01-11',
      '08-12',
      '25-12',
      '26-12',
    ];
    const isFixedHoliday = fixedHolidays.includes(dayMonth);
    const isHoliday = isSunday || isFixedHoliday;

    cols.push({
      name: dateKey,
      label: dateKey, // visual label handled in template
      field: dateKey,
      align: 'center',
      dayNum,
      month,
      weekday,
      isHoliday,
    });
  }
  return cols;
});

const columns = computed<QTableColumn[]>(() => [
  {
    name: 'operatorName',
    label: 'Personale',
    field: 'operatorName',
    align: 'left' as const,
    sortable: false, // Keep original order
    style:
      'min-width: 200px; max-width: 200px; width: 200px; position: sticky; left: 0; z-index: 3; background: white; border-right: 1px solid #ddd;',
    headerStyle:
      'min-width: 200px; max-width: 200px; width: 200px; position: sticky; left: 0; z-index: 4; background: white; border-right: 1px solid #ddd;',
  },
  ...dateColumns.value.map((c) => ({
    name: c.name,
    label: '',
    field: c.field,
    align: 'center' as const,
    style: 'padding: 1px; min-width: 32px; width: 32px;',
    headerStyle: 'padding: 1px; min-width: 32px; width: 32px;',
  })),
]);

const logger = useSecureLogger();

onMounted(async () => {
  await fetchData();
});

async function fetchData() {
  try {
    // Try to load from localStorage first
    const cached = localStorage.getItem('nurseHub_operators');
    const cacheTimestamp = localStorage.getItem('nurseHub_operators_timestamp');
    const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;

    // Use cache if less than 5 minutes old
    if (cached && cacheAge < 5 * 60 * 1000) {
      const loadedOps = JSON.parse(cached) as Operator[];
      rawOperators.value = loadedOps;
      operatorOptions.value = loadedOps;
      logger.info('Loaded operators from cache');
      return;
    }

    const querySnapshot = await getDocs(collection(db, 'operators'));
    const loadedOps: Operator[] = [];
    querySnapshot.forEach((doc) => {
      const op = doc.data() as Operator;
      // Filter out validation rows from Google Sheets
      if (op.name !== 'Mattina' && op.name !== 'Pomeriggio' && op.name !== 'Notte') {
        loadedOps.push(op);
      }
    });

    // Sort by ID number to preserve Google Sheets order
    // IDs are in format "op-N" where N is the row index
    loadedOps.sort((a, b) => {
      const numA = parseInt(a.id.replace('op-', '')) || 0;
      const numB = parseInt(b.id.replace('op-', '')) || 0;
      return numA - numB;
    });

    if (loadedOps.length > 0) {
      const sample = loadedOps[0];
      if (sample && sample.schedule) {
        const scheduleKeys = Object.keys(sample.schedule);
        const tableKeys = dateColumns.value.map((c) => c.name);

        const overlap = tableKeys.filter((k) => scheduleKeys.includes(k));
        const overlapSample = overlap.slice(0, 5).map((k) => `${k}=${sample.schedule[k]}`);

        logger.info(`DATA OVERLAP CHECK:
Table Range: ${tableKeys[0]} to ${tableKeys[tableKeys.length - 1]}
Total Schedule Entries: ${scheduleKeys.length}
Matching Dates found: ${overlap.length}
Sample Matches: ${overlapSample.join(', ')}`);
      }
    }

    // Save to localStorage
    localStorage.setItem('nurseHub_operators', JSON.stringify(loadedOps));
    localStorage.setItem('nurseHub_operators_timestamp', Date.now().toString());

    rawOperators.value = loadedOps;
    operatorOptions.value = loadedOps;
  } catch (e) {
    logger.error('Error loading table data', e);
  }
}

const syncing = ref(false);

async function syncData() {
  syncing.value = true;
  try {
    const config = smartEnv.getFirebaseConfig();
    const appConfig = {
      ...config,
      spreadsheetUrl:
        'https://docs.google.com/spreadsheets/d/1Ib8oq0wEknerDQX8Dc7o2aZ0rQQfOkMzWbaoOTfHwxA/edit?gid=280184106',
      dateRowIndex: 2,
      nameColumnIndex: 2,
      dataStartRowIndex: 4,
      dataStartColIndex: 4,
      contactsUrl: '',
      contactsStartRow: 2,
      contactNameCol: 2,
      contactEmailCol: 3,
      contactPhoneCol: 4,
      gasWebUrl: '',
    };

    logger.info('Starting sync with config');
    const sheetsService = new GoogleSheetsService(appConfig);
    const syncService = new SyncService(sheetsService);

    await syncService.syncOperatorsFromSheets();

    // Clear cache after sync
    localStorage.removeItem('nurseHub_operators');
    localStorage.removeItem('nurseHub_operators_timestamp');

    $q.notify({ type: 'positive', message: 'Sincronizzazione completata!' });
    await fetchData(); // Refresh table
  } catch (e) {
    logger.error('Sync error', e);
    $q.notify({ type: 'negative', message: 'Errore durante la sincronizzazione' });
  } finally {
    syncing.value = false;
  }
}

function filterOperators(val: string, update: (fn: () => void) => void) {
  if (val === '') {
    update(() => {
      operatorOptions.value = rawOperators.value;
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    operatorOptions.value = rawOperators.value.filter(
      (v) => v.name.toLowerCase().indexOf(needle) > -1,
    );
  });
}

// Compute shift counts per day per type
const shiftCounts = computed(() => {
  const counts: Record<string, { M: number; P: number; N: number }> = {};

  dateColumns.value.forEach((col) => {
    counts[col.name] = { M: 0, P: 0, N: 0 };
  });

  rawOperators.value.forEach((op) => {
    const schedule = op.schedule || {};
    Object.entries(schedule).forEach(([date, code]) => {
      const dateCount = counts[date];
      if (dateCount) {
        const c = code.toUpperCase();
        if (c.startsWith('M')) dateCount.M++;
        else if (c.startsWith('P')) dateCount.P++;
        else if (c.startsWith('N')) dateCount.N++;
      }
    });
  });

  return counts;
});

const filteredRows = computed(() => {
  let ops = rawOperators.value; // Start with all operators

  // Filter by Selected Personnel ONLY if selection is not empty
  if (selectedOperators.value && selectedOperators.value.length > 0) {
    ops = ops.filter((op) => selectedOperators.value.includes(op.id));
  }

  const operatorRows = ops.map((op) => {
    // 1 base row
    const row: TableRow = {
      id: op.id,
      operatorName: op.name,
      schedule: op.schedule || {},
    };

    // 2. Map schedule to row properties
    const schedule = op.schedule || {};

    // We iterate over the columns we just generated
    dateColumns.value.forEach((col) => {
      // col.name IS "YYYY-MM-DD"
      const val = schedule[col.name];
      if (val) {
        row[col.name] = val;
      }
    });

    return row;
  });

  // Create validation summary rows
  const validationRows: TableRow[] = [
    {
      id: 'validation-M',
      operatorName: 'Mattina',
      schedule: {},
    },
    {
      id: 'validation-P',
      operatorName: 'Pomeriggio',
      schedule: {},
    },
    {
      id: 'validation-N',
      operatorName: 'Notte',
      schedule: {},
    },
  ];

  // Add counts to validation rows
  dateColumns.value.forEach((col) => {
    validationRows[0]![col.name] = String(shiftCounts.value[col.name]?.M || 0);
    validationRows[1]![col.name] = String(shiftCounts.value[col.name]?.P || 0);
    validationRows[2]![col.name] = String(shiftCounts.value[col.name]?.N || 0);
  });

  // Return validation rows first, then operator rows
  return [...validationRows, ...operatorRows];
});

function isShiftVisible(code: string): boolean {
  if (selectedShiftCodes.value.length === 0) return true;
  return selectedShiftCodes.value.includes(code);
}

function getShiftColor(code: ShiftCode): string {
  if (!code) return 'grey-2';
  const c = code.toUpperCase();

  if (c.startsWith('M')) return 'amber-9 text-black'; // Darker amber for Mattina
  if (c.startsWith('P')) return 'deep-orange-6 text-white'; // Deep orange for Pomeriggio
  if (c.startsWith('N')) return 'blue-10 text-white';
  if (c.startsWith('S')) return 'green-6 text-white'; // Smonto
  if (c.startsWith('R')) return 'grey-4 text-black'; // Riposo
  if (c.startsWith('A')) return 'yellow-7 text-black'; // Assenza/Ferie

  // Default fallback
  return 'primary text-white';
}
</script>

<style scoped>
.sticky-header-table {
  /* Using absolute positioning for full height within container */
  height: 100%;
}

.sticky-column {
  position: sticky;
  left: 0;
  z-index: 1;
  background: white;
  border-right: 1px solid #ddd;
}
</style>
