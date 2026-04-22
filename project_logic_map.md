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
- **Logica Validazione:** Impedisce di offrire un turno diverso da quello presente in calendario per la data selezionata.
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

### 4. Sincronizzazione Globale
- **Componente:** `GlobalSyncBtn.vue`.
- **Azione:** Sincronizzazione completa Google Sheets -> Firebase per la configurazione attiva.
- **Stato Globale:** Registrazione in `system/syncStatus` (timestamp e autore).
- **Cooldown Differenziato:** 1 minuto per Admin, 2 ore per Utente.
- **Auto-Refresh:** Ogni cambio pagina (`MainLayout.vue`) e ogni ritorno al focus (`DashboardPage.vue`) confronta il timestamp globale con quello locale; se c'è una sincronizzazione più recente, ricarica i dati automaticamente.

## Flussi Critici

### Sincronizzazione Operatore (Nuovi Utenti)
- **Componente:** `SyncOperatorCard.vue`.
- **Azione:** Cerca l'associazione tra utente Firebase e riga del foglio turni (per Email o Nome/Cognome).
- **Sicurezza:** Permette il collegamento solo se l'operatore non ha già un `userId` e l'utente non ha già un `operatorId`.
- **Effetto:** Alla conferma, pulisce la cache Pinia (`scheduleStore`) e ricarica i dati per mostrare i turni aggiornati.
