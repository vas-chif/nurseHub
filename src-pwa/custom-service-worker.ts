/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

// Disabilita i log verbose di Workbox sia in dev che in produzione
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).__WB_DISABLE_DEV_LOGS = true;

import { clientsClaim } from 'workbox-core';

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

// --- Type Definitions (Polyfill for missing libs) ---

// Define VisibilityState manually since we are avoiding dom lib conflicts
type VisibilityState = 'hidden' | 'visible' | 'prerender';

interface PushMessageData {
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
  json<T = unknown>(): T;
  text(): string;
}

interface PushEvent extends Event {
  data: PushMessageData | null;
  waitUntil(f: Promise<unknown>): void;
}

interface NotificationEvent extends Event {
  notification: Notification;
  action: string;
  waitUntil(f: Promise<unknown>): void;
}

interface WindowClient extends Client {
  focused: boolean;
  visibilityState: VisibilityState;
  focus(): Promise<WindowClient>;
  navigate(url: string): Promise<WindowClient>;
}

interface Client {
  url: string;
  type: ClientType;
  id: string;
}

interface Clients {
  matchAll(options?: ClientQueryOptions): Promise<readonly WindowClient[]>;
  openWindow(url: string): Promise<WindowClient | null>;
  claim(): Promise<void>;
}

interface ClientQueryOptions {
  includeUncontrolled?: boolean;
  type?: ClientType;
}

type ClientType = 'window' | 'worker' | 'sharedworker' | 'all';

interface ServiceWorkerGlobalScope {
  skipWaiting(): void;
  clients: Clients;
  registration: ServiceWorkerRegistration;
  // Overload addEventListener
  addEventListener(type: 'push', listener: (event: PushEvent) => void): void;
  addEventListener(type: 'notificationclick', listener: (event: NotificationEvent) => void): void;
  addEventListener(type: string, listener: (event: Event) => void): void;
  __WB_MANIFEST: Array<PrecacheEntry | string>;
}

interface PrecacheEntry {
  url: string;
  revision: string | null;
}

// Cast self to strict type to avoid 'Window' conflicts
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.skipWaiting();
clientsClaim();

// Use with precache injection
precacheAndRoute(sw.__WB_MANIFEST);

cleanupOutdatedCaches();

// Non-SSR fallbacks to index.html
// Production SSR fallbacks to offline.html (except for dev)
if (process.env.MODE !== 'ssr') {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
} else if (process.env.PROD) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/offline.html')));
}

/*
 * --- Push Notifications ---
 */
interface FCMPayload {
  notification?: {
    title: string;
    body: string;
  };
  data?: {
    url?: string;
  };
  fcmOptions?: {
    link?: string;
  };
}

sw.addEventListener('push', (event: PushEvent) => {
  if (event.data) {
    try {
      const payload = event.data.json<FCMPayload>();

      const title = payload.notification?.title || 'NurseHub Update';
      const body = payload.notification?.body || 'Hai una nuova notifica da NurseHub';

      const options = {
        body: body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: {
          url: payload.fcmOptions?.link || payload.data?.url || '/',
        },
        tag: 'nursehub-' + Date.now(), // Unique tag so they don't overwrite each other immediately if there are multiples
      };

      event.waitUntil(sw.registration.showNotification(title, options));
    } catch (e) {
      console.error('[custom-service-worker] Error parsing push payload', e);
    }
  }
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open and focus it
      for (const client of windowClients) {
        if (client && client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(urlToOpen);
      }
    }),
  );
});
