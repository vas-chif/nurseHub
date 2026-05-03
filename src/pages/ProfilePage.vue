/**
 * @file ProfilePage.vue
 * @description User profile management page. Allows viewing and editing personal data and avatar.
 * @author Nurse Hub Team
 * @created 2026-03-02
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized dateUtils.
 * - Handles image resizing (canvas) for avatar uploads to minimize Firestore storage.
 */
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { userService } from '../services/UserService';
import { useQuasar } from 'quasar';
import { useSecureLogger } from '../utils/secureLogger';
import { useRoute } from 'vue-router';
import AppDateInput from '../components/common/AppDateInput.vue';

const authStore = useAuthStore();
const $q = useQuasar();
const logger = useSecureLogger();
const route = useRoute();

const user = computed(() => authStore.currentUser);
const avatarUrl = computed(() => user.value?.avatarUrl);
const fileInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);

const isEditing = computed(() => route.query.mode === 'edit');

const formData = ref({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  dateOfBirth: '',
});

// Initialize form data when user loads
watch(
  user,
  (newUser) => {
    if (newUser) {
      formData.value = {
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        phoneNumber: newUser.phoneNumber || '',
        email: newUser.email || '',
        dateOfBirth: newUser.dateOfBirth || '',
      };
    }
  },
  { immediate: true },
);

async function saveProfile() {
  if (!user.value) return;
  saving.value = true;
  try {
    await userService.updateUserProfile(user.value.uid, {
      firstName: formData.value.firstName,
      lastName: formData.value.lastName,
      phoneNumber: formData.value.phoneNumber,
      dateOfBirth: formData.value.dateOfBirth,
    });

    // Update local store
    if (authStore.currentUser) {
      authStore.currentUser.firstName = formData.value.firstName;
      authStore.currentUser.lastName = formData.value.lastName;
      authStore.currentUser.phoneNumber = formData.value.phoneNumber;
      authStore.currentUser.dateOfBirth = formData.value.dateOfBirth;
    }

    $q.notify({ type: 'positive', message: 'Profilo aggiornato con successo' });
  } catch (error) {
    logger.error('Error updating profile', error);
    $q.notify({ type: 'negative', message: "Errore durante l'aggiornamento" });
  } finally {
    saving.value = false;
  }
}

function triggerFilePicker() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    $q.notify({ type: 'negative', message: "L'immagine è troppo grande (Max 2MB)" });
    return;
  }

  try {
    const resizedBase64 = await resizeImage(file);
    if (!user.value) return;

    await userService.updateUserProfile(user.value.uid, { avatarUrl: resizedBase64 });

    if (authStore.currentUser) {
      authStore.currentUser.avatarUrl = resizedBase64;
    }

    $q.notify({ type: 'positive', message: 'Foto profilo aggiornata!' });
  } catch (error) {
    logger.error('Error uploading avatar', error);
    $q.notify({ type: 'negative', message: 'Errore durante il caricamento' });
  }
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
</script>

<template>
  <q-page class="q-pa-md bg-grey-1">
    <div class="row items-center q-mb-md">
      <h1 class="text-h4 q-my-none text-weight-bold text-primary">Profilo Utente</h1>
    </div>

    <div class="row justify-center q-mb-lg">
      <div class="column items-center">
        <q-avatar size="120px" class="q-mb-md shadow-3 border-white">
          <q-img :src="avatarUrl || 'https://cdn.quasar.dev/img/boy-avatar.png'" />
          <q-btn round color="primary" icon="edit" size="sm" class="absolute-bottom-right" style="bottom: 4px; right: 4px"
            @click="triggerFilePicker" v-if="isEditing" />
        </q-avatar>
        <div class="text-h6 text-weight-bold">{{ user?.firstName }} {{ user?.lastName }}</div>
        <div class="text-caption text-grey-7">{{ user?.email }}</div>
      </div>
      <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="handleFileChange" />
    </div>

    <q-card flat bordered class="max-width-600 q-mx-auto rounded-borders shadow-1">
      <q-card-section class="q-pa-md">
        <div class="text-h6 q-mb-md text-primary">Dati Personali</div>
        <q-form @submit="saveProfile" class="q-gutter-y-md">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input v-model="formData.firstName" label="Nome" filled dense :readonly="!isEditing" />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-model="formData.lastName" label="Cognome" filled dense :readonly="!isEditing" />
            </div>
          </div>

          <q-input v-model="formData.phoneNumber" label="Numero di Telefono" filled dense mask="### ### ####"
            fill-mask hint="Formato: 333 123 4567" :readonly="!isEditing" />
          
          <q-input v-model="formData.email" label="Email" filled dense readonly
            hint="L'email non può essere modificata" />

          <AppDateInput 
            v-model="formData.dateOfBirth" 
            label="Data di Nascita" 
            :readonly="!isEditing"
            :disable="!isEditing"
          />

          <q-separator class="q-my-md" />

          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input :model-value="user?.role" label="Ruolo di Sistema" filled dense readonly class="text-uppercase" />
            </div>
            <div class="col-12 col-sm-6">
              <q-input v-if="user?.profession" :model-value="user?.profession" label="Professione" filled dense readonly />
            </div>
          </div>

          <div class="row justify-end q-mt-xl" v-if="isEditing">
            <q-btn label="Salva Modifiche" type="submit" color="primary" unelevated :loading="saving" class="rounded-borders q-px-lg" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped>
.max-width-600 {
  max-width: 600px;
}
.rounded-borders {
  border-radius: 16px;
}
.border-white {
  border: 4px solid white;
}
</style>
