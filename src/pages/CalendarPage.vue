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
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
</script>

<template>
  <q-page class="q-pa-md bg-white column">
    <!-- Admin View: Full Table (Full Width) -->
    <div v-if="authStore.isAnyAdmin" class="col column">
      <AdminShiftTable />
    </div>

    <!-- User View: Centered Stack -->
    <div v-else class="column items-center full-width">
      <div class="user-view-container column q-gutter-y-lg">
        <!-- Title -->
        <div class="row items-center q-mb-xs">
          <div class="text-h5 text-weight-bold text-primary">I Tuoi Turni</div>
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
