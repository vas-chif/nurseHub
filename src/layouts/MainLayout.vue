<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useRouter } from 'vue-router';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();

// Load configurations on mount
onMounted(async () => {
  if (authStore.isAdmin) {
    await configStore.loadConfigurations();
  }
});

async function logout() {
  await authStore.logout();
  await router.push('/login');
}

async function handleConfigChange(configId: string) {
  await configStore.setActiveConfig(configId);
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar class="q-pa-xs">
        <q-toolbar-title class="q-ml-md">
          <q-avatar size="60px" color="primary" text-color="white">
            <q-img src="../assets/icon.png" />
          </q-avatar>
        </q-toolbar-title>
        <q-toolbar-title> Nurse Hub </q-toolbar-title>

        <!-- Global Config Selector (Admin Only) -->
        <q-select
          v-if="authStore.isAdmin && configStore.allConfigs.length > 0"
          v-model="configStore.activeConfigId"
          :options="configStore.allConfigs"
          option-value="id"
          option-label="name"
          emit-value
          map-options
          dense
          outlined
          label="Configurazione"
          class="q-mr-md"
          style="min-width: 200px"
          @update:model-value="handleConfigChange"
        >
          <template v-slot:prepend>
            <q-icon name="settings" size="xs" />
          </template>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar>
                <q-icon
                  :name="
                    scope.opt.profession === 'Medico'
                      ? 'medical_services'
                      : scope.opt.profession === 'OSS'
                        ? 'health_and_safety'
                        : 'local_hospital'
                  "
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
                <q-item-label caption>{{ scope.opt.profession }}</q-item-label>
              </q-item-section>
              <q-item-section side v-if="scope.opt.isActive">
                <q-badge color="green" label="●" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-btn-dropdown
          class="q-mr-md"
          flat
          rounded
          dense
          icon="account_circle"
          :label="authStore.currentUser?.firstName"
          no-caps
        >
          <q-list>
            <q-item clickable v-close-popup @click="router.push('/profile')">
              <q-item-section avatar>
                <q-icon name="person" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Dati Personali</q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable v-close-popup @click="router.push('/settings')">
              <q-item-section avatar>
                <q-icon name="settings" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Impostazioni</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-item clickable v-close-popup @click="logout">
              <q-item-section avatar>
                <q-icon name="logout" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Logout</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer bordered class="bg-white text-primary">
      <q-tabs
        no-caps
        active-color="primary"
        indicator-color="transparent"
        class="text-grey"
        align="justify"
      >
        <q-route-tab to="/" icon="dashboard" label="Home" />
        <q-route-tab to="/calendar" icon="calendar_month" label="Turni" />
        <q-route-tab v-if="!authStore.isAdmin" to="/requests" icon="event_note" label="Richieste" />

        <q-route-tab
          v-if="authStore.isAdmin"
          to="/requests"
          icon="add_circle"
          label="Nuova Richiesta"
        />
        <q-route-tab
          v-if="authStore.isAdmin"
          to="/admin/requests"
          icon="event_note"
          label="Richieste"
        />
        <q-route-tab v-if="authStore.isAdmin" to="/admin/users" icon="people" label="Utenti" />
        <q-route-tab
          v-if="authStore.isAdmin"
          to="/admin/analytics"
          icon="analytics"
          label="Stats"
        />
        <q-route-tab
          v-if="authStore.isAdmin"
          to="/admin"
          icon="admin_panel_settings"
          label="Admin"
        />
      </q-tabs>
      <div class="row justify-center q-mx-md">
        <div class="text-caption q-px-md">&copy; {{ new Date().getFullYear() }} Nurse Hub</div>
        <div class="text-center text-caption text-primary row justify-between items-center">
          <div>
            <router-link
              to="/terms"
              class="text-primary text-caption q-px-md"
              style="text-decoration: none"
            >
              Termini e Condizioni
            </router-link>
          </div>
          <div>
            <router-link
              to="/privacy"
              class="text-primary text-caption q-px-md"
              style="text-decoration: none"
            >
              Privacy Policy
            </router-link>
          </div>
          <div>
            <router-link
              to="/license"
              class="text-primary text-caption q-px-md"
              style="text-decoration: none"
            >
              Licenze
            </router-link>
          </div>
        </div>
      </div>
    </q-footer>
  </q-layout>
</template>
