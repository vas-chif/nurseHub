<script setup lang="ts">
/**
 * @file AdminUsersPage.vue
 * @description Admin page for managing user accounts, approvals, and role assignments.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-04-25
 */
import { ref, onMounted, computed } from 'vue';
import { useQuasar, date as dateUtil } from 'quasar';
import { userService } from '../services/UserService';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import type { User, SystemConfiguration, Operator } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';
import RotationManager from '../components/admin/RotationManager.vue';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useRoute } from 'vue-router';
import { watch, reactive } from 'vue';
import type { UserRole, IUserPermissions } from '../types/auth';

const logger = useSecureLogger();
const $q = useQuasar();
const configStore = useConfigStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const route = useRoute();

const activeTab = ref(uiStore.getActiveTab(route.path, 'pending'));

watch(activeTab, (newVal) => {
  uiStore.setActiveTab(route.path, newVal);
});
const loading = ref(false);
const processingId = ref<string | null>(null);
const allUsers = ref<User[]>([]);

// Approval Dialog State
const approvalDialog = ref(false);
const selectedUser = ref<User | null>(null);
const selectedConfig = ref<SystemConfiguration | null>(null);
const selectedOperator = ref<string | null>(null);

// Role Dialog State
const roleDialog = ref(false);
const editRole = ref<UserRole>('user');
const editManagedConfigs = ref<string[]>([]);
const editPermissions = reactive<IUserPermissions>({
  manageAdmins: false,
  manageSystem: false,
  viewAuditLogs: false
});
const availableOperators = ref<Operator[]>([]);
const loadingOperators = ref(false);

// Role Options Hierarchical Logic
const roleOptions = computed(() => {
  const options = ['user', 'admin'];
  if (!selectedUser.value) return options;

  // Rule: Must be a SuperAdmin to promote/manage other SuperAdmins
  // Rule: Direct promotion from User to SuperAdmin is forbidden (must be Admin first)
  if (authStore.isSuperAdmin && selectedUser.value.role !== 'user') {
    options.push('superAdmin');
  }

  // If editing another superAdmin, allow keeping it
  if (authStore.isSuperAdmin && selectedUser.value.role === 'superAdmin' && !options.includes('superAdmin')) {
    options.push('superAdmin');
  }

  return options;
});

// Filters
const searchQuery = ref('');
const filterProfession = ref('Tutti');
const filterRole = ref('Tutti');
const filterConfigId = ref('Tutti');

const departmentOptions = computed(() => {
  const allowedConfigs = authStore.isSuperAdmin
    ? configStore.allConfigs
    : configStore.allConfigs.filter(c => authStore.managedConfigIds.includes(c.id));
  return [{ id: 'Tutti', name: 'Tutti i Reparti' }, ...allowedConfigs];
});

function getConfigName(id: string | undefined) {
  if (!id) return '-';
  const config = configStore.allConfigs.find(c => c.id === id);
  return config ? config.name : id;
}

function formatDate(val: string | undefined) {
  if (!val) return '-';
  // Standard format in our DB is YYYY-MM-DD
  return dateUtil.formatDate(val, 'DD/MM/YYYY');
}

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
    name: 'configId',
    label: 'Reparto',
    field: 'configId',
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

const filteredPendingUsers = computed(() => applyFilters(pendingUsers.value));
const filteredActiveUsers = computed(() => applyFilters(activeUsers.value));

function applyFilters(users: User[]) {
  return users.filter(u => {
    // 1. Search Query
    const q = (searchQuery.value || '').toLowerCase();
    const matchesSearch = !q ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.dateOfBirth && u.dateOfBirth.includes(q));

    // 2. Profession
    const matchesProf = filterProfession.value === 'Tutti' || u.profession === filterProfession.value;

    // 3. Role
    const matchesRole = filterRole.value === 'Tutti' || u.role === filterRole.value;

    // 4. Department Filter selection
    const matchesConfig = filterConfigId.value === 'Tutti' || u.configId === filterConfigId.value;

    // 5. Config Fencing Security Rule
    // Normal admins MUST NOT see active users from configs they don't manage
    if (!authStore.isSuperAdmin) {
      if (u.configId !== null && !authStore.managedConfigIds.includes(u.configId)) {
        return false;
      }
    }

    return matchesSearch && matchesProf && matchesRole && matchesConfig;
  });
}

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

function openRoleDialog(user: User) {
  selectedUser.value = user;
  editRole.value = user.role;
  editManagedConfigs.value = user.managerialInfo?.managedConfigIds || [];

  editPermissions.manageAdmins = user.managerialInfo?.permissions?.manageAdmins || false;
  editPermissions.manageSystem = user.managerialInfo?.permissions?.manageSystem || false;
  editPermissions.viewAuditLogs = user.managerialInfo?.permissions?.viewAuditLogs || false;

  roleDialog.value = true;

  if (configStore.allConfigs.length === 0) {
    void configStore.loadConfigurations();
  }
}

async function confirmRoleUpdate() {
  if (!selectedUser.value) return;

  processingId.value = selectedUser.value.uid;
  try {
    await userService.updateUserRole(
      selectedUser.value.uid,
      editRole.value,
      editRole.value === 'admin' ? editManagedConfigs.value : [],
      editPermissions
    );

    // Force current user token refresh if we edited ourselves
    if (selectedUser.value.uid === authStore.currentUser?.uid) {
      await authStore.forceTokenRefresh();
    }

    $q.notify({ type: 'positive', message: 'Ruolo e permessi aggiornati con successo' });
    roleDialog.value = false;
    await loadUsers();
  } catch (error) {
    logger.error('Failed to update role', error);
    $q.notify({ type: 'negative', message: 'Errore aggiornamento ruolo' });
  } finally {
    processingId.value = null;
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


<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <h1 class="text-h4 q-my-none">Gestione Utenti</h1>
    </div>

    <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary" align="justify"
      narrow-indicator>
      <q-tab name="pending" label="In Attesa" icon="hourglass_empty">
        <q-badge v-if="filteredPendingUsers.length > 0" color="red" floating>{{
          filteredPendingUsers.length
        }}</q-badge>
      </q-tab>
      <q-tab name="active" label="Utenti Attivi" icon="people" />
      <q-tab name="rotations" label="Turnazioni (Rotazione)" icon="sync" />
    </q-tabs>

    <!-- Filter Bar (Only show on users tabs) -->
    <q-card flat bordered class="q-my-md bg-grey-1" v-if="activeTab !== 'rotations'">
      <q-card-section class="row q-col-gutter-sm items-center">
        <div class="col-12 col-sm-3">
          <q-input v-model="searchQuery" label="Cerca (Nome, Email, Nascita...)" outlined dense clearable
            bg-color="white">
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
        <div class="col-12 col-sm-2">
          <q-select v-model="filterProfession" :options="['Tutti', 'Infermiere', 'Medico', 'OSS']" label="Professione"
            outlined dense bg-color="white" />
        </div>
        <div class="col-12 col-sm-2">
          <q-select v-model="filterRole" :options="['Tutti', 'user', 'admin', 'superAdmin']" label="Ruolo" outlined
            dense bg-color="white" />
        </div>
        <div class="col-12 col-sm-2">
          <q-select v-model="filterConfigId" :options="departmentOptions" option-label="name" option-value="id"
            label="Reparto" outlined dense bg-color="white" emit-value map-options />
        </div>
      </q-card-section>
    </q-card>

    <q-tab-panels v-model="activeTab" animated class="bg-transparent">
      <q-tab-panel name="pending" class="q-pa-none">
        <div v-if="loading && pendingUsers.length === 0" class="q-pa-md">
          <q-card flat bordered v-for="n in 3" :key="n" class="q-mb-sm">
            <q-item>
              <q-item-section avatar>
                <q-skeleton type="QAvatar" />
              </q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="40%" />
                <q-skeleton type="text" width="60%" />
              </q-item-section>
              <q-item-section side>
                <q-skeleton type="rect" width="80px" height="30px" />
              </q-item-section>
            </q-item>
          </q-card>
        </div>
        <q-table v-else :rows="filteredPendingUsers" :columns="columns" row-key="uid" :loading="loading"
          no-data-label="Nessun utente in attesa" flat bordered>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn color="positive" icon="check" label="Approva" size="sm" @click="openApprovalDialog(props.row)"
                :loading="processingId === props.row.uid" />
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <q-tab-panel name="active" class="q-pa-none">
        <div v-if="loading && filteredActiveUsers.length === 0" class="q-pa-md">
          <q-table :rows="[{}, {}, {}]" :columns="columns" flat bordered hide-pagination hide-header>
            <template v-slot:body>
              <q-tr v-for="n in 5" :key="n">
                <q-td v-for="col in columns" :key="col.name">
                  <q-skeleton type="text" />
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
        <q-table v-else :rows="filteredActiveUsers" :columns="columns" row-key="uid" :loading="loading" flat bordered>
          <template v-slot:body-cell-configId="props">
            <q-td :props="props">
              {{ getConfigName(props.row.configId) }}
            </q-td>
          </template>
          <template v-slot:body-cell-dateOfBirth="props">
            <q-td :props="props">
              {{ formatDate(props.row.dateOfBirth) }}
            </q-td>
          </template>
          <template v-slot:body-cell-role="props">
            <q-td :props="props">
              <div class="row items-center justify-center q-gutter-x-sm">
                <q-chip :color="props.row.role === 'admin' ? 'negative' : 'primary'" text-color="white" size="sm">
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
                  <q-item clickable v-close-popup @click="openRoleDialog(props.row)">
                    <q-item-section>
                      <q-item-label>Gestisci Ruolo/Permessi</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item clickable v-close-popup @click="toggleBlockUser(props.row)">
                    <q-item-section avatar>
                      <q-icon :name="props.row.isBlocked ? 'lock_open' : 'block'"
                        :color="props.row.isBlocked ? 'positive' : 'negative'" />
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

      <q-tab-panel name="rotations" class="q-pa-none">
        <RotationManager />
      </q-tab-panel>
    </q-tab-panels>
    <q-dialog v-model="approvalDialog" persistent>
      <!-- ... existing approval dialog content (keep it similar but check imports) ... -->
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Approva Utente</div>
          <div class="text-caption">
            Seleziona la configurazione e l'operatore da associare a
            <strong>{{ selectedUser?.firstName }} {{ selectedUser?.lastName }}</strong>
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-y-md">
          <q-select v-model="selectedConfig" :options="configStore.availableConfigs" option-label="name"
            label="Configurazione / Reparto" outlined emit-value map-options
            @update:model-value="loadOperatorsForConfig" />

          <q-select v-model="selectedOperator" :options="availableOperators" option-label="name" option-value="id"
            label="Profilo Operatore" outlined emit-value map-options :disable="!selectedConfig"
            :loading="loadingOperators">
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey"> Nessun operatore disponibile </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annulla" color="grey" v-close-popup />
          <q-btn flat label="Conferma" color="primary" :disable="!selectedConfig || !selectedOperator"
            :loading="processingId === selectedUser?.uid" @click="confirmApproval" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- New Role Management Dialog -->
    <q-dialog v-model="roleDialog" persistent>
      <q-card style="min-width: 450px" class="q-pa-sm">
        <q-card-section>
          <div class="text-h6">Gestione Ruolo e Permessi</div>
          <div class="text-subtitle2 text-grey">
            {{ selectedUser?.firstName }} {{ selectedUser?.lastName }} ({{ selectedUser?.email }})
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-y-md">
          <q-select v-model="editRole" :options="roleOptions" label="Ruolo di Sistema" outlined dense
            :hint="selectedUser?.role === 'user' ? 'Per promuovere a SuperAdmin l\'utente deve prima essere Admin' : ''" />

          <div v-if="editRole === 'admin'" class="q-mt-md">
            <div class="text-subtitle2 q-mb-xs">Configurazioni Gestite (Config-Fencing)</div>
            <q-select v-model="editManagedConfigs" :options="configStore.allConfigs" option-label="name"
              option-value="id" label="Seleziona Reparti" multiple use-chips outlined emit-value map-options
              hint="L'admin potrà vedere solo i dati di questi reparti" />
          </div>

          <div v-if="editRole !== 'user'" class="q-mt-md">
            <div class="text-subtitle2 q-mb-xs">Permessi Avanzati</div>
            <q-list dense bordered separator class="rounded-borders">
              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>Gestione Amministratori</q-item-label>
                  <q-item-label caption>Può promuovere/modificare altri admin</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="editPermissions.manageAdmins" color="primary" />
                </q-item-section>
              </q-item>
              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>Gestione Sistema</q-item-label>
                  <q-item-label caption>Accesso a backup e configurazioni</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="editPermissions.manageSystem" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annulla" color="grey" v-close-popup />
          <q-btn flat label="Salva Modifiche" color="primary" :loading="processingId === selectedUser?.uid"
            @click="confirmRoleUpdate" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
