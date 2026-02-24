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

        <!-- ===== SCENARI DI SOSTITUZIONE ===== -->
        <q-card flat bordered class="q-ma-md">
          <q-card-section>
            <div class="row items-center justify-between q-mb-sm">
              <div>
                <div class="text-subtitle1 text-weight-bold">
                  <q-icon name="swap_horiz" class="q-mr-xs" />
                  Scenari di Sostituzione
                </div>
                <div class="text-caption text-grey">
                  Regole per la copertura dei turni scoperti di questa configurazione.
                </div>
              </div>
              <div class="row q-gutter-sm">
                <q-btn
                  v-if="!scenariosLoaded[config.id]"
                  flat
                  size="sm"
                  icon="download"
                  label="Carica Scenari"
                  color="secondary"
                  :loading="scenariosLoading[config.id]"
                  @click="loadScenarios(config.id)"
                />
                <template v-else>
                  <q-btn
                    flat
                    size="sm"
                    icon="restore"
                    label="Ripristina Default"
                    color="warning"
                    @click="seedDefaultScenarios(config.id)"
                  />
                  <q-btn
                    size="sm"
                    icon="add"
                    label="Nuovo Scenario"
                    color="primary"
                    @click="openNewScenarioDialog(config.id)"
                  />
                </template>
              </div>
            </div>

            <!-- Scenarios loaded: group by targetShift -->
            <div v-if="scenariosLoaded[config.id]">
              <div
                v-if="!scenariosByConfig[config.id] || scenariosByConfig[config.id]!.length === 0"
                class="text-grey text-center q-pa-md"
              >
                Nessuno scenario configurato. Premi "Ripristina Default" per caricare quelli
                standard.
              </div>

              <!-- Group by shift type -->
              <div
                v-for="group in getScenarioGroups(config.id)"
                :key="group.targetShift"
                class="q-mb-md"
              >
                <div class="text-caption text-weight-bold text-primary q-mb-xs q-pl-sm">
                  <q-chip
                    :color="getShiftColor(group.targetShift)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    Turno {{ group.targetShift }}
                  </q-chip>
                </div>

                <q-card
                  v-for="scenario in group.scenarios"
                  :key="scenario.id"
                  flat
                  bordered
                  class="q-mb-sm"
                >
                  <q-card-section class="q-py-sm">
                    <div class="row items-center justify-between">
                      <div class="col">
                        <div class="text-weight-medium text-body2">{{ scenario.label }}</div>
                        <div class="text-caption text-grey">
                          {{ scenario.roles.length }} posizione{{
                            scenario.roles.length !== 1 ? 'i' : ''
                          }}
                        </div>
                      </div>
                      <div class="row q-gutter-xs">
                        <q-btn
                          flat
                          round
                          dense
                          icon="edit"
                          size="sm"
                          color="primary"
                          @click="openEditScenarioDialog(config.id, scenario)"
                        />
                        <q-btn
                          flat
                          round
                          dense
                          icon="delete"
                          size="sm"
                          color="negative"
                          @click="deleteScenario(config.id, scenario.id)"
                        />
                      </div>
                    </div>

                    <!-- Roles inside the scenario -->
                    <div class="q-mt-xs q-pl-md">
                      <div
                        v-for="(role, idx) in scenario.roles"
                        :key="idx"
                        class="row items-center q-gutter-xs text-caption"
                      >
                        <q-chip size="xs" dense>{{ role.originalShift }}</q-chip>
                        <q-icon name="arrow_forward" size="xs" />
                        <q-chip size="xs" dense color="primary" text-color="white">{{
                          role.newShift
                        }}</q-chip>
                        <span class="text-grey">— {{ role.incentive }}</span>
                        <q-badge v-if="role.isNextDay" color="orange" label="Giorno dopo" />
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </div>
            <div v-else class="text-grey text-caption text-center q-pa-sm">
              Premi "Carica Scenari" per visualizzare e gestire gli scenari di questa
              configurazione.
            </div>
          </q-card-section>
        </q-card>
        <!-- ===== FINE SCENARI ===== -->
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

  <!-- Scenario Create/Edit Dialog -->
  <q-dialog v-model="showScenarioDialog" persistent>
    <q-card style="min-width: 500px; max-width: 700px; width: 90vw">
      <q-card-section>
        <div class="text-h6">
          {{ editingScenario?.id ? 'Modifica Scenario' : 'Nuovo Scenario' }}
        </div>
      </q-card-section>

      <q-card-section class="q-gutter-md" v-if="editingScenario">
        <div class="row q-gutter-md">
          <q-input
            v-model="editingScenario.id"
            label="ID Scenario (es: M1, P2, N1)"
            outlined
            dense
            class="col"
            :disable="!!editingScenarioOriginalId"
            hint="Univoco per tipo turno"
          />
          <q-select
            v-model="editingScenario.targetShift"
            :options="shiftOptions"
            label="Turno Mancante"
            outlined
            dense
            emit-value
            map-options
            class="col-4"
          />
        </div>

        <q-input
          v-model="editingScenario.label"
          label="Etichetta Scenario"
          outlined
          dense
          hint="Es: 1-Copertura Singola (R ➔ M)"
        />

        <!-- Roles -->
        <div class="text-subtitle2 text-weight-bold q-mt-sm">Posizioni / Ruoli</div>

        <q-card
          v-for="(role, idx) in editingScenario.roles"
          :key="idx"
          flat
          bordered
          class="q-pa-sm q-mb-sm"
        >
          <div class="row q-gutter-sm items-start">
            <q-select
              v-model="role.originalShift"
              :options="shiftOptions"
              label="Turno Originale"
              outlined
              dense
              emit-value
              map-options
              class="col-3"
            />
            <q-icon name="arrow_forward" class="q-mt-md" />
            <q-select
              v-model="role.newShift"
              :options="allShiftOptions"
              label="Turno Nuovo"
              outlined
              dense
              emit-value
              map-options
              class="col-3"
            />
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="negative"
              class="q-mt-xs"
              @click="editingScenario!.roles.splice(idx, 1)"
            />
          </div>
          <div class="row q-gutter-sm items-center q-mt-sm">
            <q-input
              v-model="role.roleLabel"
              label="Descrizione posizione"
              outlined
              dense
              class="col"
            />
          </div>
          <div class="row q-gutter-sm items-center q-mt-sm">
            <q-input v-model="role.incentive" label="Incentivo / Nota" outlined dense class="col" />
            <q-select
              v-model="role.requiredNextShift"
              :options="[{ label: '(Nessuno)', value: null }, ...shiftOptions]"
              label="Turno successivo richiesto"
              outlined
              dense
              clearable
              emit-value
              map-options
              class="col-4"
            />
          </div>
          <div class="row q-mt-sm">
            <q-toggle v-model="role.isNextDay" label="Valido il giorno dopo" dense />
          </div>
        </q-card>

        <q-btn
          flat
          icon="add"
          label="Aggiungi Posizione"
          color="primary"
          size="sm"
          @click="addRoleToEditing"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annulla" @click="showScenarioDialog = false" />
        <q-btn label="Salva" color="primary" icon="save" @click="saveScenario" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { googleSheetsService, syncService } from '../../services';
import { REPLACEMENT_SCENARIOS } from '../../config/sheets';
import type { SystemConfiguration, ReplacementScenario, ReplacementRole } from '../../types/models';

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

// --- Scenario State ---
const scenariosByConfig = reactive<Record<string, ReplacementScenario[]>>({});
const scenariosLoaded = reactive<Record<string, boolean>>({});
const scenariosLoading = reactive<Record<string, boolean>>({});

const showScenarioDialog = ref(false);
const editingScenario = ref<ReplacementScenario | null>(null);
const editingScenarioConfigId = ref<string | null>(null);
const editingScenarioOriginalId = ref<string | null>(null); // null = new scenario

const roleOptions = [
  { label: 'Infermiere', value: 'Infermiere' },
  { label: 'Medico', value: 'Medico' },
  { label: 'OSS', value: 'OSS' },
];

const shiftOptions = [
  { label: 'M (Mattina)', value: 'M' },
  { label: 'P (Pomeriggio)', value: 'P' },
  { label: 'N (Notte)', value: 'N' },
  { label: 'S (Smonto)', value: 'S' },
  { label: 'R (Riposo)', value: 'R' },
];

const allShiftOptions = [
  ...shiftOptions,
  { label: 'MP (Mattina+Pomeriggio)', value: 'MP' },
  { label: 'N11 (Notte anticipata)', value: 'N11' },
  { label: 'N12 (Notte prolungata)', value: 'N12' },
];

function getRoleIcon(role: string) {
  if (role === 'Medico') return 'medical_services';
  if (role === 'OSS') return 'volunteer_activism';
  return 'local_hospital';
}

function getShiftColor(shift: string) {
  if (shift === 'M') return 'amber-9';
  if (shift === 'P') return 'deep-orange-6';
  if (shift === 'N') return 'blue-8';
  return 'grey-7';
}

onMounted(async () => {
  await loadConfigurations();
});

async function loadConfigurations() {
  try {
    const snapshot = await getDocs(collection(db, 'systemConfigurations'));
    configurations.value = snapshot.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as SystemConfiguration,
    );

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
  activeConfigId.value = config.id;
  try {
    const configRef = doc(db, 'systemConfigurations', config.id);
    await updateDoc(configRef, {
      name: config.name,
      profession: config.profession,
      spreadsheetUrl: config.spreadsheetUrl,
    });

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
    for (const config of configurations.value) {
      if (config.isActive && config.id !== configId) {
        const configRef = doc(db, 'systemConfigurations', config.id);
        await updateDoc(configRef, { isActive: false });
        config.isActive = false;
      }
    }

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
  activeConfigId.value = config.id;
  try {
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

// ===== SCENARIO MANAGEMENT =====

async function loadScenarios(configId: string) {
  scenariosLoading[configId] = true;
  try {
    const colRef = collection(db, 'systemConfigurations', configId, 'replacementScenarios');
    const snap = await getDocs(colRef);
    scenariosByConfig[configId] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as ReplacementScenario,
    );
    scenariosLoaded[configId] = true;
  } catch (e) {
    console.error('Error loading scenarios', e);
    $q.notify({ type: 'negative', message: 'Errore nel caricamento degli scenari' });
  } finally {
    scenariosLoading[configId] = false;
  }
}

function seedDefaultScenarios(configId: string) {
  $q.dialog({
    title: 'Ripristina Scenari Default',
    message:
      'Questo sovrascriverà TUTTI gli scenari esistenti con quelli hardcodati. Vuoi continuare?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        for (const scenario of REPLACEMENT_SCENARIOS) {
          const scenarioRef = doc(
            db,
            'systemConfigurations',
            configId,
            'replacementScenarios',
            scenario.id,
          );
          await setDoc(scenarioRef, scenario);
        }
        await loadScenarios(configId);
        $q.notify({
          type: 'positive',
          message: `${REPLACEMENT_SCENARIOS.length} scenari predefiniti caricati!`,
        });
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: 'Errore durante il ripristino' });
      }
    })();
  });
}

function getScenarioGroups(configId: string) {
  const scenarios = scenariosByConfig[configId] || [];
  const groups: { targetShift: string; scenarios: ReplacementScenario[] }[] = [];
  const seen = new Set<string>();

  for (const s of scenarios) {
    if (!seen.has(s.targetShift)) {
      seen.add(s.targetShift);
      groups.push({
        targetShift: s.targetShift,
        scenarios: scenarios.filter((x) => x.targetShift === s.targetShift),
      });
    }
  }

  return groups.sort((a, b) => {
    const order = ['M', 'P', 'N'];
    return order.indexOf(a.targetShift) - order.indexOf(b.targetShift);
  });
}

function openNewScenarioDialog(configId: string) {
  editingScenarioConfigId.value = configId;
  editingScenarioOriginalId.value = null;
  editingScenario.value = {
    id: '',
    targetShift: 'M',
    label: '',
    roles: [],
  };
  showScenarioDialog.value = true;
}

function openEditScenarioDialog(configId: string, scenario: ReplacementScenario) {
  editingScenarioConfigId.value = configId;
  editingScenarioOriginalId.value = scenario.id;
  editingScenario.value = JSON.parse(JSON.stringify(scenario)) as ReplacementScenario; // deep copy
  showScenarioDialog.value = true;
}

function addRoleToEditing() {
  if (!editingScenario.value) return;
  const newRole: ReplacementRole = {
    roleLabel: '',
    originalShift: 'R',
    newShift: 'M',
    incentive: '',
  };
  editingScenario.value.roles.push(newRole);
}

async function saveScenario() {
  const configId = editingScenarioConfigId.value;
  const scenario = editingScenario.value;
  if (!configId || !scenario || !scenario.id || !scenario.label) {
    $q.notify({ type: 'warning', message: 'Compila almeno ID, turno e etichetta' });
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

    // Update local state
    const list = scenariosByConfig[configId] || [];
    const idx = list.findIndex((s) => s.id === scenario.id);
    if (idx !== -1) {
      list[idx] = { ...scenario };
    } else {
      list.push({ ...scenario });
    }
    scenariosByConfig[configId] = [...list];

    $q.notify({ type: 'positive', message: 'Scenario salvato!' });
    showScenarioDialog.value = false;
  } catch (e) {
    console.error(e);
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
        console.error(e);
        $q.notify({ type: 'negative', message: "Errore durante l'eliminazione" });
      }
    })();
  });
}
</script>
