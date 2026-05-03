/**
 * @file locales.ts
 * @description Centralized localization constants for the application.
 * @author Nurse Hub Team
 * @created 2026-05-03
 */

/**
 * Italian locale configuration for Quasar components (q-date, q-time).
 * Following the project's standard for Italian language support.
 */
export const itLocale = {
  days: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  daysShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  months: [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ],
  monthsShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  firstDayOfWeek: 1, // Monday
  format24h: true,
  pluralDay: 'giorni'
};
