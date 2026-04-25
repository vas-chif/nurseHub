/**
 * @file GoogleSheetsService.ts
 * @description Service to fetch and parse data from Google Sheets via Gviz API
 * @author Nurse Hub Team
 */

import type { AppConfig, Operator } from '../types/models';
import { smartEnv } from '../config/smartEnvironment';
import { useConfigStore } from '../stores/configStore';

interface GvizCell {
  v?: string | number | null;
  f?: string | null;
}

interface GvizRow {
  c?: (GvizCell | null)[];
}

import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

interface GvizTable {
  cols: { id: string; label: string; type: string }[];
  rows: GvizRow[];
}

interface GvizResponse {
  table: GvizTable;
}

export class GoogleSheetsService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Generates the Gviz API URL for fetching data as JSON
   */
  private getGvizUrl(url: string, range?: string): string {
    if (!url || typeof url !== 'string' || url.trim() === '') return '';
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/gid=([0-9]+)/);

    let base = idMatch
      ? `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:json&headers=0&gid=${gidMatch ? gidMatch[1] : '0'}`
      : url;
    if (range) {
      base += `&range=${range}`;
    }
    // Cache busting
    base += `&t=${Date.now()}`;
    return base;
  }

  /**
   * Safely parses the Gviz response text (which wraps JSON in a function call)
   */
  private parseGvizResponse(text: string): GvizResponse | null {
    if (!text) return null;
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      return JSON.parse(text.substring(start, end + 1)) as GvizResponse;
    } catch (e) {
      logger.error('JSON parse error in parseGvizResponse', e);
      return null;
    }
  }

  private parseAnyDate(cell: GvizCell | null): string | null {
    if (!cell || cell.v === undefined || cell.v === null) return null;
    const val = cell.v;

    // Check for "Date(year,month,day)" format
    if (typeof val === 'string' && val.includes('Date(')) {
      const parts = val.match(/\d+/g);
      if (parts && parts.length >= 3) {
        // Month is 0-indexed in JS Date
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]!), parseInt(parts[2]!));
        return this.formatDate(date);
      }
    }

    // Check for Excel serial date
    const num = Number(val);
    if (!isNaN(num) && num > 30000) {
      return this.formatDate(new Date((num - 25569) * 86400 * 1000));
    }

    // Check for string "DD/MM/YYYY" from formatted value
    const f = cell.f ? String(cell.f).trim() : null;
    if (f && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(f)) {
      const parts = f.split('/');
      return `${parts[2]!}-${parts[1]!.padStart(2, '0')}-${parts[0]!.padStart(2, '0')}`;
    }

    // Log unparsed values to help debugging
    if (val) {
      logger.warn('Unparsed Date Cell', { v: val, f: cell.f });
    }

    return null;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Fetches all operators and their schedules
   */
  public async fetchOperators(): Promise<Operator[]> {
    this.loadConfig();
    const gasWebUrl = this.config.gasWebUrl;
    
    // 1. Try to fetch via GAS Web App (Primary/Secure)
    if (gasWebUrl) {
      try {
        logger.info('Attempting sync via GAS Web App...', { url: gasWebUrl });
        const response = await fetch(gasWebUrl);
        if (!response.ok) throw new Error('GAS Web App response not OK');
        
        const result = await response.json();
        if (result.success && result.data) {
          logger.info('Sync via GAS successful');
          return this.parseGasData(result.data);
        }
        logger.warn('GAS sync returned failure, falling back to Gviz', { error: result.error });
      } catch (e) {
        logger.warn('GAS sync failed, falling back to Gviz', e);
      }
    }

    // 2. Fallback to Gviz API (requires public sheet)
    if (!this.config.spreadsheetUrl) throw new Error('Spreadsheet URL configuration missing');

    const dateRangeUrl = this.getGvizUrl(
      this.config.spreadsheetUrl,
      `${this.config.dateRowIndex}:${this.config.dateRowIndex}`,
    );
    const mainTableUrl = this.getGvizUrl(this.config.spreadsheetUrl); 
    const contactsUrl = this.config.contactsUrl
      ? this.getGvizUrl(this.config.contactsUrl || '')
      : '';

    const fetchPromises: Promise<string>[] = [
      fetch(dateRangeUrl).then((r) => r.text()),
      fetch(mainTableUrl).then((r) => r.text()),
    ];
    if (contactsUrl) fetchPromises.push(fetch(contactsUrl).then((r) => r.text()));

    try {
      const results = await Promise.all(fetchPromises);
      const datesRes = results[0] || '';
      const mainRes = results[1] || '';
      const contRes = results[2] || '';

      const dJ = this.parseGvizResponse(datesRes);
      const mJ = this.parseGvizResponse(mainRes);
      const cJ = this.parseGvizResponse(contRes);

      if (!mJ?.table?.rows) throw new Error('Invalid table structure from Gviz');

      // 1. Map Columns to Dates
      const colToDate: Record<number, string> = {};
      const isolatedRow = dJ?.table?.rows?.[0];
      if (isolatedRow) {
        isolatedRow.c?.forEach((c: GvizCell | null, i: number) => {
          if (i < this.config.dataStartColIndex - 1) return;
          const dateStr = this.parseAnyDate(c);
          if (dateStr) colToDate[i] = dateStr;
        });
      }

      // 2. Parse Contacts
      const cMap: Record<string, { email: string; phone: string }> = {};
      cJ?.table?.rows?.forEach((r: GvizRow, i: number) => {
        if (i < (this.config.contactsStartRow || 1) - 1) return;
        const name = String(r.c?.[this.config.contactNameCol - 1]?.v || '')
          .trim()
          .toUpperCase();
        if (name)
          cMap[name] = {
            email: String(r.c?.[this.config.contactEmailCol - 1]?.v || '').trim(),
            phone: String(r.c?.[this.config.contactPhoneCol - 1]?.v || '').trim(),
          };
      });

      // 3. Parse Operators & Schedules
      const parsedOps: Operator[] = [];
      mJ.table.rows.forEach((r: GvizRow, i: number) => {
        if (i < this.config.dataStartRowIndex - 1) return;

        const nameVal = r.c?.[this.config.nameColumnIndex - 1]?.v;
        if (nameVal) {
          const name = String(nameVal).trim();
          if (name.length > 1) {
            const schedule: Record<string, string> = {};
            Object.entries(colToDate).forEach(([idx, dateStr]) => {
              const cell = r.c?.[parseInt(idx)];
              if (cell && (cell.v !== undefined || cell.f !== undefined)) {
                schedule[dateStr] = String(cell.f || cell.v || '')
                  .toUpperCase()
                  .trim();
              }
            });

            parsedOps.push({
              id: `op-${i}`, 
              name,
              schedule,
              email: cMap[name.toUpperCase()]?.email || '',
              phone: cMap[name.toUpperCase()]?.phone || '',
            });
          }
        }
      });

      return parsedOps;
    } catch (error) {
      logger.error('Error fetching operators:', error);
      throw error;
    }
  }

  /**
   * Parses raw array data from GAS doGet
   */
  private parseGasData(rows: (string | number | boolean | Date | null)[][]): Operator[] {
    const colToDate: Record<number, string> = {};
    const dateRow = rows[this.config.dateRowIndex - 1] || [];
    
    // 1. Map Dates
    dateRow.forEach((val, i) => {
      if (i < this.config.dataStartColIndex - 1) return;
      let dateStr: string | null = null;
      
      if (val instanceof Date) {
        dateStr = this.formatDate(val);
      } else if (typeof val === 'string' && val.includes('T')) {
        dateStr = val.split('T')[0] || null;
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        dateStr = val.substring(0, 10);
      }
      
      if (dateStr) colToDate[i] = dateStr;
    });

    // 2. Map Operators
    const parsedOps: Operator[] = [];
    rows.forEach((row, i) => {
      if (i < this.config.dataStartRowIndex - 1) return;
      
      const nameVal = row[this.config.nameColumnIndex - 1];
      if (nameVal) {
        const name = String(nameVal).trim();
        if (name.length > 1) {
          const schedule: Record<string, string> = {};
          Object.entries(colToDate).forEach(([idx, dateStr]) => {
            const val = row[parseInt(idx)];
            if (val !== undefined && val !== null && val !== '') {
              schedule[dateStr] = String(val).toUpperCase().trim();
            }
          });

          parsedOps.push({
            id: `op-${i}`,
            name,
            schedule,
            email: '', // Contacts handled separately if needed, or we could add them to GAS
            phone: '',
          });
        }
      }
    });

    return parsedOps;
  }

  /**
   * Loads configuration - now a no-op since config is managed via systemConfigurations
   * @deprecated Configuration is now managed in systemConfigurations collection
   */
  public loadConfig(): void {
    // Configuration is now set directly via updateSpreadsheetUrl from SystemConfig component
    // This method is kept for backward compatibility but does nothing
    logger.info('loadConfig called - configuration managed via systemConfigurations');
  }

  /**
   * Updates the spreadsheet URL in memory only
   * Firestore updates are handled by SystemConfig component in systemConfigurations collection
   */
  public updateSpreadsheetUrl(url: string): void {
    this.config.spreadsheetUrl = url;
    logger.info('Spreadsheet URL updated in memory', { url });
  }

  /**
   * Updates the GAS Web App URL in memory only
   */
  public updateGasUrl(url: string): void {
    this.config.gasWebUrl = url;
    logger.info('GAS Web App URL updated in memory', { url });
  }

  public getCurrentUrl(): string {
    return this.config.spreadsheetUrl;
  }

  /**
   * Updates a shift cell in the Google Sheet via GAS Web App
   * @param operatorName Name of the operator
   * @param date Date in YYYY-MM-DD format
   * @param newShift New shift code to set
   */
  public async updateShiftOnSheets(
    operatorName: string,
    date: string,
    newShift: string,
  ): Promise<boolean> {
    const gasWebUrl = this.config.gasWebUrl;
    
    // 1. Prefer GAS Web App (Direct & Secure)
    if (gasWebUrl) {
      try {
        logger.info('Updating shift via GAS Web App...', { operatorName, date, newShift });
        const response = await fetch(gasWebUrl, {
          method: 'POST',
          body: JSON.stringify({
            operatorName,
            date,
            newShift,
            dateRowIndex: this.config.dateRowIndex,
            nameColumnIndex: this.config.nameColumnIndex,
          }),
        });

        // Safe JSON parsing: check response type first
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          if (result.success) {
            logger.info('Shift update successfully synced via GAS');
            return true;
          } else {
            logger.error('GAS shift update failed', { error: result.error });
            return false;
          }
        } else {
          const text = await response.text();
          logger.warn('GAS returned non-JSON response', { status: response.status, text: text.substring(0, 100) });
          return response.ok;
        }
      } catch (e) {
        logger.error('Network error during GAS shift update', e);
      }
    }

    // 2. Legacy/Fallback: Vercel API
    const VERCEL_API_URL = '/api/update-sheet-shift';
    const API_SECRET = smartEnv.getRequiredEnv('VITE_VERCEL_API_SECRET');
    const configStore = useConfigStore();
    const configId = configStore.activeConfigId || 'BOFo6KpGcBy8mZK40Wxt';

    try {
      const response = await fetch(VERCEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_SECRET}`,
        },
        body: JSON.stringify({
          configId,
          operatorName,
          date,
          newShift,
          dateRowIndex: this.config.dateRowIndex,
          nameColumnIndex: this.config.nameColumnIndex,
        }),
      });

      if (response.ok) {
        logger.info('Shift update successfully proxied via Vercel API');
        return true;
      } else {
        const text = await response.text();
        const errorData = text && text.startsWith('{') ? JSON.parse(text) : { error: text || 'Unknown error' };
        logger.error('Vercel API shift update failed', { error: errorData.error });
        return false;
      }
    } catch (error) {
      logger.error('Network error during shift update proxy', error);
      return false;
    }
  }
}
