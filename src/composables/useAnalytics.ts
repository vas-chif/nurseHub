import { computed, ref } from 'vue';
import type { ShiftRequest, Operator } from '../types/models';
import { date } from 'quasar';

export function useAnalytics() {
  const requests = ref<ShiftRequest[]>([]);
  const operatorsMap = ref<Record<string, Operator>>({});

  function setRequests(data: ShiftRequest[], operators: Record<string, Operator>) {
    requests.value = data;
    operatorsMap.value = operators;
  }

  // --- Metrics ---
  const totalRequests = computed(() => requests.value.length);

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
      // createdAt is "YYYY-MM-DD HH:mm" string in model
      // Safe cast or check if needed
      const createdStr = String(r.createdAt);
      const created = date.extractDate(createdStr, 'YYYY-MM-DD HH:mm');
      const resolved = r.approvalTimestamp || r.rejectionTimestamp;

      if (created && resolved) {
        totalMs += resolved - created.getTime();
        count++;
      }
    });

    if (count === 0) return '0h';

    const avgHours = Math.round(totalMs / (1000 * 60 * 60));
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
      // Use absentOperatorId if available (who the request is FOR), else creator
      const targetId = r.absentOperatorId || r.creatorId;
      counts[targetId] = (counts[targetId] || 0) + 1;
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
          name: 'Richieste',
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
    metrics: {
      total: totalRequests,
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
