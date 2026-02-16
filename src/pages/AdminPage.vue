<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="text-h5 q-mb-md text-weight-bold text-primary">Amministrazione</div>

    <div class="row q-col-gutter-md">
      <div class="col-12">
        <SystemConfig />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import SystemConfig from '../components/admin/SystemConfig.vue';
</script>
