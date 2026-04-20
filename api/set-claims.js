/**
 * @file set-claims.js
 * @description Firebase Admin script: sets Custom Claims (JWT role) for a user.
 * Called by other api scripts after every role change.
 * @author Nurse Hub Team
 * @created 2026-04-20
 * @notes
 * - Requires FIREBASE_SERVICE_ACCOUNT env variable (path to service-account JSON)
 * - Used by: migrate-claims.js, update-role.js
 * @dependencies
 * - firebase-admin
 */
'use strict';

const admin = require('firebase-admin');

// Initialize once (safe to call multiple times thanks to the check)
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./service-account.json'); // fallback for local dev
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

/**
 * Sets the `role` Custom Claim on a Firebase Auth user.
 * @param {string} uid
 * @param {'admin'|'user'} role
 */
async function setUserClaim(uid, role) {
  await admin.auth().setCustomUserClaims(uid, { role });
  console.log(`[set-claims] Custom claim set: uid=${uid}, role=${role}`);
}

module.exports = { setUserClaim, admin };
