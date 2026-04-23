/**
 * NurseHub - Sincronizzazione Schermata (Non tocca il codice esistente)
 */

// PARTE 1: APP -> EXCEL (Riceve dati dall'app)
function doPost(e) {
  // Tutte le variabili sono locali, non disturbano il proprietario
  var CONFIG_PER_SYNC = {
    dateRow: 2, // Modifica se serve
    nameCol: 2, // Modifica se serve
  };

  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    var targetDate = data.date;
    var targetOperator = String(data.operatorName || '')
      .trim()
      .toUpperCase();
    var newShift = data.newShift;
    var dRow = (data.dateRowIndex || CONFIG_PER_SYNC.dateRow) - 1;
    var nCol = (data.nameColumnIndex || CONFIG_PER_SYNC.nameCol) - 1;

    var colIndex = -1;
    var rowIndex = -1;

    var headerRow = rows[dRow] || rows[0];
    for (var c = 0; c < headerRow.length; c++) {
      var cellValue = headerRow[c];
      var fmtDate =
        cellValue instanceof Date
          ? Utilities.formatDate(cellValue, 'GMT+1', 'yyyy-MM-dd')
          : String(cellValue).trim();
      if (fmtDate == targetDate || fmtDate.indexOf(targetDate) !== -1) {
        colIndex = c;
        break;
      }
    }

    for (var r = 0; r < rows.length; r++) {
      var opInSheet = String(rows[r][nCol] || '')
        .trim()
        .toUpperCase();
      if (opInSheet == targetOperator || opInSheet.indexOf(targetOperator) !== -1) {
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

// PARTE 2: EXCEL -> APP (Invia dati all'app quando il foglio cambia)
function notify(e) {
  // Questa funzione deve essere collegata a un trigger "All'invio" o "Alla modifica"
  var WAIT_MIN = 5;
  var props = PropertiesService.getScriptProperties();

  // Rimuove vecchi trigger per non accumularli
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendSyncWebhook_NurseHub') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('sendSyncWebhook_NurseHub')
    .timeBased()
    .after(WAIT_MIN * 60 * 1000)
    .create();
}

// Funzione con nome unico per non conflittare con handleEdit o altro
function sendSyncWebhook_NurseHub() {
  // Impostazioni protette dentro la funzione
  var API_URL = 'https://nursehub-psi.vercel.app/api/sync-shifts';
  var SECRET = 'NurseHub-AIzaSyD37bwODUeDZ6';
  var CID = 'BOFo6KpGcBy8mZK40Wxt';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SECRET },
    payload: JSON.stringify({ configId: CID }),
    muteHttpExceptions: true,
  };

  try {
    UrlFetchApp.fetch(API_URL, options);
  } catch (error) {
    Logger.log('Errore sync: ' + error);
  }
}
