/* eslint-disable */
/**
 * NurseHub Auto-Sync Trigger per Google Sheets
 * ------------------------------------------------
 * 1. Sincronizzazione automatica (Excel -> App): Invia dati a Vercel dopo ogni modifica.
 * 2. Aggiornamento remoto (App -> Excel): Permette all'app di scrivere nel foglio.
 */

// ==== IMPOSTAZIONI (DA MODIFICARE) ====
const VERCEL_API_URL = 'https://nursehub-psi.vercel.app/api/sync-shifts';
const VITE_VERCEL_API_SECRET = 'NurseHub-AIzaSyD37bwODUeDZ6'; // Deve coincidere con env su Vercel
const CONFIG_ID = 'BOFo6KpGcBy8mZK40Wxt'; // L'ID della configurazione corrente su Firestore
// ======================================

const WAIT_MINUTES = 5;

/**
 * PARTE 1: EXCEL -> APP
 * Questa funzione scatta ogni volta che una cella viene modificata manualmente.
 */
function notify(e) {
  var props = PropertiesService.getScriptProperties();
  deleteTriggers_();
  ScriptApp.newTrigger('sendSyncWebhook')
    .timeBased()
    .after(WAIT_MINUTES * 60 * 1000)
    .create();
  props.setProperty('lastEditTime', new Date().getTime().toString());
}

function sendSyncWebhook() {
  deleteTriggers_();
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + VITE_VERCEL_API_SECRET },
    payload: JSON.stringify({ configId: CONFIG_ID }),
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
 * PARTE 2: APP -> EXCEL
 * Questa funzione riceve i comandi dall'app (es. approvazione cambio turno)
 * e aggiorna la cella corretta nel foglio.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    var targetDate = data.date; // Formato previsto: YYYY-MM-DD
    var targetOperator = data.operatorName;
    var newShift = data.newShift;

    var colIndex = -1;
    var rowIndex = -1;

    // Cerca la colonna della Data (Riga 1)
    for (var c = 0; c < rows[0].length; c++) {
      var cellValue = rows[0][c];
      if (cellValue instanceof Date) {
        cellValue = Utilities.formatDate(cellValue, 'GMT+1', 'yyyy-MM-dd');
      }
      if (cellValue == targetDate) {
        colIndex = c;
        break;
      }
    }

    // Cerca la riga dell'Operatore (Colonna 2)
    for (var r = 0; r < rows.length; r++) {
      if (rows[r][1] == targetOperator) {
        rowIndex = r;
        break;
      }
    }

    if (rowIndex != -1 && colIndex != -1) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(newShift);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Cella non trovata' }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendSyncWebhook') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
