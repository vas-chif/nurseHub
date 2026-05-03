/**
 * @file dateUtils.ts
 * @description Centralized date manipulation and formatting utilities.
 * @author Nurse Hub Team
 * @created 2026-05-03
 */
import { date } from 'quasar';

/**
 * Formats a date string or timestamp to Italian format (DD/MM/YYYY).
 */
export function formatToItalian(val: string | number | Date | null | undefined): string {
  if (!val) return '';
  return date.formatDate(val, 'DD/MM/YYYY');
}

/**
 * Formats a date to database standard format (YYYY-MM-DD).
 */
export function formatToDb(val: string | number | Date | null | undefined): string {
  if (!val) return '';
  return date.formatDate(val, 'YYYY-MM-DD');
}

/**
 * Formats a date to Italian long format (DD MMMM YYYY).
 */
export function formatToItalianLong(val: string | number | Date | null | undefined): string {
  if (!val) return '';
  return date.formatDate(val, 'DD MMMM YYYY', {
    months: [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ]
  });
}

/**
 * Calculates the difference in days between two dates.
 */
export function diffInDays(end: Date, start: Date): number {
  return date.getDateDiff(end, start, 'days');
}
