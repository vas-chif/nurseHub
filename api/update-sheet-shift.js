/**
 * @file update-sheet-shift.js
 * @description Vercel Serverless API endpoint: synchronizes a single shift update 
 * back to the Google Sheets Master file using a Service Account.
 * @author Nurse Hub Team
 * @created 2026-04-23
 */

import { GoogleAuth } from 'google-auth-library';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { configId, operatorName, date, newShift, dateRowIndex, nameColumnIndex } = req.body;
  if (!configId || !operatorName || !date || !newShift) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1. Get Config for sheetUrl
    const configDoc = await db.collection('systemConfigurations').doc(configId).get();
    if (!configDoc.exists) return res.status(404).json({ error: 'Config not found' });
    const configData = configDoc.data();
    const sheetUrl = configData.sheetUrl;
    if (!sheetUrl) return res.status(400).json({ error: 'No sheetUrl' });

    const spreadsheetId = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!spreadsheetId) return res.status(400).json({ error: 'Invalid sheetUrl' });

    // 2. Authenticate with Google
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // 3. Get Spreadsheet Values
    const getUrl = `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values/A1:ZZ500`;
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    const data = await getResp.json();
    const rows = data.values;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Sheet is empty' });

    // 4. Find Column and Row
    const dRow = (dateRowIndex || 1) - 1;
    const nCol = (nameColumnIndex || 2) - 1;
    
    const headers = rows[dRow].map(h => String(h).trim().toUpperCase());
    const targetDateStr = String(date).trim(); // YYYY-MM-DD
    const dayNum = new Date(date).getDate();

    let colIndex = -1;
    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (h === String(dayNum) || h.startsWith(`${dayNum}-`) || h === targetDateStr) {
            colIndex = i;
            break;
        }
    }

    if (colIndex === -1) return res.status(400).json({ error: `Date column for ${date} not found` });

    let rowIndex = -1;
    const searchName = operatorName.trim().toUpperCase();
    for (let i = 0; i < rows.length; i++) {
        const opName = String(rows[i][nCol] || '').toUpperCase();
        if (opName.includes(searchName)) {
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) return res.status(400).json({ error: `Operator ${operatorName} not found in sheet` });

    // 5. Update Value
    const getColLetter = (index) => {
        let letter = '';
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    };

    const updateUrl = `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values/'${data.range.split('!')[0]}'!${getColLetter(colIndex)}${rowIndex + 1}?valueInputOption=USER_ENTERED`;
    
    const updateResp = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            range: `'${data.range.split('!')[0]}'!${getColLetter(colIndex)}${rowIndex + 1}`,
            values: [[newShift]]
        })
    });

    if (!updateResp.ok) {
        const err = await updateResp.json();
        return res.status(500).json({ error: 'Failed to update sheet', details: err });
    }

    return res.status(200).json({ success: true, message: 'Google Sheets updated successfully' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal error', details: error.message });
  }
}
