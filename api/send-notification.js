import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  // 1. Accettiamo solo richieste POST (perché stiamo inviando dati privati)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  // 2. Livello di Sicurezza Base:
  // Controlliamo che l'App Quasar conosca la nostra password segreta Vercel
  // (La imposteremo dopo su Vercel Dashboard come VERCEL_API_SECRET)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  try {
    // 3. Estraiamo dal corpo del messaggio i dati inviati dalla app Vue
    const { title, body, fcmTokens, url } = req.body;

    if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      return res.status(400).json({ error: 'Nessun token FCM fornito' });
    }

    // 4. Autenticazione con Google (Generazione del Token OAuth2 "Passepartout")
    // Questa libreria leggera userà il file segreto JSON che inserirai su Vercel
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    // 5. Contattiamo le antenne di Google (Endpoint FCM HTTP v1)
    const projectId = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id;
    const urlFCM = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let successCount = 0;
    let failureCount = 0;

    // 6. Inviamo la notifica a ogni telefono (Token) uno alla volta
    for (const token of fcmTokens) {
      const fcmPayload = {
        message: {
          token: token,
          notification: {
            title: title,
            body: body,
          },
          webpush: {
            notification: {
              icon: '/icons/icon-192x192.png',
              vibrate: [200, 100, 200],
            },
            fcm_options: {
              link: url || '/',
            },
          },
        },
      };

      const response = await fetch(urlFCM, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      if (response.ok) {
        successCount++;
      } else {
        failureCount++;
        const errorData = await response.json();
        console.error('Errore invio singolo FCM:', errorData);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notifiche inviate: ${successCount} successi, ${failureCount} fallimenti.`,
    });
  } catch (error) {
    console.error('Errore API Vercel:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}
