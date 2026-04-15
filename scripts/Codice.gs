/**
 * Crea un menu personalizzato nel Foglio Google all'apertura.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Turni Database')
    .addItem('Trasforma in Database', 'trasformaTurniInDatabase')
    .addToUi();
}

/**
 * Trasforma i dati di un foglio turni (date in righe, nomi in colonne, turni nelle celle)
 * in un formato database (Data, Nome Operatore, Turno) su un nuovo foglio.
 */
function trasformaTurniInDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Nomi dei fogli da configurare
  // sourceSheetName: Il nome del foglio che contiene i dati dei turni nel formato originale.
  // destSheetName: Il nome del foglio dove verranno scritti i dati trasformati in formato database.
  var sourceSheetName = 'Turno'; // *** MODIFICA QUESTO SE IL TUO FOGLIO SORGENTE HA UN NOME DIVERSO ***
  var destSheetName = 'Report'; // *** MODIFICA QUESTO SE VUOI UN NOME DIVERSO PER IL FOGLIO DI DESTINAZIONE ***

  // Ottieni il foglio sorgente. Se non esiste, mostra un messaggio di errore.
  var sourceSheet = ss.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    Browser.msgBox(
      'Errore',
      'Il foglio sorgente "' +
        sourceSheetName +
        '" non è stato trovato. Assicurati che il nome sia corretto.',
      Browser.Buttons.OK,
    );
    return;
  }

  // Ottieni tutti i valori dal foglio sorgente.
  // getValues() restituisce un array bidimensionale di tutti i dati nel range utilizzato.
  var allData = sourceSheet.getDataRange().getValues();
  var allNote = sourceSheet.getDataRange().getNotes();

  // ----- Definizioni della struttura del foglio sorgente in base alla richiesta -----
  // Interpretazione della richiesta:
  // - La riga 1 (indice 0 nell'array) contiene le date, a partire dalla colonna 2 (indice 1).
  // - La colonna 1 (indice 0 nell'array) contiene i nomi del personale, a partire dalla riga 2 (indice 1).
  // - La cella A1 (allData[0][0]) è probabilmente vuota o contiene un'intestazione generica.

  // Indice della riga dove si trovano le date (0 per la prima riga)
  var dateRowIndex = 3;
  // Indice della colonna dove si trovano i nomi degli operatori (0 per la prima colonna)
  var nameColIndex = 1;

  // Indice della prima riga che contiene dati di turno effettivi (dopo la riga delle date)
  var firstDataRowIndex = dateRowIndex + 4;
  // Indice della prima colonna che contiene dati di turno effettivi (dopo la colonna dei nomi)
  var firstDataColIndex = nameColIndex + 1;

  // Inizializza l'array che conterrà i dati trasformati in formato database.
  var databaseRows = [];
  // Aggiungi l'intestazione per il nuovo foglio di report.
  databaseRows.push(['Data', 'Nome Operatore', 'Turno', 'Note']);

  // Estrai le date dalla riga definita.
  // slice(firstDataColIndex) serve a ignorare la prima cella della riga delle date (e.g., A1)
  // e prendere solo le date effettive (e.g., B1, C1, ...).
  var dates = allData[dateRowIndex].slice(firstDataColIndex);

  // Itera attraverso le righe del foglio sorgente, iniziando dalla prima riga con i nomi degli operatori.
  for (var i = firstDataRowIndex; i < allData.length; i++) {
    // Ottieni il nome dell'operatore dalla colonna definita.
    var operatorName = allData[i][nameColIndex];

    // Se il nome dell'operatore è vuoto o solo spazi, salta questa riga.
    // Questo previene l'elaborazione di righe vuote alla fine del foglio.
    if (!operatorName || String(operatorName).trim() === '') {
      continue;
    }

    // Itera attraverso le colonne della riga corrente, iniziando dalla prima colonna con i codici turno.
    for (var j = firstDataColIndex; j < allData[i].length; j++) {
      // Ottieni il codice del turno dalla cella corrente.
      var shiftCode = allData[i][j];
      var shiftNote = allNote[i][j];

      // Calcola l'indice della data corrispondente nell'array 'dates'.
      // Questo converte l'indice di colonna j nell'indice corretto per l'array 'dates'.
      var dateIndex = j - firstDataColIndex;
      var currentDate = dates[dateIndex];

      // Controlla che il codice turno non sia vuoto o solo spazi e che la 'currentDate' sia un oggetto Date valido.
      // Questo assicura che vengano elaborati solo i turni e le date valide.
      if (shiftCode && String(shiftCode).trim() !== '' && currentDate instanceof Date) {
        // Formatta la data in un formato leggibile (es. 'AAAA-MM-GG').
        // Si usa il fuso orario dello script per evitare problemi di conversione oraria.
        var formattedDate = Utilities.formatDate(
          currentDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd',
        );

        // Aggiungi la riga formattata all'array del report database.
        databaseRows.push([formattedDate, operatorName, shiftCode, shiftNote]);
      }
    }
  }

  // Ottieni o crea il foglio di destinazione.
  var destSheet = ss.getSheetByName(destSheetName);
  if (destSheet) {
    destSheet.clearContents(); // Se il foglio esiste, ne cancella tutto il contenuto.
  } else {
    destSheet = ss.insertSheet(destSheetName); // Se non esiste, crea un nuovo foglio con il nome specificato.
  }

  // Scrivi i dati nel foglio di destinazione.
  // Controlla che ci siano dati da scrivere oltre all'intestazione.
  if (databaseRows.length > 1) {
    // getRange(rigaInizio, colonnaInizio, numeroRighe, numeroColonne)
    destSheet.getRange(1, 1, databaseRows.length, databaseRows[0].length).setValues(databaseRows);
  } else {
    // Se non sono stati trovati dati validi, mostra un messaggio informativo.
    Browser.msgBox(
      'Info',
      'Nessun dato di turno valido trovato per la trasformazione. Verifica la struttura del tuo foglio "' +
        sourceSheetName +
        '".',
      Browser.Buttons.OK,
    );
  }

  // Opzionale: Regola automaticamente la larghezza delle colonne per una migliore leggibilità.
  destSheet.autoResizeColumns(1, databaseRows[0].length);

  // Messaggio di conferma del successo dell'operazione.
  Browser.msgBox(
    'Successo',
    'I dati dei turni sono stati trasformati e salvati nel foglio "' + destSheetName + '".',
    Browser.Buttons.OK,
  );
}

function getValoreRotazione(data) {
  // Controlla che l'input sia una data valida
  if (!(data instanceof Date)) {
    throw new Error('Il parametro deve essere un oggetto Date valido');
  }

  // Data di riferimento: 1 gennaio 2026
  const dataInizio = new Date(2026, 0, 1); // Mesi in JS: 0 = gennaio

  // Calcola la differenza in giorni dalla data di inizio
  const diffGiorni = Math.floor((data - dataInizio) / (1000 * 60 * 60 * 24));

  // Ciclo di 12 giorni
  const ciclo = diffGiorni % 6;
  const valori = [1, 2, 3, 4, 5, 6];

  // Se la data è precedente al 1 gennaio 2026, gestisci il modulo correttamente
  const indice = ((ciclo % 6) + 6) % 6;

  return valori[indice];
}

/**
 * Cerca la data odierna in una riga specificata del foglio attivo
 * e restituisce l'indice numerico della colonna (partendo da 1).
 *
 * @param {number} numeroRiga Il numero della riga (es. 1 per la prima riga) in cui cercare.
 * @return {number} L'indice della colonna (1, 2, 3...) dove è stata trovata la data odierna.
 * Restituisce -1 se la data non viene trovata.
 */
function trovaColonnaData(numeroRiga, dataDaCercare) {
  // Ottiene il foglio di calcolo attivo
  var foglio = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Turno');

  // Imposta la data di oggi per il confronto, ignorando l'ora (molto importante per il confronto)
  var oggi = new Date();
  //var dataDaCercare = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());

  // Ottiene l'ultima colonna piena della riga specificata
  var ultimaColonna = foglio.getLastColumn();

  // Ottiene i valori della riga completa
  // L'indice della riga è 'numeroRiga', la colonna di partenza è 1, si prende una sola riga e 'ultimaColonna' colonne.
  var intervalloRiga = foglio.getRange(numeroRiga, 1, 1, ultimaColonna);
  var valoriRiga = intervalloRiga.getValues()[0]; // getValues() restituisce un array di array, [0] prende l'array della singola riga

  // Cicla sui valori della riga
  for (var i = 0; i < valoriRiga.length; i++) {
    var valoreCella = valoriRiga[i];

    // Controlla se il valore è una data (un oggetto Date in JavaScript)
    if (valoreCella instanceof Date) {
      // Imposta la data della cella per il confronto, ignorando l'ora
      var dataCellaSoloGiorno = new Date(
        valoreCella.getFullYear(),
        valoreCella.getMonth(),
        valoreCella.getDate(),
      );

      // Confronta le due date (solo giorno)
      if (dataCellaSoloGiorno.getTime() === dataDaCercare.getTime()) {
        // La data è stata trovata. L'indice dell'array è 'i', ma i numeri di colonna di Sheets partono da 1,
        // quindi si restituisce i + 1.
        return i + 1;
      }
    }
  }

  // Se la data odierna non è stata trovata, restituisce -1
  return -1;
}

// --- Esempio di Utilizzo (Opzionale) ---

function testTrovaColonna() {
  // Sostituisci 1 con il numero della riga che vuoi analizzare (es. 1 per la riga di intestazione)
  var rigaDaCercare = 4;
  var colonnaTrovata = trovaColonnaDataOdierna(rigaDaCercare);

  if (colonnaTrovata !== -1) {
    Logger.log('La data odierna è stata trovata nella colonna numero: ' + colonnaTrovata);
    Browser.msgBox(
      'Risultato',
      'La data odierna è stata trovata nella colonna numero: ' + colonnaTrovata,
      Browser.Buttons.OK,
    );
  } else {
    Logger.log('La data odierna non è stata trovata nella riga ' + rigaDaCercare);
    Browser.msgBox(
      'Risultato',
      'La data odierna non è stata trovata nella riga ' + rigaDaCercare,
      Browser.Buttons.OK,
    );
  }
}

/**
 * Filtra, ordina alfabeticamente e riordina ciclicamente i nomi degli operatori.
 * INCLUDE LOG DETTAGLIATI PER DIAGNOSI.
 *
 * @param {number} colonnaNomi La colonna (indice numerico, 1-based) contenente i nomi degli operatori.
 * @param {number} colonnaSigleTurno La colonna (indice numerico, 1-based) contenente le sigle dei turni.
 * @param {string} siglaDaCercare La sigla del turno da usare come filtro (es. "M", "P", "N").
 * @param {number} tipoOrdinamento Un numero intero >= 1 (indice dell'elemento che deve diventare il primo).
 * @returns {string[]} Un array di nomi degli operatori filtrati, ordinati e ruotati.
 */
function filtraEOdinaOperatori(colonnaNomi, colonnaSigleTurno, siglaDaCercare, tipoOrdinamento) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Turno');
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  // ------------------------------------------
  // 1. Controlli Iniziali e Log
  // ------------------------------------------

  //Logger.log("--- START DIAGNOSI ---");
  //Logger.log("Foglio Attivo: " + sheet.getName());
  //Logger.log("Ultima riga con dati (LastRow): " + lastRow);
  //Logger.log("Ultima colonna con dati (LastColumn): " + lastColumn);
  //Logger.log("Parametri: Col Nomi=" + colonnaNomi + ", Col Sigle=" + colonnaSigleTurno + ", Sigla=" + siglaDaCercare + ", Ordine=" + tipoOrdinamento);

  if (lastRow < 2) {
    Logger.log("ERRORE: Nessun dato rilevato oltre l'intestazione (Riga 1).");
    return [];
  }

  // 2. Lettura del Range di Dati
  const rangeStartRow = 2; // Iniziamo dalla riga 2 (dopo l'intestazione)
  const rangeNumRows = lastRow - 1;

  // Leggiamo solo le colonne che ci interessano, tra la 1 e l'ultima colonna del foglio
  const range = sheet.getRange(rangeStartRow, 1, rangeNumRows, lastColumn);
  const data = range.getValues();

  //Logger.log("Range letto: R" + rangeStartRow + "C1:R" + lastRow + "C" + lastColumn + " (Righe lette: " + data.length + ")");
  if (data.length === 0) {
    Logger.log('ERRORE: La lettura del range ha restituito 0 righe.');
    return [];
  }

  // 3. Calcola l'indice 0-based corretto per le colonne fornite
  const indiceNomi = colonnaNomi - 1;
  const indiceSigle = colonnaSigleTurno - 1;
  const siglaFiltro = String(siglaDaCercare).trim().toUpperCase();

  //Logger.log("Indice 0-based Nomi: " + indiceNomi + ", Indice 0-based Sigle: " + indiceSigle);
  //Logger.log("Sigla di Ricerca normalizzata: '" + siglaFiltro + "'");

  // Controlla che gli indici siano validi
  if (indiceNomi < 0 || indiceNomi >= lastColumn || indiceSigle < 0 || indiceSigle >= lastColumn) {
    Logger.log(
      'ERRORE: Indici di colonna fuori range per i dati letti. Verifica i parametri colonnaNomi e colonnaSigleTurno.',
    );
    return [];
  }

  // 4. Filtra e ottiene la lista dei nomi
  let nomiFiltrati = data
    .filter((row, index) => {
      // Ottiene il valore della sigla dalla riga corrente, lo normalizza (trim e maiuscolo)
      const siglaCella = String(row[indiceSigle]).trim().toUpperCase();

      // LOG: Visualizza alcune righe filtrate per controllo
      if (index < 5) {
        //Logger.log("Riga " + (index + rangeStartRow) + ": Col Nomi = " + row[indiceNomi] + ", Col Sigle = " + row[indiceSigle] + " (Normalizzata: " + siglaCella + ")");
      }

      return siglaCella === siglaFiltro;
    })
    .map((row) => String(row[indiceNomi]).trim()) // Estrae il nome
    .filter((name) => name); // Rimuove eventuali stringhe di nomi vuote

  // ------------------------------------------
  // 5. Controllo dopo il Filtraggio
  // ------------------------------------------

  //Logger.log("Nomi Trovati dopo il filtraggio: " + nomiFiltrati.length);

  if (nomiFiltrati.length === 0) {
    Logger.log(
      "RISULTATO FINALE: Lista vuota. Controllare se la sigla '" +
        siglaDaCercare +
        "' è presente nella colonna " +
        colonnaSigleTurno +
        '.',
    );
    return []; // La lista è vuota, restituisce un array vuoto
  }

  // 6. Ordinamento Alfabetico (A-Z)
  nomiFiltrati.sort();
  //Logger.log("Lista Ordinata Alfabeticamente (A-Z): " + nomiFiltrati.join(', '));

  // 7. Ordinamento Ciclico (Rotazionale)
  const lunghezzaLista = nomiFiltrati.length;
  const indiceRotazione = (tipoOrdinamento - 1) % lunghezzaLista;

  //Logger.log("Parametro Ordine (1-based): " + tipoOrdinamento);
  //Logger.log("Indice di Rotazione (0-based): " + indiceRotazione);

  const parteDopo = nomiFiltrati.slice(indiceRotazione);
  const partePrima = nomiFiltrati.slice(0, indiceRotazione);

  const nomiOrdinatiCiclicamente = parteDopo.concat(partePrima);

  Logger.log('Ordine: ' + tipoOrdinamento);
  Logger.log('RISULTATO FINALE: Lista Rotata: ' + nomiOrdinatiCiclicamente.join(', '));
  Logger.log('--- END DIAGNOSI ---');

  return nomiOrdinatiCiclicamente;
}

function provaDiagnosi() {
  const colNomi = 2; // Esempio: Colonna B

  var paginaAssegnazioni =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AssegnazionePazienti');
  var rangepaginaAssegnazioni = paginaAssegnazioni.getDataRange();
  var datipaginaAssegnazioni = rangepaginaAssegnazioni.getValues();
  var dataAssegnazione = datipaginaAssegnazioni[1][1];
  var colSigle = trovaColonnaData(4, dataAssegnazione); // Esempio: Colonna L
  var ordine = getValoreRotazione(dataAssegnazione); // Esempio: Il 2° nome in ordine alfabetico diventa il primo
  paginaAssegnazioni.getRange(4, 1, 10, 3).clearContent();

  var sigla = 'M';
  var listaMattino = filtraEOdinaOperatori(colNomi, colSigle, sigla, ordine);

  // 1. Prepara i dati trasformando l'array in formato "colonna"
  var datiPerColonna = listaMattino.map(function (elemento) {
    return [elemento];
  });
  paginaAssegnazioni.getRange(4, 1, listaMattino.length, 1).setValues(datiPerColonna);

  sigla = 'P';
  ordineP = ordine - 1;
  if (ordineP < 1) {
    ordineP = 6 + ordineP;
  }
  var listaPomeriggio = filtraEOdinaOperatori(colNomi, colSigle, sigla, ordineP);
  var datiPerColonna = listaPomeriggio.map(function (elemento) {
    return [elemento];
  });
  paginaAssegnazioni.getRange(4, 2, listaPomeriggio.length, 1).setValues(datiPerColonna);

  sigla = 'N';
  ordineN = ordine - 2;
  if (ordineN < 1) {
    ordineN = 6 + ordineN;
  }
  var listaNotte = filtraEOdinaOperatori(colNomi, colSigle, sigla, ordineN);
  var datiPerColonna = listaNotte.map(function (elemento) {
    return [elemento];
  });
  paginaAssegnazioni.getRange(4, 3, listaNotte.length, 1).setValues(datiPerColonna);
}
