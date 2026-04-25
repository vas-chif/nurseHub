/**
 * @file backup-manager.js
 * @description Vercel Serverless API endpoint: manages Firestore backups (list, manual trigger, delete).
 * @author Nurse Hub Team
 * @created 2026-04-26
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { v1 } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

// Safe initialization helper
const getFirebaseConfig = () => {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.error('CRITICAL: FIREBASE_SERVICE_ACCOUNT is missing');
    return null;
  }
  try {
    return JSON.parse(sa);
  } catch (e) {
    console.error('CRITICAL: Invalid FIREBASE_SERVICE_ACCOUNT JSON');
    return null;
  }
};

const serviceAccount = getFirebaseConfig();

if (serviceAccount && !getApps().length) {
  try {
    const projectId = serviceAccount.project_id;
    // Fallback order: custom env > project-backups > project.firebasestorage.app
    const bucketName = process.env.BACKUP_STORAGE_BUCKET || `${projectId}-backups`;
    
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName
    });
    console.log(`Firebase Admin initialized for project ${projectId} with bucket ${bucketName}`);
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

const db = serviceAccount ? getFirestore() : null;
const firestoreAdminClient = serviceAccount ? new v1.FirestoreAdminClient({
  credentials: serviceAccount
}) : null;

// BACKUP_COLLECTIONS matching src/types/backup.ts
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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!serviceAccount || !db || !firestoreAdminClient) {
    return res.status(500).json({ 
      error: 'Backend misconfiguration', 
      details: 'Firebase Service Account non configurata correttamente su Vercel.' 
    });
  }

  // Security Check: VERCEL_API_SECRET
  const apiSecret = process.env.VERCEL_API_SECRET;
  const authHeader = req.headers.authorization;
  
  if (!apiSecret) {
    return res.status(500).json({ error: 'Backend misconfiguration', details: 'VERCEL_API_SECRET non impostata.' });
  }

  if (authHeader !== `Bearer ${apiSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Secret non corrispondente.' });
  }

  const { action, backupPath, logId, reason, uid, email } = req.body;

  try {
    switch (action) {
      case 'LIST':
        return await listBackups(res);
      case 'TRIGGER_MANUAL':
        return await triggerManualBackup(res, uid, email, reason);
      case 'DELETE':
        return await deleteBackup(res, backupPath, logId, reason, uid, email);
      case 'TOGGLE_AUTO':
        return await toggleAutoBackup(res, req.body.enabled, reason, uid, email);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error(`Error in backup-manager (${action}):`, error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function listBackups(res) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const projectId = serviceAccount.project_id;
  const bucketName = `${projectId}-backups`;
  const storage = new Storage({ credentials: serviceAccount });
  const bucket = storage.bucket(bucketName);

  try {
    const [files] = await bucket.getFiles({ prefix: 'firestore-exports/' });
    
    // Group files by their parent folder (the backup timestamp)
    const backupGroups = {};

    files.forEach(file => {
      const parts = file.name.split('/');
      if (parts.length < 3) return; // Not inside a backup folder
      
      const groupName = parts[1]; // e.g., 2026-04-26_01-34-59
      if (!backupGroups[groupName]) {
        backupGroups[groupName] = {
          path: `gs://${bucketName}/firestore-exports/${groupName}`,
          filesCount: 0,
          sizeBytes: 0,
          lastModified: file.metadata.updated
        };
      }
      
      backupGroups[groupName].filesCount++;
      backupGroups[groupName].sizeBytes += parseInt(file.metadata.size || 0);
    });

    const metadataList = Object.keys(backupGroups).map(name => {
      const group = backupGroups[name];
      const dateParts = name.split('_'); // [YYYY-MM-DD, HH-mm-ss-...]
      const dateStr = dateParts[0];
      const timeStr = dateParts[1]?.replace(/-/g, ':').substring(0, 5) || '00:00';
      
      const backupDate = new Date(group.lastModified);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - backupDate.getTime());
      const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        path: group.path,
        backupDate: group.lastModified,
        date: `${dateStr}, ${timeStr}`,
        daysAgo: daysAgo,
        isToday: daysAgo <= 1,
        sizeGB: (group.sizeBytes / (1024 * 1024 * 1024)).toFixed(6),
        filesCount: group.filesCount
      };
    }).sort((a, b) => new Date(b.backupDate).getTime() - new Date(a.backupDate).getTime());

    return res.status(200).json(metadataList);
  } catch (error) {
    if (error.code === 404) return res.status(200).json([]);
    throw error;
  }
}

async function triggerManualBackup(res, uid, email, reason) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const projectId = serviceAccount.project_id;
  const bucketName = `gs://${projectId}-backups`;
  
  // 1. Lock check
  const settingsDoc = await db.collection('systemSettings').doc('backup').get();
  if (settingsDoc.exists && settingsDoc.data().backupInProgress) {
    const lastLock = settingsDoc.data().lockTimestamp || 0;
    if (Date.now() - lastLock < 120000) { // 2 minutes lock
      return res.status(429).json({ error: 'Backup già in corso. Riprova tra 2 minuti.' });
    }
  }

  // 2. Set Lock
  await db.collection('systemSettings').doc('backup').set({
    backupInProgress: true,
    lockTimestamp: Date.now()
  }, { merge: true });

  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '') + '_' + Math.random().toString(36).substring(2, 6);
  const outputUriPrefix = `${bucketName}/firestore-exports/${timestamp}`;

  try {
    const [operation] = await firestoreAdminClient.exportDocuments({
      name: firestoreAdminClient.databasePath(projectId, '(default)'),
      outputUriPrefix,
      collectionIds: BACKUP_COLLECTIONS
    });

    const logEntry = {
      timestamp: Date.now(),
      status: 'SUCCESS',
      triggerType: 'MANUAL',
      destination: outputUriPrefix,
      backupPath: outputUriPrefix,
      operationName: operation.name,
      triggeredBy: uid,
      triggeredByEmail: email,
      reason: reason || 'Manuale',
      environment: process.env.VERCEL_ENV || 'production'
    };

    await db.collection('manualBackupLogs').add(logEntry);
    
    // Audit log
    await db.collection('auditLogs').add({
      timestamp: Date.now(),
      type: 'BACKUP_MANUAL',
      userId: uid,
      userEmail: email,
      details: `Backup manuale avviato: ${outputUriPrefix}`,
      reason: reason
    });

    return res.status(200).json({ success: true, operationName: operation.name });
  } finally {
    // Release lock
    await db.collection('systemSettings').doc('backup').update({ backupInProgress: false });
  }
}

async function deleteBackup(res, backupPath, logId, reason, uid, email) {
  if (!backupPath) return res.status(400).json({ error: 'Missing backupPath' });

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const storage = new Storage({ credentials: serviceAccount });
  
  // Safety Check if logId is provided
  let originalLog = null;
  if (logId) {
    const logDoc = await db.collection('backupLogs').doc(logId).get();
    const manualDoc = await db.collection('manualBackupLogs').doc(logId).get();
    originalLog = (logDoc.exists ? logDoc.data() : (manualDoc.exists ? manualDoc.data() : null));
    
    if (originalLog && originalLog.backupPath !== backupPath) {
      return res.status(400).json({ error: 'SAFETY_CHECK_FAILED: Il path non corrisponde al log.' });
    }
  }

  // Delete from GCS
  const bucketName = backupPath.split('/')[2];
  const prefix = backupPath.split('/').slice(3).join('/') + '/';
  const bucket = storage.bucket(bucketName);
  
  const [files] = await bucket.getFiles({ prefix });
  let totalSize = 0;
  await Promise.all(files.map(file => {
    totalSize += parseInt(file.metadata.size || 0);
    return file.delete();
  }));

  const sizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(6);
  const monthlySavings = `€${(parseFloat(sizeGB) * 0.020).toFixed(6)}`;

  // Archive log
  if (logId || originalLog) {
    const deletedLog = {
      ...(originalLog || {}),
      deletedAt: Date.now(),
      deletedBy: uid,
      deletedByEmail: email,
      deletionReason: reason,
      originalBackupPath: backupPath,
      sizeGB,
      monthlySavings,
      originalLogId: logId || 'unknown'
    };
    await db.collection('deletedBackupLogs').add(deletedLog);
    
    // Try to delete original log
    if (logId) {
      await db.collection('backupLogs').doc(logId).delete().catch(() => {});
      await db.collection('manualBackupLogs').doc(logId).delete().catch(() => {});
    }
  }

  // Audit
  await db.collection('auditLogs').add({
    timestamp: Date.now(),
    type: 'BACKUP_DELETE',
    userId: uid,
    userEmail: email,
    details: `Backup eliminato: ${backupPath}`,
    metadata: { sizeGB, monthlySavings }
  });

  return res.status(200).json({ success: true, message: 'Backup eliminato con successo.' });
}

async function toggleAutoBackup(res, enabled, reason, uid, email) {
  await db.collection('systemSettings').doc('backup').set({
    autoBackupEnabled: enabled,
    updatedAt: Date.now()
  }, { merge: true });

  await db.collection('backupAutomationLogs').add({
    timestamp: Date.now(),
    status: enabled ? 'active' : 'inactive',
    action: enabled ? 'activate' : 'deactivate',
    changedBy: uid,
    changedByEmail: email,
    reason: reason
  });

  await db.collection('auditLogs').add({
    timestamp: Date.now(),
    type: 'BACKUP_TOGGLE',
    userId: uid,
    userEmail: email,
    details: `Backup automatico ${enabled ? 'attivato' : 'disattivato'}`,
    reason: reason
  });

  return res.status(200).json({ success: true });
}
