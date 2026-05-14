/**
 * @file RegisterPage.vue
 * @description Page for new user registration. Handles personal data collection and account creation.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-05-14
 * @notes
 * - Standardized using AppDateInput and centralized dateUtils.
 * - Forces acceptance of Terms and Conditions.
 * - Fase 8: optional reparto selection at registration (configId pre-populated).
 */
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import AppDateInput from '../components/common/AppDateInput.vue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { SystemConfiguration } from '../types/models';

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

const selectedGroup = ref<string | null>(null);
const selectedProfession = ref<string | null>(null);
const configs = ref<SystemConfiguration[]>([]);
const loadingConfigs = ref(false);

// Folder Logic (Fase 37): Compute unique groups and roles
const groupOptions = computed(() => {
  const groups = new Set<string>();
  configs.value.forEach(c => { if (c.group) groups.add(c.group); });
  return Array.from(groups).sort();
});

const professionOptions = computed(() => {
  if (!selectedGroup.value) return [];
  const roles = configs.value
    .filter(c => c.group === selectedGroup.value)
    .map(c => c.profession);
  return Array.from(new Set(roles)).sort();
});

// Phase 37: fallback for legacy configs without group
const hasGroupedConfigs = computed<boolean>(() => groupOptions.value.length > 0);
const selectedConfigId = ref<string | null>(null); // flat fallback when no groups exist
watch(selectedGroup, () => { selectedProfession.value = null; }); // reset profession cascade

const loading = ref(false);
const errorMessage = ref('');
const isPwd = ref(true);
const isPwdConfirm = ref(true);
const showVerificationDialog = ref(false);
const acceptTerms = ref(false);

onMounted(async () => {
  loadingConfigs.value = true;
  try {
    const snapshot = await getDocs(collection(db, 'systemConfigurations'));
    configs.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SystemConfiguration));
  } catch {
    // Fallback: the admin will assign the config later
  } finally {
    loadingConfigs.value = false;
  }
});

async function handleRegister() {
  loading.value = true;
  errorMessage.value = '';

  try {
    // Phase 37: resolve configId — 2-step (grouped) or flat fallback (legacy no-group configs)
    let configId: string | null = null;
    if (hasGroupedConfigs.value) {
      const match = configs.value.find(
        (c) => c.group === selectedGroup.value && c.profession === selectedProfession.value,
      );
      configId = match?.id ?? null;
    } else {
      configId = selectedConfigId.value;
    }

    await authStore.register(
      formData.value.email,
      formData.value.password,
      formData.value.firstName,
      formData.value.lastName,
      formData.value.dateOfBirth,
      configId,
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

          <!-- Folder Logic (Fase 37): Reparto + Ruolo -->
          <div v-if="loadingConfigs" class="q-gutter-y-sm">
            <q-skeleton type="QInput" height="40px" />
            <q-skeleton type="QInput" height="40px" />
          </div>
          <!-- Cartelle (Phase 37): 2-step when groups configured -->
          <div v-else-if="hasGroupedConfigs" class="q-gutter-y-sm">
            <!-- 1. Selezione del Reparto (Il Gruppo/Cartella) -->
            <q-select
              v-model="selectedGroup"
              :options="groupOptions"
              clearable
              filled
              dense
              label="Seleziona Reparto"
              hint="Esempio: Terapia Intensiva, Area Medica..."
              :rules="[(val) => !!val || 'Seleziona un reparto']"
            >
              <template #prepend>
                <q-icon name="folder" color="primary" />
              </template>
            </q-select>

            <!-- 2. Selezione del Ruolo (La Professione) -->
            <q-select
              v-model="selectedProfession"
              :options="professionOptions"
              :disable="!selectedGroup"
              filled
              dense
              label="Il tuo Ruolo"
              hint="Infermieri, Medico, OSS..."
              :rules="[(val) => !!val || 'Seleziona il tuo ruolo']"
            >
              <template #prepend>
                <q-icon
                  :name="selectedProfession === 'Medico' ? 'medical_services' : (selectedProfession === 'OSS' ? 'volunteer_activism' : 'local_hospital')"
                  color="primary"
                />
              </template>
            </q-select>
          </div>
          <!-- Fallback: flat list when no groups are configured (legacy configs) -->
          <div v-else class="q-gutter-y-sm">
            <q-select
              v-model="selectedConfigId"
              :options="configs"
              option-value="id"
              option-label="name"
              emit-value
              map-options
              filled
              dense
              label="Seleziona Reparto (opzionale)"
              clearable
              hint="L'amministratore può assegnarlo in un secondo momento"
            >
              <template #prepend>
                <q-icon name="apartment" color="grey-6" />
              </template>
            </q-select>
          </div>

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
