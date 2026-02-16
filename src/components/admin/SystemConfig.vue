<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between">
        <div>
          <div class="text-h6">Configurazione Sistema</div>
          <div class="text-caption text-grey">Gestisci configurazioni per ruoli diversi</div>
        </div>
        <q-btn
          color="primary"
          label="Nuova Configurazione"
          icon="add"
          size="sm"
          @click="showCreateDialog = true"
        />
      </div>
    </q-card-section>

    <!-- Configuration List -->
    <q-list separator bordered>
      <div v-if="configurations.length === 0" class="q-pa-md text-center text-grey">
        Nessuna configurazione. Clicca "Nuova Configurazione" per iniziare.
      </div>

      <q-expansion-item
        v-for="config in configurations"
        :key="config.id"
        :label="config.name"
        :caption="`Professione: ${config.profession}`"
        expand-separator
        header-class="bg-grey-1"
      >
        <template v-slot:header>
          <q-item-section avatar>
            <q-avatar
              :icon="getRoleIcon(config.profession)"
              :color="config.isActive ? 'primary' : 'grey-5'"
              text-color="white"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-bold">{{ config.name }}</q-item-label>
            <q-item-label caption>Professione: {{ config.profession }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row q-gutter-xs">
              <q-badge v-if="config.isActive" color="green" label="Attiva" />
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                size="sm"
                @click.stop="deleteConfig(config.id)"
              >
                <q-tooltip>Elimina</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </template>

        <!-- Expanded Content: Configuration Details -->
        <q-card flat bordered class="q-ma-md">
          <q-card-section class="q-gutter-md">
            <q-input
              v-model="config.name"
              label="Nome Configurazione"
              outlined
              dense
              hint="Es: Turni Infermieri Reparto A"
            />

            <q-select
              v-model="config.profession"
              :options="roleOptions"
              label="Professione Target"
              outlined
              dense
              emit-value
              map-options
            />

            <q-input
              v-model="config.spreadsheetUrl"
              label="Google Spreadsheet URL"
              outlined
              dense
              hint="Incolla qui il link completo del foglio Google"
            >
              <template v-slot:append>
                <q-btn flat round dense icon="content_paste" @click="pasteUrl(config)" />
              </template>
            </q-input>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              v-if="!config.isActive"
              flat
              label="Attiva"
              color="positive"
              icon="check_circle"
              @click="activateConfig(config.id)"
            >
              <q-tooltip>Imposta come configurazione attiva</q-tooltip>
            </q-btn>
            <q-badge v-else color="green" label="● Configurazione Attiva" class="q-mr-md" />

            <q-btn
              flat
              label="Sincronizza Ora"
              color="secondary"
              icon="sync"
              :loading="syncing && activeConfigId === config.id"
              @click="triggerSync(config)"
            />
            <q-btn
              label="Salva"
              color="primary"
              icon="save"
              :loading="saving && activeConfigId === config.id"
              @click="saveConfig(config)"
            />
          </q-card-actions>
        </q-card>
      </q-expansion-item>
    </q-list>
  </q-card>

  <!-- Create Configuration Dialog -->
  <q-dialog v-model="showCreateDialog">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Nuova Configurazione</div>
      </q-card-section>

      <q-card-section class="q-gutter-md">
        <q-input
          v-model="newConfigName"
          label="Nome Configurazione"
          outlined
          autofocus
          hint="Es: Turni Infermieri"
        />

        <q-select
          v-model="newConfigProfession"
          :options="roleOptions"
          label="Professione Target"
          outlined
          emit-value
          map-options
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annulla" v-close-popup />
        <q-btn
          label="Crea"
          color="primary"
          @click="createConfiguration"
          :disable="!newConfigName || !newConfigProfession"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { googleSheetsService, syncService } from '../../services';
import type { SystemConfiguration } from '../../types/models';

const $q = useQuasar();
const authStore = useAuthStore();

const configurations = ref<SystemConfiguration[]>([]);
const activeConfigId = ref<string | null>(null);
const currentConfig = ref<SystemConfiguration | null>(null);
const showCreateDialog = ref(false);
const newConfigName = ref('');
const newConfigProfession = ref<'Infermiere' | 'Medico' | 'OSS'>('Infermiere');
const saving = ref(false);
const syncing = ref(false);

const roleOptions = [
  { label: 'Infermiere', value: 'Infermiere' },
  { label: 'Medico', value: 'Medico' },
  { label: 'OSS', value: 'OSS' },
];

function getRoleIcon(role: string) {
  if (role === 'Medico') return 'medical_services';
  if (role === 'OSS') return 'volunteer_activism';
  return 'local_hospital'; // Infermiere
}

onMounted(async () => {
  await loadConfigurations();
});

async function loadConfigurations() {
  try {
    const snapshot = await getDocs(collection(db, 'systemConfigurations'));
    configurations.value = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as SystemConfiguration,
    );

    // Set first as active if none selected
    if (configurations.value.length > 0 && !activeConfigId.value) {
      const active = configurations.value.find((c) => c.isActive);
      activeConfigId.value = active ? active.id : configurations.value[0]!.id;
      currentConfig.value = configurations.value.find((c) => c.id === activeConfigId.value) || null;
    }
  } catch (error) {
    console.error('Error loading configurations', error);
  }
}

async function createConfiguration() {
  try {
    const newConfig: Omit<SystemConfiguration, 'id'> = {
      name: newConfigName.value,
      profession: newConfigProfession.value,
      spreadsheetUrl: '',
      createdAt: Date.now(),
      createdBy: authStore.currentUser!.uid,
      isActive: false,
    };

    const docRef = await addDoc(collection(db, 'systemConfigurations'), newConfig);
    configurations.value.push({ id: docRef.id, ...newConfig });

    $q.notify({ type: 'positive', message: 'Configurazione creata!' });
    showCreateDialog.value = false;
    newConfigName.value = '';
    newConfigProfession.value = 'Infermiere';
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: 'Errore durante la creazione' });
  }
}

async function saveConfig(config: SystemConfiguration) {
  if (!config) return;
  saving.value = true;
  activeConfigId.value = config.id; // Track which config is being saved
  try {
    const configRef = doc(db, 'systemConfigurations', config.id);
    await updateDoc(configRef, {
      name: config.name,
      profession: config.profession,
      spreadsheetUrl: config.spreadsheetUrl,
    });

    // Find and update in local array
    const index = configurations.value.findIndex((c) => c.id === config.id);
    if (index !== -1) {
      configurations.value[index] = { ...config };
    }

    $q.notify({ type: 'positive', message: 'Configurazione salvata!' });
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: 'Errore durante il salvataggio' });
  } finally {
    saving.value = false;
    activeConfigId.value = null;
  }
}

async function activateConfig(configId: string) {
  try {
    // Deactivate all configs
    for (const config of configurations.value) {
      if (config.isActive && config.id !== configId) {
        const configRef = doc(db, 'systemConfigurations', config.id);
        await updateDoc(configRef, { isActive: false });
        config.isActive = false;
      }
    }

    // Activate selected config
    const configRef = doc(db, 'systemConfigurations', configId);
    await updateDoc(configRef, { isActive: true });

    const configToActivate = configurations.value.find((c) => c.id === configId);
    if (configToActivate) {
      configToActivate.isActive = true;
    }

    $q.notify({ type: 'positive', message: 'Configurazione attivata!' });
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: "Errore durante l'attivazione" });
  }
}

function deleteConfig(configId: string) {
  const config = configurations.value.find((c) => c.id === configId);
  if (!config) return;

  $q.dialog({
    title: 'Conferma Eliminazione',
    message: `Eliminare la configurazione "${config.name}"?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await deleteDoc(doc(db, 'systemConfigurations', configId));

        // Remove from local array
        configurations.value = configurations.value.filter((c) => c.id !== configId);

        $q.notify({ type: 'info', message: 'Configurazione eliminata' });
      } catch (error) {
        console.error(error);
        $q.notify({ type: 'negative', message: "Errore durante l'eliminazione" });
      }
    })();
  });
}

async function triggerSync(config: SystemConfiguration) {
  if (!config?.spreadsheetUrl) {
    $q.notify({ type: 'warning', message: 'Imposta prima un URL del foglio Google' });
    return;
  }

  syncing.value = true;
  activeConfigId.value = config.id; // Track which config is being synced
  try {
    // Update service with current config URL
    googleSheetsService.updateSpreadsheetUrl(config.spreadsheetUrl);
    await syncService.syncOperatorsFromSheets(config.id);
    $q.notify({ type: 'positive', message: 'Sincronizzazione completata!' });
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: 'Errore durante la sincronizzazione' });
  } finally {
    syncing.value = false;
    activeConfigId.value = null;
  }
}

async function pasteUrl(config: SystemConfiguration) {
  try {
    const text = await navigator.clipboard.readText();
    if (config) {
      config.spreadsheetUrl = text;
    }
  } catch {
    $q.notify({ type: 'warning', message: 'Impossibile incollare dagli appunti' });
  }
}
</script>
