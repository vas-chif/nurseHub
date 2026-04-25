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

### 3. Gestione Utenti (Admin)
- **Pagina:** `AdminUsersPage.vue`.
- **Azioni:**
  - Promuovere a Admin / Rimuovere Admin.
  - Approvare/Disapprovare accesso utente.
- **Tecnologia:** Custom Claims via Vercel API (`api/update-role.js`).

## Flussi Critici

### Il "Cambio Turno" (Swap)
1. **Creazione:** L'utente sceglie data e turno da offrire. 
   - *Logic Check:* Deve avere quel turno in quella data (Validazione client-side).
2. **Notifica:** Parte una notifica anonima a tutti i colleghi compatibili e agli admin.
3. **Accettazione:** Un collega accetta. Lo stato diventa `PENDING_ADMIN`.
4. **Approvazione:** L'admin conferma. 
   - **Firebase:** I turni vengono invertiti nei documenti `operators`.
   - **Google Sheets:** Se in modalità "Auto", viene aggiornato il file Master tramite `api/update-sheet-swap.js`.

### 4. Sincronizzazione Isolata (Department-Based)
- **Componente:** `GlobalSyncBtn.vue`.
- **Azione:** Sincronizzazione Google Sheets -> Firebase **solo** per la configurazione selezionata.
- **Stato Isolato:** Ogni reparto ha il suo stato in `systemConfigurations/{configId}/metadata/sync`.
- **Cooldown Indipendente:** 1 minuto per Admin, 2 ore per Utente, calcolato per singolo reparto.
- **Auto-Refresh Intelligente:** Al cambio pagina o ritorno al focus, l'app verifica il timestamp specifico del reparto attivo; se c'è stata una sincronizzazione esterna per quel reparto, ricarica i dati.

## Flussi Critici

### Sincronizzazione Operatore (Nuovi Utenti)
- **Componente:** `SyncOperatorCard.vue`.
- **Azione:** Cerca l'associazione tra utente Firebase e riga del foglio turni (per Email o Nome/Cognome).
- **Sicurezza:** Permette il collegamento solo se l'operatore non ha già un `userId` e l'utente non ha già un `operatorId`.
- **Effetto:** Alla conferma, pulisce la cache Pinia (`scheduleStore`) e ricarica i dati per mostrare i turni aggiornati.
- **Validazione Admin:** Quando l'admin crea una richiesta per conto di un utente, il sistema verifica il turno reale dell'utente e blocca/avvisa in caso di discrepanza.

## Note Tecniche di Manutenzione

### 1. Pulizia Notifiche
- **Policy:** Le notifiche hanno scopo informativo temporaneo.
- **Retention:** Si consiglia la cancellazione automatica (via Cloud Function o manutenzione manuale) ogni 30 giorni per evitare accumuli nel database.

### 2. Gesture & Navigazione
- **Swipe Sensitivity:** La sensibilità dello swipe tra i tab della Home è stata ridotta (aumentato il threshold/tempo) per evitare cambi pagina accidentali durante lo scroll verticale.
