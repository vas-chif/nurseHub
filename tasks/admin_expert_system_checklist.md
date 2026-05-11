# Checklist Implementazione Sistema Esperto Admin

Questa checklist traccia il potenziamento della logica di gestione richieste Admin, garantendo l'integrità dei dati tra Firestore e Google Sheets.

## Fase 1: Fonte di Verità & Sicurezza (Urgent)
- [x] **1.1 Verifica Pre-Approvazione (Pre-flight)**: Implementare il controllo in tempo reale su Google Sheets prima di ogni approvazione per rilevare incongruenze di turno.
- [x] **1.2 Dialogo di Conflitto Intelligente**: Creazione del pannello Admin con opzioni "Forza Sovrascrittura", "Gestione Manuale" e "Annulla".
- [x] **1.3 Snapshot di Chiusura (Storico)**: Modifica del salvataggio su Firestore per "scolpire" i dati del sostituto (ID, Nome, Scenario) nel documento chiuso, eliminando i "sostituti fantasma".

## Fase 2: Organizzazione & Visibilità (UX)
- [x] **2.1 Raggruppamento Offerte per Scenario**: Refactoring della lista monitoraggio offerte per mostrare gli scenari ordinati per complessità (1, 2, 3...).
  - [x] **Smart Mapping**: De-duplicazione lato utente e visualizzazione multi-scenario lato admin.
- [x] **2.2 Filtro Scenari Vuoti**: Nascondere automaticamente gli scenari che non hanno candidati per pulire l'interfaccia.

## Fase 3: Logica Temporale (Guardia dell'Orologio)
- [x] **3.1 Definizione Orari di Inizio**: Configurazione degli orari standard (M, P, N) nella logica di sistema.
- [x] **3.2 Filtro Suggerimenti "Passati"**: Implementazione del blocco per scenari che coinvolgono turni già iniziati o conclusi rispetto all'orario attuale (Applicato a vista Admin e Utente).
- [x] **3.3 Invalida Offerte Scadute**: Marcare come non approvabili le offerte che sono diventate temporalmente impossibili.

---
**Regole di Progetto Attive:**
- [x] Sincronizzazione Google Sheets (Priority 1)
- [x] Regola N ➔ S (Smonto obbligatorio)
- [x] Note trasparenti con Emoji
- [x] Coerenza Temporale (Expert System)
