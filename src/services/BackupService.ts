/**
 * @file BackupService.ts
 * @description Proxy service for interacting with administrative backup/restore APIs on Vercel.
 * @author Nurse Hub Team
 * @created 2026-03-20
 * @modified 2026-04-27
 * @notes
 * - Manages Firestore backups stored in Google Cloud Storage (GCS).
 * - Triggers manual backups, list history, and performs full or collection-level restores.
 * - Requires administrative JWT claims and a secure API secret for Vercel communication.
 */

import { useSecureLogger } from '../utils/secureLogger';
import type { BackupMetadata, CloudFunctionResponse } from '../types/backup';

const logger = useSecureLogger();

export class BackupService {
  private get baseUrl() {
    return import.meta.env.VITE_API_BASE_URL || 'https://nursehub-psi.vercel.app';
  }

  private get authHeader() {
    return `Bearer ${import.meta.env.VITE_VERCEL_API_SECRET ?? ''}`;
  }

  /**
   * Lists all available backups from GCS
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/backup-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ action: 'LIST' }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (e) {
      logger.error('Error listing backups', e);
      throw e;
    }
  }

  /**
   * Triggers a manual Firestore backup
   */
  async triggerManualBackup(uid: string, email: string, reason: string): Promise<CloudFunctionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/backup-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ 
          action: 'TRIGGER_MANUAL',
          uid,
          email,
          reason
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`${err.error || 'Errore'}: ${err.details || ''}`);
      }
      return await response.json();
    } catch (e) {
      logger.error('Error triggering manual backup', e);
      throw e;
    }
  }

  /**
   * Deletes a backup from GCS and archives the log
   */
  async deleteBackup(backupPath: string, logId: string, reason: string, uid: string, email: string): Promise<CloudFunctionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/backup-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ 
          action: 'DELETE',
          backupPath,
          logId,
          reason,
          uid,
          email
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`${err.error || 'Errore'}: ${err.details || ''}`);
      }
      return await response.json();
    } catch (e) {
      logger.error('Error deleting backup', e);
      throw e;
    }
  }

  /**
   * Restores Firestore from a backup
   */
  async restoreBackup(backupPath: string, type: 'full' | 'collection', collectionIds: string[] | null, reason: string, uid: string, email: string): Promise<CloudFunctionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/backup-restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ 
          backupPath,
          type,
          collectionIds,
          reason,
          uid,
          email
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`${err.error || 'Errore'}: ${err.details || ''}`);
      }
      return await response.json();
    } catch (e) {
      logger.error('Error restoring backup', e);
      throw e;
    }
  }

  /**
   * Toggles auto-backup automation
   */
  async toggleAutoBackup(enabled: boolean, reason: string, uid: string, email: string): Promise<CloudFunctionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/backup-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ 
          action: 'TOGGLE_AUTO',
          enabled,
          reason,
          uid,
          email
        }),
      });

      if (!response.ok) throw new Error('Errore durante la modifica dell\'automazione');
      return await response.json();
    } catch (e) {
      logger.error('Error toggling auto backup', e);
      throw e;
    }
  }
}

export const backupService = new BackupService();
