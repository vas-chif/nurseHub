declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
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
