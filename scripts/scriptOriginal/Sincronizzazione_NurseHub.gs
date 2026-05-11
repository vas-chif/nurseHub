/* eslint-disable */
/**
 * NurseHub Sincronizzazione Standalone
 * -----------------------------------------
 * Questo script gestisce la comunicazione bidirezionale tra Google Sheets 
 * e l'App NurseHub (Phase 33 - Expert System).
 *
 * CARATTERISTICHE:
 * - Standalone: Può essere aggiunto a qualsiasi foglio esistente senza toccare i file originali.
 * - Sincronizzazione App -> Sheets: Aggiorna turni e note professionali.
 * - Sincronizzazione Sheets -> App: Notifica l'app dopo ogni modifica manuale su Excel.
 * - Reportistica: Genera report in formato database per l'analisi.
 */

// ==== CONFIGURAZIONE (DA MODIFICARE SOLO SE NECESSARIO) ====
const VERCEL_API_URL = 'https://nursehub-psi.vercel.app/api/sync-shifts';
const VITE_VERCEL_API_SECRET = 'NurseHub-AIzaSyD37bwODUeDZ6';
const WAIT_MINUTES = 2; // Tempo di attesa prima di notificare l'app dopo una modifica manuale
// ===========================================================

/**
 * Crea il menu dedicato nell'interfaccia di Google Sheets.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('NurseHub Admin')
    .addItem('Genera Report Database', 'trasformaTurniInDatabase')
    .addSeparator()
    .addItem('Sincronizza Ora con App', 'sendSyncWebhook')
    .addToUi();
}

/**
 * Punto di ingresso per la lettura dati (GET).
 * Utilizzato dall'App per verificare lo stato attuale del foglio (Sync Check).
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rawData = sheet.getDataRange().getValues();
    var notes = sheet.getDataRange().getNotes();
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    // Trasforma le date in stringhe YYYY-MM-DD per coerenza con il database
    var data = rawData.map(function (row) {
      return row.map(function (cell) {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
        }
        return cell;
      });
    });

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        data: data,
        notes: notes,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: err.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Punto di ingresso per la scrittura dati (POST).
 * Riceve i comandi di aggiornamento dall'App (Approvazioni, Cambi Turno, Note).
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    // Parametri dinamici inviati dall'app
    var dateRow = (data.dateRowIndex || 3) - 1; // Default riga 3
    var nameCol = (data.nameColumnIndex || 2) - 1; // Default colonna B

    var targetDate = data.date;
    var targetOperator = String(data.operatorName || '').trim().toUpperCase();
    var newShift = data.newShift;
    var note = data.note;

    var colIndex = -1;
    var rowIndex = -1;

    // 1. Ricerca Colonna Data
    var headerRow = rows[dateRow] || rows[0];
    for (var c = 0; c < headerRow.length; c++) {
      var cellValue = headerRow[c];
      if (!cellValue) continue;

      var formattedDate = '';
      var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

      if (cellValue instanceof Date) {
        formattedDate = Utilities.formatDate(cellValue, tz, 'yyyy-MM-dd');
      } else {
        formattedDate = String(cellValue).trim();
        if (formattedDate.indexOf('/') !== -1) {
          var parts = formattedDate.split('/');
          if (parts.length === 3 && parts[2].length === 4) {
            formattedDate = parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
          }
        }
      }

      if (formattedDate == targetDate || (formattedDate.length >= 10 && formattedDate.indexOf(targetDate) !== -1)) {
        colIndex = c;
        break;
      }
    }

    // 2. Ricerca Riga Operatore (Logica di Matching Avanzata)
    var targetOpUpper = targetOperator.toUpperCase().trim();
    var targetWords = targetOpUpper.split(/\s+/).filter(function (w) { return w.length > 1; });

    for (var r = 0; r < rows.length; r++) {
      var cellVal = String(rows[r][nameCol] || '').replace(/[\n\r]/g, ' ').toUpperCase().trim();
      if (!cellVal) continue;

      // Match esatto
      if (cellVal === targetOpUpper) { rowIndex = r; break; }

      // Match per parole (Nome/Cognome invertiti)
      var allWordsMatch = true;
      if (targetWords.length > 0) {
        for (var w = 0; w < targetWords.length; w++) {
          if (cellVal.indexOf(targetWords[w]) === -1) { allWordsMatch = false; break; }
        }
        if (allWordsMatch) { rowIndex = r; break; }
      }
    }

    // 3. Esecuzione Aggiornamento
    if (rowIndex != -1 && colIndex != -1) {
      var cell = sheet.getRange(rowIndex + 1, colIndex + 1);
      
      // Imposta valore e colore
      cell.setValue(newShift);
      cell.setFontColor(data.color || "#0000FF"); // Default Blu per modifiche app

      // Imposta nota professionale con Audit Log
      var noteContent = (note || "").toString().trim();
      var finalNote = "👤 Modificato dall'app";
      if (noteContent !== '') {
        finalNote += "\n" + noteContent;
      }
      cell.setNote(finalNote);

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: 'Aggiornato: ' + targetOperator })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Operatore o Data non trovati' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Trigger di notifica all'App dopo modifica manuale (Sheets -> App).
 * Da collegare a un trigger "All'invio" o "Alla modifica".
 */
function notify(e) {
  deleteTriggers_();
  ScriptApp.newTrigger('sendSyncWebhook')
    .timeBased()
    .after(WAIT_MINUTES * 60 * 1000)
    .create();
}

/**
 * Invia il Webhook a Vercel per forzare il refresh dei dati nell'App.
 */
function sendSyncWebhook() {
  deleteTriggers_();
  var props = PropertiesService.getScriptProperties();
  var configId = props.getProperty('CONFIG_ID') || 'BOFo6KpGcBy8mZK40Wxt';

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + VITE_VERCEL_API_SECRET },
    payload: JSON.stringify({ configId: configId }),
    muteHttpExceptions: true,
  };
  try {
    UrlFetchApp.fetch(VERCEL_API_URL, options);
  } catch (error) {
    Logger.log('Errore chiamata Vercel: ' + error);
  }
}

/**
 * Elimina i trigger temporanei per evitare duplicati.
 */
function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendSyncWebhook') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Genera un report tabellare dei turni (formato Database).
 * Utile per analisi esterne o backup.
 */
function trasformaTurniInDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheets()[0];
  var destSheetName = 'Report_NurseHub';

  var allData = sourceSheet.getDataRange().getValues();
  var allNote = sourceSheet.getDataRange().getNotes();

  // Rilevamento automatico coordinate (basato su standard NurseHub)
  var dateRowIndex = 2; // Riga 3
  var nameColIndex = 1; // Colonna B
  var firstDataRowIndex = dateRowIndex + 4;
  var firstDataColIndex = nameColIndex + 1;

  var databaseRows = [];
  databaseRows.push(['Data', 'Nome Operatore', 'Turno', 'Note']);
  var dates = allData[dateRowIndex].slice(firstDataColIndex);

  for (var i = firstDataRowIndex; i < allData.length; i++) {
    var operatorName = allData[i][nameColIndex];
    if (!operatorName || String(operatorName).trim() === '') continue;

    for (var j = firstDataColIndex; j < allData[i].length; j++) {
      var shiftCode = allData[i][j];
      var shiftNote = allNote[i][j];
      var dateIndex = j - firstDataColIndex;
      var currentDate = dates[dateIndex];

      if (shiftCode && String(shiftCode).trim() !== '' && currentDate instanceof Date) {
        var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        databaseRows.push([formattedDate, operatorName, shiftCode, shiftNote]);
      }
    }
  }

  var destSheet = ss.getSheetByName(destSheetName);
  if (destSheet) destSheet.clearContents();
  else destSheet = ss.insertSheet(destSheetName);

  if (databaseRows.length > 1) {
    destSheet.getRange(1, 1, databaseRows.length, databaseRows[0].length).setValues(databaseRows);
  }
  destSheet.autoResizeColumns(1, databaseRows[0].length);
  SpreadsheetApp.getUi().alert('Successo', 'Report generato nel foglio ' + destSheetName, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * ISTRUZIONI PER L'ATTIVAZIONE (Admin)
 * -----------------------------------
 * 1. Apri Google Sheets -> Estensioni -> Apps Script.
 * 2. Crea un nuovo file chiamato 'Sincronizzazione_NurseHub.gs'.
 * 3. Incolla questo codice.
 * 4. Fai clic su "Esegui" -> "onOpen" per autorizzare lo script.
 * 5. Fai clic su "Deploy" -> "Nuovo Deploy".
 * 6. Seleziona "Web App", imposta "Chiunque" come accesso.
 * 7. Copia l'URL della Web App e incollalo nelle impostazioni dell'App NurseHub.
 * 8. (Opzionale) Aggiungi un Trigger nel pannello Apps Script: 
 *    - Funzione: notify, Evento: Alla modifica.
 */
