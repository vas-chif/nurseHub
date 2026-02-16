/**
 * @file firebase.ts
 * @description Firebase initialization boot file
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-02-12
 * @example
 * // Auto-imported by Quasar boot system
 * // Provides global db and auth instances
 * import { db, auth } from 'src/boot/firebase';
 * @notes
 * - Uses smartEnvironment for type-safe config access
 * - Validates all Firebase env vars at startup
 * - Initializes IMMEDIATELY to prevent undefined errors
 * - Exports db and auth as initialized singletons
 * @dependencies
 * - firebase/app, firebase/firestore, firebase/auth
 * - smartEnvironment (config validation)
 */
import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import type { App } from 'vue';
import { smartEnv } from 'src/config/smartEnvironment';
import { useSecureLogger } from 'src/utils/secureLogger';

const logger = useSecureLogger();

// Firebase configuration from smartEnvironment (validates all vars)
const firebaseConfig = smartEnv.getFirebaseConfig();

// Initialize Firebase IMMEDIATELY (not in boot callback!)
// This prevents "Cannot read properties of undefined (reading 'app')" errors
logger.info('Initializing Firebase', { projectId: firebaseConfig.projectId });

const firebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(firebaseApp);
const auth: Auth = getAuth(firebaseApp);

logger.info('Firebase initialized successfully');

export default boot(({ app }: { app: App }) => {
  // Provide globally for Options API components
  app.config.globalProperties.$db = db;
  app.config.globalProperties.$auth = auth;

  logger.debug('Firebase instances added to global properties');
});

export { db, auth };
