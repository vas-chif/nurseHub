/* eslint-disable */
/**
 * NurseHub Auto-Sync Trigger per Google Sheets
 * ------------------------------------------------
 * Questo script usa un trigger "onEdit" e un Time-Driven trigger
 * per creare un sistema "Debouncing" (ritardo intelligente).
 * Invia una notifica a Vercel solo dopo 5 minuti dall'ultima modifica.
 */

// ==== IMPOSTAZIONI (DA MODIFICARE) ====
const VERCEL_API_URL = 'https://tuo-progetto-vercel.vercel.app/api/sync-shifts';
const SYNC_SECRET_TOKEN = 'LA_TUA_PASSWORD_SEGRETA'; // Deve coincidere con env su Vercel
const CONFIG_ID = 'ID_DELLA_CONFIGURAZIONE'; // L'ID della configurazione corrente su Firestore (es: 'BOFo...Wxt')
// ======================================

const WAIT_MINUTES = 5;

/**
 * Questa funzione scatta automaticamente ogni volta che una cella viene modificata.
 * Invece di far partire subito la chiamata, resetta un contatore.
 */
function onEdit(e) {
  var props = PropertiesService.getScriptProperties();

  // Cancella i trigger precedenti pendenti per evitare chiamate multiple
  deleteTriggers_();

  // Imposta un nuovo trigger che scatterà tra 5 minuti esatti
  ScriptApp.newTrigger('sendSyncWebhook')
    .timeBased()
    .after(WAIT_MINUTES * 60 * 1000)
    .create();

  // Salviamo l'orario dell'ultima modifica (per debug)
  props.setProperty('lastEditTime', new Date().getTime().toString());
}

/**
 * Questa è la funzione che viene eseguita dal timer dopo 5 minuti di inattività.
 */
function sendSyncWebhook() {
  // Puliamo il trigger per non farlo scattare di nuovo
  deleteTriggers_();

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + SYNC_SECRET_TOKEN,
    },
    payload: JSON.stringify({
      configId: CONFIG_ID,
    }),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(VERCEL_API_URL, options);
    Logger.log('Sincronizzazione completata: ' + response.getContentText());
  } catch (error) {
    Logger.log('Errore chiamata Vercel: ' + error);
  }
}

/**
 * Funzione di utilità per cancellare i trigger "timeBased" in sospeso
 */
function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendSyncWebhook') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
