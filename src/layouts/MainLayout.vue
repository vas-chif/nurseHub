/**
 * @file MainLayout.vue
 * @description Primary application layout. Orchestrates global navigation, notification listeners, and PWA interactions.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-04-27
 * @notes
 * - Manages real-time Firebase listeners for in-app and administrative notifications.
 * - Implements gesture-based (swipe) navigation with dynamic route discovery.
 * - Handles role-based visibility for navigation tabs (Tab-Fencing).
 * - Centralizes the "Department Switcher" (ConfigSelector) for SuperAdmins.
 */
<script setup lang="ts">
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useUiStore } from '../stores/uiStore';
import { useRouter } from 'vue-router';
import { onMounted, onUnmounted, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import ConfigSelector from '../components/common/ConfigSelector.vue';
import { requestNotificationPermission } from '../services/NotificationService';
import type { SystemConfiguration, Notification as AppNotification } from '../types/models';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();
const notificationStore = useNotificationStore();
const scheduleStore = useScheduleStore();
const syncStore = useSyncStore();
const uiStore = useUiStore();
const $q = useQuasar();
const isMobile = computed(() => $q.platform.is.mobile);

let unsubs: (() => void)[] = [];

// Load configurations on mount
onMounted(async () => {
  scheduleStore.init();

  // 0. Redirect to last path if on home
  if (router.currentRoute.value.path === '/' && uiStore.lastPath && uiStore.lastPath !== '/') {
    void router.push(uiStore.lastPath);
  }

  if (authStore.currentUser?.uid) {
    // 1. Request FCM Permission
    void requestNotificationPermission(authStore.currentUser.uid);

    // 2. Start In-App Notification Listener
    const unsubInApp = notificationStore.initInAppListener(authStore.currentUser.uid, (n: AppNotification) => {
      $q.notify({
        message: n.message,
        color: 'secondary',
        icon: 'notifications_active',
        position: 'top',
        timeout: 5000,
        actions: [
          { label: 'Chiudi', color: 'white' }
        ]
      });
    });
    unsubs.push(unsubInApp);
  }

  // Admin notification listener
  if (authStore.isAnyAdmin) {
    await configStore.loadConfigurations();
    notificationStore.initAdminListener(() => {
      if (router.currentRoute.value.path !== '/admin/requests') {
        $q.notify({
          message: `Nuova richiesta ricevuta`,
          caption: `Da un operatore`,
          color: 'primary',
          icon: 'notifications',
          position: 'top',
          actions: [
            {
              label: 'Vedi',
              color: 'white',
              handler: () => {
                void router.push('/admin/requests');
              },
            },
          ],
        });
      }
    });
  } else if (authStore.currentUser?.uid) {
    // User notification listener (for status updates)
    notificationStore.initUserListener(authStore.currentUser.uid, (req) => {
      if (router.currentRoute.value.path !== '/requests') {
        $q.notify({
          message: `Aggiornamento richiesta`,
          caption: `La tua richiesta del ${req.date} è ora ${req.status}`,
          color: req.status === 'CLOSED' ? 'positive' : 'warning',
          icon: 'update',
          position: 'top',
          actions: [
            {
              label: 'Vedi',
              color: 'white',
              handler: () => {
                void router.push('/requests');
              },
            },
          ],
        });
      }
    });
  }
});

function handleSwipe({ direction }: { direction: 'left' | 'right' | 'up' | 'down' }) {
  // Configurazione rotte per lo swipe (ordine di navigazione dinamico)
  let routes: string[] = ['/', '/calendar'];

  if (authStore.isAnyAdmin) {
    // Basic Admin routes filtered by visibility
    if (uiStore.isTabVisible('new_request')) routes.push('/requests');
    if (uiStore.isTabVisible('admin_requests')) routes.push('/admin/requests');
    if (uiStore.isTabVisible('admin_users')) routes.push('/admin/users');
    if (uiStore.isTabVisible('admin_analytics')) routes.push('/admin/analytics');
    // Only SuperAdmin can see /admin
    if (authStore.isSuperAdmin && uiStore.isTabVisible('admin_system')) routes.push('/admin');

    // Also filter Home and Calendar if hidden
    if (!uiStore.isTabVisible('home')) {
      routes = routes.filter(r => r !== '/');
    }
    if (!uiStore.isTabVisible('calendar')) {
      routes = routes.filter(r => r !== '/calendar');
    }
  } else {
    // Regular user routes
    routes.push('/requests');
  }

  const currentPath = router.currentRoute.value.path;
  const currentIndex = routes.indexOf(currentPath);

  if (currentIndex === -1) return;

  if (direction === 'left' && currentIndex < routes.length - 1) {
    // Swipe a sinistra -> Vai avanti
    const nextRoute = routes[currentIndex + 1];
    if (nextRoute) void router.push(nextRoute);
  } else if (direction === 'right' && currentIndex > 0) {
    // Swipe a destra -> Vai indietro
    const prevRoute = routes[currentIndex - 1];
    if (prevRoute) void router.push(prevRoute);
  }
}

// Watch for user configId to initialize configStore for regular users
watch(
  () => authStore.currentUser?.configId,
  (newConfigId) => {
    if (newConfigId && !authStore.isAnyAdmin && !configStore.activeConfigId) {
      configStore.activeConfigId = newConfigId;
      // Also set a basic activeConfig object if not present
      if (!configStore.activeConfig) {
        configStore.activeConfig = {
          id: newConfigId,
          name: authStore.currentUser?.profession || 'Configurazione',
          profession:
            (authStore.currentUser?.profession as 'Infermiere' | 'Medico' | 'OSS') || 'Infermiere',
          isActive: true,
          spreadsheetUrl: '',
          createdAt: Date.now(),
          createdBy: 'system',
        } as SystemConfiguration;
      }
    }
  },
  { immediate: true },
);

// Automatic refresh when navigating (checks global sync status)
watch(
  () => router.currentRoute.value.path,
  (newPath) => {
    if (authStore.isAuthenticated) {
      if (configStore.activeConfigId) {
        void syncStore.checkAndRefresh(configStore.activeConfigId);
      }
      // Save last visited path for session persistence
      if (newPath !== '/' && newPath !== '/login' && newPath !== '/register') {
        uiStore.setLastPath(newPath);
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  notificationStore.stopListeners();
  unsubs.forEach((unsub) => unsub());
  unsubs = [];
});

async function logout() {
  await authStore.logout();
  await router.push('/login');
}

const canGoBack = computed(() => {
  const rootPaths = ['/', '/calendar', '/requests', '/admin/requests', '/admin/users', '/admin/analytics', '/admin'];
  // Also consider sub-paths of root paths as "backable" if they are deep, but for now simple check
  return !rootPaths.includes(router.currentRoute.value.path);
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.push('/');
  }
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar class="q-pa-xs">
        <q-btn v-if="canGoBack" flat round dense icon="arrow_back" @click="goBack" class="q-mr-xs" />
        <q-avatar v-else :size="isMobile ? 'sm' : '60px'" color="primary" text-color="white">
          <q-img src="../assets/icon.png" />
        </q-avatar>

        <q-toolbar-title>
          <!-- Active Department Indicator (Admin Only) -->
          <div v-if="authStore.isAnyAdmin && configStore.activeConfig" class="row no-wrap q-gutter-md justify-center">
            <q-chip outline square :size="isMobile ? 'sm' : 'lg'" color="white" text-color="white" icon="home_work"
              class="q-px-md">
              {{ configStore.activeConfig.name }}
            </q-chip>
          </div>

        </q-toolbar-title>

        <!-- Global Config Selector (SuperAdmin Only) -->
        <ConfigSelector v-if="authStore.isSuperAdmin" class="q-mr-md" />

        <!-- In-App Notifications Badge -->
        <q-btn flat round dense icon="notifications" class="q-mr-sm">
          <q-badge v-if="notificationStore.unreadCount > 0" color="red" floating>
            {{ notificationStore.unreadCount }}
          </q-badge>
          <q-menu anchor="bottom right" self="top right" :offset="[0, 10]">
            <q-list style="min-width: 380px; max-width: 95vw">
              <div class="row items-center justify-between q-pa-sm">
                <div class="text-subtitle2">Notifiche</div>
                <q-btn v-if="notificationStore.unreadCount > 0" flat dense color="primary"
                  label="Segna tutte come lette" size="md" @click="notificationStore.resetUnread()" />
              </div>
              <q-separator />

              <template v-if="notificationStore.notifications.length > 0">
                <q-item v-for="n in notificationStore.notifications" :key="n.id">
                  <q-item-section avatar>
                    <q-icon :name="n.type === 'NEW_OPPORTUNITY' ? 'campaign' : 'notifications'"
                      :color="n.type === 'NEW_OPPORTUNITY' ? 'secondary' : 'primary'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label lines="3">{{ n.message }}</q-item-label>
                    <q-item-label caption>{{ new Date(n.createdAt).toLocaleTimeString() }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>

              <q-item v-else>
                <q-item-section class="text-grey text-caption text-center q-pa-md">
                  Nessuna nuova notifica
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn-dropdown class="q-mr-md" flat rounded dense icon="account_circle"
          :label="authStore.currentUser?.firstName" no-caps>
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

    <q-page-container v-touch-swipe.horizontal.100="handleSwipe">
      <router-view v-slot="{ Component }">
        <transition appear enter-active-class="animated fadeIn" leave-active-class="animated fadeOut" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </q-page-container>

    <q-footer bordered class="bg-white text-primary">
      <q-tabs no-caps active-color="primary" indicator-color="transparent" class="text-grey" align="justify">
        <!-- Home: always visible for regular users, toggleable for admins -->
        <q-route-tab v-if="!authStore.isAnyAdmin || uiStore.isTabVisible('home')" to="/" icon="dashboard"
          label="Home" />
        <q-route-tab v-if="!authStore.isAnyAdmin || uiStore.isTabVisible('calendar')" to="/calendar"
          icon="calendar_month" label="Turni" />

        <!-- User-only tabs -->
        <q-route-tab v-if="!authStore.isAnyAdmin" to="/requests" icon="event_note" label="Richieste" />

        <!-- Admin-only tabs (conditional on visibility settings) -->
        <q-route-tab v-if="authStore.isAnyAdmin && uiStore.isTabVisible('new_request')" to="/requests" icon="add_circle"
          label="Nuova Richiesta" />

        <q-route-tab v-if="authStore.isAnyAdmin && uiStore.isTabVisible('admin_requests')" to="/admin/requests"
          icon="event_note" label="Richieste">
          <q-badge v-if="notificationStore.pendingRequestsCount > 0" color="red" floating>
            {{ notificationStore.pendingRequestsCount }}
          </q-badge>
        </q-route-tab>

        <q-route-tab v-if="authStore.isAnyAdmin && uiStore.isTabVisible('admin_users')" to="/admin/users" icon="people"
          label="Utenti" />

        <q-route-tab v-if="authStore.isAnyAdmin && uiStore.isTabVisible('admin_analytics')" to="/admin/analytics"
          icon="analytics" label="Stats" />

        <q-route-tab v-if="authStore.isSuperAdmin && uiStore.isTabVisible('admin_system')" to="/admin"
          icon="admin_panel_settings" label="Admin" />
      </q-tabs>
      <div class="row justify-center q-mx-md">
        <div class="text-caption q-px-md">&copy; {{ new Date().getFullYear() }} Nurse Hub</div>
        <div class="text-center text-caption text-primary row justify-between items-center">
          <div>
            <router-link to="/terms" class="text-primary text-caption q-px-md" style="text-decoration: none">
              Termini e Condizioni
            </router-link>
          </div>
          <div>
            <router-link to="/privacy" class="text-primary text-caption q-px-md" style="text-decoration: none">
              Privacy Policy
            </router-link>
          </div>
          <div>
            <router-link to="/license" class="text-primary text-caption q-px-md" style="text-decoration: none">
              Licenze
            </router-link>
          </div>
        </div>
      </div>
    </q-footer>
  </q-layout>
</template>

<style scoped>
/* No additional styles needed */
</style>
