<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <h1 class="text-h5 q-my-none">Analytics Dashboard 📊</h1>

      <!-- Date Filter -->
      <div class="row q-gutter-sm">
        <q-input
          v-model="filters.dateFrom"
          label="Dal"
          dense
          outlined
          type="date"
          style="width: 150px"
          @update:model-value="refreshData"
        />
        <q-input
          v-model="filters.dateTo"
          label="Al"
          dense
          outlined
          type="date"
          style="width: 150px"
          @update:model-value="refreshData"
        />
        <q-btn icon="refresh" flat round color="primary" @click="refreshData" :loading="loading" />
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-subtitle2">Totale Richieste</div>
            <div class="text-h4">{{ metrics.total }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="bg-warning text-white">
          <q-card-section>
            <div class="text-subtitle2">In Attesa</div>
            <div class="text-h4">{{ metrics.pending }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="bg-positive text-white">
          <q-card-section>
            <div class="text-subtitle2">Tasso Approvazione</div>
            <div class="text-h4">{{ metrics.approvalRate }}%</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="bg-info text-white">
          <q-card-section>
            <div class="text-subtitle2">Tempo Medio Risposta</div>
            <div class="text-h4">{{ metrics.avgTime }}</div>
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
            <apexchart
              type="donut"
              :options="charts.status.value.options"
              :series="charts.status.value.series"
            />
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
            <apexchart
              type="line"
              height="300"
              :options="charts.trend.value.options"
              :series="charts.trend.value.series"
            />
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
            <apexchart
              type="bar"
              height="250"
              :options="charts.topOperators.value.options"
              :series="charts.topOperators.value.series"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAnalytics } from 'src/composables/useAnalytics';
import { getDocs, collection, query } from 'firebase/firestore';
import { db } from 'src/boot/firebase';
import { useConfigStore } from 'src/stores/configStore';
import { operatorsService } from 'src/services/OperatorsService';
import type { ShiftRequest, Operator } from 'src/types/models';

const configStore = useConfigStore();

const { setRequests, metrics, charts } = useAnalytics();
const loading = ref(false);

const filters = ref({
  dateFrom: '',
  dateTo: '',
});

// Setup default month filters
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
filters.value.dateFrom = firstDay.toISOString().split('T')[0] as string;
filters.value.dateTo = lastDay.toISOString().split('T')[0] as string;

async function refreshData() {
  loading.value = true;
  try {
    // 1. Fetch Requests
    // Note: Better to do compounding queries or filter client side for flexibility if data set is small (<1000)
    // For now assuming we can fetch collection and filter client side for Phase 10.2 simplicity
    const reqRef = collection(db, 'shiftRequests');
    const q = query(reqRef);

    // Apply basic date range filter at DB level if possible, but string dates make it tricky.
    // Let's fetch all (or recent limit) and filter in JS for maximum flexibility on the formatted string dates
    // If dataset grows, we need to index 'date' field or 'createdAt'

    const snapshot = await getDocs(q);
    let requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftRequest);

    // Client side filtering
    if (filters.value.dateFrom) {
      requests = requests.filter((r) => r.date >= filters.value.dateFrom);
    }
    if (filters.value.dateTo) {
      requests = requests.filter((r) => r.date <= filters.value.dateTo);
    }

    // 2. Fetch Operators for names
    if (!configStore.activeConfigId) {
      console.warn('No active config for analytics');
      return;
    }

    const operatorsList = await operatorsService.getOperatorsByConfig(configStore.activeConfigId);
    const operators: Record<string, Operator> = {};
    operatorsList.forEach((op) => {
      operators[op.id] = op;
    });

    setRequests(requests, operators);
  } catch (e) {
    console.error('Error fetching analytics:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refreshData();
});
</script>
