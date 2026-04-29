<script setup lang="ts">
/**
 * @file AdminAnalyticsPage.vue
 * @description Dashboard for administrative analytics and request trends.
 * @author Nurse Hub Team
 * @created 2026-03-20
 * @modified 2026-04-27
 * @notes
 * - Uses ApexCharts for data visualization.
 * - Integrated with Firestore for real-time request tracking.
 * - Systematic skeleton loading for reduced layout shift.
 */
import { ref, onMounted, watch, nextTick } from 'vue';
import { useAnalytics } from 'src/composables/useAnalytics';
import { useSecureLogger } from 'src/utils/secureLogger';

const logger = useSecureLogger();
import { getDocs, collection, query } from 'firebase/firestore';
import { db } from 'src/boot/firebase';
import { useConfigStore } from 'src/stores/configStore';
import { operatorsService } from 'src/services/OperatorsService';
import type { ShiftRequest, Operator } from 'src/types/models';
import { exportFile, useQuasar } from 'quasar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const $q = useQuasar();

const configStore = useConfigStore();

const { setRequests, metrics, charts, rawRequests } = useAnalytics();
const loading = ref(true); // Start as true to prevent premature chart mounting

const filters = ref({
  dateFrom: '',
  dateTo: '',
});

// Setup default month filters
function getLocalYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
filters.value.dateFrom = getLocalYYYYMMDD(firstDay);
filters.value.dateTo = getLocalYYYYMMDD(lastDay);

function formatIT(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function wrapCsvValue(val: string | number | boolean | null | undefined) {
  let formatted = val === void 0 || val === null ? '' : String(val);
  formatted = formatted.split('"').join('""');
  return `"${formatted}"`;
}

function exportCSV() {
  if (rawRequests.value.length === 0) return;

  const columns = [
    { label: 'Data', field: 'date' },
    { label: 'Operatore', field: 'absentOperatorName' },
    { label: 'Turno', field: 'originalShift' },
    { label: 'Motivo', field: 'reason' },
    { label: 'Stato', field: 'status' },
    { label: 'Creato il', field: 'createdAt' },
  ];

  const header = columns.map((col) => wrapCsvValue(col.label)).join(',');
  const lines = rawRequests.value.map((row) => {
    return columns
      .map((col) => {
        const field = col.field as keyof ShiftRequest;
        const rawVal = (row as unknown as Record<string, unknown>)[field];
        let val: string | number | boolean | null | undefined;

        if (field === 'createdAt' && typeof rawVal === 'number') {
          val = new Date(rawVal).toLocaleString();
        } else {
          val = rawVal as string | number | boolean | null | undefined;
        }
        return wrapCsvValue(val);
      })
      .join(',');
  });

  const content = [header, ...lines].join('\r\n');

  const status = exportFile(
    `analytics_export_${filters.value.dateFrom}_${filters.value.dateTo}.csv`,
    content,
    'text/csv',
  );

  if (status !== true) {
    $q.notify({
      message: 'Browser denied file download...',
      color: 'negative',
      icon: 'warning',
    });
  }
}

function exportPDF() {
  if (rawRequests.value.length === 0) return;

  const doc = new jsPDF();
  const configName = configStore.activeConfig?.name || 'Reparto';

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(26, 35, 126); // Primary Navy
  doc.text('NurseHub - Report Analytics', 14, 22);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Reparto: ${configName}`, 14, 30);
  doc.text(`Periodo: ${filters.value.dateFrom} - ${filters.value.dateTo}`, 14, 37);
  doc.text(`Generato il: ${new Date().toLocaleString()}`, 14, 44);

  // --- KPI Section ---
  doc.setDrawColor(200);
  doc.line(14, 50, 196, 50);

  doc.setFontSize(14);
  doc.setTextColor(26, 35, 126);
  doc.text('Indicatori Chiave (KPI)', 14, 60);

  doc.setFontSize(10);
  doc.setTextColor(0);
  const kpiY = 70;
  doc.text(`Totale Richieste: ${metrics.total.value}`, 14, kpiY);
  doc.text(`In Attesa: ${metrics.pending.value}`, 60, kpiY);
  doc.text(`Tasso Approvazione: ${metrics.approvalRate.value}%`, 110, kpiY);
  doc.text(`Tempo Medio: ${metrics.avgTime.value}`, 160, kpiY);

  // --- Data Table ---
  const tableData = rawRequests.value.map(row => [
    row.date,
    row.absentOperatorName || 'N/D',
    row.originalShift,
    row.reason || '',
    row.status,
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Data', 'Operatore', 'Turno', 'Motivo', 'Stato']],
    body: tableData,
    headStyles: { fillColor: [26, 35, 126] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    margin: { top: 80 },
  });

  doc.save(`analytics_report_${filters.value.dateFrom}_${filters.value.dateTo}.pdf`);
}

async function refreshData() {
  if (!configStore.activeConfigId) {
    logger.warn('Attempted to refresh analytics without an active configId');
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    // 1. Fetch Requests
    const reqRef = collection(db, 'shiftRequests');
    const q = query(reqRef);

    const snapshot = await getDocs(q);
    let requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest);

    // Client side filtering
    // Assicuriamo che le richieste appartengano al reparto attivo
    requests = requests.filter((r) => !r.configId || r.configId === configStore.activeConfigId);

    if (filters.value.dateFrom) {
      requests = requests.filter((r) => r.date >= filters.value.dateFrom);
    }
    if (filters.value.dateTo) {
      requests = requests.filter((r) => r.date <= filters.value.dateTo);
    }

    // 2. Fetch Operators for names
    const operatorsList = await operatorsService.getOperatorsByConfig(configStore.activeConfigId);
    const operators: Record<string, Operator> = {};
    operatorsList.forEach((op: Operator) => {
      operators[op.id] = op;
    });

    setRequests(requests, operators, filters.value.dateFrom, filters.value.dateTo);
    
    // Ensure DOM is ready before making charts visible
    await nextTick();
  } catch (e) {
    logger.error('Error fetching analytics', e);
  } finally {
    loading.value = false;
  }
}

// Watch for config changes (e.g. from SuperAdmin selector or initial load)
watch(() => configStore.activeConfigId, (newId) => {
  if (newId) {
    void refreshData();
  }
}, { immediate: true });

onMounted(() => {
  // If config is already there, trigger it. If not, the watcher will catch it.
  if (configStore.activeConfigId) {
    void refreshData();
  }
});
</script>


<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <h1 class="text-h5 q-my-none">Analytics Dashboard 📊</h1>

      <!-- Date Filter -->
      <div class="row q-gutter-sm">
        <q-input :model-value="formatIT(filters.dateFrom)" label="Dal" dense outlined readonly style="width: 150px">
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="filters.dateFrom" mask="YYYY-MM-DD" @update:model-value="refreshData">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Chiudi" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-input :model-value="formatIT(filters.dateTo)" label="Al" dense outlined readonly style="width: 150px">
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="filters.dateTo" mask="YYYY-MM-DD" @update:model-value="refreshData">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Chiudi" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-btn icon="refresh" flat round color="primary" @click="refreshData" :loading="loading" />
        <q-btn icon="download" label="Esporta CSV" color="secondary" outline @click="exportCSV"
          :disable="metrics.total.value === 0" />
        <q-btn icon="picture_as_pdf" label="Esporta PDF" color="accent" outline @click="exportPDF"
          :disable="metrics.total.value === 0" />
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-subtitle2">Assenze a Calendario</div>
            <div class="text-h4">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.totalAbsences }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-secondary text-white">
          <q-card-section>
            <div class="text-subtitle2">Richieste in App</div>
            <div class="text-h4">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.total }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-warning text-white">
          <q-card-section>
            <div class="text-subtitle2">In Attesa</div>
            <div class="text-h4">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.pending }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-positive text-white">
          <q-card-section>
            <div class="text-subtitle2">Tasso Approvazione</div>
            <div class="text-h4">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.approvalRate }}%</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-12 col-md">
        <q-card class="bg-info text-white">
          <q-card-section>
            <div class="text-subtitle2">Tempo Medio</div>
            <div class="text-h4">
              <q-skeleton v-if="loading" type="text" width="80px" />
              <template v-else>{{ metrics.avgTime }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="row q-col-gutter-md q-mb-lg">
      <!-- Status Distribution -->
      <div class="col-12 col-md-4">
        <q-card class="fit">
          <q-card-section>
            <div class="text-h6">Stato Richieste</div>
          </q-card-section>
          <q-card-section>
            <q-skeleton v-if="loading || !configStore.activeConfigId" type="circle" size="180px" class="q-mx-auto" />
            <apexchart v-else :key="loading" type="donut" :options="charts.status.value.options" :series="charts.status.value.series" />
          </q-card-section>
        </q-card>
      </div>

      <!-- Trend -->
      <div class="col-12 col-md-8">
        <q-card class="fit">
          <q-card-section>
            <div class="text-h6">Andamento Giornaliero</div>
          </q-card-section>
          <q-card-section>
            <q-skeleton v-if="loading || !configStore.activeConfigId" type="rect" height="300px" />
            <apexchart v-else :key="loading" type="line" height="300" :options="charts.trend.value.options"
              :series="charts.trend.value.series" />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="row q-col-gutter-md">
      <!-- Top Operators -->
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="text-h6">Top 5 Operatori</div>
          </q-card-section>
          <q-card-section>
            <q-skeleton v-if="loading || !configStore.activeConfigId" type="rect" height="250px" />
            <apexchart v-else :key="loading" type="bar" height="250" :options="charts.topOperators.value.options"
              :series="charts.topOperators.value.series" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
