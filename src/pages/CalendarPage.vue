/**
 * @file CalendarPage.vue
 * @description Main calendar page with support for Admin (Table) and User (Monthly Grid) views.
 * @author Nurse Hub Team
 * @created 2026-03-10
 * @modified 2026-05-03
 */
<script setup lang="ts">
import ShiftMonthView from '../components/calendar/ShiftMonthView.vue';
import AdminShiftTable from '../components/calendar/AdminShiftTable.vue';
import DailyRosterCard from '../components/dashboard/DailyRosterCard.vue';
import RotationWidget from '../components/calendar/RotationWidget.vue';
import GlobalSyncBtn from '../components/common/GlobalSyncBtn.vue';
import { useAuthStore } from '../stores/authStore';
import { computed } from 'vue';

const authStore = useAuthStore();

/** True while auth initialization is pending — prevents rendering tabelle before user role is known. */
const isPageLoading = computed(() => !authStore.isInitialized);
</script>

<template>
  <q-page class="q-pa-md bg-white column">
    <!-- §1.10 Skeleton: shown while auth role is resolving -->
    <div v-if="isPageLoading" class="col column">
      <q-card flat bordered class="q-mb-sm">
        <q-card-section>
          <q-skeleton type="text" width="30%" class="q-mb-md" />
          <q-skeleton type="rect" height="40px" class="q-mb-sm" />
          <q-skeleton type="rect" height="40px" class="q-mb-sm" />
          <q-skeleton type="rect" height="40px" />
        </q-card-section>
      </q-card>
    </div>

    <!-- Admin View: Full Table (Full Width) -->
    <div v-else-if="authStore.isAnyAdmin" class="col column">
      <AdminShiftTable />
    </div>

    <!-- User View: Centered Stack -->
    <div v-else class="column items-center full-width">
      <div class="user-view-container column q-gutter-y-lg">
        <!-- Title -->
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-h5 text-weight-bold text-primary">I Tuoi Turni</div>
          <GlobalSyncBtn />
        </div>
        
        <!-- Monthly Grid -->
        <ShiftMonthView />

        <!-- Daily Roster (Chi c'è di turno) -->
        <DailyRosterCard />
        
        <!-- Shift Rotation Widget -->
        <RotationWidget />
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.user-view-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
