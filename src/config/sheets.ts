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
    label: '1-Copertura Singola (R ➔ M)',
    roles: [
      {
        roleLabel: 'Personale a riposo (R) che copre la mattina',
        originalShift: 'R',
        newShift: 'M',
        incentive: 'Straordinario incentivato M (07:00-14:00)',
      },
    ],
  },
  {
    id: 'M2',
    targetShift: 'M',
    label: '2-Copertura Combinata 2 Operatori (MP + N12)',
    roles: [
      {
        roleLabel: 'Personale di pomeriggio (P) che anticipa (MP)',
        originalShift: 'P',
        newShift: 'MP',
        incentive: 'Straordinario incentivato M (07:00-14:00)',
      },
      {
        roleLabel: 'Personale di notte (N) che prolunga (N12)',
        originalShift: 'N',
        newShift: 'N12',
        incentive: 'Straordinario incentivato 19:00-21:00',
      },
    ],
  },
  {
    id: 'M3',
    targetShift: 'M',
    label: '3-Copertura Combinata 3 Operatori (MP + P➔M + N12)',
    roles: [
      {
        roleLabel: 'Personale di mattina (M) che prolunga (MP)',
        originalShift: 'M',
        newShift: 'MP',
        incentive: 'Straordinario incentivato P (14:00-19:00)',
      },
      {
        roleLabel: 'Personale di pomeriggio (P) che anticipa (M)',
        originalShift: 'M',
        newShift: 'M',
        incentive: 'Copertura Turno Mattina',
      },
      {
        roleLabel: 'Personale di notte (N) che prolunga (N12)',
        originalShift: 'N',
        newShift: 'N12',
        incentive: 'Straordinario incentivato 19:00-21:00',
      },
    ],
  },
  {
    id: 'M4',
    targetShift: 'M',
    label: '4-Copertura Combinata 3 Operatori (P➔M + N➔P + S➔N)',
    roles: [
      {
        roleLabel: 'Personale di pomeriggio (P) che anticipa (M)',
        originalShift: 'P',
        newShift: 'M',
        incentive: 'Copertura Turno Mattina',
      },
      {
        roleLabel: 'Personale di notte (N) che anticipa (P)',
        originalShift: 'N',
        newShift: 'P',
        incentive: 'Copertura Turno Pomeriggio',
      },
      {
        roleLabel: 'Personale di smonto (S) che copre la notte (N)',
        originalShift: 'S',
        newShift: 'N',
        incentive: 'Straordinario incentivato N (21:00-07:00)',
        requiredNextShift: 'R',
      },
    ],
  },

  // --- MANCANZA POMERIGGIO (P) ---
  {
    id: 'P1',
    targetShift: 'P',
    label: '1-Copertura Combinata 2 Operatori (R ➔ P+N11)',
    roles: [
      {
        roleLabel: 'Personale a riposo (R) che copre il pomeriggio',
        originalShift: 'R',
        newShift: 'P',
        incentive: 'Straordinario incentivato P (19:00-20:00)',
      },
      {
        roleLabel: 'Personale in turno notte (N) che anticipa (N11)',
        originalShift: 'N',
        newShift: 'N11',
        incentive: 'Straordinario incentivato 20:00-21:00',
      },
    ],
  },
  {
    id: 'P2',
    targetShift: 'P',
    label: '2-Copertura Combinata 2 Operatori (MP+N12)',
    roles: [
      {
        roleLabel: 'Personale di mattina (M) che prolunga (MP)',
        originalShift: 'M',
        newShift: 'MP',
        incentive: 'Straordinario incentivato P (19:00-20:00)',
      },
      {
        roleLabel: 'Personale di notte (N) che prolunga (N12)',
        originalShift: 'N',
        newShift: 'N12',
        incentive: 'Straordinario incentivato 19:00-21:00',
      },
    ],
  },
  {
    id: 'P3',
    targetShift: 'P',
    label: '3-Copertura Combinata 2 Operatori (N ➔ P + S ➔ N)',
    roles: [
      {
        roleLabel: 'Personale di notte (N) che anticipa il pomeriggio',
        originalShift: 'N',
        newShift: 'P',
        incentive: 'Copertura Turno Pomeriggio',
      },
      {
        roleLabel: 'Personale di smonto (S) che copre la notte (N)',
        originalShift: 'S',
        newShift: 'N',
        incentive: 'Straordinario incentivato N (21:00-07:00)',
        requiredNextShift: 'R',
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
        roleLabel: 'Personale di smonto che può fare la notte',
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
    label: 'Sostituzione Combinata R + R+1',
    roles: [
      {
        roleLabel: 'Personale a riposo (R) che copre la notte',
        originalShift: 'R',
        newShift: 'N',
        incentive: 'Copertura Turno Notte',
      },
      {
        roleLabel: 'Personale a riposo domani che anticipa la mattina',
        originalShift: 'R',
        newShift: 'M',
        incentive: 'Straordinario incentivato M (07:00-14:00)',
        isNextDay: true,
      },
    ],
  },
];
