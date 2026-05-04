# 🛠️ Piano di Regolarizzazione Progetto NurseHub

> **Creato:** 04/05/2026
> **Basato su:** `codebase_audit_2026-05-04.md`
> **Regola:** Spuntare ogni item SOLO dopo aver eseguito `yarn tsc --noEmit` + `yarn lint` senza errori.

---

## 🔴 PRIORITÀ ALTA — Sicurezza & Architettura

- [ ] **[SECURITY] `roleGuard.ts` — Protezione preventiva `/admin`**
  - Aggiungere logica nel guard che blocca gli admin normali (non superAdmin) **prima** che la route venga caricata, con redirect a `/dashboard` e `$q.notify` negative.
  - Attualmente la protezione è solo in `onMounted` di `AdminPage.vue` (lato UI, non preventivo).
  - File: `src/router/guards/roleGuard.ts`

- [ ] **[JWT] Aggiungere `configId` di appartenenza ai Custom Claims**
  - Il JWT attualmente porta `role`, `canManageAdmins` ma **non** il `configId` dell'utente.
  - Aggiornare la Cloud Function `api/set-claims.js` per includere `configId` (e `managedConfigIds` per gli admin) nel token.
  - Aggiornare `api/migrate-claims.js` per retrocompatibilità.
  - Aggiornare `authStore.ts` per leggere `configId` dal claim JWT (fallback Firestore).
  - Aggiornare `firestore.rules` per usare `request.auth.token.configId` nelle regole di Config-Fencing (costo zero vs lettura Firestore).
  - File: `api/set-claims.js`, `api/migrate-claims.js`, `src/stores/authStore.ts`, `firestore.rules`

- [ ] **[§1.11] Scomporre `AdminRequestsPage.vue` (2006 righe — +1506)**
  - Il file più critico del progetto. Candidati all'estrazione:
    - Logica approvazione/rifiuto richieste → composable `useAdminRequests.ts`
    - Form creazione richiesta → già `CreateRequestForm.vue` (verificare se usato)
    - Lista richieste pendenti → componente `PendingRequestsList.vue`
    - Lista cambi turno → componente `PendingSwapsList.vue`
  - File: `src/pages/AdminRequestsPage.vue`

- [ ] **[§1.11] Scomporre `ActiveRequestsCard.vue` (689 righe — +189)**
  - Candidati all'estrazione:
    - Logica filtro/ordinamento → composable `useRequestsFilter.ts`
    - Archivio richieste nascoste → componente `HiddenRequestsArchive.vue`
  - File: `src/components/dashboard/ActiveRequestsCard.vue`

---

## 🟡 PRIORITÀ MEDIA — Violazioni Regole Progetto

- [ ] **[§1.9] Rimuovere `eslint-disable` da `AdminRequestsPage.vue` riga 995**
  - Sostituire il `// eslint-disable-next-line no-floating-promises` con `void` davanti alla chiamata asincrona.
  - File: `src/pages/AdminRequestsPage.vue`

- [ ] **[§1.9] Rimuovere `eslint-disable` da `boot/i18n.ts` riga 11**
  - Risolvere `@typescript-eslint/no-empty-object-type` nel modo corretto (es. usare `Record<string, never>` o estendere correttamente il tipo).
  - File: `src/boot/i18n.ts`

- [ ] **[§1.9] Rimuovere `eslint-disable` da `stores/index.ts` riga 10**
  - Stessa categoria di `i18n.ts` — risolvere il tipo vuoto correttamente.
  - File: `src/stores/index.ts`

- [ ] **[§1.10] Aggiungere `q-skeleton` a `DashboardPage.vue`**
  - Identificare le sezioni con dati asincroni e aggiungere skeleton loader durante il caricamento.
  - File: `src/pages/DashboardPage.vue`

- [ ] **[§1.10] Aggiungere `q-skeleton` a `CalendarPage.vue`**
  - La tabella turni è asincrona — aggiungere skeleton che riproduca la struttura della tabella.
  - File: `src/pages/CalendarPage.vue`

- [ ] **[§2] Correggere ordine struttura in `SettingsPage.vue`**
  - Spostare `<script setup>` PRIMA di `<template>` (regola §2: `script → template → style`).
  - File: `src/pages/SettingsPage.vue`

- [ ] **[AppDateInput] Sostituire `type="date"` nativo in `CreateRequestForm.vue` riga 57**
  - Rimpiazzare `<q-input type="date">` con `<AppDateInput>` per rispettare lo standard di localizzazione DD/MM/YYYY.
  - File: `src/components/admin/CreateRequestForm.vue`

- [ ] **[locales.ts] Rimuovere `itLocale` locale da `AdminShiftTable.vue` riga 53**
  - Sostituire `const itLocale = { ... }` con import da `src/constants/locales.ts`.
  - File: `src/components/calendar/AdminShiftTable.vue`

- [ ] **[TTL] Aggiungere campo `expireAt` al tipo `ShiftRequest` in `models.ts`**
  - Il campo esiste in `ShiftSwap` ma non in `ShiftRequest`. Aggiungere `expireAt?: number` con JSDoc.
  - Verificare che `AdminRequestsPage.vue` e `UserRequestsPage.vue` lo usino per marcatura visiva.
  - File: `src/types/models.ts`

- [ ] **[TTL] Verificare policy TTL Firestore per `notifications` (15 giorni)**
  - Controllare in `firestore.indexes.json` o nella console Firebase che il TTL field sia configurato sul campo `expireAt` della collection `notifications`.
  - Documentare il risultato nel `project_logic_map.md`.

---

## 🟢 PRIORITÀ BASSA — Qualità & Completezza

- [ ] **[§1.7] Aggiungere header JSDoc a `boot/auth.ts`** *(HIGH)*
- [ ] **[§1.7] Aggiungere header JSDoc a `router/routes.ts`** *(HIGH)*
- [ ] **[§1.7] Aggiungere header JSDoc a `boot/apexcharts.ts`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `boot/i18n.ts`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `components/admin/AdminBackupRestore.vue`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `components/user/SyncOperatorCard.vue`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `pages/PendingVerificationPage.vue`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `types/backup.ts`** *(MEDIUM)*
- [ ] **[§1.7] Aggiungere header JSDoc a `components/PwaInstallBanner.vue`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `i18n/en-US/index.ts`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `i18n/index.ts`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `pages/ErrorNotFound.vue`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `pages/LicensePage.vue`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `pages/PrivacyPage.vue`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `services/index.ts`** *(LOW)*
- [ ] **[§1.7] Aggiungere header JSDoc a `stores/index.ts`** *(LOW)*

---

## 🔵 BACKLOG — Miglioramenti UX/Logica (non bloccanti)

- [ ] **[RotationWidget] Aggiungere animazione CSS `pulse`/`vibrate` ai badge della rotazione attuale**
  - Attualmente i bordi sono colorati ma statici. Aggiungere classe CSS `@keyframes pulse` o usare Quasar `animated`.
  - File: `src/components/calendar/RotationWidget.vue`

- [ ] **[RotationService] Estrarre la State Machine dal widget al service**
  - La logica `currentColumnIndex + ciclo modulo` vive nel widget. Spostarla in `RotationService.ts` come metodo `advance(rotation, totalCols)` puro e testabile.
  - File: `src/services/RotationService.ts`, `src/components/calendar/RotationWidget.vue`

- [ ] **[AdminUsersPage] Valutare scomposizione (538 righe — +38)**
  - Sotto soglia ma alta densità. Monitorare ad ogni nuova feature aggiunta.
  - File: `src/pages/AdminUsersPage.vue`

---

## ✅ Checklist Pre-Commit (da eseguire dopo ogni item)

```bash
yarn tsc --noEmit   # 0 errori TypeScript
yarn lint           # 0 errori ESLint, 0 warning
```
