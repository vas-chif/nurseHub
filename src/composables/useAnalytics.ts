/**
 * @file useAnalytics.ts
 * @description Composable for computing analytics metrics and chart data from shift requests.
 * @author Nurse Hub Team
 * @created 2026-03-20
 * @modified 2026-04-27
 * @notes
 * - Processes Firestore shiftRequests documents into metrics (total, pending, rate).
 * - Generates formatted data for ApexCharts (donut, line, bar).
 * - Reactively updates based on filtered request data.
 */
import { computed, ref } from 'vue';
import type { ShiftRequest, Operator } from '../types/models';


export function useAnalytics() {
  const requests = ref<ShiftRequest[]>([]);
  const operatorsMap = ref<Record<string, Operator>>({});

  const dateFilters = ref({ from: '', to: '' });

  function setRequests(data: ShiftRequest[], operators: Record<string, Operator>, from: string = '', to: string = '') {
    requests.value = data;
    operatorsMap.value = operators;
    dateFilters.value = { from, to };
  }

  // --- Metrics ---
  const totalRequests = computed(() => requests.value.length);

  const totalAbsences = computed(() => {
    let count = 0;
    const { from, to } = dateFilters.value;
    if (!from || !to) return 0;

    for (const opId in operatorsMap.value) {
      const schedule = operatorsMap.value[opId]?.schedule;
      if (!schedule) continue;

      for (const [dateKey, code] of Object.entries(schedule)) {
        // Count any code starting with 'A' as an absence in the filtered date range
        if (dateKey >= from && dateKey <= to && typeof code === 'string' && code.startsWith('A')) {
          count++;
        }
      }
    }
    return count;
  });

  const pendingRequests = computed(() => requests.value.filter((r) => r.status === 'OPEN').length);

  const approvalRate = computed(() => {
    const total = requests.value.length;
    if (total === 0) return 0;
    const approved = requests.value.filter(
      (r) => r.status === 'CLOSED' && !r.rejectionReason,
    ).length;
    return Math.round((approved / total) * 100);
  });

  const avgResponseTime = computed(() => {
    const processed = requests.value.filter((r) => r.status === 'CLOSED');
    if (processed.length === 0) return '0h';

    let totalMs = 0;
    let count = 0;

    processed.forEach((r) => {
      const created = r.createdAt;
      const resolved = r.approvalTimestamp || r.rejectionTimestamp;

      if (created && resolved) {
        totalMs += resolved - created;
        count++;
      }
    });

    if (count === 0) return '0h';

    const avgMs = totalMs / count;
    if (avgMs < 1000 * 60 * 60) {
      const avgMins = Math.round(avgMs / (1000 * 60));
      return `${avgMins} min`;
    }
    const avgHours = Math.round(avgMs / (1000 * 60 * 60));
    return `${avgHours}h`;
  });

  // --- Charts ---
  const statusCharts = computed(() => {
    const approved = requests.value.filter(
      (r) => r.status === 'CLOSED' && !r.rejectionReason,
    ).length;
    const rejected = requests.value.filter(
      (r) => r.status === 'CLOSED' && r.rejectionReason,
    ).length;
    const pending = requests.value.filter((r) => r.status === 'OPEN').length;

    return {
      series: [approved, rejected, pending],
      options: {
        labels: ['Approvate', 'Rifiutate', 'In Attesa'],
        colors: ['#21BA45', '#C10015', '#F2C037'],
        legend: { position: 'bottom' },
      },
    };
  });

  const trendChart = computed(() => {
    // Group by date (YYYY-MM-DD)
    const groups: Record<string, number> = {};

    // Sort requests by date
    const sorted = [...requests.value].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach((r) => {
      groups[r.date] = (groups[r.date] || 0) + 1;
    });

    return {
      series: [
        {
          name: 'Richieste',
          data: Object.values(groups),
        },
      ],
      options: {
        xaxis: { categories: Object.keys(groups) },
        colors: ['#1976D2'],
      },
    };
  });

  const topOperatorsChart = computed(() => {
    const counts: Record<string, number> = {};

    requests.value.forEach((r) => {
      // Conta chi si propone per coprire il turno (i salvatori), non chi è assente
      if (r.offeringOperatorIds && r.offeringOperatorIds.length > 0) {
        r.offeringOperatorIds.forEach((id) => {
          counts[id] = (counts[id] || 0) + 1;
        });
      } else if (r.offers && r.offers.length > 0) {
        r.offers.forEach((offer) => {
          counts[offer.operatorId] = (counts[offer.operatorId] || 0) + 1;
        });
      }
    });

    // Sort and take top 5
    const top = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const names = top.map(([id]) => operatorsMap.value[id]?.name || 'Sconosciuto');
    const values = top.map(([, count]) => count);

    return {
      series: [
        {
          name: 'Proposte di Copertura',
          data: values,
        },
      ],
      options: {
        plotOptions: {
          bar: { horizontal: true },
        },
        xaxis: { categories: names },
        colors: ['#5e35b1'],
      },
    };
  });

  return {
    setRequests,
    rawRequests: requests,
    rawOperators: operatorsMap,
    metrics: {
      total: totalRequests,
      totalAbsences,
      pending: pendingRequests,
      approvalRate,
      avgTime: avgResponseTime,
    },
    charts: {
      status: statusCharts,
      trend: trendChart,
      topOperators: topOperatorsChart,
    },
  };
}
