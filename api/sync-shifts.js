import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

const db = getFirestore();

// Note: Ensure this node-fetch is available in Vercel. We can simply use the built-in fetch if Node >= 18.
export default async function handler(req, res) {
  // 1. Validate Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Validate Secret Token
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { configId } = req.body;

  if (!configId) {
    return res.status(400).json({ error: 'Missing configId in request body' });
  }

  try {
    // 3. Get the Config details from Firestore
    console.log(`Starting sync for config: ${configId}`);
    const configDoc = await db.collection('configurations').doc(configId).get();

    if (!configDoc.exists) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const configData = configDoc.data();
    if (!configData.sheetUrl) {
      return res.status(400).json({ error: 'Configuration has no sheetUrl configured' });
    }

    // 4. Transform Google Sheets URL to CSV Export URL
    let exportUrl = configData.sheetUrl;
    if (exportUrl.includes('/edit')) {
      exportUrl = exportUrl.replace(/\/edit.*$/, '/export?format=csv');
    }

    console.log(`Fetching CSV from: ${exportUrl}`);
    const sheetResponse = await fetch(exportUrl);

    if (!sheetResponse.ok) {
      throw new Error(`Failed to fetch sheet: ${sheetResponse.statusText}`);
    }

    const csvText = await sheetResponse.text();
    const rows = csvText.split('\n').filter((row) => row.trim().length > 0);

    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // 5. Parse Headers
    // Header format is usually: IDNO, OPERATOR, 1-Nov, 2-Nov, ...
    const headers = rows[0].split(',').map((h) => h.trim());

    // Validate we have IDNO and OPERATOR columns
    const idnoIndex = headers.findIndex((h) => h.toUpperCase() === 'IDNO');
    if (idnoIndex === -1) {
      return res.status(400).json({ error: 'Missing IDNO column in Google Sheets' });
    }

    // Date parsing logic matching your frontend
    // Assumes year comes from config configuration.year or current year
    const currentYear = configData.year || new Date().getFullYear();
    const dateHeaders = [];

    // Parse date headers (skip IDNO and OPERATOR)
    for (let i = 0; i < headers.length; i++) {
      if (i === idnoIndex || headers[i].toUpperCase() === 'OPERATOR') continue;

      const headerText = headers[i];
      if (!headerText) continue;

      // Try to parse "1-nov" or "1" -> depending on exactly how it's formatted
      // A common pattern used in nursehub is to parse 'D-MMM' or just 'D'
      // Let's use a robust matcher
      const match = headerText.match(/^(\d{1,2})(?:-([A-Za-z]+))?/);
      if (match) {
        let day = parseInt(match[1], 10);
        let month = match[2];

        // If month is string like 'nov', map to index. If not provided, assume month from config
        let monthIndex = configData.month
          ? parseInt(configData.month, 10) - 1
          : new Date().getMonth();
        if (month) {
          const monthNames = [
            'gen',
            'feb',
            'mar',
            'apr',
            'mag',
            'giu',
            'lug',
            'ago',
            'set',
            'ott',
            'nov',
            'dic',
          ];
          const foundIndex = monthNames.findIndex((m) =>
            month.toLowerCase().startsWith(m.toLowerCase()),
          );
          if (foundIndex !== -1) monthIndex = foundIndex;
        }

        // Create YYYY-MM-DD string
        const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dateHeaders.push({ index: i, dateStr });
      }
    }

    // 6. Process Operators
    console.log(`Found ${dateHeaders.length} date columns`);
    let operatorsUpdated = 0;
    const batch = db.batch();

    // Query existing operators to get their document IDs by IDNO
    const operatorsSnapshot = await db
      .collection('operators')
      .where('configId', '==', configId)
      .get();

    const existingOperatorsMap = new Map();
    operatorsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.employeeId) {
        existingOperatorsMap.set(data.employeeId.toString().trim(), doc.id);
      }
    });

    for (let j = 1; j < rows.length; j++) {
      const columns = rows[j].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const idnoStr = columns[idnoIndex];

      if (!idnoStr) continue;

      const schedule = {};

      for (const { index, dateStr } of dateHeaders) {
        const shiftValue = columns[index] || '';
        if (shiftValue) {
          schedule[dateStr] = shiftValue.toUpperCase();
        }
      }

      const docId = existingOperatorsMap.get(idnoStr);

      if (docId) {
        // Update existing operator
        const opRef = db.collection('operators').doc(docId);
        batch.update(opRef, { schedule, lastSynced: FieldValue.serverTimestamp() });
        operatorsUpdated++;
      }
      // If operator doesn't exist, we don't create them here. Creation happens via "Importa File" in Admin.
    }

    // 7. Update Configuration sync timestamp
    const configRef = db.collection('configurations').doc(configId);
    batch.update(configRef, { lastSyncedFromSheets: FieldValue.serverTimestamp() });

    await batch.commit();

    console.log(`Successfully synced ${operatorsUpdated} operators for config ${configId}`);
    return res.status(200).json({ success: true, operatorsUpdated });
  } catch (err) {
    console.error('Error during sync:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
