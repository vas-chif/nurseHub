/**
 * @file backup-scheduled.js
 * @description Vercel Serverless API endpoint: scheduled daily backup cron job.
 * @author Nurse Hub Team
 * @created 2026-04-26
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { v1 } from '@google-cloud/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

const db = getFirestore();
const firestoreAdminClient = new v1.FirestoreAdminClient({
  credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

const BACKUP_COLLECTIONS = [
  'users',
  'systemConfigurations',
  'shiftRequests',
  'shiftSwaps',
  'notifications',
  'auditLogs',
  'backupLogs',
  'manualBackupLogs',
  'restoreLogs',
  'deletedBackupLogs',
  'backupAutomationLogs',
  'systemSettings',
];

export default async function handler(req, res) {
  // Security Check: Vercel Cron Secret (if configured) or just checking request from Vercel
  // In Vercel Cron, you can check the CRON_SECRET environment variable
  // if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    // 1. Check if auto-backup is enabled in systemSettings
    const settingsDoc = await db.collection('systemSettings').doc('backup').get();
    const isEnabled = settingsDoc.exists ? settingsDoc.data().autoBackupEnabled : false;

    if (!isEnabled) {
      console.log('Scheduled backup skipped: autoBackupEnabled is false.');
      await db.collection('backupLogs').add({
        timestamp: Date.now(),
        status: 'SKIPPED',
        triggerType: 'SCHEDULED',
        message: 'Backup automatico disabilitato nelle impostazioni.',
        environment: process.env.VERCEL_ENV || 'production'
      });
      return res.status(200).json({ success: true, message: 'Skipped' });
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const projectId = serviceAccount.project_id;
    const bucketName = `gs://${projectId}-backups`;
    
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '') + '_' + Math.random().toString(36).substring(2, 6);
    const outputUriPrefix = `${bucketName}/firestore-exports/${timestamp}`;

    console.log(`Starting scheduled backup to ${outputUriPrefix}...`);
    
    const [operation] = await firestoreAdminClient.exportDocuments({
      name: firestoreAdminClient.databasePath(projectId, '(default)'),
      outputUriPrefix,
      collectionIds: BACKUP_COLLECTIONS
    });

    const logEntry = {
      timestamp: Date.now(),
      status: 'SUCCESS',
      triggerType: 'SCHEDULED',
      destination: outputUriPrefix,
      backupPath: outputUriPrefix,
      operationName: operation.name,
      environment: process.env.VERCEL_ENV || 'production'
    };

    await db.collection('backupLogs').add(logEntry);
    
    // Audit log
    await db.collection('auditLogs').add({
      timestamp: Date.now(),
      type: 'BACKUP_SCHEDULED',
      details: `Backup programmato eseguito: ${outputUriPrefix}`
    });

    return res.status(200).json({ success: true, operationName: operation.name });

  } catch (error) {
    console.error('Scheduled backup error:', error);
    
    await db.collection('backupLogs').add({
      timestamp: Date.now(),
      status: 'FAILED',
      triggerType: 'SCHEDULED',
      message: error.message,
      environment: process.env.VERCEL_ENV || 'production'
    });

    return res.status(500).json({ error: 'Errore durante il backup programmato', details: error.message });
  }
}
