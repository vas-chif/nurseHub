<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Amministrazione</div>

    <div class="row q-col-gutter-md">
      <!-- Left Col: Creation -->
      <div class="col-12 col-md-6">
        <CreateRequestForm />
      </div>

      <!-- Right Col: Monitoring & Config -->
      <div class="col-12 col-md-6 q-gutter-y-md">
        <SystemConfig />
        <OfferMonitor />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import CreateRequestForm from '../components/admin/CreateRequestForm.vue';
import OfferMonitor from '../components/admin/OfferMonitor.vue';
import SystemConfig from '../components/admin/SystemConfig.vue';
</script>
