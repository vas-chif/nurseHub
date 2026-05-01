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
import { ref, onMounted, computed, watch } from 'vue';
import { useConfigStore } from '../../stores/configStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { rotationService } from '../../services/RotationService';
import type { RotationGroup, Operator } from '../../types/models';
import { useQuasar } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import { doc } from 'firebase/firestore';
import { db } from '../../boot/firebase';

const logger = useSecureLogger();
const $q = useQuasar();
const configStore = useConfigStore();
const scheduleStore = useScheduleStore();

// Autocomplete: list of operators for the current config
const operatorOptions = ref<Operator[]>([]);
const filteredOperatorOptions = ref<Operator[]>([]);

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

// Default patterns from Google Sheets scheme
const DEFAULT_PATTERNS = [
  ['A', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'A', 'A'], // Mary
  ['A', 'A', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'B'], // Simo
  ['A', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A', 'B'], // Sara
  ['B', 'A', 'A', 'B', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'B', 'A'], // Dani
  ['B', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'A'], // Matte
  ['B', 'B', 'A', 'A', 'B', 'A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B', 'A', 'A', 'B']  // Vas
];

function getNewId() {
  return doc(collection(db, 'temp')).id;
}
import { collection } from 'firebase/firestore';

async function loadGroups() {
  if (!configStore.activeConfigId) return;
  loading.value = true;
  try {
    groups.value = await rotationService.getGroups(configId.value);
    // Load operators for autocomplete
    operatorOptions.value = await scheduleStore.loadOperators(configId.value);
    filteredOperatorOptions.value = operatorOptions.value;
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

// Watch for config change to refresh data instantly without page reload
watch(
  () => configStore.activeConfigId,
  (newId) => {
    if (newId) {
      void loadGroups();
    } else {
      groups.value = [];
    }
  }
);

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
  // Cyclic default pattern assignment (1-6, then back to 1)
  const patternIndex = formData.value.operators.length % DEFAULT_PATTERNS.length;
  const sourcePattern = DEFAULT_PATTERNS[patternIndex] || [];
  const defaultPattern = [...sourcePattern];

  formData.value.operators.push({
    operatorId: '',
    operatorName: '',
    pattern: defaultPattern,
  });
}

/**
 * Filters the operator dropdown list based on the user's search query.
 */
function filterOperatorOptions(val: string, update: (fn: () => void) => void) {
  update(() => {
    if (val === '') {
      filteredOperatorOptions.value = operatorOptions.value;
    } else {
      const needle = val.toLowerCase();
      filteredOperatorOptions.value = operatorOptions.value.filter(
        (op) => op.name.toLowerCase().includes(needle),
      );
    }
  });
}

/**
 * When an operator is selected from the dropdown, populate both
 * operatorId and operatorName on the row to avoid manual typing errors.
 */
function onOperatorSelected(rowIndex: number, selected: Operator | null) {
  if (!selected) return;
  const row = formData.value.operators[rowIndex];
  if (!row) return;
  row.operatorId = selected.id;
  row.operatorName = selected.name;
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

          <q-markup-table flat bordered class="q-mt-sm rotation-matrix-table">
            <thead>
              <tr>
                <th class="text-left" style="min-width: 160px;">Operatore</th>
                <th v-for="i in columnsCount" :key="i" class="text-center" style="width: 44px; min-width: 44px;">{{ i }}</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(op, rowIndex) in formData.operators" :key="rowIndex">
                <td style="min-width: 160px;">
                  <q-select
                    :model-value="op.operatorName"
                    :options="filteredOperatorOptions"
                    option-label="name"
                    use-input
                    input-debounce="200"
                    dense
                    outlined
                    placeholder="Cerca operatore..."
                    style="min-width: 150px;"
                    @filter="filterOperatorOptions"
                    @update:model-value="(val: Operator) => onOperatorSelected(rowIndex, val)"
                  >
                    <template v-slot:no-option>
                      <q-item>
                        <q-item-section class="text-grey">Nessun operatore trovato</q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </td>
                <td v-for="i in columnsCount" :key="i" style="width: 44px; padding: 2px 4px;">
                  <q-input
                    v-model="op.pattern[i-1]"
                    dense
                    outlined
                    input-class="text-center text-weight-bold"
                    maxlength="1"
                    style="width: 40px;"
                  />
                </td>
                <td style="width: 40px;">
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

<style scoped lang="scss">
.rotation-matrix-table {
  overflow-x: auto;
  display: block;
  white-space: nowrap;

  th, td {
    padding: 4px 6px;
    vertical-align: middle;
  }
}
</style>
