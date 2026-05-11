# Mappa Logica del Progetto NurseHub

## Pagine Principali

### 1. Home / Dashboard
- **Funzione:** Vista rapida turni e opportunità.
- **Componenti:**
  - `ActiveRequestsCard.vue`: Mostra i turni scoperti.
    - **Filtro "Non mi interessa":** Gli utenti possono nascondere opportunità irrilevanti (il loro UID viene aggiunto all'array `hiddenBy`). Le richieste nascoste finiscono in un archivio espandibile.
    - **Ordinamento Dinamico:** Possibilità di ordinare per "Data Creazione" o "Data Turno".
  - `SwapOpportunitiesCard.vue`: Mostra i cambi proposti dai colleghi (stessa logica di filtro `hiddenBy` e ordinamento).
- **Logica:** Filtra i turni in base al `configId` dell'utente e alla compatibilità oraria.
- **Design:** Gerarchia visuale premium nei turni (Lettera grande per il codice turno, icona piccola sotto).

### 2. Le Mie Richieste (`UserRequestsPage.vue`)
- **Sezioni:**
  - **Assenza:** Per chiedere ferie/malattia.
  - **Cambio Turno:** Per proporre uno scambio con un collega.
- **Storico:** Elenco di tutte le richieste passate (Assenze e Cambi).
- **Logica Validazione:** 
  - **Cambi:** Impedisce di offrire un turno diverso da quello presente in calendario per la data selezionata.
  - **Assenze:** Impedisce di chiedere assenza per un turno diverso da quello previsto nel calendario (es. non puoi chiedere P se sei di M).
- **Notifiche:** Invio unificato e anonimo (Admin + Colleghi) per evitare duplicati e proteggere la privacy.

### 3. Gestione Utenti e Gerarchia (Admin & SuperAdmin)
- **Pagina:** `AdminUsersPage.vue`.
- **Gerarchia Ruoli (Phase 27):**
  - **SuperAdmin:** Accesso universale, gestione configurazioni di sistema, backup e permessi admin. Può cambiare il reparto attivo tramite il `ConfigSelector` nell'header.
  - **Admin (Config-Fencing):** Gestisce **solo** i reparti assegnati (`managedConfigIds`). Non può creare/modificare configurazioni globali e non vede il selettore di reparti nell'header (è bloccato sul suo reparto predefinito).
  - **User:** Accesso limitato ai propri turni e richieste.
- **Config-Fencing:** Isolamento totale dei dati tra reparti. Un Admin degli "Infermieri TI" non può vedere né gestire i dati degli "Infermieri PS".
- **Backup & Infrastructure:**
  - Il sistema di Backup (Export/Import Firestore) richiede obbligatoriamente che il progetto Firebase sia sul piano **Blaze (Pay-as-you-go)**.
  - Le API su Vercel gestiscono l'avvio e la logistica, ma l'esecuzione materiale avviene sui server Google Cloud.

### 4. Personalizzazione Navigazione e Sicurezza (Phase 28)
- **Settings:** In `SettingsPage.vue`, Admin e SuperAdmin possono personalizzare la visibilità delle schede (tab) del footer.
- **Persistenza:** Le preferenze di visibilità sono salvate in `uiStore` (localStorage).
- **Navigazione Dinamica:** Sia il menu footer che la logica di "swipe" si adattano dinamicamente mostrando solo le rotte abilitate.
- **Sicurezza Gerarchica:**
  - La pagina **Sistema** (`/admin`) è ora accessibile **esclusivamente** ai SuperAdmin.
  - **Redirect di Sicurezza:** Gli Admin che tentano di accedere via URL diretto a `/admin` vengono automaticamente reindirizzati alla dashboard con notifica di accesso negato.

## Flussi Critici

### 1. Localizzazione e Standard Date (Elite Standard)
- **Centralizzazione**: Tutta la logica di localizzazione è gestita in `src/utils/dateUtils.ts` e `src/constants/locales.ts`.
- **AppDateInput.vue**: È il componente master obbligatorio per ogni input di data. Gestisce automaticamente il formato `DD/MM/YYYY` per l'utente e `YYYY-MM-DD` per il database.
- **Formato Unificato**: Visualizzazione sempre in formato italiano (`gg/mm/aaaa`).
- **Standard Visuale Turni**: Lettera grande e centrale (M, P, N) con icona di supporto per massima leggibilità (Elite UI).

### 2. Il "Cambio Turno" (Swap)
1. **Creazione:** L'utente sceglie data e turno da offrire. 
   - *Logic Check:* Deve avere quel turno in quella data (Validazione client-side).
2. **Notifica:** Parte una notifica anonima a tutti i colleghi compatibili e agli admin.
3. **Accettazione:** Un collega accetta. Lo stato diventa `PENDING_ADMIN`.
4. **Approvazione:** L'admin conferma. 
   - **Firebase:** I turni vengono invertiti nei documenti `operators`.
   - **Google Sheets:** Se in modalità "Auto", viene aggiornato il file Master tramite `api/update-sheet-swap.js`.

### 3. Il Sistema Esperto Admin (Expert System - Maggio 2026)
L'app funge da "Vigile Intelligente" tra Database e Google Sheets per garantire coerenza assoluta.
- **Pre-flight Sync Check**: Prima di ogni approvazione, il sistema interroga Google Sheets (via GAS) per verificare che il turno dell'operatore non sia cambiato manualmente su Excel.
- **Dialogo di Risoluzione Conflitti**: In caso di mismatch (es. Excel dice 'S' ma App si aspetta 'R'), l'Admin deve scegliere esplicitamente tra:
  - **Forza Sovrascrittura**: L'app vince e riscrive il dato su Excel.
  - **Gestione Manuale**: L'app aggiorna solo Firestore e lascia l'Admin libero di agire su Excel.
  - **Annulla**: Per investigare la causa dell'errore.
  - **Motore di Matching Centralizzato (Expert System Core)**: 
    - Tutta la logica di abbinamento tra operatori e scenari risiede in `useShiftLogic.ts` (`isOperatorEligibleForRole`).
    - **Single Source of Truth**: Questo motore è l'unico responsabile per popolare la Dashboard Utente, i Suggerimenti Admin e per filtrare l'invio delle Notifiche.
    - **Temporal Guard Onnipresente**: 
      - **In-Shift Guard**: Impedisce "Spostamenti" se il turno è iniziato da >30 min.
      - **End-Time Guard**: Rimuove l'operatore se il suo turno è finito da >30 min (considerato "Smontato").
    - **Anti-Noise Notification Guard**: Prima di inviare notifiche, il sistema ricontrolla l'idoneità temporale. Se un operatore è diventato inidoneo tra la ricerca e l'invio (es. è passato il tempo limite), non riceve la notifica.
- **Organizzazione Offerte (Multi-Scenario Mapping)**: 
  - **Lato Utente**: Le opzioni di copertura sono de-duplicate per "Ruolo" (es. se N12 è presente in 3 scenari, l'utente vede una sola riga). L'utente si candida per un'azione di copertura specifica.
  - **Lato Admin**: Il sistema mappa automaticamente ogni candidatura su **tutti** gli scenari compatibili. Se un operatore offre "N12", il suo nome apparirà in ogni raggruppamento (Scenario 3, 4, 5...) che prevede quel ruolo, permettendo all'Admin di valutare l'offerta in contesti di gruppo differenti.
- **Snapshot Indelebile**: Al momento della chiusura, l'app salva un oggetto `resolutionMetadata` (ID, Nome, Scenario) nel documento Firestore. Questo garantisce che lo storico mostri sempre chi ha coperto il turno, anche se i dati degli operatori cambiano in futuro.

### 4. Manutenzione e Pulizia Automatica (Phase 31)
- **TTL (Time To Live) Firestore:** Implementazione del campo `expireAt` in ogni documento critico per l'eliminazione automatica dal database (Piano Blaze richiesto).
- **Notifiche Intelligenti**: L'invio delle notifiche è subordinato al Motore di Matching. Se un operatore non vede più l'opportunità in dashboard (perché scaduta o incompatibile), il sistema non gli invia il ping, riducendo il rumore di fondo.
- **Scadenza Real-time Unificata**: Le richieste (Assenze e Cambi) e le relative offerte non approvate entro l'orario di inizio del turno vengono marcate visivamente come `SCADUTO` (Admin) o `Scaduta` (Utente) in tempo reale.

### 5. Sincronizzazione Isolata & Filtro Maestro (Phase 30.1)
- **Filtro Maestro (SuperAdmin):** Il passaggio tra un reparto e l'altro (cambio `configId`) aggiorna unicamente la variabile in RAM (`configStore.activeConfigId`). Tutti i componenti e le computed properties (liste, utenti, richieste, notifiche in arrivo) si filtrano lato client-side a latenza zero, garantendo il 100% di isolamento visivo senza generare costi per Firebase Reads.
- **Componente di Sync:** `GlobalSyncBtn.vue`.
- **Regole Sicurezza Rigide:** `firestore.rules` autorizza l'aggiornamento degli operatori agli Admin o agli Utenti Base purché l'azione sia rigorosamente limitata al `configId` di loro appartenenza (Config-Fencing DB-level).
- **Stato Isolato:** Ogni reparto ha il suo stato in `systemConfigurations/{configId}/metadata/sync`.
- **Cooldown Indipendente:** Il database e il client forzano un cooldown di 1 minuto per gli Admin e 2 ore per gli Utenti Base, applicato al singolo reparto.
- **Auto-Refresh Intelligente:** Al cambio pagina o ritorno al focus, l'app verifica il timestamp specifico del reparto attivo; se c'è stata una sincronizzazione esterna per quel reparto, ricarica i dati.

### 6. Sistema di Rotazione Interattiva (Phase 31)
- **Logica "State Machine":** Basata sul `currentColumnIndex`. Il sistema gestisce una matrice infinita tramite ciclo Modulo.
- **Elite Preview**: Il `RotationWidget` mostra la rotazione attuale con badge vibranti e la **prossima rotazione** in formato ultra-compatto (`bg-grey-3`, font 0.55rem) per una gerarchia visiva chiara.
- **Timer Autonomo & Manuale**: Avanzamento automatico ogni 5 giorni con possibilità di pausa e ripartenza manuale (Democratizzazione del timer).

## Note Tecniche di Manutenzione

### 1. UX & Visual Feedback
- **Skeletons**: Implementazione di `<q-skeleton>` su tutte le liste asincrone.
- **Scroll Snap**: La bacheca turni in dashboard utilizza lo scorrimento magnetico orizzontale e la barra di scorrimento stilizzata per una navigazione touch impeccabile.
- **Swipe-Stop**: Lo scorrimento orizzontale dei turni ferma la propagazione degli eventi (`.stop`) per evitare cambi pagina accidentali.
- **Esportazione PDF/CSV**: Generazione reportistica Analytics client-side.

### 2. Sicurezza e Sessioni
- **Cache Isolation**: Durante il `logout`, svuotamento cache `scheduleStore`.
- **Session Hardening**: L'inizializzazione dell'app (`authStore.init`) deve attendere il profilo Firestore completo.

### 3. Manutenibilità & DRY
- **JSDoc**: Header JSDoc obbligatori per tutti i file.
- **No Duplication**: Vietata la definizione locale di `itLocale` o array di mesi/giorni. Usare sempre `src/constants/locales.ts`.
- **Standardizzazione UI**: Design vibrante, lettere dei turni ad alta visibilità e uso sistematico di `AppDateInput`.
- **Elite Formatting**: Le note inviate a Google Sheets utilizzano emoji e formattazione multiriga (👤 Operatore, 📝 Nota, 🤝 Sostituto, 📋 Scenario, ✅ Approvazione) per massima chiarezza visiva sul file Excel.

### 7. Gestione Avanzata Turni & Audit Log (Phase 32 - Ottimizzazione Admin)
Il sistema è stato potenziato per trasformare `AdminShiftTable.vue` in una console di comando chirurgica, garantendo tracciabilità totale (Audit Trail) sia su Firebase che su Excel.

- **Modifica Diretta & UX "Interattiva"**:
  - **Grid-based Selector**: La lista di modifica è stata sostituita da una griglia compatta di badge colorati (M, P, N, R, A, S) per una selezione immediata.
  - **Workflow "Select -> Note -> Confirm"**: L'admin seleziona il turno (evidenziato con bordo indigo e zoom), inserisce una nota opzionale e solo allora clicca "Conferma". Questo evita chiusure accidentali e promuove la documentazione delle modifiche.
  - **Visual Feedback**: Le celle con modifiche pendenti mostrano un bordo tratteggiato (`pending-badge`). Il pulsante flottante "Salva su Excel" appare dinamicamente solo in presenza di modifiche e mostra il conteggio totale.
- **Audit Trail Persistente (App History)**:
  - Ogni operatore possiede un campo `history` in Firestore che registra: turno precedente, nuovo turno, autore della modifica, timestamp e la nota inserita.
  - **Row Expander Premium**: Cliccando sull'icona orologio (🕒) si apre un'area di dettaglio che mostra:
    - **Cronologia Modifiche**: Timeline visiva dei cambiamenti effettuati dall'app.
    - **Note Excel Associate**: Riepilogo di tutti i commenti presenti sul file Excel per quell'operatore.
    - **Ordinamento Dinamico**: Un toggle permette di visualizzare la cronologia in ordine "Più recenti" (Discendente) o "Più vecchi" (Crescente).
- **Sincronizzazione Excel Certificata**:
  - **Audit Log Cromatico**: Le modifiche da App sono distinte per colore (Rosso per richieste, Blu per modifiche manuali admin).
  - **Note Professionali**: Ogni nota su Excel è formattata con l'intestazione `Modificato dall'app` seguita dai dettagli: `🛠️ Modifica: [Nota] (Admin: Nome) | 🔄 Da: X ➔ a: Y`.
- **Integrità & Performance**:
  - **Batch Write**: Tutte le modifiche locali (turni + storico) vengono inviate a Firestore in un'unica transazione atomica per garantire la coerenza dei dati.
  - **Auto-Cleanup**: Alla chiusura dei menu di modifica, lo stato temporaneo viene resettato automaticamente per evitare errori di inserimento.
- **Sorting Persistente**: L'ordine di visualizzazione (Excel vs Alfabetico) è salvato nel `localStorage` e ripristinato ad ogni accesso.
- **Filtri Persistenti**: Lo stato dei filtri (operatori, date, codici turno, note) viene salvato automaticamente nel `localStorage` per una navigazione senza attriti.

### 8. Gestione Scenari Combinati & Turni Tecnici Differenziati (Phase 33 - Expert System Advance)
Il sistema è ora in grado di gestire sostituzioni complesse che richiedono la collaborazione di più operatori (es. copertura di un pomeriggio tramite un prolungamento mattina + un anticipo notte).

- **Mappatura Turni Tecnici (MP, MP12, N11, N12)**:
  - Introdotta la distinzione tra **MP** (Mattina+Pomeriggio standard fino alle 19:00) e **MP12** (Mattina+Pomeriggio prolungato fino alle 20:00).
  - La logica speculare si applica alle notti: **N11** (Anticipata) e **N12** (Prolungata).
- **Batch Approval Workflow (Copertura di Gruppo)**:
  - **Selezione Multipla**: Nella sezione "Monitoraggio Offerte", l'Admin può selezionare tramite checkbox più operatori all'interno dello stesso scenario combinato.
  - **Approvazione Atomica**: Il pulsante "Approva Selezione" esegue un'operazione batch che chiude la richiesta e aggiorna contemporaneamente i calendari di tutti i partecipanti.
  - **Mapping Automatico**: L'app deduce autonomamente il codice turno tecnico (es. MP12 invece di P) in base al ruolo dell'operatore nello scenario, eliminando errori di inserimento manuale.
- **Audit Log Sincronizzato**:
  - Le note su Google Sheets per l'operatore assente mostrano l'elenco completo dei sostituti (`Sostituito da: Op A + Op B`).
  - Ogni sostituto riceve sul proprio calendario la nota specifica relativa allo scenario e al ruolo ricoperto.
