import { GoogleSheetsService } from './GoogleSheetsService';
import { SyncService } from './SyncService';
import { DEFAULT_SHEETS_CONFIG } from '../config/sheets';

export const googleSheetsService = new GoogleSheetsService(DEFAULT_SHEETS_CONFIG);
export const syncService = new SyncService(googleSheetsService);
