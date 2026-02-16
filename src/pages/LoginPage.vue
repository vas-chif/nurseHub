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

          <div class="text-center q-mt-md">
            <q-btn
              flat
              label="Non hai un account? Registrati"
              color="primary"
              @click="$router.push('/register')"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const isPwd = ref(true);

async function handleLogin() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await authStore.login(email.value, password.value);

    // If login successful (email verified), check admin/operator verification
    if (!authStore.isVerified) {
      void router.push('/pending-verification');
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
