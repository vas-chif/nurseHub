<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <h1 class="text-h4 q-my-none">Gestione Utenti</h1>
    </div>

    <q-tabs
      v-model="activeTab"
      dense
      class="text-grey"
      active-color="primary"
      indicator-color="primary"
      align="justify"
      narrow-indicator
    >
      <q-tab name="pending" label="In Attesa" icon="hourglass_empty">
        <q-badge v-if="pendingUsers.length > 0" color="red" floating>{{
          pendingUsers.length
        }}</q-badge>
      </q-tab>
      <q-tab name="active" label="Utenti Attivi" icon="people" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated>
      <q-tab-panel name="pending">
        <q-table
          :rows="pendingUsers"
          :columns="columns"
          row-key="uid"
          :loading="loading"
          no-data-label="Nessun utente in attesa"
        >
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                color="positive"
                icon="check"
                label="Approva"
                size="sm"
                @click="openApprovalDialog(props.row)"
                :loading="processingId === props.row.uid"
              />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <q-tab-panel name="active">
        <q-table :rows="activeUsers" :columns="columns" row-key="uid" :loading="loading" filter="">
          <template v-slot:body-cell-role="props">
            <q-td :props="props">
              <div class="row items-center justify-center q-gutter-x-sm">
                <q-chip
                  :color="props.row.role === 'admin' ? 'negative' : 'primary'"
                  text-color="white"
                  size="sm"
                >
                  {{ props.row.role }}
                </q-chip>
                <q-icon v-if="props.row.isBlocked" name="block" color="negative" size="xs">
                  <q-tooltip>Utente Bloccato</q-tooltip>
                </q-icon>
              </div>
            </q-td>
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn-dropdown size="sm" color="primary" label="Azioni">
                <q-list>
                  <q-item clickable v-close-popup @click="toggleAdminRole(props.row)">
                    <q-item-section>
                      <q-item-label>{{
                        props.row.role === 'admin' ? 'Rimuovi Admin' : 'Promuovi ad Admin'
                      }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item clickable v-close-popup @click="toggleBlockUser(props.row)">
                    <q-item-section avatar>
                      <q-icon
                        :name="props.row.isBlocked ? 'lock_open' : 'block'"
                        :color="props.row.isBlocked ? 'positive' : 'negative'"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-negative">{{
                        props.row.isBlocked ? 'Sblocca Utente' : 'Blocca Utente'
                      }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>
    <q-dialog v-model="approvalDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Approva Utente</div>
          <div class="text-caption">
            Seleziona la configurazione e l'operatore da associare a
            <strong>{{ selectedUser?.firstName }} {{ selectedUser?.lastName }}</strong>
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-y-md">
          <q-select
            v-model="selectedConfig"
            :options="configStore.allConfigs"
            option-label="name"
            label="Configurazione / Reparto"
            outlined
            emit-value
            map-options
            @update:model-value="loadOperatorsForConfig"
          />

          <q-select
            v-model="selectedOperator"
            :options="availableOperators"
            option-label="name"
            option-value="id"
            label="Profilo Operatore"
            outlined
            emit-value
            map-options
            :disable="!selectedConfig"
            :loading="loadingOperators"
          >
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey"> Nessun operatore disponibile </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-banner v-if="selectedOperator" class="bg-blue-1 text-blue-10 q-mt-sm" rounded dense>
            <template v-slot:avatar>
              <q-icon name="info" color="primary" />
            </template>
            Professione assegnata: <strong>{{ selectedConfig?.profession }}</strong>
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annulla" color="grey" v-close-popup />
          <q-btn
            flat
            label="Conferma Approvazione"
            color="primary"
            :disable="!selectedConfig || !selectedOperator"
            :loading="processingId === selectedUser?.uid"
            @click="confirmApproval"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
import { userService } from '../services/UserService';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import type { User, SystemConfiguration, Operator } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();
const $q = useQuasar();
const configStore = useConfigStore();

const activeTab = ref('pending');
const loading = ref(false);
const processingId = ref<string | null>(null);
const allUsers = ref<User[]>([]);

// Approval Dialog State
const approvalDialog = ref(false);
const selectedUser = ref<User | null>(null);
const selectedConfig = ref<SystemConfiguration | null>(null);
const selectedOperator = ref<string | null>(null);
const availableOperators = ref<Operator[]>([]);
const loadingOperators = ref(false);

const columns = [
  { name: 'firstName', label: 'Nome', field: 'firstName', sortable: true, align: 'left' as const },
  { name: 'lastName', label: 'Cognome', field: 'lastName', sortable: true, align: 'left' as const },
  { name: 'email', label: 'Email', field: 'email', sortable: true, align: 'left' as const },
  {
    name: 'profession',
    label: 'Professione',
    field: 'profession',
    sortable: true,
    align: 'left' as const,
  },
  {
    name: 'dateOfBirth',
    label: 'Data di Nascita',
    field: 'dateOfBirth',
    sortable: true,
    align: 'left' as const,
  },
  {
    name: 'role',
    label: 'Ruolo di Sistema',
    field: 'role',
    sortable: true,
    align: 'center' as const,
  },
  { name: 'actions', label: 'Azioni', field: 'actions', align: 'center' as const },
];

const pendingUsers = computed(() => allUsers.value.filter((u) => u.pendingApproval));
const activeUsers = computed(() => allUsers.value.filter((u) => !u.pendingApproval));

async function loadUsers() {
  loading.value = true;
  try {
    allUsers.value = await userService.getAllUsers();
  } catch (error) {
    logger.error('Failed to load users', error);
    $q.notify({ type: 'negative', message: 'Errore nel caricamento utenti' });
  } finally {
    loading.value = false;
  }
}

// Open dialog instead of clicking approve directly
function openApprovalDialog(user: User) {
  selectedUser.value = user;
  selectedConfig.value = null;
  selectedOperator.value = null;
  availableOperators.value = [];
  approvalDialog.value = true;

  // Create a minimal config object matching SystemConfiguration interface
  // or rely on v-model to handle the selection properly.
  // We need to typecase or handle the selection event correctly.

  // Ensure configs are loaded
  if (configStore.allConfigs.length === 0) {
    void configStore.loadConfigurations();
  }
}

async function loadOperatorsForConfig(config: SystemConfiguration | null) {
  selectedOperator.value = null;
  availableOperators.value = [];

  if (!config?.id) return;

  loadingOperators.value = true;
  try {
    availableOperators.value = await operatorsService.getOperatorsByConfig(config.id);
  } catch (error) {
    logger.error('Failed to load operators', error);
    $q.notify({ type: 'negative', message: 'Errore caricamento operatori' });
  } finally {
    loadingOperators.value = false;
  }
}

async function confirmApproval() {
  if (!selectedUser.value || !selectedConfig.value?.id || !selectedOperator.value) return;

  const uid = selectedUser.value.uid;
  processingId.value = uid;
  try {
    const configId = selectedConfig.value.id;
    const opId = selectedOperator.value; // Now correctly typed as string

    await userService.approveUserWithConfig(uid, configId, opId);

    $q.notify({ type: 'positive', message: `Utente ${selectedUser.value.firstName} approvato!` });
    approvalDialog.value = false;
    await loadUsers(); // Reload list
  } catch (error) {
    logger.error('Failed to approve user', error);
    $q.notify({ type: 'negative', message: "Errore durante l'approvazione" });
  } finally {
    processingId.value = null;
  }
}

async function toggleAdminRole(user: User) {
  const newRole = user.role === 'admin' ? 'user' : 'admin';
  try {
    await userService.updateUserRole(user.uid, newRole);
    $q.notify({ type: 'positive', message: `Ruolo sistema aggiornato a ${newRole}` });
    await loadUsers();
  } catch (error) {
    logger.error('Failed to update role', error);
    $q.notify({ type: 'negative', message: 'Errore aggiornamento ruolo' });
  }
}

async function toggleBlockUser(user: User) {
  const action = user.isBlocked ? 'sbloccato' : 'bloccato';
  try {
    await userService.toggleUserBlockStatus(user.uid, !!user.isBlocked);
    $q.notify({ type: 'positive', message: `Utente ${action} con successo` });
    await loadUsers();
  } catch (error) {
    logger.error('Failed to block/unblock user', error);
    $q.notify({ type: 'negative', message: 'Errore operazione blocco' });
  }
}

onMounted(() => {
  void loadUsers();
});
</script>
