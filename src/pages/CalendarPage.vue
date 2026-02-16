<template>
  <q-page class="q-pa-md bg-white column">
    <!-- Admin View: Full Table -->
    <div v-if="authStore.isAdmin" class="col column">
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
  </q-page>
</template>

<script setup lang="ts">
import ShiftMonthView from '../components/calendar/ShiftMonthView.vue';
import AdminShiftTable from '../components/calendar/AdminShiftTable.vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
</script>
