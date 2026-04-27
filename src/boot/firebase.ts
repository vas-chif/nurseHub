/**
 * @file firebase.ts
 * @description Quasar boot file for Firebase initialization (Auth, Firestore, Messaging).
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-04-27
 * @notes
 * - Implements persistent multi-tab local cache for Firestore.
 * - Configures IndexedDB-first auth persistence for reliable PWA sessions.
 * - Initializes Web Push (FCM) messaging with foreground notification handlers.
 * - Uses smartEnvironment for validated configuration retrieval.
 */
import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getMessaging, type Messaging, isSupported, onMessage } from 'firebase/messaging';
import type { App } from 'vue';
import { smartEnv } from 'src/config/smartEnvironment';
import { useSecureLogger } from 'src/utils/secureLogger';
import { Notify } from 'quasar';

const logger = useSecureLogger();

// Firebase configuration from smartEnvironment (validates all vars)
const firebaseConfig = smartEnv.getFirebaseConfig();

// Initialize Firebase IMMEDIATELY (not in boot callback!)
logger.info('Initializing Firebase', { projectId: firebaseConfig.projectId });

const firebaseApp = initializeApp(firebaseConfig);
const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const auth: Auth = getAuth(firebaseApp);

// Ensure local persistence for mobile/PWA instances across app restarts
if (typeof window !== 'undefined') {
  // Try indexedDB first (best for PWA/iOS), fallback to localStorage
  setPersistence(auth, indexedDBLocalPersistence)
    .catch(() => {
      logger.warn('IndexedDB persistence failed, falling back to browserLocalPersistence');
      return setPersistence(auth, browserLocalPersistence);
    })
    .catch((err) => {
      logger.error('Auth persistence error', err);
    });
}

let messaging: Messaging | null = null;

// Messaging only works in the browser
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        messaging = getMessaging(firebaseApp);
        logger.info('Firebase Messaging initialized');

        // Handle messages when app is in FOREGROUND
        onMessage(messaging, (payload) => {
          logger.info('Foreground message received', payload);
          Notify.create({
            message: payload.notification?.title || 'NurseHub Update',
            caption: payload.notification?.body || '',
            color: 'primary',
            icon: 'notifications_active',
            position: 'top',
            timeout: 10000,
            actions: [{ label: 'OK', color: 'white' }]
          });
        });
      } else {
        logger.warn('Firebase Messaging not supported in this browser');
      }
    })
    .catch((err) => {
      logger.error('Error checking messaging support', err);
    });
}

logger.info('Firebase initialized successfully');

export default boot(({ app }: { app: App }) => {
  // Provide globally for Options API components
  app.config.globalProperties.$db = db;
  app.config.globalProperties.$auth = auth;

  logger.debug('Firebase instances added to global properties');
});

export { db, auth, messaging };
