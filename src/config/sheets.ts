/**
 * @file sheets.ts
 * @description Default configuration for Google Sheets integration
 * @author Nurse Hub Team
 */

import type { AppConfig } from '../types/models';

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
