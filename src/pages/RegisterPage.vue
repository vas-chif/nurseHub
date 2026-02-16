<template>
  <div class="flex flex-center bg-grey-2" style="min-height: 100vh">
    <q-card class="q-pa-md" style="width: 400px; max-width: 90vw">
      <q-card-section>
        <div class="text-h5 text-center q-mb-md">Registrati a</div>
        <div class="row justify-center">
          <q-avatar size="100px" color="primary" text-color="white">
            <q-img src="../assets/icon.png" />
          </q-avatar>
        </div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleRegister" class="q-gutter-md">
          <q-input
            v-model="formData.firstName"
            filled
            label="Nome"
            :rules="[(val) => !!val || 'Nome obbligatorio']"
          />

          <q-input
            v-model="formData.lastName"
            filled
            label="Cognome"
            :rules="[(val) => !!val || 'Cognome obbligatorio']"
          />

          <q-input
            v-model="formData.email"
            filled
            type="email"
            label="Email"
            autocomplete="email"
            :rules="[(val) => !!val || 'Email obbligatoria']"
          />

          <q-input
            v-model="formData.dateOfBirth"
            filled
            label="Data di Nascita"
            mask="####-##-##"
            placeholder="YYYY-MM-DD"
            :rules="[
              (val) => !!val || 'Data di nascita obbligatoria',
              (val) => /^\d{4}-\d{2}-\d{2}$/.test(val) || 'Formato: YYYY-MM-DD',
            ]"
          >
            <template #append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="formData.dateOfBirth" mask="YYYY-MM-DD">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="OK" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>

          <q-input
            v-model="formData.password"
            filled
            :type="isPwd ? 'password' : 'text'"
            label="Password"
            autocomplete="new-password"
            :rules="[
              (val) => !!val || 'Password obbligatoria',
              (val) => val.length >= 8 || 'Minimo 8 caratteri',
            ]"
          >
            <template #append>
              <q-icon
                :name="isPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>

          <q-input
            v-model="formData.confirmPassword"
            filled
            :type="isPwdConfirm ? 'password' : 'text'"
            label="Conferma Password"
            autocomplete="new-password"
            :rules="[
              (val) => !!val || 'Conferma password obbligatoria',
              (val) => val === formData.password || 'Le password non coincidono',
            ]"
          >
            <template #append>
              <q-icon
                :name="isPwdConfirm ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="isPwdConfirm = !isPwdConfirm"
              />
            </template>
          </q-input>

          <q-checkbox v-model="acceptTerms" color="primary">
            Accetto i <router-link to="/terms" target="_blank">Termini e Condizioni</router-link>
          </q-checkbox>

          <div v-if="errorMessage" class="text-negative">
            {{ errorMessage }}
          </div>

          <q-btn
            type="submit"
            label="Registrati"
            color="primary"
            :loading="loading"
            class="full-width"
            :disable="!acceptTerms"
          />

          <div class="text-center q-mt-md">
            <q-btn
              flat
              label="Hai già un account? Accedi"
              color="primary"
              @click="$router.push('/login')"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Email Verification Dialog -->
    <q-dialog
      v-model="showVerificationDialog"
      persistent
      transition-show="scale"
      transition-hide="scale"
    >
      <q-card class="bg-primary text-white" style="width: 300px">
        <q-card-section>
          <div class="text-h6">Verifica Email Richiesta</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          Un'email di verifica è stata inviata a <strong>{{ formData.email }}</strong
          >. <br /><br />
          Per favore controlla la tua casella di posta (inclusa la cartella Spam) e clicca sul link
          per attivare il tuo account.
        </q-card-section>

        <q-card-actions align="right" class="bg-white text-primary">
          <q-btn flat label="Continua al Login" @click="handleVerificationDismiss" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

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

    // Show verification dialog instead of notifying and redirecting immediately
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
