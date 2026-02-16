<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">Configurazione Sistema</div>
      <div class="text-caption text-grey">Gestisci il collegamento con Google Sheets</div>
    </q-card-section>

    <q-card-section class="q-gutter-md">
      <q-input
        v-model="spreadsheetUrl"
        label="Google Spreadsheet URL"
        outlined
        dense
        hint="Incolla qui il link completo del foglio Google"
      >
        <template v-slot:append>
          <q-btn flat round dense icon="content_paste" @click="pasteUrl" />
        </template>
      </q-input>
    </q-card-section>

    <q-card-actions align="right">
      <q-btn
        flat
        label="Sincronizza Ora"
        color="secondary"
        icon="sync"
        :loading="syncing"
        @click="triggerSync"
      />
      <q-btn
        label="Salva Configurazione"
        color="primary"
        icon="save"
        :loading="saving"
        @click="saveConfig"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { googleSheetsService, syncService } from '../../services';

const $q = useQuasar();
const spreadsheetUrl = ref('');
const saving = ref(false);
const syncing = ref(false);

onMounted(async () => {
  // Load current config
  await googleSheetsService.loadConfig();
  spreadsheetUrl.value = googleSheetsService.getCurrentUrl();
});

async function pasteUrl() {
  try {
    const text = await navigator.clipboard.readText();
    spreadsheetUrl.value = text;
  } catch {
    $q.notify({ type: 'warning', message: 'Impossibile incollare dagli appunti' });
  }
}

async function saveConfig() {
  if (!spreadsheetUrl.value) return;
  saving.value = true;
  try {
    await googleSheetsService.updateSpreadsheetUrl(spreadsheetUrl.value);
    $q.notify({ type: 'positive', message: 'Configurazione salvata con successo' });
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: 'Errore durante il salvataggio' });
  } finally {
    saving.value = false;
  }
}

async function triggerSync() {
  syncing.value = true;
  try {
    // Ensure we have the latest config loaded/saved before syncing
    await googleSheetsService.loadConfig();
    await syncService.syncOperatorsFromSheets();
    $q.notify({ type: 'positive', message: 'Sincronizzazione completata!' });
  } catch (error) {
    console.error(error);
    $q.notify({ type: 'negative', message: 'Errore durante la sincronizzazione' });
  } finally {
    syncing.value = false;
  }
}
</script>
