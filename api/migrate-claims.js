/**
 * @file migrate-claims.js
 * @description One-time migration script: reads ALL users from Firestore and writes
 * their `role` field as a Custom Claim in Firebase Auth JWT.
 * Run ONCE after deploying the JWT-First authorization system (Phase 25).
 * @author Nurse Hub Team
 * @created 2026-04-20
 * @notes
 * - Safe to run multiple times (idempotent)
 * - Does NOT modify Firestore documents
 * - Requires FIREBASE_SERVICE_ACCOUNT env var or service-account.json
 * @usage
 *   node api/migrate-claims.js
 */
'use strict';

const { setUserClaim, admin } = require('./set-claims');

async function migrateAllUsers() {
  const db = admin.firestore();
  const usersSnapshot = await db.collection('users').get();

  console.log(`[migrate-claims] Found ${usersSnapshot.size} users to migrate...`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const role = data.role === 'admin' ? 'admin' : 'user';

    try {
      // Check current claims to avoid unnecessary writes
      const authUser = await admin.auth().getUser(uid);
      const existingClaim = authUser.customClaims?.role;

      if (existingClaim === role) {
        console.log(`[migrate-claims] SKIP uid=${uid} (claim already correct: ${role})`);
        skipped++;
        continue;
      }

      await setUserClaim(uid, role);
      console.log(`[migrate-claims] ✅ uid=${uid} → role=${role}`);
      success++;
    } catch (err) {
      // User might exist in Firestore but not in Auth (edge case)
      console.error(`[migrate-claims] ❌ uid=${uid} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[migrate-claims] Done. ✅ ${success} updated | ⏩ ${skipped} skipped | ❌ ${errors} errors`);
  process.exit(errors > 0 ? 1 : 0);
}

migrateAllUsers().catch((err) => {
  console.error('[migrate-claims] Fatal error:', err);
  process.exit(1);
});
