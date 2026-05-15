/**
 * @file LoginPage.vue
 * @description Entry point for user authentication. Handles login, password recovery and biometric opt-in.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-05-15
 * @notes
 * - Integrates with Firebase Auth for secure credentials management.
 * - Handles email verification and role-based initial redirection.
 * - Includes a dialog for password reset via email.
 * - Phase 38 P6: shows biometric opt-in dialog after first successful login (native Android only).
 */
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../stores/authStore';
import { useBiometricAuth } from '../composables/useBiometricAuth';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const isPwd = ref(true);

// Phase 38 P6: Biometric opt-in
const biometric = useBiometricAuth();
const showBiometricOptIn = ref(false);

// Password Reset refs
const showResetDialog = ref(false);
const resetEmail = ref('');
const resetLoading = ref(false);

async function handleResetPassword() {
  if (!resetEmail.value) {
    $q.notify({
      color: 'negative',
      message: 'Inserisci un indirizzo email',
      icon: 'warning',
      position: 'top',
    });
    return;
  }

  resetLoading.value = true;
  try {
    await authStore.resetPassword(resetEmail.value);
    showResetDialog.value = false;
    resetEmail.value = '';
    $q.notify({
      color: 'positive',
      message: 'Email di ripristino inviata! Controlla la tua casella di posta.',
      icon: 'check_circle',
      position: 'top',
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    $q.notify({
      color: 'negative',
      message: err.message || "Errore durante l'invio della mail. Riprova.",
      icon: 'warning',
      position: 'top',
    });
  } finally {
    resetLoading.value = false;
  }
}

/** Phase 37: Role-Aware Smart Redirect (§1.10) */
function navigateAfterLogin(): void {
  if (!authStore.isVerified && !authStore.isAnyAdmin) {
    void router.push('/pending-verification');
  } else if (authStore.isAnyAdmin) {
    void router.push('/admin/users');
  } else {
    void router.push('/');
  }
}

/** Phase 38 P6: Called from opt-in dialog — navigates after user answers the dialog. */
function handleBiometricOptIn(accepted: boolean): void {
  biometric.setOptIn(accepted);
  showBiometricOptIn.value = false;
  navigateAfterLogin();
}

async function handleLogin() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await authStore.login(email.value, password.value);

    // Phase 38 P6: Show biometric opt-in once (native Android only; never asked before)
    if (Capacitor.isNativePlatform() && !biometric.hasBeenAsked()) {
      const available = await biometric.isBiometricAvailable();
      if (available) {
        showBiometricOptIn.value = true;
        return; // navigation delegated to handleBiometricOptIn()
      }
    }

    navigateAfterLogin();
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    if (err.message === 'EMAIL_NOT_VERIFIED') {
      errorMessage.value =
        'Devi verificare la tua email prima di accedere. Controlla la tua casella di posta (inclusa la cartella Spam).';
    } else if (err.code === 'auth/invalid-credential') {
      errorMessage.value = 'Email o password non validi.';
    } else {
      errorMessage.value = err.message || 'Errore durante il login';
    }
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="flex flex-center bg-grey-2" style="min-height: 100vh">
    <q-card class="q-pa-md" style="width: 400px; max-width: 90vw">
      <div class="text-h5 text-center q-mb-sm">Accedi a</div>
      <q-card-section>
        <div class="row justify-center">
          <q-avatar size="100px" color="primary" text-color="white">
            <q-img src="../assets/icon.png" />
          </q-avatar>
        </div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleLogin" class="q-gutter-md">
          <q-input v-model="email" filled type="email" label="Email" autocomplete="email"
            :rules="[(val) => !!val || 'Email obbligatoria']" />

          <q-input v-model="password" filled :type="isPwd ? 'password' : 'text'" label="Password"
            autocomplete="current-password" :rules="[(val) => !!val || 'Password obbligatoria']">
            <template #append>
              <q-icon :name="isPwd ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="isPwd = !isPwd" />
            </template>
          </q-input>

          <div v-if="errorMessage" class="text-negative">
            {{ errorMessage }}
          </div>

          <q-btn type="submit" label="Accedi" color="primary" :loading="loading" class="full-width" />

          <div class="row justify-between text-caption q-mt-md">
            <q-btn flat dense no-caps label="Password dimenticata?" color="primary" @click="showResetDialog = true" />
            <q-btn flat dense no-caps label="Non hai un account? Registrati" color="primary"
              @click="$router.push('/register')" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Phase 40: Redesigned Premium Biometric Opt-in Dialog -->
    <q-dialog v-model="showBiometricOptIn" persistent backdrop-filter="blur(10px)">
      <q-card class="glass-card q-pa-sm" style="min-width: 340px; max-width: 90vw; border-radius: 20px;">
        <q-card-section class="text-center q-pb-none">
          <q-avatar size="72px" font-size="42px" color="primary" text-color="white" icon="fingerprint" class="q-mb-md shadow-2" />
          <div class="text-h6 text-weight-bold text-primary">Accesso Biometrico</div>
        </q-card-section>

        <q-card-section class="text-center">
          <p class="text-body1 text-grey-9 q-mb-xs">
            Vuoi accedere più velocemente?
          </p>
          <p class="text-body2 text-grey-7">
            Abilita l'impronta digitale o il PIN per sbloccare NurseHub in un tocco.
          </p>
          <div class="q-mt-md q-pa-sm bg-blue-1 rounded-borders row items-center no-wrap">
            <q-icon name="info" color="primary" size="xs" class="q-mr-sm" />
            <div class="text-caption text-primary text-left">
              GDPR: Le tue credenziali rimangono sicure nel chip del telefono.
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="center" class="q-pb-md q-gutter-x-sm">
          <q-btn flat label="Più tardi" color="grey-7" no-caps class="q-px-md" @click="handleBiometricOptIn(false)" />
          <q-btn unelevated label="Sì, abilita ora" color="primary" no-caps class="q-px-lg" style="border-radius: 12px;" @click="handleBiometricOptIn(true)" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog for Password Reset -->
    <q-dialog v-model="showResetDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Recupera Password</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p class="text-body2">
            Inserisci l'indirizzo email associato al tuo account. Ti invieremo un link per
            reimpostare la tua password.
          </p>
          <q-input dense v-model="resetEmail" type="email" autofocus placeholder="La tua email..."
            @keyup.enter="handleResetPassword" />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn flat label="Invia Email" :loading="resetLoading" @click="handleResetPassword" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.08);
}
</style>
