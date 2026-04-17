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
          <q-input
            v-model="email"
            filled
            type="email"
            label="Email"
            autocomplete="email"
            :rules="[(val) => !!val || 'Email obbligatoria']"
          />

          <q-input
            v-model="password"
            filled
            :type="isPwd ? 'password' : 'text'"
            label="Password"
            autocomplete="current-password"
            :rules="[(val) => !!val || 'Password obbligatoria']"
          >
            <template #append>
              <q-icon
                :name="isPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>

          <div v-if="errorMessage" class="text-negative">
            {{ errorMessage }}
          </div>

          <q-btn
            type="submit"
            label="Accedi"
            color="primary"
            :loading="loading"
            class="full-width"
          />

          <div class="row justify-between text-caption q-mt-md">
            <q-btn
              flat
              dense
              no-caps
              label="Password dimenticata?"
              color="primary"
              @click="showResetDialog = true"
            />
            <q-btn
              flat
              dense
              no-caps
              label="Non hai un account? Registrati"
              color="primary"
              @click="$router.push('/register')"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

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
          <q-input
            dense
            v-model="resetEmail"
            type="email"
            autofocus
            placeholder="La tua email..."
            @keyup.enter="handleResetPassword"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn flat label="Invia Email" :loading="resetLoading" @click="handleResetPassword" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuthStore } from '../stores/authStore';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const isPwd = ref(true);

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

async function handleLogin() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await authStore.login(email.value, password.value);

    // If login successful (email verified), check admin/operator verification
    if (!authStore.isVerified) {
      void router.push('/pending-verification');
    } else if (authStore.isAdmin) {
      void router.push('/admin/requests');
    } else {
      void router.push('/');
    }
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
