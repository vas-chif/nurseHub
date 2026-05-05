/**
 * @file stores/index.ts
 * @description Pinia store bootstrap for Quasar.
 *   Creates the Pinia instance and optionally registers plugins.
 *   To add typed Pinia plugin properties, extend the PiniaCustomProperties
 *   interface inside the plugin definition (not here) to avoid empty-interface lint errors.
 * @author Nurse Hub Team
 * @created 2026-01-15
 */
import { defineStore } from '#q-app/wrappers';
import { createPinia } from 'pinia';

/*
 * When adding new properties to stores via Pinia plugins, extend the
 * `PiniaCustomProperties` interface here.
 * @see https://pinia.vuejs.org/core-concepts/plugins.html#typing-new-store-properties
 * Example: declare module 'pinia' { export interface PiniaCustomProperties { myProp: string } }
 */

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia();

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  return pinia;
});
