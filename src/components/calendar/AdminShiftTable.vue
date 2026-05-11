/**
 * @file AdminShiftTable.vue
 * @description Advanced administrative table for managing operator shifts with virtual scrolling.
 * @author Nurse Hub Team
 * @created 2026-03-15
 * @modified 2026-04-27
 * @notes
 * - Uses Quasar QTable with virtual-scroll for high performance.
 * - Dynamic columns based on date range.
 * - Integrated with scheduleStore and global sync logic.
 */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { date as quasarDate, type QTableColumn, useQuasar } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import { itLocale } from '../../constants/locales';
import GlobalSyncBtn from '../common/GlobalSyncBtn.vue';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import type { Operator, ShiftCode, AppConfig } from '../../types/models';
import { useSyncStore } from '../../stores/syncStore';

interface TableRow {
  id: string;
  operatorName: string;
  schedule: Record<string, string>; // Keep raw schedule for filtering
  notes: Record<string, string>; // Shift notes (§1.12)
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

const scheduleStore = useScheduleStore();
const operatorOptions = ref<Operator[]>([]);
const selectedOperators = ref<string[]>([]); // Array of IDs

const startDate = ref(quasarDate.formatDate(new Date(), 'YYYY-MM-DD'));
const daysToShow = ref(30);

const selectedShiftCodes = ref<string[]>([]);
const shiftCodeOptions = ['M', 'P', 'N', 'R', 'A', 'S'];

const pagination = ref({ rowsPerPage: 0 }); // Show all rows for virtual scroll
const showLegend = ref(false);
const showOnlyWithNotes = ref(false);

const $q = useQuasar();
const authStore = useAuthStore();
const syncStore = useSyncStore();
const pendingChanges = ref<Record<string, Record<string, string>>>({}); // operatorId -> { date -> newShift }
const savingChanges = ref(false);

const hasPendingChanges = computed(() => Object.keys(pendingChanges.value).length > 0);


function formatDate(dt: string) {
  if (!dt) return '';
  return quasarDate.formatDate(dt, 'DD/MM/YYYY');
}

// Generate Date Columns dynamically based on startDate and daysToShow
const dateColumns = computed<DateColumn[]>(() => {
  const cols: DateColumn[] = [];
  const start = new Date(startDate.value);

  for (let i = 0; i < daysToShow.value; i++) {
    const d = quasarDate.addToDate(start, { days: i });
    const dateKey = quasarDate.formatDate(d, 'YYYY-MM-DD');
    const dayNum = quasarDate.formatDate(d, 'DD');
    const month = d.toLocaleDateString('it-IT', { month: 'short' });
    const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' });

    // Check for holidays (Sundays + fixed dates)
    const isSunday = d.getDay() === 0;
    const dayMonth = quasarDate.formatDate(d, 'DD-MM');
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
const configStore = useConfigStore();

onMounted(async () => {
  if (configStore.activeConfigId) {
    await fetchData();
  }
});

watch(
  () => configStore.activeConfigId,
  async (newId: string | null) => {
    if (newId) {
      await fetchData();
    }
  },
);

watch(
  () => scheduleStore.lastUpdated,
  () => {
    // When the store is updated (e.g. via global sync), update our local state
    void fetchData(false);
  }
);

async function fetchData(forceRefresh = false) {
  if (!configStore.activeConfigId) {
    logger.warn('No active config - cannot load operators');
    return;
  }

  try {
    // Use the Pinia store for loading/caching
    await scheduleStore.loadOperators(configStore.activeConfigId, forceRefresh);

    // Filter out validation rows (if any survived in raw storage)
    const filteredOps = scheduleStore.operators.filter(
      (op) => op.name !== 'Mattina' && op.name !== 'Pomeriggio' && op.name !== 'Notte',
    );

    // Sort by ID number to preserve Google Sheets order
    filteredOps.sort((a, b) => {
      const orderA = a.sheetOrder ?? 999;
      const orderB = b.sheetOrder ?? 999;
      return orderA - orderB;
    });

    operatorOptions.value = filteredOps;
  } catch (e) {
    logger.error('Error loading table data', e);
  }
}


function filterOperators(val: string, update: (fn: () => void) => void) {
  if (val === '') {
    update(() => {
      operatorOptions.value = scheduleStore.operators.filter(
        (op) => op.name !== 'Mattina' && op.name !== 'Pomeriggio' && op.name !== 'Notte',
      );
    });
    return;
  }
  update(() => {
    const needle = val.toLowerCase();
    operatorOptions.value = scheduleStore.operators.filter(
      (v) =>
        v.name.toLowerCase().indexOf(needle) > -1 &&
        v.name !== 'Mattina' &&
        v.name !== 'Pomeriggio' &&
        v.name !== 'Notte',
    );
  });
}

// Compute shift counts per day per type
const shiftCounts = computed(() => {
  const counts: Record<string, { M: number; P: number; N: number }> = {};

  dateColumns.value.forEach((col) => {
    counts[col.name] = { M: 0, P: 0, N: 0 };
  });

  scheduleStore.operators.forEach((op) => {
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
  let ops = operatorOptions.value; // Use filtered options (names + search)

  // Filter by Selected Personnel ONLY if selection is not empty
  if (selectedOperators.value && selectedOperators.value.length > 0) {
    ops = ops.filter((op) => selectedOperators.value.includes(op.id));
  }

  let operatorRows = ops.map((op) => {
    // 1 base row
    const row: TableRow = {
      id: op.id,
      operatorName: op.name,
      schedule: op.schedule || {},
      notes: op.notes || {},
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

  // 3. Filter by Selected Shift Codes (Hide rows with NO matches in the visible range)
  if (selectedShiftCodes.value.length > 0) {
    operatorRows = operatorRows.filter((row) => {
      // Check if ANY of the visible date columns in this row has a shift that matches the filter
      return dateColumns.value.some((col) => {
        const shiftCode = row[col.name] as string;
        if (!shiftCode) return false;
        // We check if the shift starts with any of the selected filter prefixes
        return selectedShiftCodes.value.some((f) => shiftCode.toUpperCase().startsWith(f));
      });
    });
  }

  // 4. Filter by Rows with Notes (§3.1)
  if (showOnlyWithNotes.value) {
    operatorRows = operatorRows.filter((row) => {
      return Object.values(row.notes).some(note => note && note.trim().length > 0);
    });
  }

  return operatorRows;
});

function isShiftVisible(code: string, operatorId: string, date: string): boolean {
  if (selectedShiftCodes.value.length > 0 && !selectedShiftCodes.value.includes(code)) return false;
  
  // New Note-specific filter logic (§3.1)
  if (showOnlyWithNotes.value) {
    const op = operatorOptions.value.find(o => o.id === operatorId);
    if (!op || !op.notes || !op.notes[date]) return false;
  }
  
  return true;
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

function handleShiftEdit(operatorId: string, date: string, newShift: string) {
  if (!pendingChanges.value[operatorId]) {
    pendingChanges.value[operatorId] = {};
  }
  pendingChanges.value[operatorId][date] = newShift;
}

function isPending(operatorId: string, date: string) {
  return pendingChanges.value[operatorId]?.[date] !== undefined;
}

function getDisplayShift(row: TableRow, date: string) {
  return pendingChanges.value[row.id]?.[date] || (row[date] as string) || '';
}

async function savePendingChanges() {
  if (!hasPendingChanges.value || !configStore.activeConfigId) return;

  savingChanges.value = true;
  try {
    const { GoogleSheetsService } = await import('../../services/GoogleSheetsService');
    const sheetsService = new GoogleSheetsService(configStore.activeConfig as AppConfig);
    
    const adminName = `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim() || 'Admin';
    let totalSaved = 0;

    for (const [opId, dates] of Object.entries(pendingChanges.value)) {
      const op = operatorOptions.value.find(o => o.id === opId);
      if (!op) continue;

      for (const [date, newShift] of Object.entries(dates)) {
        const oldShift = op.schedule[date] || '-';
        const note = `🛠️ Modifica Manuale (Admin: ${adminName}) | 🔄 Da: ${oldShift} ➔ A: ${newShift}`;
        // Manual edits are BLUE in GAS
        await sheetsService.updateShiftOnSheets(op.name, date, newShift, note, 'blue');
        totalSaved++;
      }
    }

    $q.notify({
      type: 'positive',
      message: `${totalSaved} modifiche salvate correttamente su Excel!`,
      icon: 'cloud_done'
    });

    pendingChanges.value = {};
    await fetchData(true);
    void syncStore.recordSync(configStore.activeConfigId);
  } catch (e) {
    logger.error('Error saving pending changes', e);
    $q.notify({ type: 'negative', message: 'Errore durante il salvataggio su Excel' });
  } finally {
    savingChanges.value = false;
  }
}
</script>


<template>
  <div class="column full-height col">
    <!-- Filters Header -->
    <div class="row q-col-gutter-sm q-mb-md items-center">
      <div class="col-12 col-md-3">
        <q-select v-model="selectedOperators" :options="operatorOptions" label="Filtra Personale" dense outlined
          multiple use-chips use-input emit-value map-options option-value="id" option-label="name"
          @filter="filterOperators">
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

      <div class="col-12 col-md-2">
        <q-input :model-value="formatDate(startDate)" label="Data Inizio" outlined dense readonly
          class="cursor-pointer">
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="startDate" mask="YYYY-MM-DD" :locale="itLocale">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Chiudi" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-6 col-md-2">
        <q-input v-model.number="daysToShow" label="Giorni" type="number" dense outlined />
      </div>

      <div class="col-6 col-md-2">
        <q-select v-model="selectedShiftCodes" :options="shiftCodeOptions" label="Filtra Turni" dense outlined multiple
          use-chips />
      </div>

      <div class="col-12 col-md-3 row no-wrap items-center justify-end q-gutter-x-sm">
        <q-btn
          :flat="!showOnlyWithNotes"
          :color="showOnlyWithNotes ? 'amber-9' : 'grey-7'"
          icon="sticky_note_2"
          @click="showOnlyWithNotes = !showOnlyWithNotes"
          dense
        >
          <q-tooltip>Mostra solo righe con note</q-tooltip>
        </q-btn>
        <GlobalSyncBtn size="md" />
        <q-btn icon="refresh" label="Aggiorna" outline dense color="primary" @click="() => fetchData(true)" no-caps>
          <q-tooltip>Ricarica Dati Locale</q-tooltip>
        </q-btn>
        <q-btn icon="info" round flat dense color="info" @click="showLegend = true">
          <q-tooltip>Legenda Turni</q-tooltip>
        </q-btn>
      </div>
    </div>
    <!-- Table -->
    <div class="col relative-position">
      <q-table title="Calendario Turni Completo" :rows="filteredRows" :columns="columns" row-key="id"
        :pagination="pagination" dense separator="cell" class="sticky-header-table absolute-full" flat bordered
        virtual-scroll :rows-per-page-options="[0]" :loading="scheduleStore.loading">
        <!-- Loading Skeleton Slot -->
        <template v-slot:loading>
          <div class="absolute-full bg-white q-pa-none" style="z-index: 10">
            <div v-for="r in 10" :key="r" class="row no-wrap q-mb-xs">
              <div class="col-2 q-pa-sm">
                <q-skeleton type="text" />
              </div>
              <div v-for="c in 15" :key="c" class="col q-pa-xs">
                <q-skeleton type="rect" height="24px" />
              </div>
            </div>
          </div>
        </template>

        <!-- Custom Header -->
        <template v-slot:header="props">
          <q-tr :props="props">
            <!-- Operator Name Header -->
            <q-th key="operatorName" :props="props" class="sticky-column-z5" style="background: white">
              Personale
            </q-th>

            <!-- Dynamic Date Headers -->
            <q-th v-for="col in dateColumns" :key="col.name" :props="props" class="text-center q-pa-xs"
              :class="{ 'bg-red-1': col.isHoliday, 'bg-grey-1': !col.isHoliday }">
              <div class="column items-center justify-center" style="line-height: 1.1">
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

          <!-- Validation Mattina -->
          <q-tr class="bg-amber-1" style="height: 28px">
            <q-th class="sticky-column-z5 bg-amber-1 text-left text-black text-weight-bold">
              Mattina
            </q-th>
            <q-th v-for="col in dateColumns" :key="'m-' + col.name" class="text-center q-pa-none"
              style="padding: 1px !important">
              <span :class="{
                'text-red-8 text-weight-bold': shiftCounts[col.name]?.M !== 6,
                'text-amber-9': shiftCounts[col.name]?.M === 6,
              }">
                {{ shiftCounts[col.name]?.M || 0 }}
              </span>
            </q-th>
          </q-tr>

          <!-- Validation Pomeriggio -->
          <q-tr class="bg-deep-orange-1" style="height: 28px">
            <q-th class="sticky-column-z5 bg-deep-orange-1 text-left text-white text-weight-bold">
              Pomeriggio
            </q-th>
            <q-th v-for="col in dateColumns" :key="'p-' + col.name" class="text-center q-pa-none"
              style="padding: 1px !important">
              <span :class="{
                'text-red-8 text-weight-bold': shiftCounts[col.name]?.P !== 6,
                'text-deep-orange-6 text-weight-bold': shiftCounts[col.name]?.P === 6,
              }">
                {{ shiftCounts[col.name]?.P || 0 }}
              </span>
            </q-th>
          </q-tr>

          <!-- Validation Notte -->
          <q-tr class="bg-blue-1" style="height: 28px">
            <q-th class="sticky-column-z5 bg-blue-1 text-left text-white text-weight-bold">
              Notte
            </q-th>
            <q-th v-for="col in dateColumns" :key="'n-' + col.name" class="text-center q-pa-none"
              style="padding: 1px !important">
              <span :class="{
                'text-red-8 text-weight-bold': shiftCounts[col.name]?.N !== 6,
                'text-blue-10 text-weight-bold': shiftCounts[col.name]?.N === 6,
              }">
                {{ shiftCounts[col.name]?.N || 0 }}
              </span>
            </q-th>
          </q-tr>
        </template>

        <!-- Custom Body -->
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td key="operatorName" :props="props" class="sticky-column text-weight-bold">
              <div class="text-weight-bold ellipsis" style="max-width: 190px" :title="props.row.operatorName">
                {{ props.row.operatorName }}
              </div>
            </q-td>

            <q-td v-for="col in dateColumns" :key="col.name" :props="props" class="text-center q-pa-none" :class="{
              'bg-red-1': col.isHoliday,
              'pending-cell': isPending(props.row.id, col.name)
            }" style="padding: 1px !important">
              <!-- Highlight badge only if it matches filter or no filter set -->
              <div v-if="getDisplayShift(props.row, col.name) && isShiftVisible(getDisplayShift(props.row, col.name), props.row.id, col.name)"
                class="full-width full-height flex flex-center">
                <q-badge
                  :color="getShiftColor(getDisplayShift(props.row, col.name))" 
                  class="cursor-pointer shadow-1 full-width flex flex-center relative-position shift-badge"
                  :class="{ 'pending-badge': isPending(props.row.id, col.name) }"
                  style="height: 24px; font-size: 0.75rem; border-radius: 4px"
                >
                  {{ getDisplayShift(props.row, col.name) }}
                  
                  <!-- Visual indicator for note (Excel-style red triangle) -->
                  <div v-if="props.row.notes[col.name]" class="note-indicator"></div>

                  <q-tooltip v-if="props.row.notes[col.name]" 
                    class="glass-tooltip text-white shadow-10" 
                    :offset="[0, 12]"
                    anchor="bottom middle" self="top middle"
                  >
                    <div class="tooltip-content">
                      <div class="row no-wrap items-center q-mb-xs border-bottom-soft q-pb-xs">
                        <q-icon name="sticky_note_2" size="14px" class="q-mr-sm text-amber" />
                        <span class="text-weight-bold text-uppercase tracking-wider" style="font-size: 0.7rem">Dettagli Nota Excel</span>
                      </div>
                      <div class="note-text q-mt-sm">{{ props.row.notes[col.name] }}</div>
                    </div>
                  </q-tooltip>

                  <!-- Edit Menu (Opens on standard click) -->
                  <q-menu touch-position>
                    <q-list style="min-width: 100px">
                      <q-item v-for="code in shiftCodeOptions" :key="code" clickable v-close-popup @click="handleShiftEdit(props.row.id, col.name, code)">
                        <q-item-section avatar>
                          <q-badge :color="getShiftColor(code)" size="sm">{{ code }}</q-badge>
                        </q-item-section>
                        <q-item-section>{{ code }}</q-item-section>
                      </q-item>
                      <q-separator />
                      <q-item clickable v-close-popup @click="handleShiftEdit(props.row.id, col.name, '')">
                        <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                        <q-item-section>Rimuovi</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-badge>
              </div>
              <!-- Empty spacer or grey text if filtered out -->
              <div v-else class="full-width full-height cursor-pointer" style="min-height: 24px">
                <span class="text-grey-3 text-caption"> - </span>
                <q-menu v-if="!showOnlyWithNotes" touch-position>
                  <q-list style="min-width: 100px">
                    <q-item v-for="code in shiftCodeOptions" :key="code" clickable v-close-popup @click="handleShiftEdit(props.row.id, col.name, code)">
                      <q-item-section avatar>
                        <q-badge :color="getShiftColor(code)" size="sm">{{ code }}</q-badge>
                      </q-item-section>
                      <q-item-section>{{ code }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </div>
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
              <span class="q-ml-md">
                Mattina (tutti i codici che iniziano con M: M, MRDN, etc.)
              </span>
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
              <span class="q-ml-md">Riposo (tutti i codici che iniziano con R: R, RRDG, RDM, etc.)</span>
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

    <!-- Floating Batch Save Button -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]" v-if="hasPendingChanges">
      <q-btn
        fab
        icon="cloud_upload"
        color="indigo-10"
        label="Salva su Excel"
        @click="savePendingChanges"
        :loading="savingChanges"
      >
        <q-badge color="red" floating>{{ Object.values(pendingChanges).reduce((acc, curr) => acc + Object.keys(curr).length, 0) }}</q-badge>
      </q-btn>
    </q-page-sticky>
  </div>
</template>


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

.sticky-column-z5 {
  position: sticky;
  left: 0;
  z-index: 5 !important;
  border-right: 1px solid #ddd;
}

/* Make headers sticky vertically */
:deep(.sticky-header-table thead tr th) {
  position: sticky;
  z-index: 2;
}

:deep(.sticky-header-table thead tr:nth-child(1) th) {
  top: 0;
  height: 55px;
  /* Forced height for consistent math */
}

:deep(.sticky-header-table thead tr:nth-child(2) th) {
  top: 55px;
}

:deep(.sticky-header-table thead tr:nth-child(3) th) {
  top: 83px;
  /* 55 + 28 */
}

:deep(.sticky-header-table thead tr:nth-child(4) th) {
  top: 111px;
  /* 83 + 28 */
}

/* Note Indicator styles */
.note-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 6px 6px 0;
  border-color: transparent #ff1744 transparent transparent;
  border-radius: 0 4px 0 0;
}

/* Premium Tooltip Styles */
.glass-tooltip {
  background: rgba(15, 23, 42, 0.92) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px !important;
  border-radius: 12px !important;
  max-width: 320px !important;
}

.border-bottom-soft {
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.tracking-wider {
  letter-spacing: 0.05em;
}

.note-text {
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap; /* Preserve line breaks from Excel */
  color: rgba(255, 255, 255, 0.9);
}

.pending-badge {
  border: 2px dashed white !important;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5) !important;
}

.pending-cell {
  background-color: rgba(25, 118, 210, 0.1) !important;
}

.shift-badge:hover {
  filter: brightness(1.1);
  transform: scale(1.05);
  transition: all 0.2s;
}
</style>
