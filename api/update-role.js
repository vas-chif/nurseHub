/**
 * @file update-role.js
 * @description Vercel Serverless API endpoint: updates a user's Custom Claim (JWT role)
 * when an admin promotes or demotes them. Called by UserService.updateUserRole().
 * @author Nurse Hub Team
 * @created 2026-04-21
 * @notes
 * - Authenticated via VERCEL_API_SECRET header
 * - Updates both Custom Claims and Firestore for consistency
 * @dependencies
 * - firebase-admin
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

const auth = getAuth();
const db = getFirestore();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security Check: VERCEL_API_SECRET
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { uid, role } = req.body;

    if (!uid || !role) {
      return res.status(400).json({ error: 'Missing uid or role' });
    }

    // 1. Update Custom Claims (JWT)
    await auth.setCustomUserClaims(uid, { role });

    // 2. Update Firestore user document for consistency
    await db.collection('users').doc(uid).update({
      role: role,
      updatedAt: Date.now()
    });

    console.log(`Successfully updated role to ${role} for user ${uid}`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Ruolo aggiornato a ${role} con successo.` 
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
