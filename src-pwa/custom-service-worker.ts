/**
 * @file custom-service-worker.ts
 * @description Service Worker for NurseHub using Firebase Cloud Messaging (FCM).
 * Pattern adapted from user preference (ProfessioneSiCura).
 */

/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

// Phase 25: Definizione tipi globale per evitare 'any' (§1.8)
declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & { 
    __WB_MANIFEST: (string | { url: string; revision: string | null })[];
    __WB_DISABLE_DEV_LOGS: boolean;
  };

import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Disabilita log di Workbox in sviluppo se necessario
self.__WB_DISABLE_DEV_LOGS = true;

void self.skipWaiting();
void clientsClaim();

// 1. PRECACHING
// La variabile manifest viene usata una sola volta per evitare l'errore di Workbox
const manifest = self.__WB_MANIFEST;
if (manifest && Array.isArray(manifest)) {
  precacheAndRoute(manifest);
}

cleanupOutdatedCaches();

// 2. ROUTING (Fallback per SPA) - Attivato solo in PROD per evitare errori in DEV
if (process.env.PROD) {
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML || '/index.html'),
      { 
        denylist: [
          new RegExp(process.env.PWA_SERVICE_WORKER_REGEX || 'service-worker\\.js$'), 
          /workbox-(.)*\.js$/ 
        ] 
      }
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 FIREBASE CLOUD MESSAGING (Background Notifications)
// ─────────────────────────────────────────────────────────────────────────────

try {
  // Initialize Firebase inside the Service Worker using Env Vars
  // Note: These must be provided in quasar.config.ts > pwa > extendRoute/env
  const firebaseApp = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY as string,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: process.env.VITE_FIREBASE_APP_ID as string
  });

  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, (payload) => {
    console.log('[custom-service-worker.ts] Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'NurseHub: Nuova Notifica';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Hai una nuova comunicazione in sospeso.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-128x128.png',
      data: payload.data, // Contiene URL o ID per la navigazione
      vibrate: [200, 100, 200],
      tag: 'nursehub-notification' // Evita duplicati se arrivano più messaggi simili
    };

    void self.registration.showNotification(notificationTitle, notificationOptions);
  });
  
  self.addEventListener('notificationclick', (event: {
    notification: Notification;
    waitUntil(promise: Promise<void | WindowClient | null>): void;
  }) => {
    event.notification.close();
    
    // Recupera l'URL dalla data o usa la root
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Se c'è già una finestra aperta con quell'URL, focus
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri nuova finestra
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  });

} catch (error) {
  console.error('[custom-service-worker.ts] Error initializing FCM', error);
}
