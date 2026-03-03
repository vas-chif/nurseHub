import { GoogleAuth } from 'google-auth-library';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Security layer: Check for the special cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    // 1. Initialize Firebase Admin
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    const db = getFirestore();
    const batch = db.batch();
    const now = new Date();
    
    // Limits and tracking
    let deletedNotificationsCounter = 0;
    let deletedSwapsCounter = 0;
    let deletedRequestsCounter = 0;

    // --- RULE 1: Delete all notifications older than 30 days ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const notificationsSnapshot = await db.collection('notifications')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(300) 
      .get();
      
    notificationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedNotificationsCounter++;
    });

    // --- RULE 2: Delete Swaps & Requests older than 90 days (Archive Limit) ---
    // Specifically targeting items not in OPEN/PENDING statuses.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoString = ninetyDaysAgo.toISOString().split('T')[0];
    
    // Shift Swaps
    const swapsSnapshot = await db.collection('shiftSwaps')
      .where('date', '<', ninetyDaysAgoString)
      .limit(100)
      .get();
      
    swapsSnapshot.docs.forEach(doc => {
      if (doc.data().status !== 'OPEN') {
        batch.delete(doc.ref);
        deletedSwapsCounter++;
      }
    });

    // Shift Requests (Absences)  
    const requestsSnapshot = await db.collection('shiftRequests')
      .where('date', '<', ninetyDaysAgoString)
      .limit(100)
      .get();
      
    requestsSnapshot.docs.forEach(doc => {
      if (doc.data().status !== 'OPEN') {
        batch.delete(doc.ref);
        deletedRequestsCounter++;
      }
    });

    // 3. Commit the batch destruction
    if (deletedNotificationsCounter + deletedSwapsCounter + deletedRequestsCounter > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: 'Pulizia completata con successo.',
      stats: {
        notificationsDeleted: deletedNotificationsCounter,
        swapsDeleted: deletedSwapsCounter,
        requestsDeleted: deletedRequestsCounter,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Errore durante la pulizia cron:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}
