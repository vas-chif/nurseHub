/// <reference types="vite/client" />

// Make this file a module so that `declare module` blocks are augmentations,
// not ambient module declarations that would shadow the real vue-router exports.
export {};

declare global {
  // Augment Vite's ImportMetaEnv with project-specific VITE_ variables
  interface ImportMetaEnv {
    readonly VITE_FIREBASE_VAPID_KEY: string | undefined;
    readonly VITE_FIREBASE_API_KEY: string | undefined;
    readonly VITE_FIREBASE_PROJECT_ID: string | undefined;
    readonly VITE_FIREBASE_APP_ID: string | undefined;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string | undefined;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string | undefined;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string | undefined;
    readonly VITE_FIREBASE_DATABASE_URL: string | undefined;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: string;
      VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
      VUE_ROUTER_BASE: string | undefined;
    }
  }
}

// Augment vue-router meta types for type-safe guard checks
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresVerified?: boolean;
    requiresAdmin?: boolean;
    /** SuperAdmin-only routes — enforced by roleGuard before component load */
    requiresSuperAdmin?: boolean;
  }
}
