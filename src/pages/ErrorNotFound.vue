<script setup lang="ts">
/**
 * @file ErrorNotFound.vue
 * @description Generic 404 / not-found page shown by the router catch-all route.
 * @author Nurse Hub Team
 * @created 2026-01-15
 * @modified 2026-05-13
 * @notes
 * - Phase 37: Smart Redirect based on user role.
 */
import { computed } from 'vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();

const homeRoute = computed(() => {
  if (!authStore.isAuthenticated) return '/login';
  if (authStore.isAnyAdmin) return '/admin/users';
  return '/';
});
</script>

<template>
  <div class="fullscreen bg-blue text-white text-center q-pa-md flex flex-center">
    <div>
      <div style="font-size: 30vh">404</div>

      <div class="text-h2" style="opacity: 0.4">Pagina non trovata</div>

      <q-btn
        class="q-mt-xl"
        color="white"
        text-color="blue"
        unelevated
        :to="homeRoute"
        label="Torna alla Home"
        no-caps
      />
    </div>
  </div>
</template>
