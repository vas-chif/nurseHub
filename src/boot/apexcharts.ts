/**
 * @file apexcharts.ts
 * @description Quasar boot file — globally registers the VueApexCharts component
 *   so charts are available in any page/component without per-file imports.
 * @author Nurse Hub Team
 * @created 2026-01-15
 */
import { boot } from 'quasar/wrappers';
import VueApexCharts from 'vue3-apexcharts';

export default boot(({ app }) => {
  app.use(VueApexCharts);
});
