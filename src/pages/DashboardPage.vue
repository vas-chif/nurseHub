<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Dashboard</div>

    <!-- Shift Calendar -->
    <ShiftCalendar />

    <!-- Active Requests -->
    <ActiveRequestsCard />

    <!-- Quick Actions (Optional Future) -->
    <div class="q-mt-lg text-center">
      <q-btn
        outline
        color="primary"
        label="Vedi tutto il calendario"
        to="/calendar"
        class="full-width"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import ShiftCalendar from '../components/dashboard/ShiftCalendar.vue';
import ActiveRequestsCard from '../components/dashboard/ActiveRequestsCard.vue';
</script>
