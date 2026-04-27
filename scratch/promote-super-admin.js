/**
 * @file promote-super-admin.js
 * @description Script to promote a user to SuperAdmin by calling the Vercel API.
 * This avoids needing the Firebase Service Account locally.
 * Run this via 'node scratch/promote-super-admin.js <UID>'
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiSecret = process.env.VITE_VERCEL_API_SECRET;
const baseUrl = process.env.VITE_API_BASE_URL || 'https://nursehub-psi.vercel.app';

if (!apiSecret) {
  console.error('ERRORE: Variabile VITE_VERCEL_API_SECRET non trovata nel file .env');
  process.exit(1);
}

const uid = process.argv[2];
if (!uid) {
  console.error('ERRORE: Specifica l\'UID dell\'utente. Esempio: node scratch/promote-super-admin.js XYZ123');
  process.exit(1);
}

async function promote() {
  console.log(`Promozione utente ${uid} a SuperAdmin tramite API...`);
  
  try {
    const response = await fetch(`${baseUrl}/api/update-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`
      },
      body: JSON.stringify({
        uid,
        role: 'superAdmin',
        managedConfigIds: [],
        permissions: {
          manageAdmins: true,
          manageSystem: true,
          viewAuditLogs: true
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Errore API');
    }

    console.log('✅ Risposta API:', data.message);
    console.log('\nSUCCESS: L\'utente è ora SuperAdmin. Deve fare logout e login nell\'app per aggiornare la sessione.');
  } catch (error) {
    console.error('❌ Errore durante la promozione:', error.message);
    if (error.message.includes('Unauthorized')) {
      console.log('Suggerimento: Verifica che VITE_VERCEL_API_SECRET nel .env sia identico a VERCEL_API_SECRET su Vercel.');
    }
  }
}

promote();
