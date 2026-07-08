/**
 * @file ExportShiftsBtn.vue
 * @description Button to export the user's current month shifts in PDF or JSON format.
 * @author Nurse Hub Team
 * @created 2026-07-08
 * @dependencies
 * - jspdf
 * - jspdf-autotable
 */
<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { date as quasarDate, useQuasar } from 'quasar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const $q = useQuasar();
const authStore = useAuthStore();
const scheduleStore = useScheduleStore();

const props = defineProps<{
  targetDate?: Date;
}>();

const currentOperator = computed(() => {
  const targetId = authStore.currentOperator?.id || authStore.currentUser?.operatorId;
  const userConfigId = authStore.currentUser?.configId;
  const ops = userConfigId
    ? scheduleStore.getOperatorsForConfig(userConfigId)
    : scheduleStore.operators;
  return ops.find((op) => op.id === targetId) || authStore.currentOperator;
});

function getMonthShifts() {
  if (!currentOperator.value || !currentOperator.value.schedule) return { shifts: [], monthName: '' };
  
  const now = props.targetDate || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const shifts = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  
  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(year, month, i);
    const dateStr = quasarDate.formatDate(d, 'YYYY-MM-DD');
    const shiftCode = currentOperator.value.schedule[dateStr];
    if (shiftCode) {
      shifts.push({
        date: quasarDate.formatDate(d, 'DD/MM/YYYY'),
        shift: shiftCode,
        note: currentOperator.value.notes?.[dateStr] || ''
      });
    }
  }
  
  const monthNameStr = quasarDate.formatDate(now, 'MMMM_YYYY');
  return { shifts, monthName: monthNameStr };
}

function exportJSON() {
  const data = getMonthShifts();
  if (data.shifts.length === 0) {
    $q.notify({ type: 'warning', message: 'Nessun turno da esportare per questo mese.' });
    return;
  }
  const jsonStr = JSON.stringify(data.shifts, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `turni_${data.monthName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  const data = getMonthShifts();
  if (data.shifts.length === 0) {
    $q.notify({ type: 'warning', message: 'Nessun turno da esportare per questo mese.' });
    return;
  }
  
  const doc = new jsPDF();
  const operatorName = currentOperator.value?.name || '';
  const title = `Turni di ${operatorName} - ${data.monthName.replace('_', ' ')}`;
  doc.text(title, 14, 15);
  
  const tableData = data.shifts.map(s => [s.date, s.shift, s.note]);
  
  autoTable(doc, {
    startY: 20,
    head: [['Data', 'Turno', 'Note']],
    body: tableData,
    styles: { font: 'helvetica' },
    headStyles: { fillColor: [24, 100, 151] }, // Brand color
  });
  
  doc.save(`turni_${data.monthName}.pdf`);
}
</script>

<template>
  <q-btn-dropdown
    color="primary"
    outline
    rounded
    icon="download"
    label="Esporta"
    class="text-weight-bold"
    dense
  >
    <q-list>
      <q-item clickable v-close-popup @click="exportPDF">
        <q-item-section avatar>
          <q-icon name="picture_as_pdf" color="red" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Esporta PDF</q-item-label>
        </q-item-section>
      </q-item>

      <q-item clickable v-close-popup @click="exportJSON">
        <q-item-section avatar>
          <q-icon name="data_object" color="blue-10" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Esporta JSON</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<style scoped>
/* Scoped styles */
</style>
