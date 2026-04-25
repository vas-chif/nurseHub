import { type Timestamp } from 'firebase/firestore';

export enum BackupType { SCHEDULED = 'SCHEDULED', MANUAL = 'MANUAL', EMERGENCY = 'EMERGENCY' }
export enum BackupStatus { IN_PROGRESS = 'IN_PROGRESS', SUCCESS = 'SUCCESS', FAILED = 'FAILED', SKIPPED = 'SKIPPED' }
export enum RestoreType { FULL = 'full', COLLECTION = 'collection' }

export interface BackupMetadata {
  path: string;               // gs://bucket/firestore-exports/2025-12-15_11-14-36-042-x7k2
  backupDate: Date;
  date: string;               // '15/12/2025, 11:14' (human-readable)
  daysAgo: number;
  isToday: boolean;
  sizeGB: string;             // '0.0004'
  filesCount: number;
  collectionsCount?: number;
  type?: BackupType;
}

export interface BackupLog {
  id: string;
  timestamp: Date | Timestamp | number;
  status: BackupStatus;
  triggerType: BackupType;
  destination?: string;
  backupPath?: string;        // CAMPO CRITICO per matching delete/archive
  operationName?: string;
  collectionsCount?: number;
  executionTime?: number;
  triggeredBy?: string;       // uid
  triggeredByEmail?: string;  // per audit trail
  reason?: string;
  message?: string;
  collections?: string[];
  environment?: string;
}

export interface DeletedBackupLog extends BackupLog {
  deletedAt: Date | Timestamp | number;
  deletedBy: string;
  deletedByEmail: string;
  deletionReason: string;
  originalBackupPath: string;
  sizeGB: string;
  monthlySavings: string;     // '€0.000008'
  originalLogId: string;
  originalCollection: string; // 'backupLogs' | 'manualBackupLogs'
}

export interface RestoreLog {
  id: string;
  timestamp: Date | Timestamp | number;
  status: BackupStatus;
  type: RestoreType;
  collectionIds?: string[];   // undefined = full restore
  source: string;
  safetyBackup: string;       // emergency backup prima del restore
  executionTime: number;
  triggeredBy: string;
  triggeredByEmail?: string;
  error?: string;
  environment: string;
}

export interface SetupActivationLog {
  id: string;
  timestamp: Date | Timestamp | number;
  status: 'active' | 'inactive';
  action?: 'activate' | 'deactivate' | null;
  changedBy?: string | null;
  changedByEmail?: string | null;
  reason?: string | null;
  previousStatus?: string | null;
}

export interface CloudFunctionResponse {
  success: boolean;
  message?: string;
  executionTime?: number;
  collectionsCount?: number;
  operationName?: string;
  destination?: string;
  safetyBackup?: string;
}

// Lista collezioni da backuppare — adatta al tuo progetto
export const BACKUP_COLLECTIONS = [
  'users',                  // 🔴 CRITICO: PII utenti
  'systemConfigurations',   // 🔴 CRITICO: config reparti
  'shiftRequests',          // 🔴 CRITICO: assenze/cambi
  'shiftSwaps',             // 🔴 CRITICO: proposte di cambio
  'notifications',          // 🟡 ALTO: log messaggi
  'auditLogs',              // 🟡 ALTO: GDPR Art. 30
  'backupLogs',             // 🟡 ALTO: storia backup
  'manualBackupLogs',       // 🟡 ALTO: backup manuali
  'restoreLogs',            // 🟡 ALTO: restore operations
  'deletedBackupLogs',      // 🟡 ALTO: audit cancellazioni
  'backupAutomationLogs',   // 🟡 ALTO: toggle history
  'systemSettings',         // 🟢 MEDIO: config
] as const;
