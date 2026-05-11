function creaTabellaPresaInCarico() {
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
//----------------------------------------------------------------------------------------------------------------------------

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

  //Logger.log("Ordine: "+tipoOrdinamento)
  //Logger.log("RISULTATO FINALE: Lista Rotata: " + nomiOrdinatiCiclicamente.join(', '));
  //Logger.log("--- END DIAGNOSI ---");

  return nomiOrdinatiCiclicamente;
}
//--------------------------------------------------------------------------------------------------------------------------------

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
//---------------------------------------------------------------------------------------------------------------------------------------

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
