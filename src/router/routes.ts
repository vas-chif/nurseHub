import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: '/terms',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/TermsPage.vue') }],
  },
  {
    path: '/privacy',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/PrivacyPage.vue') }],
  },
  {
    path: '/license',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LicensePage.vue') }],
  },
  {
    path: '/settings',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [{ path: '', component: () => import('pages/SettingsPage.vue') }],
  },
  {
    path: '/login',
    component: () => import('pages/LoginPage.vue'),
  },
  {
    path: '/register',
    component: () => import('pages/RegisterPage.vue'),
  },
  {
    path: '/pending-verification',
    component: () => import('pages/PendingVerificationPage.vue'),
    meta: { requiresAuth: true },
  },

  // Protected routes
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true, requiresVerified: true },
    children: [
      { path: '', component: () => import('pages/DashboardPage.vue') },
      { path: 'calendar', component: () => import('pages/CalendarPage.vue') },
      {
        path: 'admin',
        component: () => import('pages/AdminPage.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'admin/users',
        component: () => import('pages/AdminUsersPage.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'requests', // Changed from '/requests' to 'requests' to be a child route
        component: () => import('pages/UserRequestsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'admin/requests',
        component: () => import('pages/AdminRequestsPage.vue'),
        meta: { requiresAdmin: true },
      },
      { path: 'profile', component: () => import('pages/ProfilePage.vue') }, // Changed from '/profile' to 'profile'
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
