/**
 * @file RotationManager.vue
 * @description Admin component for creating and managing shift rotation groups.
 * @author Nurse Hub Team
 * @created 2026-04-29
 * @modified 2026-04-29
 * @notes
 * - Allows admins to define rotation matrices (e.g. 18-step cycle).
 * - Binds operators to the matrix rows.
 * @dependencies
 * - src/services/RotationService
 * - src/stores/configStore
 */
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useConfigStore } from '../../stores/configStore';
import { rotationService } from '../../services/RotationService';
import type { RotationGroup } from '../../types/models';
import { useQuasar } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import { doc } from 'firebase/firestore';
import { db } from '../../boot/firebase';

const logger = useSecureLogger();
const $q = useQuasar();
const configStore = useConfigStore();

const groups = ref<RotationGroup[]>([]);
const loading = ref(true);

const showDialog = ref(false);
const editMode = ref(false);

const formData = ref<RotationGroup>({
  id: '',
  configId: '',
  name: '',
  userIds: [],
  operators: [],
  isActive: true,
  currentColumnIndex: 0,
  nextChangeTimestamp: null,
  updatedAt: 0,
});

// For the UI builder
const columnsCount = ref(18);

function getNewId() {
  return doc(collection(db, 'temp')).id;
}
import { collection } from 'firebase/firestore';

async function loadGroups() {
  if (!configStore.activeConfigId) return;
  loading.value = true;
  try {
    groups.value = await rotationService.getGroups(configId.value);
  } catch (error) {
    logger.error('Failed to load groups', error);
  } finally {
    loading.value = false;
  }
}

const configId = computed(() => configStore.activeConfigId || '');

onMounted(() => {
  void loadGroups();
});

function openCreate() {
  formData.value = {
    id: getNewId(),
    configId: configId.value,
    name: 'Nuovo Gruppo Rotazione',
    userIds: [],
    operators: [],
    isActive: true,
    currentColumnIndex: 0,
    nextChangeTimestamp: null,
    updatedAt: Date.now(),
  };
  editMode.value = false;
  showDialog.value = true;
}

function openEdit(g: RotationGroup) {
  formData.value = JSON.parse(JSON.stringify(g));
  editMode.value = true;
  showDialog.value = true;
}

function addOperatorRow() {
  formData.value.operators.push({
    operatorId: '',
    operatorName: 'Nuovo Operatore',
    pattern: Array(columnsCount.value).fill('A'),
  });
}

function removeOperatorRow(index: number) {
  formData.value.operators.splice(index, 1);
}

async function saveGroup() {
  if (!formData.value.name) {
    $q.notify({ type: 'warning', message: 'Inserire un nome per il gruppo' });
    return;
  }
  
  try {
    await rotationService.saveGroup(configId.value, formData.value);
    $q.notify({ type: 'positive', message: 'Gruppo salvato con successo' });
    showDialog.value = false;
    void loadGroups();
  } catch (error) {
    logger.error('Failed to save group', error);
    $q.notify({ type: 'negative', message: 'Errore nel salvataggio' });
  }
}

function deleteGroup(g: RotationGroup) {
  $q.dialog({
    title: 'Conferma Eliminazione',
    message: `Sei sicuro di voler eliminare il gruppo ${g.name}?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await rotationService.deleteGroup(configId.value, g.id);
        $q.notify({ type: 'info', message: 'Gruppo eliminato' });
        void loadGroups();
      } catch (error) {
        logger.error('Failed to delete group', error);
        $q.notify({ type: 'negative', message: 'Errore durante eliminazione' });
      }
    })();
  });
}
</script>

<template>
  <div class="q-pa-md">
    <div class="row justify-between items-center q-mb-md">
      <div class="text-h6">Gestione Gruppi Rotazione</div>
      <q-btn color="primary" icon="add" label="Crea Gruppo" @click="openCreate" />
    </div>

    <div v-if="loading" class="q-mb-md">
      <q-card v-for="n in 3" :key="n" flat bordered class="q-mb-sm">
        <q-item>
          <q-item-section avatar><q-skeleton type="QAvatar" /></q-item-section>
          <q-item-section>
            <q-skeleton type="text" width="40%" />
            <q-skeleton type="text" width="60%" />
          </q-item-section>
          <q-item-section side><q-skeleton type="QBtn" /></q-item-section>
        </q-item>
      </q-card>
    </div>
    
    <div v-else-if="groups.length === 0" class="text-center text-grey q-pa-lg">
      Nessun gruppo di rotazione configurato.
    </div>

    <q-list v-else bordered separator class="bg-white rounded-borders">
      <q-item v-for="g in groups" :key="g.id">
        <q-item-section avatar>
          <q-icon name="sync" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ g.name }}</q-item-label>
          <q-item-label caption>{{ g.operators.length }} operatori | Colonna Attuale: {{ g.currentColumnIndex + 1 }}</q-item-label>
          <q-item-label caption>
            Stato: <q-badge :color="g.isActive ? 'positive' : 'warning'">{{ g.isActive ? 'Attivo' : 'In Pausa' }}</q-badge>
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <div class="row q-gutter-sm">
            <q-btn flat round color="primary" icon="edit" @click="openEdit(g)" />
            <q-btn flat round color="negative" icon="delete" @click="deleteGroup(g)" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Dialog Edit/Create -->
    <q-dialog v-model="showDialog" maximized transition-show="slide-up" transition-hide="slide-down">
      <q-card>
        <q-toolbar class="bg-primary text-white">
          <q-btn flat round dense icon="close" v-close-popup />
          <q-toolbar-title>{{ editMode ? 'Modifica' : 'Crea' }} Gruppo</q-toolbar-title>
          <q-btn flat label="Salva" @click="saveGroup" />
        </q-toolbar>

        <q-card-section class="q-gutter-md">
          <q-input v-model="formData.name" label="Nome Gruppo (es. Turno 4)" outlined />
          
          <div class="row items-center q-gutter-md">
            <div class="text-subtitle1">Matrice Rotazione (Colonne: {{ columnsCount }})</div>
            <q-btn size="sm" color="secondary" label="Aggiungi Operatore" icon="add" @click="addOperatorRow" />
          </div>

          <q-markup-table flat bordered class="q-mt-sm">
            <thead>
              <tr>
                <th class="text-left">Operatore</th>
                <th v-for="i in columnsCount" :key="i" class="text-center">{{ i }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(op, rowIndex) in formData.operators" :key="rowIndex">
                <td>
                  <q-input v-model="op.operatorName" dense outlined placeholder="Nome Operatore" />
                </td>
                <td v-for="i in columnsCount" :key="i" style="width: 50px">
                  <q-input v-model="op.pattern[i-1]" dense outlined input-class="text-center text-weight-bold" />
                </td>
                <td>
                  <q-btn flat round color="negative" icon="delete" size="sm" @click="removeOperatorRow(rowIndex)" />
                </td>
              </tr>
            </tbody>
          </q-markup-table>
          
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
