/* eslint-disable */
/**
 * NurseHub UNIFIED SCRIPT per Google Sheets
 * -----------------------------------------
 * Questo script unifica la gestione del menu 'Turni Database'
 * e la sincronizzazione automatica con l'App.
 *
 * ISTRUZIONI:
 * 1. Svuota completamente il tuo progetto Google Apps Script (cancella Codice.gs, GAS_AutoSync.js, ecc.)
 * 2. Incolla questo intero codice in un unico file (es. Codice.gs)
 * 3. Salva e fai un "Nuovo Deploy" come Web App.
 */

// ==== IMPOSTAZIONI (DA MODIFICARE SE NECESSARIO) ====
const VERCEL_API_URL = 'https://nursehub-psi.vercel.app/api/sync-shifts';
const VITE_VERCEL_API_SECRET = 'NurseHub-AIzaSyD37bwODUeDZ6';
const CONFIG_ID = 'BOFo6KpGcBy8mZK40Wxt';
const WAIT_MINUTES = 5;
// ====================================================

/**
 * 1. GESTIONE MENU E APERTURA
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
 * 2. APP -> FRONTEND (Lettura dati dall'App)
 * Permette all'app di leggere il contenuto del foglio bypassando il CORS
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rawData = sheet.getDataRange().getValues();
    var notes = sheet.getDataRange().getNotes();
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    // Trasforma le date in stringhe YYYY-MM-DD per evitare problemi di fuso orario nel browser
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
 * 3. APP -> EXCEL (Ricezione dati dall'App)
 * Questa funzione riceve i comandi dall'app (es. approvazione cambio turno)
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    // Parametri dinamici dall'app
    var dateRow = (data.dateRowIndex || 2) - 1;
    var nameCol = (data.nameColumnIndex || 2) - 1;

    var targetDate = data.date;
    var targetOperator = String(data.operatorName || '')
      .trim()
      .toUpperCase();
    var newShift = data.newShift;
    var note = data.note;

    var colIndex = -1;
    var rowIndex = -1;

    // Cerca la colonna della Data
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
        // Se la data è in formato testo DD/MM/YYYY, proviamo a normalizzarla
        if (formattedDate.indexOf('/') !== -1) {
          var parts = formattedDate.split('/');
          if (parts.length === 3) {
            // Semplice check per DD/MM/YYYY
            if (parts[2].length === 4)
              formattedDate =
                parts[2] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[0]).slice(-2);
          }
        }
      }

      // Match esatto o parziale (es. 2026-04-27 contenuto in una stringa più lunga)
      if (
        formattedDate == targetDate ||
        (formattedDate.length >= 10 && formattedDate.indexOf(targetDate) !== -1)
      ) {
        colIndex = c;
        break;
      }
    }

    // Cerca la riga dell'Operatore
    var targetOpUpper = targetOperator.toUpperCase().trim();
    var targetWords = targetOpUpper.split(/\s+/).filter(function (w) {
      return w.length > 1;
    });

    for (var r = 0; r < rows.length; r++) {
      var cellVal = String(rows[r][nameCol] || '');
      var opNameInSheet = cellVal
        .replace(/[\n\r]/g, ' ')
        .toUpperCase()
        .trim();

      if (!opNameInSheet) continue;

      // Match 1: Uguaglianza esatta (dopo trim e upper)
      if (opNameInSheet === targetOpUpper) {
        rowIndex = r;
        break;
      }

      // Match 2: "Tutte le parole presenti" (Gestisce l'inversione Nome Cognome / Cognome Nome)
      var allWordsMatch = true;
      if (targetWords.length > 0) {
        for (var w = 0; w < targetWords.length; w++) {
          if (opNameInSheet.indexOf(targetWords[w]) === -1) {
            allWordsMatch = false;
            break;
          }
        }
        if (allWordsMatch) {
          rowIndex = r;
          break;
        }
      }

      // Match 3: Cross-check inverso (se il nome nel foglio è contenuto nell'app)
      var sheetWords = opNameInSheet.split(/\s+/).filter(function (w) {
        return w.length > 1;
      });
      var allSheetWordsMatch = true;
      if (sheetWords.length > 0) {
        for (var sw = 0; sw < sheetWords.length; sw++) {
          if (targetOpUpper.indexOf(sheetWords[sw]) === -1) {
            allSheetWordsMatch = false;
            break;
          }
        }
        if (allSheetWordsMatch) {
          rowIndex = r;
          break;
        }
      }
    }

    if (rowIndex != -1 && colIndex != -1) {
      var cell = sheet.getRange(rowIndex + 1, colIndex + 1);
      cell.setValue(newShift);
      
      if (note && note.trim() !== '') {
        cell.setNote(note);
      } else {
        cell.clearNote();
      }

      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          message: 'Aggiornato: ' + targetOperator + ' il ' + targetDate,
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: 'Cella non trovata',
        details: {
          rowIndex: rowIndex,
          colIndex: colIndex,
          op: targetOperator,
          date: targetDate,
          resolvedDateRow: dateRow + 1,
          resolvedNameCol: nameCol + 1,
          headerSample: headerRow.slice(0, 5).map(function (c) {
            return String(c).substring(0, 10);
          }),
        },
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
 * 3. EXCEL -> APP (Invio dati all'App dopo modifica)
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

function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendSyncWebhook') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * 4. LOGICA REPORT (Da Codice.gs)
 */
function trasformaTurniInDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheetName = 'Turno';
  var destSheetName = 'Report';

  var sourceSheet = ss.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    Browser.msgBox('Errore', 'Foglio sorgente non trovato.', Browser.Buttons.OK);
    return;
  }

  var allData = sourceSheet.getDataRange().getValues();
  var allNote = sourceSheet.getDataRange().getNotes();

  var dateRowIndex = 3;
  var nameColIndex = 1;
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
        var formattedDate = Utilities.formatDate(
          currentDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd',
        );
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
  Browser.msgBox('Successo', 'Report generato nel foglio Report.', Browser.Buttons.OK);
}
