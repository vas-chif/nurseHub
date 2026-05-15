<script setup lang="ts">
/**
 * @file WidgetShiftsPage.vue
 * @description Mobile-first shift preview widget: today + next 4 days for the logged-in operator.
 * @author Nurse Hub Team
 * @created 2026-05-15
 * @modified 2026-05-15
 * @notes
 * - Phase 39: Visible to all users. Admins see it only on mobile ($q.screen.lt.md) or in viewMode='user'.
 * - Data sourced from authStore.currentOperator (already in RAM) — zero extra Firestore reads (Phase 30.1).
 * - Shift styles use getShiftStyleForCode from useShiftLogic (§1.12 DRY).
 * - §1.3 useSecureLogger · §1.8 no any · §1.10 q-skeleton · §1.11 < 120 lines.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, date as quasarDate } from 'quasar';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useSecureLogger } from '../utils/secureLogger';
import { getShiftStyleForCode } from '../composables/useShiftLogic';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();
const logger = useSecureLogger();

// Visibility gate: Admins see widget only on mobile OR in Operator mode.
const isVisible = computed(() => {
  if (!authStore.isAuthenticated) return false;
  if (!authStore.isAnyAdmin) return true;            // Regular users: always visible
  if (uiStore.viewMode === 'user') return true;      // Admin in Operator mode: visible
  return $q.screen.lt.md;                            // Admin in Admin mode: mobile only
});

// Build 5-day preview from the operator's in-RAM schedule
const days = computed(() => {
  const schedule = authStore.currentOperator?.schedule ?? {};
  const today = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = quasarDate.formatDate(d, 'YYYY-MM-DD');
    const shift = schedule[key] ?? null;
    const style = getShiftStyleForCode(shift);
    return {
      key,
      label: i === 0
        ? 'OGGI'
        : d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase(),
      shift: shift ?? '',
      color: style.color,
      bg: style.bg,
      icon: style.icon,
      shiftLabel: style.label,
      isToday: i === 0,
    };
  });
});

const operatorName = computed(() => authStore.currentOperator?.name ?? authStore.currentUser?.firstName ?? '–');

function goBack() {
  void router.back();
}

logger.info('WidgetShiftsPage mounted');
</script>

<template>
  <!-- Guard: redirect admins on desktop in Admin mode -->
  <q-page class="widget-page flex flex-center">
    <!-- Skeleton while auth loads -->
    <template v-if="!authStore.isInitialized">
      <div class="widget-card column q-gutter-md">
        <q-skeleton type="rect" height="28px" width="60%" />
        <q-skeleton v-for="n in 5" :key="n" type="rect" height="56px" class="rounded-borders" />
      </div>
    </template>

    <!-- Not visible guard -->
    <template v-else-if="!isVisible">
      <div class="text-center q-pa-xl">
        <q-icon name="lock" size="48px" color="grey-4" />
        <div class="text-grey-5 q-mt-md">Vista non disponibile in modalità Admin su desktop.</div>
        <q-btn flat color="primary" label="Torna indietro" class="q-mt-md" @click="goBack" />
      </div>
    </template>

    <!-- Widget Card -->
    <template v-else>
      <div class="widget-card">
        <!-- Header -->
        <div class="widget-header row items-center justify-between q-mb-md">
          <div class="column">
            <span class="text-caption text-grey-5 uppercase letter-spacing">I tuoi turni</span>
            <span class="text-subtitle1 text-weight-bold text-white">{{ operatorName }}</span>
          </div>
          <q-btn flat round dense icon="arrow_back" color="white" @click="goBack" />
        </div>

        <!-- Shift Rows -->
        <div v-for="day in days" :key="day.key" class="shift-row row items-center q-pa-sm q-mb-sm rounded-borders"
          :class="{ 'today-row': day.isToday }" :style="{ borderLeft: `4px solid ${day.color}`, background: day.bg }">
          <div class="col-4">
            <span class="text-caption text-weight-bold" :class="day.isToday ? 'text-white' : 'text-grey-4'">
              {{ day.label }}
            </span>
          </div>
          <div class="col row items-center q-gutter-x-sm">
            <q-icon :name="day.icon" size="18px" :style="{ color: day.color }" />
            <span class="text-subtitle2 text-weight-bolder" :style="{ color: day.color }">
              {{ day.shift || '–' }}
            </span>
            <span class="text-caption text-grey-5">{{ day.shiftLabel }}</span>
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.widget-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0f172a 100%);
}

.widget-card {
  width: 100%;
  max-width: 420px;
  padding: 24px 20px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  margin: 16px;
}

.widget-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.shift-row {
  border-radius: 10px;
  transition: transform 0.15s ease;
}

.shift-row:hover {
  transform: translateX(4px);
}

.today-row {
  background: rgba(255, 255, 255, 0.1) !important;
  border-left-width: 5px !important;
}

.letter-spacing {
  letter-spacing: 1.5px;
  font-size: 0.65rem;
}
</style>
