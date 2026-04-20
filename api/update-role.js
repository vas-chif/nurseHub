/**
 * @file update-role.js
 * @description Vercel Serverless API endpoint: updates a user's Custom Claim (JWT role)
 * when an admin promotes or demotes them. Called by UserService.updateUserRole().
 * @author Nurse Hub Team
 * @created 2026-04-20
 * @notes
 * - Authenticated via VERCEL_API_SECRET header (same pattern as send-notification.js)
 * - Validates the caller is an admin via Firebase Admin SDK token verification
 * - After writing the claim, the user's next getIdToken(true) will reflect the new role
 * @dependencies
 * - firebase-admin (via set-claims.js)
 * - VERCEL_API_SECRET env variable
 * - FIREBASE_SERVICE_ACCOUNT env variable (JSON string)
 */
'use strict';

const { setUserClaim, admin } = require('./set-claims');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization',
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security: verify shared secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { targetUid, newRole, callerIdToken } = req.body;

  // Validate inputs (§1.8 no `any` — validate rigorously)
  if (!targetUid || !newRole || (newRole !== 'admin' && newRole !== 'user')) {
    return res.status(400).json({ error: 'Missing or invalid targetUid / newRole' });
  }

  if (!callerIdToken) {
    return res.status(400).json({ error: 'Missing callerIdToken' });
  }

  try {
    // Verify the caller is a real admin (double security: check JWT claim OR Firestore role)
    const decodedToken = await admin.auth().verifyIdToken(callerIdToken);
    const callerIsAdmin =
      decodedToken.role === 'admin' ||
      (await admin
        .firestore()
        .collection('users')
        .doc(decodedToken.uid)
        .get()
        .then((snap) => snap.data()?.role === 'admin'));

    if (!callerIsAdmin) {
      return res.status(403).json({ error: 'Caller is not an admin' });
    }

    // Set the custom claim
    await setUserClaim(targetUid, newRole);

    return res.status(200).json({
      success: true,
      message: `Custom claim 'role=${newRole}' set for uid=${targetUid}`,
    });
  } catch (err) {
    console.error('[update-role] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
