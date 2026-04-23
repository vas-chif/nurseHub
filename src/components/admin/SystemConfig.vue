/**
* @file SystemConfig.vue
* @description Advanced administrative panel for managing hospital configurations and scenarios.
* @author Nurse Hub Team
* @created 2026-03-24
* @modified 2026-04-23
*/
<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useSecureLogger } from '../../utils/secureLogger';

const logger = useSecureLogger();
import { googleSheetsService, syncService } from '../../services';
import type { SystemConfiguration, ReplacementScenario, ReplacementRole } from '../../types/models';

const $q = useQuasar();
const authStore = useAuthStore();
const scenarioStore = useScenarioStore();

// Config state
const configurations = ref<SystemConfiguration[]>([]);
const activeConfigId = ref<string | null>(null);
const currentConfig = ref<SystemConfiguration | null>(null);
const showCreateDialog = ref(false);
const newConfigName = ref('');
const newConfigProfession = ref<'Infermiere' | 'Medico' | 'OSS'>('Infermiere');
const saving = ref(false);
const syncing = ref(false);

// Scenario state
const scenariosByConfig = reactive<Record<string, ReplacementScenario[]>>({});
const scenariosLoaded = reactive<Record<string, boolean>>({});
const scenariosLoading = reactive<Record<string, boolean>>({});
const showScenarioDialog = ref(false);
const editingScenario = ref<ReplacementScenario | null>(null);
const editingScenarioConfigId = ref<string | null>(null);
const editingScenarioOriginalId = ref<string | null>(null);

// Options
const roleOptions = [
  { label: 'Infermiere', value: 'Infermiere' },
  { label: 'Medico', value: 'Medico' },
  { label: 'OSS', value: 'OSS' },
];

const shiftBaseOptions = [
  { label: 'M - Mattina', value: 'M' },
  { label: 'P - Pomeriggio', value: 'P' },
  { label: 'N - Notte', value: 'N' },
  { label: 'S - Smonto', value: 'S' },
  { label: 'R - Riposo', value: 'R' },
];

const allShiftOptions = [
  ...shiftBaseOptions,
  { label: 'MP - Mattina+Pomeriggio', value: 'MP' },
  { label: 'N11 - Notte anticipata', value: 'N11' },
  { label: 'N12 - Notte prolungata', value: 'N12' },
];

function getRoleIcon(role: string) {
  if (role === 'Medico') return 'medical_services';
  if (role === 'OSS') return 'volunteer_activism';
  return 'local_hospital';
}

function getShiftColor(shift: string): string {
  const map: Record<string, string> = {
    M: 'amber-9',
    P: 'deep-orange-6',
    N: 'blue-8',
    S: 'teal-7',
    R: 'green-7',
    MP: 'purple-7',
    N11: 'indigo-6',
    N12: 'indigo-8',
  };
  return map[shift] || 'grey-7';
}

onMounted(async () => {
  await loadConfigurations();
});

async function loadConfigurations() {
  try {
    const snapshot = await getDocs(collection(db, 'systemConfigurations'));
    configurations.value = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SystemConfiguration,
    );
    if (configurations.value.length > 0 && !activeConfigId.value) {
      const active = configurations.value.find((c) => c.isActive);
      activeConfigId.value = active ? active.id : configurations.value[0]!.id;
      currentConfig.value = configurations.value.find((c) => c.id === activeConfigId.value) || null;
    }
  } catch (error) {
    logger.error('Error loading configurations', error);
  }
}

// Auto-load scenarios when a config is expanded
async function onConfigExpand(configId: string) {
  if (!scenariosLoaded[configId]) {
    await loadScenarios(configId);
  }
}

async function createConfiguration() {
  try {
    const newConfig: Omit<SystemConfiguration, 'id'> = {
      name: newConfigName.value,
      profession: newConfigProfession.value,
      spreadsheetUrl: '',
      gasWebUrl: '',
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
    logger.error('Error', error);
    $q.notify({ type: 'negative', message: 'Errore durante la creazione' });
  }
}

async function saveConfig(config: SystemConfiguration) {
  if (!config) return;
  saving.value = true;
  activeConfigId.value = config.id;
  try {
    const configRef = doc(db, 'systemConfigurations', config.id);
    await updateDoc(configRef, {
      name: config.name,
      profession: config.profession,
      spreadsheetUrl: config.spreadsheetUrl,
      gasWebUrl: config.gasWebUrl || '',
    });
    const index = configurations.value.findIndex((c) => c.id === config.id);
    if (index !== -1) configurations.value[index] = { ...config };
    $q.notify({ type: 'positive', message: 'Configurazione salvata!' });
  } catch (error) {
    logger.error('Error', error);
    $q.notify({ type: 'negative', message: 'Errore durante il salvataggio' });
  } finally {
    saving.value = false;
    activeConfigId.value = null;
  }
}

async function activateConfig(configId: string) {
  try {
    for (const config of configurations.value) {
      if (config.isActive && config.id !== configId) {
        await updateDoc(doc(db, 'systemConfigurations', config.id), { isActive: false });
        config.isActive = false;
      }
    }
    await updateDoc(doc(db, 'systemConfigurations', configId), { isActive: true });
    const c = configurations.value.find((x) => x.id === configId);
    if (c) c.isActive = true;
    $q.notify({ type: 'positive', message: 'Configurazione attivata!' });
  } catch (error) {
    logger.error('Error', error);
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
        configurations.value = configurations.value.filter((c) => c.id !== configId);
        $q.notify({ type: 'info', message: 'Configurazione eliminata' });
      } catch (error) {
        logger.error('Error', error);
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
  activeConfigId.value = config.id;
  try {
    googleSheetsService.updateSpreadsheetUrl(config.spreadsheetUrl);
    await syncService.syncOperatorsFromSheets(config.id);
    $q.notify({ type: 'positive', message: 'Sincronizzazione completata!' });
  } catch (error) {
    logger.error('Error during synchronization', error);
    $q.notify({ type: 'negative', message: 'Errore durante la sincronizzazione' });
  } finally {
    syncing.value = false;
    activeConfigId.value = null;
  }
}

async function pasteUrl(config: SystemConfiguration, type: 'spreadsheet' | 'gas') {
  try {
    const text = await navigator.clipboard.readText();
    if (config) {
      if (type === 'spreadsheet') config.spreadsheetUrl = text;
      else config.gasWebUrl = text;
    }
  } catch {
    $q.notify({ type: 'warning', message: 'Impossibile incollare dagli appunti' });
  }
}

// ===== SCENARIOS =====

async function loadScenarios(configId: string) {
  scenariosLoading[configId] = true;
  try {
    await scenarioStore.loadScenarios(configId);
    scenariosByConfig[configId] = [...scenarioStore.scenarios];
    scenariosLoaded[configId] = true;
  } catch (e) {
    logger.error('Error loading scenarios', e);
    $q.notify({ type: 'negative', message: 'Errore nel caricamento degli scenari' });
  } finally {
    scenariosLoading[configId] = false;
  }
}

function seedDefaultScenarios(configId: string) {
  $q.dialog({
    title: 'Ripristina Scenari Default',
    message: `Vuoi sovrascrivere tutti gli scenari con i 13 predefiniti approvati nel sistema?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await scenarioStore.seedDefaultScenarios(configId);
        await loadScenarios(configId); // Reload locally
        $q.notify({
          type: 'positive',
          message: `Scenari ripristinati correttamente!`,
        });
      } catch (e) {
        logger.error('Error', e);
        $q.notify({ type: 'negative', message: 'Errore durante il ripristino' });
      }
    })();
  });
}

function getScenarioGroups(configId: string) {
  const scenarios = scenariosByConfig[configId] || [];
  const order = ['M', 'P', 'N', 'S', 'R'];
  const groups: { targetShift: string; scenarios: ReplacementScenario[] }[] = [];
  const seen = new Set<string>();
  for (const s of [...scenarios].sort(
    (a, b) => order.indexOf(a.targetShift) - order.indexOf(b.targetShift),
  )) {
    if (!seen.has(s.targetShift)) {
      seen.add(s.targetShift);
      groups.push({
        targetShift: s.targetShift,
        scenarios: scenarios.filter((x) => x.targetShift === s.targetShift),
      });
    }
  }
  return groups;
}

function openNewScenarioDialog(configId: string) {
  editingScenarioConfigId.value = configId;
  editingScenarioOriginalId.value = null;
  editingScenario.value = { id: '', targetShift: 'M', label: '', roles: [] };
  showScenarioDialog.value = true;
}

function openEditScenarioDialog(configId: string, scenario: ReplacementScenario) {
  editingScenarioConfigId.value = configId;
  editingScenarioOriginalId.value = scenario.id;
  editingScenario.value = JSON.parse(JSON.stringify(scenario)) as ReplacementScenario;
  showScenarioDialog.value = true;
}

function addRoleToEditing() {
  if (!editingScenario.value) return;
  const newRole: ReplacementRole = {
    roleLabel: '',
    originalShift: 'R',
    newShift: 'M',
    incentive: '',
    startTime: '',
    endTime: '',
  };
  editingScenario.value.roles.push(newRole);
}

async function saveScenario() {
  const configId = editingScenarioConfigId.value;
  const scenario = editingScenario.value;
  if (!configId || !scenario || !scenario.id || !scenario.label) {
    $q.notify({ type: 'warning', message: 'Compila ID, turno mancante e descrizione' });
    return;
  }
  try {
    const scenarioRef = doc(
      db,
      'systemConfigurations',
      configId,
      'replacementScenarios',
      scenario.id,
    );
    await setDoc(scenarioRef, { ...scenario });
    const list = scenariosByConfig[configId] || [];
    const idx = list.findIndex((s) => s.id === scenario.id);
    if (idx !== -1) list.splice(idx, 1, { ...scenario });
    else list.push({ ...scenario });
    scenariosByConfig[configId] = [...list];
    $q.notify({ type: 'positive', message: 'Scenario salvato!' });
    showScenarioDialog.value = false;
  } catch (e) {
    logger.error('Error', e);
    $q.notify({ type: 'negative', message: 'Errore durante il salvataggio dello scenario' });
  }
}

function deleteScenario(configId: string, scenarioId: string) {
  $q.dialog({
    title: 'Elimina Scenario',
    message: `Eliminare lo scenario "${scenarioId}"?`,
    cancel: true,
  }).onOk(() => {
    void (async () => {
      try {
        await deleteDoc(
          doc(db, 'systemConfigurations', configId, 'replacementScenarios', scenarioId),
        );
        scenariosByConfig[configId] = (scenariosByConfig[configId] || []).filter(
          (s) => s.id !== scenarioId,
        );
        $q.notify({ type: 'info', message: 'Scenario eliminato' });
      } catch (e) {
        logger.error('Error deleting scenario', e);
        $q.notify({ type: 'negative', message: "Errore durante l'eliminazione" });
      }
    })();
  });
}
</script>

<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between">
        <div>
          <div class="text-h6">Configurazione Sistema</div>
          <div class="text-caption text-grey">Gestisci configurazioni per ruoli diversi</div>
        </div>
        <q-btn color="primary" label="Nuova Configurazione" icon="add" size="sm" @click="showCreateDialog = true" />
      </div>
    </q-card-section>

    <q-list separator bordered>
      <div v-if="configurations.length === 0" class="q-pa-md text-center text-grey">
        Nessuna configurazione. Clicca "Nuova Configurazione" per iniziare.
      </div>

      <q-expansion-item v-for="config in configurations" :key="config.id" expand-separator header-class="bg-grey-1"
        @show="onConfigExpand(config.id)">
        <template v-slot:header>
          <q-item-section avatar>
            <q-avatar :icon="getRoleIcon(config.profession)" :color="config.isActive ? 'primary' : 'grey-5'"
              text-color="white" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">{{ config.name }}</q-item-label>
            <q-item-label caption>Professione: {{ config.profession }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs">
              <q-badge v-if="config.isActive" color="green" label="Attiva" />
              <q-btn flat round dense icon="delete" color="negative" size="sm" @click.stop="deleteConfig(config.id)">
                <q-tooltip>Elimina</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </template>

        <!-- Config Details -->
        <q-card flat bordered class="q-ma-md">
          <q-card-section class="q-gutter-md">
            <q-input v-model="config.name" label="Nome Configurazione" outlined dense
              hint="Es: Turni Infermieri Reparto A" />
            <q-select v-model="config.profession" :options="roleOptions" label="Professione Target" outlined dense
              emit-value map-options />
            <q-input v-model="config.spreadsheetUrl" label="Google Spreadsheet URL" outlined dense
              hint="Incolla qui il link completo del foglio Google">
              <template v-slot:append>
                <q-btn flat round dense icon="content_paste" @click="pasteUrl(config, 'spreadsheet')" />
              </template>
            </q-input>

            <q-input v-model="config.gasWebUrl" label="GAS Web App URL (Script Google)" outlined dense
              hint="Incolla l'URL dell'applicazione web creato dallo script">
              <template v-slot:append>
                <q-btn flat round dense icon="content_paste" @click="pasteUrl(config, 'gas')" />
              </template>
            </q-input>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="!config.isActive" flat label="Attiva" color="positive" icon="check_circle"
              @click="activateConfig(config.id)">
              <q-tooltip>Imposta come configurazione attiva</q-tooltip>
            </q-btn>
            <q-badge v-else color="green" label="● Configurazione Attiva" class="q-mr-md" />
            <q-btn flat label="Sincronizza Ora" color="secondary" icon="sync"
              :loading="syncing && activeConfigId === config.id" @click="triggerSync(config)" />
            <q-btn label="Salva" color="primary" icon="save" :loading="saving && activeConfigId === config.id"
              @click="saveConfig(config)" />
          </q-card-actions>
        </q-card>

        <!-- Scenari di Sostituzione -->
        <q-card flat bordered class="q-ma-md q-mb-lg">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div>
                <div class="text-subtitle1 text-weight-bold">
                  <q-icon name="swap_horiz" color="primary" class="q-mr-xs" />
                  Scenari di Sostituzione
                </div>
                <div class="text-caption text-grey">Regole per la copertura dei turni scoperti</div>
              </div>
              <div class="row q-gutter-sm" v-if="scenariosLoaded[config.id]">
                <q-btn flat size="sm" icon="restore" label="Default" color="warning"
                  @click="seedDefaultScenarios(config.id)">
                  <q-tooltip>Ripristina scenari predefiniti</q-tooltip>
                </q-btn>
                <q-btn size="sm" icon="add" label="Nuovo Scenario" color="primary" unelevated
                  @click="openNewScenarioDialog(config.id)" />
              </div>
            </div>

            <!-- Loading spinner -->
            <div v-if="scenariosLoading[config.id]" class="text-center q-py-lg">
              <q-spinner color="primary" size="2em" />
              <div class="text-caption text-grey q-mt-sm">Caricamento scenari...</div>
            </div>

            <!-- Scenarios by group -->
            <div v-else-if="scenariosLoaded[config.id]">
              <div v-if="!scenariosByConfig[config.id] || scenariosByConfig[config.id]!.length === 0"
                class="text-center q-pa-lg text-grey">
                <q-icon name="inbox" size="2em" class="q-mb-sm" />
                <div class="text-body2">Nessuno scenario configurato.</div>
                <q-btn flat size="sm" color="primary" label="Carica scenari predefiniti" class="q-mt-sm"
                  @click="seedDefaultScenarios(config.id)" />
              </div>

              <div v-for="group in getScenarioGroups(config.id)" :key="group.targetShift" class="q-mb-lg">
                <div class="row items-center q-mb-sm">
                  <q-chip :color="getShiftColor(group.targetShift)" text-color="white" size="md" dense icon="schedule">
                    Mancanza Turno {{ group.targetShift }}
                  </q-chip>
                  <span class="text-caption text-grey q-ml-sm">{{ group.scenarios.length }} scenario{{
                    group.scenarios.length !== 1 ? 'i' : ''
                  }}</span>
                </div>

                <div class="q-gutter-sm">
                  <q-card v-for="scenario in group.scenarios" :key="scenario.id" flat bordered class="scenario-card">
                    <q-card-section class="q-py-sm q-px-md">
                      <div class="row items-start justify-between no-wrap">
                        <div class="col">
                          <div class="text-weight-medium">{{ scenario.label }}</div>
                          <div class="row q-gutter-xs q-mt-xs">
                            <div v-for="(role, idx) in scenario.roles" :key="idx"
                              class="role-chip row items-center q-gutter-xs">
                              <q-chip :color="getShiftColor(role.originalShift)" text-color="white" size="xs" dense>{{
                                role.originalShift }}</q-chip>
                              <q-icon name="arrow_right_alt" size="xs" color="grey-6" />
                              <q-chip :color="getShiftColor(role.newShift)" text-color="white" size="xs" dense>{{
                                role.newShift
                                }}</q-chip>
                              <span v-if="role.startTime && role.endTime" class="text-caption text-grey-7">({{
                                role.startTime
                                }}–{{ role.endTime }})</span>
                              <q-badge v-if="role.isNextDay" label="D+1" color="orange" />
                              <span v-if="idx < scenario.roles.length - 1" class="text-grey q-mx-xs">+</span>
                            </div>
                          </div>
                        </div>
                        <div class="row q-gutter-xs no-wrap">
                          <q-btn flat round dense icon="edit" size="sm" color="primary"
                            @click="openEditScenarioDialog(config.id, scenario)">
                            <q-tooltip>Modifica scenario</q-tooltip>
                          </q-btn>
                          <q-btn flat round dense icon="delete" size="sm" color="negative"
                            @click="deleteScenario(config.id, scenario.id)">
                            <q-tooltip>Elimina scenario</q-tooltip>
                          </q-btn>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>
  </q-card>

  <!-- Create Configuration Dialog -->
  <q-dialog v-model="showCreateDialog">
    <q-card style="min-width: 400px">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">Nuova Configurazione</div>
      </q-card-section>
      <q-card-section class="q-gutter-md q-pt-lg">
        <q-input v-model="newConfigName" label="Nome Configurazione" outlined autofocus hint="Es: Turni Infermieri" />
        <q-select v-model="newConfigProfession" :options="roleOptions" label="Professione Target" outlined emit-value
          map-options />
      </q-card-section>
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Annulla" v-close-popup />
        <q-btn label="Crea" color="primary" unelevated @click="createConfiguration"
          :disable="!newConfigName || !newConfigProfession" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Scenario Edit Dialog -->
  <q-dialog v-model="showScenarioDialog" persistent maximized>
    <q-card style="
        max-width: 680px;
        margin: auto;
        border-radius: 12px;
        height: fit-content;
        max-height: 95vh;
        overflow-y: auto;
      ">
      <!-- Header -->
      <q-card-section class="bg-primary text-white row items-center">
        <q-icon name="swap_horiz" size="sm" class="q-mr-sm" />
        <div class="text-h6 col">
          {{ editingScenarioOriginalId ? 'Modifica Scenario' : 'Nuovo Scenario' }}
        </div>
        <q-btn flat round dense icon="close" @click="showScenarioDialog = false" />
      </q-card-section>

      <q-card-section class="q-gutter-md q-pt-lg" v-if="editingScenario">
        <!-- ID and target shift -->
        <div class="row q-gutter-md">
          <q-input v-model="editingScenario.id" label="ID Scenario" outlined dense class="col-4"
            :disable="!!editingScenarioOriginalId" hint="Es: M1, P2, N3" />
          <q-select v-model="editingScenario.targetShift" :options="shiftBaseOptions" label="Turno Mancante" outlined
            dense emit-value map-options class="col" />
        </div>

        <q-input v-model="editingScenario.label" label="Descrizione Scenario" outlined dense
          hint="Es: 1-Copertura Singola (R ➔ M)" />

        <!-- Roles -->
        <div class="text-subtitle2 text-weight-bold row items-center justify-between q-mt-sm">
          <span><q-icon name="people" class="q-mr-xs" />Posizioni di copertura</span>
          <q-btn flat size="sm" icon="add" label="Aggiungi posizione" color="primary" @click="addRoleToEditing" />
        </div>

        <div v-if="editingScenario.roles.length === 0"
          class="text-grey text-caption text-center q-pa-md bg-grey-1 rounded-borders">
          Nessuna posizione. Premi "Aggiungi posizione" per iniziare.
        </div>

        <q-card v-for="(role, idx) in editingScenario.roles" :key="idx" bordered flat class="q-mb-sm role-edit-card">
          <q-card-section class="q-pa-md">
            <div class="row items-center justify-between q-mb-sm">
              <div class="text-caption text-weight-bold text-primary">Posizione {{ idx + 1 }}</div>
              <q-btn flat round dense size="xs" icon="close" color="negative"
                @click="editingScenario!.roles.splice(idx, 1)">
                <q-tooltip>Rimuovi posizione</q-tooltip>
              </q-btn>
            </div>

            <!-- Description -->
            <q-input v-model="role.roleLabel" label="Descrizione posizione" outlined dense class="q-mb-sm"
              placeholder="Es: Personale a riposo che copre la mattina" />

            <!-- Shift change row -->
            <div class="row q-gutter-sm items-center q-mb-sm">
              <q-select v-model="role.originalShift" :options="shiftBaseOptions" label="Da turno" outlined dense
                emit-value map-options class="col" />
              <q-icon name="arrow_forward" color="primary" />
              <q-select v-model="role.newShift" :options="allShiftOptions" label="A turno" outlined dense emit-value
                map-options class="col" />
            </div>

            <!-- Time range -->
            <div class="row q-gutter-sm items-center q-mb-sm">
              <q-input v-model="role.startTime" label="Ora inizio" outlined dense class="col" placeholder="07:00"
                mask="##:##" fill-mask>
                <template v-slot:prepend><q-icon name="schedule" /></template>
              </q-input>
              <span class="text-grey">–</span>
              <q-input v-model="role.endTime" label="Ora fine" outlined dense class="col" placeholder="14:00"
                mask="##:##" fill-mask>
                <template v-slot:prepend><q-icon name="schedule" /></template>
              </q-input>
            </div>

            <!-- Incentive -->
            <q-input v-model="role.incentive" label="Tipo incentivo / nota" outlined dense class="q-mb-sm"
              placeholder="Es: Straordinario incentivato" />

            <!-- Extra options row -->
            <div class="row q-gutter-md items-center">
              <q-select v-model="role.requiredNextShift"
                :options="[{ label: 'Nessuno', value: null }, ...shiftBaseOptions]"
                label="Turno successivo obbligatorio" outlined dense clearable emit-value map-options class="col" />
              <q-toggle v-model="role.isNextDay" label="Vale il giorno dopo" dense />
            </div>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn flat label="Annulla" @click="showScenarioDialog = false" />
        <q-btn label="Salva Scenario" color="primary" icon="save" unelevated @click="saveScenario" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>


<style scoped>
.scenario-card {
  transition: box-shadow 0.2s ease;
}

.scenario-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.role-edit-card {
  background: #f9f9f9;
  border-left: 3px solid var(--q-primary);
}

.role-chip {
  flex-wrap: nowrap;
}
</style>
