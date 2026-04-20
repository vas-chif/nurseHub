/**
 * @file TutorialWizard.vue
 * @description Interactive visual onboarding wizard for first-time users
 * @author Nurse Hub Team
 * @created 2026-04-19
 * @modified 2026-04-19
 * @example
 * <TutorialWizard />
 * @notes
 * - Responsive: Fullscreen on mobile devices
 * - Visibility: Only shown to normal users on mobile devices
 * @dependencies
 * - src/composables/useOnboarding.ts
 * - src/stores/authStore.ts
 */

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useOnboarding } from '../composables/useOnboarding';
import { useAuthStore } from '../stores/authStore';

const $q = useQuasar();
const authStore = useAuthStore();

// Only show if user is authenticated AND is not an admin AND we are on mobile
const isEligible = computed(() => {
  return $q.platform.is.mobile && authStore.isAuthenticated && !authStore.isAdmin;
});

const uid = computed(() => (isEligible.value ? authStore.currentUser?.uid : null));
const { showTutorial, completeOnboarding, dismissTemporarily } = useOnboarding(uid);

const slide = ref(1);

const handleFinish = () => {
  completeOnboarding();
};
</script>

<template>
  <q-dialog 
    v-model="showTutorial" 
    persistent 
    maximized 
    transition-show="slide-up" 
    transition-hide="slide-down"
  >
    <q-card 
      class="column fit bg-white text-primary"
    >
      <q-carousel
        v-model="slide"
        transition-prev="slide-right"
        transition-next="slide-left"
        swipeable
        animated
        control-color="primary"
        navigation
        arrows
        padding
        class="bg-transparent fit rounded-borders"
        height="100%"
      >
        <!-- Slide 1: Benvenuto -->
        <q-carousel-slide :name="1" class="column no-wrap flex-center q-pa-xl">
          <q-avatar size="120px" class="q-mb-md" color="primary" text-color="white">
            <q-img src="../assets/icon.png" width="80px" height="80px" />
          </q-avatar>
          <div class="text-h4 text-weight-bold text-center q-mt-md text-primary">
            Benvenuto in <br/><span class="text-secondary">Nurse Hub</span>
          </div>
          <p class="text-center text-body1 q-mt-md text-grey-7">
            L'app per gestire in modo rapido e semplice i tuoi turni e le richieste di sostituzione in reparto.
          </p>
        </q-carousel-slide>

        <!-- Slide 2: Dashboard e Sincronizzazione -->
        <q-carousel-slide :name="2" class="column no-wrap flex-center q-pa-xl">
          <q-icon name="dashboard" size="100px" color="primary" class="q-mb-md" />
          <div class="text-h4 text-weight-bold text-center q-mt-md text-primary">
            La tua Dashboard
          </div>
          <p class="text-center text-body1 q-mt-md text-grey-7">
            Dalla <strong>Home</strong> puoi vedere un riepilogo rapido dei tuoi prossimi turni e premere l'icona <q-icon name="refresh" color="primary" /> per sincronizzarli in tempo reale col tabellone generale.
          </p>
        </q-carousel-slide>

        <!-- Slide 3: Richiedere un Cambio -->
        <q-carousel-slide :name="3" class="column no-wrap flex-center q-pa-xl">
          <q-icon name="swap_horiz" size="100px" color="secondary" class="q-mb-md" />
          <div class="text-h4 text-weight-bold text-center q-mt-md text-primary">
            Chiedere un Cambio
          </div>
          <p class="text-center text-body1 q-mt-md text-grey-7">
            Vai nel tab <strong>"Richieste"</strong> e compila "Cambio Turno". Indica quale turno cedi (es. Mattina) e quale desideri (es. Pomeriggio).<br/><br/>
            La richiesta rimarrà anonima per gli altri finché qualcuno non deciderà di coprirti.
          </p>
        </q-carousel-slide>

        <!-- Slide 4: Opportunità -->
        <q-carousel-slide :name="4" class="column no-wrap flex-center q-pa-xl">
          <q-icon name="handshake" size="100px" color="amber-8" class="q-mb-md" />
          <div class="text-h4 text-weight-bold text-center q-mt-md text-primary">
            Le Opportunità
          </div>
          <p class="text-center text-body1 q-mt-md text-grey-7">
            Nella tua <strong>Dashboard</strong> vedrai la sezione "Opportunità". Qui appaiono le richieste dei tuoi colleghi.<br/><br/>Se un cambio ti fa comodo, puoi accettarlo con un semplice click!
          </p>
        </q-carousel-slide>

        <!-- Slide 5: L'Approvazione -->
        <q-carousel-slide :name="5" class="column no-wrap flex-center q-pa-xl">
          <q-icon name="admin_panel_settings" size="100px" color="primary" class="q-mb-md" />
          <div class="text-h4 text-weight-bold text-center q-mt-md text-primary">
            L'Approvazione
          </div>
          <p class="text-center text-body1 q-mt-md text-grey-7">
            <strong>Attenzione:</strong> Accettare un cambio non lo rende subito ufficiale!<br/><br/>Ogni scambio deve essere approvato dall'Amministratore (Coordinatore). Troverai l'esito finale aggiornato automaticamente nel tab "Richieste".
          </p>
          <q-btn
            color="primary"
            label="Ho capito, Iniziamo!"
            size="lg"
            class="q-mt-xl full-width text-weight-bold"
            rounded
            unelevated
            @click="handleFinish"
          />
        </q-carousel-slide>

      </q-carousel>

      <!-- Bottom actions -->
      <div v-if="slide < 5" class="absolute-bottom text-center q-pb-xl full-width row justify-center q-gutter-md">
         <q-btn flat color="grey-7" label="Più tardi" @click="dismissTemporarily" />
         <q-btn flat color="secondary" label="Salta tutorial" @click="handleFinish" />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.fit {
  width: 100%;
  height: 100%;
}
</style>
