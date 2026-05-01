# Mappa Logica del Progetto NurseHub

## Pagine Principali

### 1. Home / Dashboard
- **Funzione:** Vista rapida turni e opportunità.
- **Componenti:**
  - `ActiveRequestsCard.vue`: Mostra i turni scoperti e permette di candidarsi.
  - `SwapOpportunitiesCard.vue`: Mostra i cambi proposti dai colleghi.
- **Logica:** Filtra i turni in base al `configId` dell'utente e alla compatibilità oraria.
- **Novità:** Localizzazione IT forzata per date e giorni della settimana.

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

### 1. Localizzazione e Standard Date
- **Formato Unificato:** Tutte le date nel sistema utilizzano il formato italiano `DD/MM/YYYY` (gg/mm/aaaa).
- **Calendari Localizzati:** Ogni componente `q-date` (Assenze, Scambi, Filtri Admin, Profilo) integra la locale `itLocale` per nomi mesi e giorni.
- **Integrazione UI:** Sostituzione sistematica degli input `type="date"` con selettori Quasar localizzati per garantire uniformità tra browser e dispositivi.

### 2. Il "Cambio Turno" (Swap)
1. **Creazione:** L'utente sceglie data e turno da offrire. 
   - *Logic Check:* Deve avere quel turno in quella data (Validazione client-side).
2. **Notifica:** Parte una notifica anonima a tutti i colleghi compatibili e agli admin.
3. **Accettazione:** Un collega accetta. Lo stato diventa `PENDING_ADMIN`.
4. **Approvazione:** L'admin conferma. 
   - **Firebase:** I turni vengono invertiti nei documenti `operators`.
   - **Google Sheets:** Se in modalità "Auto", viene aggiornato il file Master tramite `api/update-sheet-swap.js`.

### 4. Sincronizzazione Isolata & Filtro Maestro (Phase 30.1)
- **Filtro Maestro (SuperAdmin):** Il passaggio tra un reparto e l'altro (cambio `configId`) aggiorna unicamente la variabile in RAM (`configStore.activeConfigId`). Tutti i componenti e le computed properties (liste, utenti, richieste, notifiche in arrivo) si filtrano lato client-side a latenza zero, garantendo il 100% di isolamento visivo senza generare costi per Firebase Reads.
- **Componente di Sync:** `GlobalSyncBtn.vue`.
- **Regole Sicurezza Rigide:** `firestore.rules` autorizza l'aggiornamento degli operatori agli Admin o agli Utenti Base purché l'azione sia rigorosamente limitata al `configId` di loro appartenenza (Config-Fencing DB-level).
- **Stato Isolato:** Ogni reparto ha il suo stato in `systemConfigurations/{configId}/metadata/sync`.
- **Cooldown Indipendente:** Il database e il client forzano un cooldown di 1 minuto per gli Admin e 2 ore per gli Utenti Base, applicato al singolo reparto.
- **Auto-Refresh Intelligente:** Al cambio pagina o ritorno al focus, l'app verifica il timestamp specifico del reparto attivo; se c'è stata una sincronizzazione esterna per quel reparto, ricarica i dati.

### 5. Sincronizzazione Operatore (Nuovi Utenti)
- **Componente:** `SyncOperatorCard.vue`.
- **Azione:** Cerca l'associazione tra utente Firebase e riga del foglio turni (per Email o Nome/Cognome).
- **Sicurezza:** Permette il collegamento solo se l'operatore non ha già un `userId` e l'utente non ha già un `operatorId`.
- **Effetto:** Alla conferma, pulisce la cache Pinia (`scheduleStore`) e ricarica i dati per mostrare i turni aggiornati.
- **Validazione Admin:** Quando l'admin crea una richiesta per conto di un utente, il sistema verifica il turno reale dell'utente e blocca/avvisa in caso di discrepanza.

### 6. Sistema di Rotazione Interattiva (Phase 30)
- **Logica "State Machine":** Abbandonato il calcolo rigido basato su `startDate`. Il sistema usa una state machine basata sul `currentColumnIndex` della matrice dei turni (es. 18 step).
- **Matrice Infinita:** Superata l'ultima colonna, il sistema riparte dalla prima applicando un ciclo Modulo matematico, garantendo una progressione senza fine.
- **Timer Autonomo:** Ogni 5 giorni scatta il timer: il sistema avanza la colonna, notifica gli utenti e ripianifica autonomamente la "sveglia" ai prossimi 5 giorni (120 ore).
- **Controllo Utente ("Democratizzazione"):** Qualsiasi utente che faccia parte del gruppo di rotazione può mettere in "Pausa" il timer (es. per il periodo di "Fuori Turno" estivo) e riattivarlo, impostando manualmente il giorno e l'ora esatta del prossimo scatto. Da quel momento il timer riprende a girare.
- **Componenti:** 
  - `RotationManager.vue` (Admin): Per definire i gruppi, aggiungere operatori e compilare la matrice di rotazione.
  - `RotationWidget.vue` (Utenti): Espanso nella pagina Calendario, permette ai membri di vedere il Setting attuale (A/B) e gestire la pausa/ripresa del timer.

## Note Tecniche di Manutenzione

### 1. UX & Visual Feedback (Phase 25+)
- **Skeletons [COMPLETATO]**: Implementazione sistematica di `<q-skeleton>` su tutte le liste asincrone e dashboard (Turni Home, Log Backup, Lista Utenti Admin, Storico Richieste, Analytics e Tabella Turni Admin).
- **Esportazione PDF/CSV [COMPLETATO]**: Implementazione di reportistica avanzata nella dashboard Analytics con generazione client-side di documenti professionali.
- **Perceived Performance**: L'obiettivo è mostrare la struttura della pagina entro 100ms, caricando i dati reali in background.
- **Transizioni**: Uso di `q-slide-transition` e Skeleton UI per eliminare lo sfarfallio del layout (Cumulative Layout Shift) durante il caricamento dei dati da Firestore/Sheets.

### 4. Manutenzione Dati e Sessioni
- **Pulizia Notifiche**: Le notifiche hanno scopo informativo temporaneo. Cancellazione automatica ogni 30 giorni via Vercel Cron.
- **Cache Isolation**: Durante il `logout`, è OBBLIGATORIO svuotare tutte le cache locali (specialmente `scheduleStore`) per evitare che i turni di un utente siano visibili a quello successivo sullo stesso dispositivo.
- **Session Hardening**: L'inizializzazione dell'app (`authStore.init`) deve attendere il caricamento completo del profilo Firestore prima di permettere l'accesso alle pagine protetti, evitando "buchi" di dati o race conditions.

### 5. Standard di Documentazione (Phase 29)
- **Documentazione Sistematica [COMPLETATO]**: Audit e implementazione degli header JSDoc obbligatori per tutti i file critici (Pages, Services, Stores e Composables) secondo lo standard §1.7 di `project-rules.md`.
- **Tracciabilità**: Ogni file include ora `@created`, `@modified` e `@notes` per tracciare l'evoluzione delle logiche di business e delle integrazioni esterne (Firebase/Google Sheets/Vercel).
- **Manutenibilità**: I commenti JSDoc guidano i futuri sviluppatori attraverso le complessità dei flussi asincroni e delle gerarchie di permessi.

## Note Tecniche di Manutenzione
- **Swipe Sensitivity**: La sensibilità dello swipe tra i tab della Home è stata ridotta (threshold 100px) per evitare cambi pagina accidentali.
- **Dynamic Routing**: Le rotte dello swipe vengono ricalcolate dinamicamente in base ai permessi dell'utente e alle preferenze di visibilità impostate nelle Settings.
- **Auto-Selection Calendar**: Il calendario deve resettare la selezione se l'ID utente cambia e attendere il profilo completo prima di auto-selezionare l'operatore predefinito.
