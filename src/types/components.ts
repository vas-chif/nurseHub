/**
 * @file components.ts
 * @description Centralized types for UI components props and events.
 * @author Nurse Hub Team
 * @created 2026-05-03
 */

/**
 * Props for the AppDateInput component
 */
export interface AppDateInputProps {
  modelValue: string | null | undefined;
  label?: string;
  hint?: string;
  readonly?: boolean;
  disable?: boolean;
  required?: boolean;
  dense?: boolean;
  filled?: boolean;
  icon?: string;
  hideLabel?: boolean;
  flat?: boolean;
  borderless?: boolean;
}

/**
 * Visual style for a shift indicator
 */
export interface ShiftStyle {
  color: string;
  icon: string;
  label: string;
  bg: string;
}

/**
 * Representation of a single day's shift in a calendar
 */
export interface DayShift {
  date: string;
  dateFormatted: string;
  dayName: string;
  shift: string;
}

/**
 * Collection of days for an operator's calendar view
 */
export interface OperatorCalendar {
  operatorId: string;
  operatorName: string;
  days: DayShift[];
}
