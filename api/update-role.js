/**
 * @file update-role.js
 * @description Vercel Serverless API endpoint: updates a user's Custom Claim (JWT role)
 * and Firestore managerialInfo. Called by UserService.updateUserRole().
 * @author Nurse Hub Team
 * @created 2026-04-21
 * @modified 2026-04-27
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Safe initialization helper for Firebase Admin
 */
function initAdmin() {
  if (getApps().length) return { auth: getAuth(), db: getFirestore() };
  
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saEnv) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  
  try {
    const serviceAccount = JSON.parse(saEnv);
    const app = initializeApp({ credential: cert(serviceAccount) });
    return { auth: getAuth(app), db: getFirestore(app) };
  } catch (err) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Security Check: VERCEL_API_SECRET
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let admin;
  try {
    admin = initAdmin();
  } catch (err) {
    return res.status(500).json({ error: 'Backend misconfiguration', details: err.message });
  }

  try {
    const { uid, role, managedConfigIds, permissions } = req.body;

    if (!uid || !role) {
      return res.status(400).json({ error: 'Missing uid or role' });
    }

    // 1. Update Custom Claims (JWT) - Zero-Trust source of truth
    const claims = { 
      role, 
      managedConfigIds: managedConfigIds || [],
      permissions: permissions || { manageAdmins: false, manageSystem: false, viewAuditLogs: false },
      isActive: true,
      profileComplete: true 
    };
    await admin.auth.setCustomUserClaims(uid, claims);

    // 2. Update Firestore user document for consistency and audit
    const updateData = {
      role: role,
      updatedAt: Date.now(),
      // §1.10 managerialInfo is CF-write-only for clients
      managerialInfo: {
        role,
        managedConfigIds: claims.managedConfigIds,
        permissions: claims.permissions,
        updatedAt: Date.now()
      }
    };
    
    await admin.db.collection('users').doc(uid).update(updateData);

    console.log(`Successfully updated role to ${role} for user ${uid}`, { managedCount: claims.managedConfigIds.length });
    
    return res.status(200).json({ 
      success: true, 
      message: `Ruolo e permessi aggiornati per ${role} con successo.`,
      claims
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
