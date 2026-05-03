/**
 * @file RegisterPage.vue
 * @description Page for new user registration. Handles personal data collection and account creation.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized dateUtils.
 * - Forces acceptance of Terms and Conditions.
 */
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import AppDateInput from '../components/common/AppDateInput.vue';

const router = useRouter();
const authStore = useAuthStore();

const formData = ref({
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  password: '',
  confirmPassword: '',
});

const loading = ref(false);
const errorMessage = ref('');
const isPwd = ref(true);
const isPwdConfirm = ref(true);
const showVerificationDialog = ref(false);
const acceptTerms = ref(false);

async function handleRegister() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await authStore.register(
      formData.value.email,
      formData.value.password,
      formData.value.firstName,
      formData.value.lastName,
      formData.value.dateOfBirth,
    );

    showVerificationDialog.value = true;
  } catch (error) {
    errorMessage.value = (error as Error).message || 'Errore durante la registrazione';
  } finally {
    loading.value = false;
  }
}

function handleVerificationDismiss() {
  void router.push('/login');
}
</script>

<template>
  <div class="flex flex-center bg-grey-1" style="min-height: 100vh">
    <q-card flat bordered class="q-pa-lg shadow-2 rounded-borders" style="width: 450px; max-width: 95vw">
      <q-card-section class="text-center">
        <div class="row justify-center q-mb-md">
          <q-avatar size="120px" class="shadow-1">
            <q-img src="../assets/icon.png" />
          </q-avatar>
        </div>
        <div class="text-h4 text-weight-bold text-primary">Crea Account</div>
        <div class="text-subtitle2 text-grey-7">Unisciti alla piattaforma NurseHub</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleRegister" class="q-gutter-y-md">
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-input v-model="formData.firstName" filled dense label="Nome" :rules="[(val) => !!val || 'Nome obbligatorio']" />
            </div>
            <div class="col-6">
              <q-input v-model="formData.lastName" filled dense label="Cognome" :rules="[(val) => !!val || 'Cognome obbligatorio']" />
            </div>
          </div>

          <q-input v-model="formData.email" filled dense type="email" label="Email" autocomplete="email"
            :rules="[(val) => !!val || 'Email obbligatoria']" />

          <AppDateInput
            v-model="formData.dateOfBirth"
            label="Data di Nascita"
            required
          />

          <q-input v-model="formData.password" filled dense :type="isPwd ? 'password' : 'text'" label="Password"
            autocomplete="new-password" :rules="[
              (val) => !!val || 'Password obbligatoria',
              (val) => val.length >= 8 || 'Minimo 8 caratteri',
            ]">
            <template #append>
              <q-icon :name="isPwd ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="isPwd = !isPwd" />
            </template>
          </q-input>

          <q-input v-model="formData.confirmPassword" filled dense :type="isPwdConfirm ? 'password' : 'text'"
            label="Conferma Password" autocomplete="new-password" :rules="[
              (val) => !!val || 'Conferma password obbligatoria',
              (val) => val === formData.password || 'Le password non coincidono',
            ]">
            <template #append>
              <q-icon :name="isPwdConfirm ? 'visibility_off' : 'visibility'" class="cursor-pointer"
                @click="isPwdConfirm = !isPwdConfirm" />
            </template>
          </q-input>

          <q-checkbox v-model="acceptTerms" color="primary" class="text-caption">
            Accetto i <router-link to="/terms" target="_blank" class="text-primary text-weight-bold">Termini e Condizioni</router-link>
          </q-checkbox>

          <div v-if="errorMessage" class="text-negative text-caption text-center">
            {{ errorMessage }}
          </div>

          <q-btn type="submit" label="Inizia Ora" color="primary" unelevated :loading="loading" class="full-width rounded-borders q-py-sm"
            :disable="!acceptTerms" />

          <div class="text-center q-mt-md">
            <q-btn flat label="Hai già un account? Accedi" color="primary" no-caps @click="$router.push('/login')" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Email Verification Dialog -->
    <q-dialog v-model="showVerificationDialog" persistent transition-show="scale" transition-hide="scale">
      <q-card class="bg-primary text-white rounded-borders" style="width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="mark_email_unread" size="md" class="q-mr-sm" />
          <div class="text-h6">Verifica Email</div>
        </q-card-section>

        <q-card-section class="q-pa-md">
          Un'email di verifica è stata inviata a:<br>
          <div class="text-weight-bolder text-h6 q-my-sm">{{ formData.email }}</div>
          Controlla la tua casella di posta (e la cartella Spam) per attivare l'account.
        </q-card-section>

        <q-card-actions align="right" class="bg-white text-primary">
          <q-btn flat label="Vai al Login" @click="handleVerificationDismiss" class="text-weight-bold" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.rounded-borders {
  border-radius: 16px;
}
</style>
