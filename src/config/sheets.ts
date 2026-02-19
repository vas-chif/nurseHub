/**
 * @file sheets.ts
 * @description Default configuration for Google Sheets integration
 * @author Nurse Hub Team
 */

import type { AppConfig, ReplacementScenario } from '../types/models';

export const DEFAULT_SHEETS_CONFIG: AppConfig = {
  spreadsheetUrl:
    'https://docs.google.com/spreadsheets/d/1Ib8oq0wEknerDQX8Dc7o2aZ0rQQfOkMzWbaoOTfHwxA/edit?gid=280184106',
  dateRowIndex: 4,
  nameColumnIndex: 2,
  dataStartRowIndex: 8,
  dataStartColIndex: 3,

  // Contacts Sheet
  contactsUrl:
    'https://docs.google.com/spreadsheets/d/1elFk52_4QNHnPzAVl0jAfkLMRlrT8MkRgTqVf2__3d8/edit?gid=1070892265#gid=1070892265',
  contactsStartRow: 1,
  contactNameCol: 1,
  contactPhoneCol: 2,
  contactEmailCol: 3,

  // GAS Web App for mailing
  gasWebUrl:
    'https://script.google.com/macros/s/AKfycbzVxYJq9xfGnEooBPpqrQry72rS8g-LDMqCCkE38SWMYaml0YffNtv0ApZg4Qcj755Q-Q/exec',
};

export const REPLACEMENT_SCENARIOS: ReplacementScenario[] = [
  // --- MANCANZA MATTINA (M) ---
  {
    id: 'M1',
    targetShift: 'M',
    label: 'Copertura da Riposo (R ➔ M)',
    roles: [
      {
        roleLabel: 'Copertura Mattina (07:00-14:00)',
        originalShift: 'R',
        newShift: 'M',
        incentive: 'Straordinario incentivato M (07:00-14:00)',
      },
    ],
  },
  {
    id: 'M_DA_P',
    targetShift: 'M',
    label: 'Copertura da Personale di Pomeriggio',
    roles: [
      {
        roleLabel: 'Copertura solo mattina (07:00-14:00)',
        originalShift: 'P',
        newShift: 'M',
        incentive: 'Copertura Turno Mattina',
      },
      {
        roleLabel: 'Copertura totale M+P (07:00-20:00 con pausa)',
        originalShift: 'P',
        newShift: 'MP',
        incentive: 'Straordinario incentivato M (07:00-14:00)',
      },
    ],
  },
  {
    id: 'M_DA_N',
    targetShift: 'M',
    label: 'Copertura da Personale di Notte (Prolungo)',
    roles: [
      {
        roleLabel: 'Prolungo Notte (N12)',
        originalShift: 'N',
        newShift: 'N12',
        incentive: 'Straordinario incentivato 07:00-09:00',
      },
    ],
  },

  // --- MANCANZA POMERIGGIO (P) ---
  {
    id: 'P1',
    targetShift: 'P',
    label: 'Copertura da Riposo (R ➔ P)',
    roles: [
      {
        roleLabel: 'Copertura Pomeriggio (14:00-21:00)',
        originalShift: 'R',
        newShift: 'P',
        incentive: 'Straordinario incentivato P (14:00-21:00)',
      },
    ],
  },
  {
    id: 'P_DA_M',
    targetShift: 'P',
    label: 'Copertura da Personale di Mattina',
    roles: [
      {
        roleLabel: 'Copertura totale M+P (07:00-20:00 con 1h pausa)',
        originalShift: 'M',
        newShift: 'MP',
        incentive: 'Straordinario incentivato P (14:00-20:00)',
      },
      {
        roleLabel: 'Copertura solo pomeriggio (14:00-21:00)',
        originalShift: 'M',
        newShift: 'P',
        incentive: 'Copertura Turno Pomeriggio',
      },
    ],
  },
  {
    id: 'P_DA_N',
    targetShift: 'P',
    label: 'Anticipo Turno Notte (N11)',
    roles: [
      {
        roleLabel: 'Anticipo Notte (N11)',
        originalShift: 'N',
        newShift: 'N11',
        incentive: 'Straordinario incentivato 20:00-21:00',
      },
    ],
  },

  // --- MANCANZA NOTTE (N) ---
  {
    id: 'N1',
    targetShift: 'N',
    label: 'Sostituzione da Turno S (S ➔ N)',
    roles: [
      {
        roleLabel: 'Copertura Notte da Smonto',
        originalShift: 'S',
        newShift: 'N',
        incentive: 'Straordinario incentivato N (21:00-07:00)',
        requiredNextShift: 'R',
      },
    ],
  },
  {
    id: 'N2',
    targetShift: 'N',
    label: 'Sostituzione da Riposo (R ➔ N)',
    roles: [
      {
        roleLabel: 'Copertura Notte (21:00-07:00)',
        originalShift: 'R',
        newShift: 'N',
        incentive: 'Copertura Turno Notte',
      },
    ],
  },
];
