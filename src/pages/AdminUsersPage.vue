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
                @click="approveUser(props.row)"
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar';
import { userService } from '../services/UserService';
import type { User } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();
const $q = useQuasar();

const activeTab = ref('pending');
const loading = ref(false);
const processingId = ref<string | null>(null);
const allUsers = ref<User[]>([]);

const columns = [
  { name: 'firstName', label: 'Nome', field: 'firstName', sortable: true, align: 'left' as const },
  { name: 'lastName', label: 'Cognome', field: 'lastName', sortable: true, align: 'left' as const },
  { name: 'email', label: 'Email', field: 'email', sortable: true, align: 'left' as const },
  {
    name: 'dateOfBirth',
    label: 'Data di Nascita',
    field: 'dateOfBirth',
    sortable: true,
    align: 'left' as const,
  },
  { name: 'role', label: 'Ruolo', field: 'role', sortable: true, align: 'center' as const },
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

async function approveUser(user: User) {
  processingId.value = user.uid;
  try {
    await userService.approveUser(user.uid);
    $q.notify({ type: 'positive', message: `Utente ${user.firstName} approvato!` });
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
    $q.notify({ type: 'positive', message: `Ruolo aggiornato a ${newRole}` });
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
