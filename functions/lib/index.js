"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNewShiftRequest = exports.onShiftRequestStatusChange = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// Helper function to send notification safely
async function sendNotificationToUser(identifier, title, body, url = '/') {
    var _a;
    let fcmTokens = [];
    let targetUserId = identifier.userId;
    // Se conosciamo solo l'operatorId, dobbiamo cercare a quale utente appartiene
    if (!targetUserId && identifier.operatorId) {
        const usersSnap = await db
            .collection('users')
            .where('operatorId', '==', identifier.operatorId)
            .get();
        if (!usersSnap.empty) {
            // Potrebbe esserci solo un utente collegato a un operatore (o al massimo gestiamo il primo)
            const userData = usersSnap.docs[0].data();
            fcmTokens = (userData === null || userData === void 0 ? void 0 : userData.fcmTokens) || [];
            targetUserId = usersSnap.docs[0].id;
        }
    }
    else if (targetUserId) {
        // Altrimenti procediamo col classico user ID se fornito direttamente
        const userDoc = await db.collection('users').doc(targetUserId).get();
        if (userDoc.exists) {
            fcmTokens = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || [];
        }
    }
    if (fcmTokens.length === 0) {
        console.log(`Impossibile trovare token FCM per ${JSON.stringify(identifier)}`);
        return;
    }
    // 2. Prepara il payload per il Web Push
    const message = {
        notification: {
            title: title,
            body: body,
        },
        webpush: {
            notification: {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                vibrate: [200, 100, 200],
            },
            data: { url: url },
        },
        tokens: fcmTokens,
    };
    // 3. Invia tramite Firebase Admin
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Notifiche inviate a ${targetUserId}: ${response.successCount} successi, ${response.failureCount} fallimenti.`);
        // Opzionale: pulire i token scaduti (se response.failureCount > 0)
    }
    catch (error) {
        console.error("Errore durante l'invio della notifica multicast:", error);
    }
}
// 1. Triggers per Nuove Opportunità (Richieste Urgenti) e Approvazioni/Rifiuti
exports.onShiftRequestStatusChange = functions
    .region('europe-west1')
    .firestore.document('shiftRequests/{requestId}')
    .onUpdate(async (change, _context) => {
    const newData = change.after.data();
    const oldData = change.before.data();
    // Caso A: Richiesta passata a CHIUSO - C'è un vincitore per la copertura
    if (oldData.status !== 'CHIUSO' && newData.status === 'CHIUSO') {
        // Troviamo chi ha offerto e a chi è stato assegnato il turno
        if (newData.offers && Array.isArray(newData.offers)) {
            // Avvisiamo tutti quelli che avevano fatto un'offerta per questa richiesta
            for (const offer of newData.offers) {
                const offeringUserId = offer.operatorId; // Attenzione: dobbiamo assicurarci di avere lo UserId o OperatorId
                // 1. Se l'offerta NON E' RIFIUTATA e la richiesta E' CHIUSA, vuol dire che è lui il fortunato
                if (!offer.isRejected) {
                    await sendNotificationToUser({ operatorId: offeringUserId }, 'Offerta Approvata! 🎉', `La tua disponibilità per il turno del ${newData.date} è stata accettata. Grazie!`, '/');
                }
                else {
                    // 2. Altrimenti è stata scartata (o era già stata rifiutata prima)
                    await sendNotificationToUser({ operatorId: offeringUserId }, 'Offerta non accettata', `La tua offerta per il turno del ${newData.date} non è stata confermata da parte dell'Admin.`, '/');
                }
            }
        }
        return;
    }
    // Caso B: Una nuova richiesta è stata creata come URGENTE (usare onCreate per questo, vedi sotto)
});
// Trigger separato per la creazione delle richieste (Le opportunità)
exports.onNewShiftRequest = functions
    .region('europe-west1')
    .firestore.document('shiftRequests/{requestId}')
    .onCreate(async (snap, _context) => {
    const request = snap.data();
    if (request.isUrgent && request.status === 'APERTO') {
        // Invia un avviso a TUTTI gli operatori della stessa professione (o a tutti)
        // Attenzione: questo è un broadcast, in produzione andrebbe limitato per professione o reparto.
        const usersSnap = await db
            .collection('users')
            .where('profession', '==', request.profession)
            .get();
        const tokens = [];
        usersSnap.forEach((doc) => {
            const data = doc.data();
            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                tokens.push(...data.fcmTokens);
            }
        });
        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: 'Nuova Richiesta Urgente! 🚨',
                    body: `È richiesta copertura urgenza per ${request.profession} il ${request.date} (${request.originalShift})`,
                },
                webpush: {
                    data: { url: '/' },
                },
                tokens: tokens,
            };
            try {
                await admin.messaging().sendEachForMulticast(message);
            }
            catch (e) {
                console.error('Errore broadcast', e);
            }
        }
    }
});
//# sourceMappingURL=index.js.map