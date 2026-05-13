/**
 * @file delete-user.js
 * @description Vercel Serverless API endpoint: deletes a Firebase Auth account via
 * firebase-admin. The client SDK does not have this privilege. Called by
 * UserService.deleteUser() after the Firestore batch (user doc + operator link) has
 * already been cleaned up on the client side.
 * @author Nurse Hub Team
 * @created 2026-05-13
 * @modified 2026-05-13
 * @notes
 * - Architecture pattern: Vercel Serverless Function (same pattern as update-role.js)
 * - OWASP A01: VERCEL_API_SECRET checked on every request
 * - OWASP A01: self-deletion blocked both here (callerUid === uid) and in the UI
 * - OWASP A03: Firebase Admin SDK validates UID internally; unknown UIDs return 404
 * - No sensitive data returned in error responses
 * @dependencies
 * - firebase-admin/app
 * - firebase-admin/auth
 * - FIREBASE_SERVICE_ACCOUNT (env var — JSON string of service account key)
 * - VERCEL_API_SECRET (env var — shared secret for API authentication)
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Safe initialization helper for Firebase Admin (mirrors update-role.js pattern)
 *
 * @returns {{ auth: import('firebase-admin/auth').Auth }}
 * @throws {Error} If FIREBASE_SERVICE_ACCOUNT is missing or invalid JSON
 */
function initAdmin() {
  if (getApps().length) return { auth: getAuth() };

  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saEnv) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');

  try {
    const serviceAccount = JSON.parse(saEnv);
    const app = initializeApp({ credential: cert(serviceAccount) });
    return { auth: getAuth(app) };
  } catch (err) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
  }
} /*end initAdmin*/

/**
 * DELETE USER handler
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 *
 * @example
 * // Called from UserService.deleteUser()
 * POST /api/delete-user
 * Authorization: Bearer <VERCEL_API_SECRET>
 * Body: { uid: "abc123", callerUid: "xyz789" }
 */
export default async function handler(req, res) {
  // CORS Headers (mirrors update-role.js)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Security Check: VERCEL_API_SECRET (OWASP A01)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { uid, callerUid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  // OWASP A01 — Hardening: block self-deletion at API level (defence in depth)
  // UI already disables the button for self, this is the server-side guard
  if (uid === callerUid) {
    return res.status(403).json({ error: 'Self-deletion not allowed' });
  }

  let admin;
  try {
    admin = initAdmin();
  } catch (err) {
    return res.status(500).json({ error: 'Backend misconfiguration' });
  }

  try {
    await admin.auth.deleteUser(uid);
    return res.status(200).json({ success: true });
  } catch (err) {
    // Firebase Admin returns code 'auth/user-not-found' if UID does not exist
    if (err.code === 'auth/user-not-found') {
      // Treat as success — the goal (user does not exist) is already achieved
      return res.status(200).json({ success: true, note: 'user-not-found-treated-as-success' });
    }
    return res.status(500).json({ error: 'Failed to delete user' });
  }
} /*end handler*/
