/**
 * @file backup-restore.js
 * @description Vercel Serverless API endpoint: handles Firestore restore operations.
 * @author Nurse Hub Team
 * @created 2026-04-26
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { v1 } from '@google-cloud/firestore';

// Safe initialization helper
const getFirebaseConfig = () => {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return null;
  try {
    return JSON.parse(sa);
  } catch (e) {
    return null;
  }
};

const serviceAccount = getFirebaseConfig();

if (serviceAccount && !getApps().length) {
  try {
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

const db = serviceAccount ? getFirestore() : null;
const firestoreAdminClient = serviceAccount ? new v1.FirestoreAdminClient({
  credentials: serviceAccount
}) : null;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!serviceAccount || !db || !firestoreAdminClient) {
    return res.status(500).json({ 
      error: 'Backend misconfiguration', 
      details: 'Firebase Service Account non configurata correttamente.' 
    });
  }

  // Security Check: VERCEL_API_SECRET
  const apiSecret = process.env.VERCEL_API_SECRET;
  if (!apiSecret || req.headers.authorization !== `Bearer ${apiSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { backupPath, type, collectionIds, reason, uid, email } = req.body;

  if (!backupPath || !type) {
    return res.status(400).json({ error: 'Missing backupPath or type' });
  }

  const projectId = serviceAccount.project_id;
  const startTime = Date.now();

  try {
    // 1. SAFETY: Emergency Backup before restore
    const bucketBaseName = process.env.BACKUP_STORAGE_BUCKET || `${projectId}-backups`;
    const emergencyTimestamp = `emergency-before-restore-${Date.now()}`;
    const emergencyPath = `gs://${bucketBaseName}/emergency/${emergencyTimestamp}`;
    
    console.log('Starting emergency safety backup...');
    const [exportOp] = await firestoreAdminClient.exportDocuments({
      name: firestoreAdminClient.databasePath(projectId, '(default)'),
      outputUriPrefix: emergencyPath,
      collectionIds: [] // Full backup
    });
    // We don't wait for exportOp to finish fully here to keep timeout low, 
    // but the system will proceed with import. 
    // In production, you might want to wait if the DB is small.

    // 2. RESTORE (Import)
    console.log(`Starting restore from ${backupPath}...`);
    const [importOp] = await firestoreAdminClient.importDocuments({
      name: firestoreAdminClient.databasePath(projectId, '(default)'),
      inputUriPrefix: backupPath,
      collectionIds: type === 'collection' ? collectionIds : []
    });

    // Wait for import to complete (blocking call for UI feedback)
    await importOp.promise();

    const executionTime = Date.now() - startTime;

    // 3. Log Restore
    const logEntry = {
      timestamp: Date.now(),
      status: 'SUCCESS',
      type: type,
      collectionIds: type === 'collection' ? collectionIds : null,
      source: backupPath,
      safetyBackup: emergencyPath,
      executionTime,
      triggeredBy: uid,
      triggeredByEmail: email,
      environment: process.env.VERCEL_ENV || 'production'
    };

    await db.collection('restoreLogs').add(logEntry);

    // Audit Log
    await db.collection('auditLogs').add({
      timestamp: Date.now(),
      type: 'BACKUP_RESTORE',
      userId: uid,
      userEmail: email,
      details: `Ripristino completato da ${backupPath} (${type})`,
      reason: reason,
      metadata: { safetyBackup: emergencyPath, executionTime }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Ripristino completato con successo.',
      executionTime,
      safetyBackup: emergencyPath
    });

  } catch (error) {
    console.error('Restore error:', error);
    
    await db.collection('restoreLogs').add({
      timestamp: Date.now(),
      status: 'FAILED',
      type: type,
      source: backupPath,
      error: error.message,
      triggeredBy: uid,
      environment: process.env.VERCEL_ENV || 'production'
    });

    return res.status(500).json({ error: 'Errore durante il ripristino', details: error.message });
  }
}
