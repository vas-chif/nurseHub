/**
 * @file AdminAnalyticsPage.vue
 * @description Dashboard for administrative analytics and request trends.
 * @author Nurse Hub Team
 * @created 2026-03-20
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized dateUtils.
 * - Uses ApexCharts for data visualization.
 */
<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useAnalytics } from 'src/composables/useAnalytics';
import { useSecureLogger } from 'src/utils/secureLogger';
import { getDocs, collection, query } from 'firebase/firestore';
import { db } from 'src/boot/firebase';
import { useConfigStore } from 'src/stores/configStore';
import { operatorsService } from 'src/services/OperatorsService';
import type { ShiftRequest, Operator } from 'src/types/models';
import { exportFile, useQuasar } from 'quasar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import AppDateInput from '../components/common/AppDateInput.vue';
import { formatToDb } from '../utils/dateUtils';

const $q = useQuasar();
const logger = useSecureLogger();
const configStore = useConfigStore();

const { setRequests, metrics, charts, rawRequests } = useAnalytics();
const loading = ref(true);

const filters = ref({
  dateFrom: '',
  dateTo: '',
});

// Setup default month filters
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
filters.value.dateFrom = formatToDb(firstDay);
filters.value.dateTo = formatToDb(lastDay);

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
    await nextTick();
  } catch (e) {
    logger.error('Error fetching analytics', e);
  } finally {
    loading.value = false;
  }
}

watch(() => configStore.activeConfigId, (newId) => {
  if (newId) void refreshData();
}, { immediate: true });

// Refetch on date change
watch([() => filters.value.dateFrom, () => filters.value.dateTo], () => {
  void refreshData();
});

onMounted(() => {
  if (configStore.activeConfigId) void refreshData();
});
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <h1 class="text-h5 q-my-none text-weight-bold text-primary">Analytics Dashboard 📊</h1>

      <!-- Date Filters -->
      <div class="row q-gutter-sm items-center">
        <div style="width: 150px">
          <AppDateInput v-model="filters.dateFrom" label="Dal" />
        </div>
        <div style="width: 150px">
          <AppDateInput v-model="filters.dateTo" label="Al" />
        </div>

        <q-btn icon="refresh" flat round color="primary" @click="refreshData" :loading="loading" />
        <q-btn icon="download" label="CSV" color="secondary" outline @click="exportCSV"
          :disable="metrics.total.value === 0" />
        <q-btn icon="picture_as_pdf" label="PDF" color="accent" outline @click="exportPDF"
          :disable="metrics.total.value === 0" />
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-primary text-white rounded-borders shadow-2">
          <q-card-section>
            <div class="text-subtitle2 opacity-80">Assenze a Calendario</div>
            <div class="text-h4 text-weight-bolder">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.totalAbsences }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-secondary text-white rounded-borders shadow-2">
          <q-card-section>
            <div class="text-subtitle2 opacity-80">Richieste in App</div>
            <div class="text-h4 text-weight-bolder">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.total }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-warning text-white rounded-borders shadow-2">
          <q-card-section>
            <div class="text-subtitle2 opacity-80">In Attesa</div>
            <div class="text-h4 text-weight-bolder">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.pending }}</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md">
        <q-card class="bg-positive text-white rounded-borders shadow-2">
          <q-card-section>
            <div class="text-subtitle2 opacity-80">Tasso Approvazione</div>
            <div class="text-h4 text-weight-bolder">
              <q-skeleton v-if="loading" type="text" width="60px" />
              <template v-else>{{ metrics.approvalRate }}%</template>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-md-4">
        <q-card class="fit shadow-1 rounded-borders">
          <q-card-section>
            <div class="text-h6 text-grey-8">Stato Richieste</div>
          </q-card-section>
          <q-card-section>
            <q-skeleton v-if="loading || !configStore.activeConfigId" type="circle" size="180px" class="q-mx-auto" />
            <apexchart v-else :key="loading" type="donut" :options="charts.status.value.options" :series="charts.status.value.series" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card class="fit shadow-1 rounded-borders">
          <q-card-section>
            <div class="text-h6 text-grey-8">Andamento Giornaliero</div>
          </q-card-section>
          <q-card-section>
            <q-skeleton v-if="loading || !configStore.activeConfigId" type="rect" height="300px" />
            <apexchart v-else :key="loading" type="line" height="300" :options="charts.trend.value.options"
              :series="charts.trend.value.series" />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card class="shadow-1 rounded-borders">
          <q-card-section>
            <div class="text-h6 text-grey-8">Top 5 Operatori</div>
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

<style scoped>
.rounded-borders {
  border-radius: 16px;
}
.opacity-80 {
  opacity: 0.8;
}
</style>
