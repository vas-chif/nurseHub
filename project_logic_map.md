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

### 3. Manutenzione e Pulizia Automatica (Phase 31)
- **TTL (Time To Live) Firestore:** Implementazione del campo `expireAt` in ogni documento critico per l'eliminazione automatica dal database (Piano Blaze richiesto).
- **Notifications:** Eliminazione automatica dopo **15 giorni**.
- **shiftRequests & shiftSwaps:** Eliminazione automatica dopo **90 giorni** se lo stato è `CLOSED`, `REJECTED` o `EXPIRED`.
- **Scadenza Real-time:** Le richieste non approvate entro l'orario di inizio del turno vengono marcate visivamente come `EXPIRED` e non sono più modificabili/accettabili.

### 4. Sincronizzazione Isolata & Filtro Maestro (Phase 30.1)
- **Filtro Maestro (SuperAdmin):** Il passaggio tra un reparto e l'altro (cambio `configId`) aggiorna unicamente la variabile in RAM (`configStore.activeConfigId`). Tutti i componenti e le computed properties (liste, utenti, richieste, notifiche in arrivo) si filtrano lato client-side a latenza zero, garantendo il 100% di isolamento visivo senza generare costi per Firebase Reads.
- **Componente di Sync:** `GlobalSyncBtn.vue`.
- **Regole Sicurezza Rigide:** `firestore.rules` autorizza l'aggiornamento degli operatori agli Admin o agli Utenti Base purché l'azione sia rigorosamente limitata al `configId` di loro appartenenza (Config-Fencing DB-level).
- **Stato Isolato:** Ogni reparto ha il suo stato in `systemConfigurations/{configId}/metadata/sync`.
- **Cooldown Indipendente:** Il database e il client forzano un cooldown di 1 minuto per gli Admin e 2 ore per gli Utenti Base, applicato al singolo reparto.
- **Auto-Refresh Intelligente:** Al cambio pagina o ritorno al focus, l'app verifica il timestamp specifico del reparto attivo; se c'è stata una sincronizzazione esterna per quel reparto, ricarica i dati.

### 5. Sistema di Rotazione Interattiva (Phase 31)
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
