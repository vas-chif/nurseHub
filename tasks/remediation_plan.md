# 🛠️ Piano di Regolarizzazione Progetto NurseHub

> **Creato:** 04/05/2026
> **Aggiornato:** 05/05/2026
> **Basato su:** `codebase_audit_2026-05-04.md`
> **Regola:** Spuntare ogni item SOLO dopo aver eseguito `yarn tsc --noEmit` + `yarn lint` senza errori.
> **Stato attuale:** `tsc --noEmit` → 0 errori | `yarn lint` → 0 errori, 0 warning

---

## 🔴 PRIORITÀ ALTA — Sicurezza & Architettura

- [x] **[SECURITY] `roleGuard.ts` — Protezione preventiva `/admin`**
  - ✅ Guard migrato a Vue Router 5 return-value API. Blocca admin normali PRIMA del mount con redirect `/dashboard` + `Notify.create`.
  - Commit: `88dbf38`

- [x] **[JWT] Aggiungere `configId` di appartenenza ai Custom Claims**
  - ✅ `api/set-claims.js` include `configId` e `managedConfigIds`.
  - ✅ `authStore.ts` legge `claimConfigId` dal JWT (fallback Firestore).
  - ✅ `firestore.rules` usa `request.auth.token.get('role', ...)` e `isUserInConfig()` con claim JWT come check primario.
  - ⚠️ Vedi item aperto sotto: il fallback Firestore in `isUserInConfig()` è ancora presente.

- [x] **[§1.11] Scomporre `AdminRequestsPage.vue` (2006 righe → 363)**
  - ✅ Logica estratta in composable `useAdminRequests.ts`.
  - ✅ `CreateRequestForm.vue` già esistente e usato.

- [x] **[§1.11] Scomporre `ActiveRequestsCard.vue` (689 righe → 280)**
  - ✅ Composable `useRequestsFilter.ts` estratto.
  - ✅ Componente `HiddenRequestsArchive.vue` estratto.
  - Commit: `b2b8eca`

---

## 🔴 ANCORA APERTO — Trovato in audit 05/05/2026

- [ ] **[JWT] `firestore.rules` — `isUserInConfig()` usa ancora lettura Firestore come fallback**
  - La funzione verifica prima `request.auth.token.get('configId', '')` (corretto, zero-cost), ma il ramo `||` cade su `get(/databases/.../users/$(request.auth.uid)).data.configId` — una lettura Firestore a pagamento per ogni regola valutata.
  - **Fix:** rimuovere il fallback Firestore da `isUserInConfig()`. Il claim JWT è ora sempre popolato (da `api/set-claims.js` + `api/migrate-claims.js`).
  - File: `firestore.rules` — funzione `isUserInConfig()` riga ~44

- [ ] **[TTL] Verificare policy TTL Firestore per `notifications` (15 giorni)**
  - Non verificabile lato client. Controllare nella console Firebase (Firestore → collection `notifications` → TTL policy su campo `expireAt`).
  - Se mancante: configurare TTL su `expireAt` con retention 15 giorni tramite Firebase Console o `firestore.indexes.json`.
  - Documentare il risultato in `project_logic_map.md` sezione "Manutenzione e Pulizia Automatica".

---

## 🟡 PRIORITÀ MEDIA — Violazioni Regole Progetto

- [x] **[§1.9] Rimuovere `eslint-disable` da `AdminRequestsPage.vue`**
  - ✅ Risolto durante la scomposizione del file.

- [x] **[§1.9] Rimuovere `eslint-disable` da `boot/i18n.ts`**
  - ✅ Risolto. 0 occorrenze `eslint-disable` nel codebase.

- [x] **[§1.9] Rimuovere `eslint-disable` da `stores/index.ts`**
  - ✅ Risolto.

- [x] **[§1.10] Aggiungere `q-skeleton` a `DashboardPage.vue`**
  - ✅ Skeleton presente (QAvatar + text + rect).

- [x] **[§1.10] Aggiungere `q-skeleton` a `CalendarPage.vue`**
  - ✅ Skeleton presente per tutte e 3 le righe della struttura tabella.

- [x] **[§2] Correggere ordine struttura in `SettingsPage.vue`**
  - ✅ `<script setup>` alla riga 12, `<template>` alla riga 171.

- [x] **[AppDateInput] Sostituire `type="date"` nativo in `CreateRequestForm.vue`**
  - ✅ Usa `<AppDateInput>` dalla riga 58.

- [x] **[locales.ts] Rimuovere `itLocale` locale da `AdminShiftTable.vue`**
  - ✅ Ora importa `itLocale` da `src/constants/locales.ts` riga 16.

- [x] **[TTL] Aggiungere campo `expireAt` al tipo `ShiftRequest` in `models.ts`**
  - ✅ `expireAt?: number` presente a riga 70 di `models.ts`.

- [ ] **[TTL] Verificare policy TTL Firestore per `notifications` (15 giorni)**
  - ➡️ Spostato in "Ancora Aperto" sopra.

---

## 🟢 PRIORITÀ BASSA — Qualità & Completezza

- [x] **[§1.7] Aggiungere header JSDoc a `boot/auth.ts`** *(HIGH)*
- [x] **[§1.7] Aggiungere header JSDoc a `router/routes.ts`** *(HIGH)*
- [x] **[§1.7] Aggiungere header JSDoc a `boot/apexcharts.ts`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `boot/i18n.ts`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `components/admin/AdminBackupRestore.vue`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `components/user/SyncOperatorCard.vue`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `pages/PendingVerificationPage.vue`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `types/backup.ts`** *(MEDIUM)*
- [x] **[§1.7] Aggiungere header JSDoc a `components/PwaInstallBanner.vue`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `i18n/en-US/index.ts`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `i18n/index.ts`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `pages/ErrorNotFound.vue`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `pages/LicensePage.vue`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `pages/PrivacyPage.vue`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `services/index.ts`** *(LOW)*
- [x] **[§1.7] Aggiungere header JSDoc a `stores/index.ts`** *(LOW)*
  - ✅ Tutti e 16 i file completati. Commit: `8694eea`

---

## 🔵 BACKLOG — Miglioramenti UX/Logica (non bloccanti)

- [x] **[RotationWidget] Animazione CSS `badge-pulse` sui badge della rotazione attuale**
  - ✅ `@keyframes badge-pulse` + classe `.badge-pulse` applicata quando `group.isActive`.
  - Commit: `cfde0f5`

- [x] **[RotationService] Metodo `advance()` puro e testabile**
  - ✅ `export function advance(currentIndex, totalCols)` presente a riga 109 di `RotationService.ts`.
  - Commit: `cfde0f5`

- [ ] **[AdminUsersPage] Monitorare dimensione (538 righe — +38 sopra soglia)**
  - ⚠️ Sotto la soglia critica per componenti admin complessi. Rivalutare se supera 600 righe con le prossime feature.
  - File: `src/pages/AdminUsersPage.vue`

---

## ✅ Checklist Pre-Commit (da eseguire dopo ogni item)

```bash
yarn tsc --noEmit   # 0 errori TypeScript
yarn lint           # 0 errori ESLint, 0 warning
```
