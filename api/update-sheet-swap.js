/**
 * @file update-sheet-swap.js
 * @description Vercel Serverless API endpoint: synchronizes an approved shift swap 
 * back to the Google Sheets Master file. Inverts shifts for the two involved operators.
 * @author Nurse Hub Team
 * @created 2026-04-21
 * @notes
 * - Requires Service Account with Editor access to the spreadsheet
 * - Uses batchUpdate to minimize API calls
 * @dependencies
 * - google-auth-library
 * - firebase-admin
 */
'use strict';

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

  const { configId, swap } = req.body;
  if (!configId || !swap) return res.status(400).json({ error: 'Missing parameters' });

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

    // 3. Get Spreadsheet Values (to find row/col)
    // We assume the data is in the first sheet (Sheet1) or we could use range 'A1:ZZ500'
    const getUrl = `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values/A1:ZZ500`;
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    const data = await getResp.json();
    const rows = data.values;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Sheet is empty' });

    const headers = rows[0].map(h => String(h).trim().toUpperCase());
    const idnoIndex = headers.indexOf('IDNO');
    const operatorIndex = headers.indexOf('OPERATOR');
    
    // Find column for the date (swap.date is YYYY-MM-DD)
    // Sheet dates might be "D-MMM" (1-Nov) or "D" (1)
    const targetDate = new Date(swap.date);
    const dayNum = targetDate.getDate();
    
    let colIndex = -1;
    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        // Match day number if it's a numeric column or starts with day number
        if (h === String(dayNum) || h.startsWith(`${dayNum}-`)) {
            colIndex = i;
            break;
        }
    }

    if (colIndex === -1) return res.status(400).json({ error: `Date column for ${swap.date} not found` });

    // 4. Find rows for Creator and Counterpart
    let creatorRowIndex = -1;
    let counterRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const opName = String(row[operatorIndex] || '').toUpperCase();
        
        // Match by name (case-insensitive contains)
        if (opName.includes(swap.creatorName.toUpperCase())) creatorRowIndex = i;
        if (opName.includes(swap.counterpartName.toUpperCase())) counterRowIndex = i;
    }

    if (creatorRowIndex === -1 || counterRowIndex === -1) {
        return res.status(400).json({ 
            error: 'Operators not found in sheet', 
            details: { creatorRowIndex, counterRowIndex, creatorName: swap.creatorName, counterName: swap.counterpartName } 
        });
    }

    // 5. Execute Updates
    const updates = [
        {
            range: `${String.fromCharCode(65 + colIndex)}${creatorRowIndex + 1}`,
            values: [[swap.desiredShift]]
        },
        {
            range: `${String.fromCharCode(65 + colIndex)}${counterRowIndex + 1}`,
            values: [[swap.offeredShift]]
        }
    ];

    // Helper for columns > Z (AA, AB...)
    const getColLetter = (index) => {
        let letter = '';
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    };

    const updateUrl = `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const updateBody = {
        valueInputOption: 'USER_ENTERED',
        data: [
            {
                range: `'${data.range.split('!')[0]}'!${getColLetter(colIndex)}${creatorRowIndex + 1}`,
                values: [[swap.desiredShift]]
            },
            {
                range: `'${data.range.split('!')[0]}'!${getColLetter(colIndex)}${counterRowIndex + 1}`,
                values: [[swap.offeredShift]]
            }
        ]
    };

    const updateResp = await fetch(updateUrl, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${token.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
    });

    if (!updateResp.ok) {
        const err = await updateResp.json();
        return res.status(500).json({ error: 'Failed to update sheet', details: err });
    }

    return res.status(200).json({ success: true, message: 'Google Sheets updated successfully' });

  } catch (error) {
    console.error('Sheet update error:', error);
    return res.status(500).json({ error: 'Internal error', details: error.message });
  }
}
