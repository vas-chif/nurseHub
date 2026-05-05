/**
 * @file services/index.ts
 * @description Singleton instances of the core application services.
 *   Import from here to avoid creating multiple instances across the codebase.
 * @author Nurse Hub Team
 * @created 2026-02-01
 */
import { GoogleSheetsService } from './GoogleSheetsService';
import { SyncService } from './SyncService';
import { DEFAULT_SHEETS_CONFIG } from '../config/sheets';

export const googleSheetsService = new GoogleSheetsService(DEFAULT_SHEETS_CONFIG);
export const syncService = new SyncService(googleSheetsService);
