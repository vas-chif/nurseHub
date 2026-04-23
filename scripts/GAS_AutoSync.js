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

    // Parametri dinamici (opzionali dall'app, o default)
    var dateRow = (data.dateRowIndex || 2) - 1; // Default riga 2 (index 1)
    var nameCol = (data.nameColumnIndex || 2) - 1; // Default colonna B (index 1)
    
    var targetDate = data.date; // YYYY-MM-DD
    var targetOperator = String(data.operatorName || '').trim().toUpperCase();
    var newShift = data.newShift;

    var colIndex = -1;
    var rowIndex = -1;

    // 1. Cerca la colonna della Data nella riga specificata
    var headerRow = rows[dateRow] || rows[0];
    for (var c = 0; c < headerRow.length; c++) {
      var cellValue = headerRow[c];
      var formattedDate = "";
      
      if (cellValue instanceof Date) {
        formattedDate = Utilities.formatDate(cellValue, 'GMT+1', 'yyyy-MM-dd');
      } else {
        formattedDate = String(cellValue).trim();
      }
      
      if (formattedDate == targetDate || formattedDate.indexOf(targetDate) !== -1) {
        colIndex = c;
        break;
      }
    }

    // 2. Cerca la riga dell'Operatore nella colonna specificata
    for (var r = 0; r < rows.length; r++) {
      var opNameInSheet = String(rows[r][nameCol] || '').trim().toUpperCase();
      if (opNameInSheet == targetOperator || opNameInSheet.indexOf(targetOperator) !== -1) {
        rowIndex = r;
        break;
      }
    }

    if (rowIndex != -1 && colIndex != -1) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(newShift);
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Aggiornato: ' + targetOperator + ' il ' + targetDate 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: false, 
        error: 'Cella non trovata', 
        details: { rowIndex: rowIndex, colIndex: colIndex, op: targetOperator, date: targetDate } 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
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
