/**
 * @file CalendarPage.vue
 * @description Main calendar page that toggles between personal month view and administrative table view.
 * @author Nurse Hub Team
 * @created 2026-03-01
 * @modified 2026-04-27
 * @notes
 * - Renders ShiftMonthView for regular users.
 * - Renders AdminShiftTable for administrators (SuperAdmin/Admin).
 * - Integrates DailyRosterCard for quick status checks.
 */
<script setup lang="ts">
import ShiftMonthView from '../components/calendar/ShiftMonthView.vue';
import AdminShiftTable from '../components/calendar/AdminShiftTable.vue';
import DailyRosterCard from '../components/dashboard/DailyRosterCard.vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
</script>

<template>
  <q-page class="q-pa-md bg-white column">
    <!-- Admin View: Full Table -->
    <div v-if="authStore.isAnyAdmin" class="col column">
      <AdminShiftTable />
    </div>

    <!-- User View: Month Calendar -->
    <div v-else>
      <ShiftMonthView />

      <!-- Legend -->
      <div class="row q-mt-md justify-center q-gutter-sm">
        <q-badge color="amber-8" label="Mattina" />
        <q-badge color="orange-8" label="Pomeriggio" />
        <q-badge color="blue-10" label="Notte" />
        <q-badge color="grey-5" label="Riposo" />
      </div>
    </div>

    <!-- Daily Roster (Chi c'è di turno) -->
    <DailyRosterCard class="q-mt-lg" v-if="!authStore.isAnyAdmin" />
  </q-page>
</template>
