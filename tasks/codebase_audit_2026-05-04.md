# 📊 Analisi Completa NurseHub — Audit 04/05/2026

> **Data analisi:** 04/05/2026
> **Eseguita da:** GitHub Copilot (analisi statica automatizzata)
> **Scope:** Verifica `project_logic_map.md` + conformità `project-rules.md`

---

## 🗺️ PARTE 1 — Verifica `project_logic_map.md`

### Pagina 1 — Dashboard

| Punto | Stato |
|---|---|
| `ActiveRequestsCard.vue` — filtro `hiddenBy` + archivio espandibile | ✅ Filtro implementato, archivio con `ignoredRequests` computed presente |
| `ActiveRequestsCard.vue` — ordinamento dinamico (Data Creazione / Turno) | ✅ Implementato con `sortBy` ref e `sortOptions` |
| `SwapOpportunitiesCard.vue` — filtro `hiddenBy` | ✅ Implementato |
| `SwapOpportunitiesCard.vue` — ordinamento dinamico | ✅ Implementato |
| Design "lettera grande turno + icona sotto" | ✅ Standard visuale presente nei componenti dashboard |

---

### Pagina 2 — Le Mie Richieste (`UserRequestsPage.vue`)

| Punto | Stato |
|---|---|
| Sezione Assenza con form | ✅ `AbsenceRequestForm.vue` delegato |
| Sezione Cambio Turno | ✅ Presente inline |
| Storico richieste | ✅ `visibleRequests` computed + `q-expansion-item` |
| Validazione cambio (turno ≠ calendario bloccato) | ✅ `submitSwap` confronta `op.schedule[date]` |
| Validazione assenza (blocco se turno ≠ previsto) | ✅ Implementato in `generatePreview()` di `useAbsenceForm.ts` |
| Notifiche unificate e anonime | ✅ `notifySwapProposed` + `notifyEligibleOperators` via `NotificationService` |

---

### Pagina 3 — Gestione Utenti (`AdminUsersPage.vue`)

| Punto | Stato |
|---|---|
| 3 ruoli: superAdmin, admin, user | ✅ Implementati |
| Admin limitato a `managedConfigIds` | ✅ Config Fencing attivo in `applyFilters` |
| SuperAdmin ha `ConfigSelector` nell'header | ✅ In `MainLayout.vue` con `v-if="isSuperAdmin"` |
| Admin bloccato sul reparto predefinito | ✅ Identity fencing in `configStore` |

---

### Pagina 4 — Navigazione & Sicurezza (Phase 28)

| Punto | Stato |
|---|---|
| `SettingsPage.vue` — personalizzazione tab footer | ✅ Implementato |
| Persistenza in `uiStore` (localStorage) | ✅ Implementato |
| Footer tab dinamiche | ✅ `MainLayout.vue` filtra via `uiStore.isTabVisible` |
| Swipe rispetta solo rotte abilitate | ✅ `handleSwipe` ricostruisce routes filtrate |
| Pagina Sistema `/admin` solo SuperAdmin | ✅ `AdminPage.vue` redirect + notifica in `onMounted` |
| Redirect admin con notifica | ⚠️ **PARZIALE** — La protezione è in `onMounted` di `AdminPage.vue` (lato UI), **non** nel router guard `roleGuard.ts`. Un admin che naviga via URL diretto viene bloccato, ma solo dopo che la pagina ha iniziato a montarsi — non preventivamente come da specifica |

---

### Flusso Critico 1 — Date & Localizzazione

| Punto | Stato |
|---|---|
| `dateUtils.ts` centralizzato | ✅ Esiste con `formatToDb`, `formatToItalian` |
| `locales.ts` centralizzato | ✅ Esiste |
| `AppDateInput.vue` usato ovunque | ⚠️ **PARZIALE** — Vedi violazione `CreateRequestForm.vue` sotto |
| MAI `itLocale` locale | ❌ `AdminShiftTable.vue` riga 53 definisce `itLocale` localmente invece di importarlo da `src/constants/locales.ts` |

---

### Flusso Critico 2 — Cambio Turno (Swap)

| Punto | Stato |
|---|---|
| Validazione client-side turno su data | ✅ In `submitSwap` |
| Notifica anonima a colleghi + admin | ✅ `notifySwapProposed` |
| Stato `PENDING_ADMIN` dopo accettazione | ✅ Gestito in `AdminRequestsPage.vue` |
| Approvazione admin → inversione turni in Firestore | ✅ `update-sheet-swap.js` API Vercel |
| Propagazione a Google Sheets | ✅ `api/update-sheet-swap.js` esiste |

---

### Flusso Critico 3 — TTL & Pulizia Automatica (Phase 31)

| Punto | Stato |
|---|---|
| Campo `expireAt` in `ShiftSwap` | ✅ In `models.ts` |
| Campo `expireAt` in `ShiftRequest` | ⚠️ **Non verificato** — non presente nel tipo base `ShiftRequest`, solo in `ShiftSwap` |
| Notifications eliminate dopo 15 giorni | ⚠️ Delegato a Firestore TTL policy — non verificabile lato client |
| Richieste scadute marcate visivamente `EXPIRED` | ✅ `isRequestExpired()` in `useShiftLogic.ts` con stile `opacity-50 grayscale` |

---

### Flusso Critico 4 — Filtro Maestro & Sync (Phase 30.1)

| Punto | Stato |
|---|---|
| Cambio `activeConfigId` solo in RAM, zero Firestore reads | ✅ Documentato e implementato in `configStore` |
| `GlobalSyncBtn.vue` esiste | ✅ |
| Cooldown per-reparto (1 min admin / 2 ore user) | ✅ In `syncStore` + `GlobalSyncBtn` |
| Auto-refresh intelligente al cambio pagina/focus | ✅ Verificato |
| Config-fencing a livello DB (Firestore Rules) | ✅ Documentato in `firestore.rules` |

---

### Flusso Critico 5 — Rotazione Interattiva (Phase 31)

| Punto | Stato |
|---|---|
| `RotationWidget.vue` esiste | ✅ 295 righe |
| Prossima rotazione ultra-compatta (`bg-grey-3`, `0.55rem`) | ✅ Implementato |
| Badge "vibranti" sulla rotazione attuale | ⚠️ **PARZIALE** — Bordi colorati statici, nessuna animazione CSS pulse/vibrate |
| Timer autonomo ogni 5 giorni con pausa/ripartenza | ⚠️ **PARZIALE** — Il timer lato frontend mostra il countdown ma il cambio automatico ogni 5 giorni è gestito lato backend. Pausa/ripartenza manuale sono presenti |
| Logica State Machine in `RotationService.ts` | ⚠️ **PARZIALE** — Il ciclo modulo esiste ma la SM vera vive nel widget, il service è solo CRUD Firestore |

---

## 📏 File sopra soglia §1.11 (500 righe)

| File | Righe | Eccesso |
|---|---|---|
| `pages/AdminRequestsPage.vue` | **2006** | 🔴 **+1506** — caso critico, candidato principale alla scomposizione |
| `components/dashboard/ActiveRequestsCard.vue` | **689** | 🔴 +189 |
| `pages/AdminUsersPage.vue` | **538** | 🟡 +38 |
| `src/composables/useAbsenceForm.ts` | 365 | ✅ sotto soglia |
| `pages/UserRequestsPage.vue` | 466 | ✅ sotto soglia |

---

## 📋 PARTE 2 — Verifica regole `project-rules.md`

### §1.1 — Package Manager YARN

✅ Rispettato ovunque. Nessun `package-lock.json` presente.

---

### §1.3 — MAI `console.*` (useSecureLogger)

| Nota | Posizione |
|---|---|
| `console.log` in commento JSDoc (non codice eseguibile) | `firestoreLogger.ts` riga 164 — dentro `/* */`, non violazione reale |

✅ **Nessuna violazione reale** nel codice eseguibile.

---

### §1.4 — Tipi centralizzati in `src/types/`

✅ Nessun tipo duplicato rilevato. I tipi locali trovati sono solo parametri di funzione inline, non interfacce duplicate.

---

### §1.7 — JSDoc Header OBBLIGATORIO

❌ **16 file senza header JSDoc**:

| File | Priorità |
|---|---|
| `boot/auth.ts` | 🔴 HIGH |
| `router/routes.ts` | 🔴 HIGH |
| `boot/apexcharts.ts` | 🟡 MEDIUM |
| `boot/i18n.ts` | 🟡 MEDIUM |
| `components/admin/AdminBackupRestore.vue` | 🟡 MEDIUM |
| `components/user/SyncOperatorCard.vue` | 🟡 MEDIUM |
| `pages/PendingVerificationPage.vue` | 🟡 MEDIUM |
| `types/backup.ts` | 🟡 MEDIUM |
| `components/PwaInstallBanner.vue` | 🟢 LOW |
| `i18n/en-US/index.ts` | 🟢 LOW |
| `i18n/index.ts` | 🟢 LOW |
| `pages/ErrorNotFound.vue` | 🟢 LOW |
| `pages/LicensePage.vue` | 🟢 LOW |
| `pages/PrivacyPage.vue` | 🟢 LOW |
| `services/index.ts` | 🟢 LOW |
| `stores/index.ts` | 🟢 LOW |

---

### §1.8 — No `any`

✅ Nessuna violazione reale — l'unico match nel grep era testo in un commento JSDoc ("any administrative role"), non codice TypeScript.

---

### §1.9 — No `eslint-disable`

❌ **3 violazioni**:

| File | Riga | Tipo |
|---|---|---|
| `pages/AdminRequestsPage.vue` | 995 | `// eslint-disable-next-line @typescript-eslint/no-floating-promises` |
| `boot/i18n.ts` | 11 | `/* eslint-disable @typescript-eslint/no-empty-object-type */` |
| `stores/index.ts` | 10 | `// eslint-disable-next-line @typescript-eslint/no-empty-object-type` |

---

### §1.10 — Skeleton UI OBBLIGATORIO

❌ **2 pagine con liste asincrone prive di `q-skeleton`**:

| File | Problema |
|---|---|
| `pages/DashboardPage.vue` | Nessun `q-skeleton` nonostante carichi dati asincroni |
| `pages/CalendarPage.vue` | Nessun `q-skeleton` nonostante la tabella turni sia asincrona |

---

### §1.10 (JWT) — JWT-First Authorization

✅ Rispettato in `authStore.ts`: `isAdmin`/`isAnyAdmin` leggono prima da `claimRole` (JWT), fallback Firestore. `getIdToken(true)` chiamato dopo cambio ruolo.

---

### §1.11 — Decomposizione componenti >500 righe

❌ **2 violazioni critiche** (vedi tabella righe sopra).
`AdminRequestsPage.vue` a **2006 righe** è il caso più grave dell'intero progetto.

---

### §2 — Vue Structure Order (`script` → `template` → `style`)

❌ **1 violazione**:

| File | Problema |
|---|---|
| `pages/SettingsPage.vue` | `<template>` viene **prima** di `<script>` |

---

### §1.2 — Google Sheets come Source of Truth

✅ `GoogleSheetsService.ts` esiste. `SyncService.ts` gestisce Sheets→Firestore. API Vercel (`update-sheet-swap.js`, `update-sheet-shift.js`) propagano le scritture.

---

### Regola AppDateInput — MAI `type="date"` nativo

❌ **1 violazione**:

| File | Riga | Problema |
|---|---|---|
| `components/admin/CreateRequestForm.vue` | 57 | `<q-input type="date">` invece di `<AppDateInput>` |

---

### Regola `locales.ts` — MAI `itLocale` definito localmente

❌ **1 violazione**:

| File | Riga | Problema |
|---|---|---|
| `components/calendar/AdminShiftTable.vue` | 53 | `const itLocale = { ... }` definita localmente invece di importare da `src/constants/locales.ts` |

---

## 🎯 Riepilogo Finale

### Logica mancante o parziale (`project_logic_map`)

| # | Problema | File |
|---|---|---|
| 1 | ⚠️ Protezione `/admin` per admin normali solo lato UI, non nel guard preventivo | `router/guards/roleGuard.ts` |
| 2 | ⚠️ Badge rotazione senza animazione pulse/vibrate CSS | `components/calendar/RotationWidget.vue` |
| 3 | ⚠️ State Machine dispersa nel widget, non nel service | `services/RotationService.ts` |
| 4 | ⚠️ Campo `expireAt` non verificato in `ShiftRequest` (solo in `ShiftSwap`) | `src/types/models.ts` |

---

### Violazioni regole `project-rules.md`

| Regola | N. Violazioni | File coinvolti |
|---|---|---|
| §1.7 JSDoc header | **16** | Vedi lista sopra |
| §1.9 no `eslint-disable` | **3** | `AdminRequestsPage`, `i18n.ts`, `stores/index.ts` |
| §1.10 Skeleton UI | **2** | `DashboardPage.vue`, `CalendarPage.vue` |
| §1.11 Decomposizione | **2** | `AdminRequestsPage.vue` (2006 righe), `ActiveRequestsCard.vue` (689 righe) |
| §2 Vue structure order | **1** | `SettingsPage.vue` — `<template>` prima di `<script>` |
| AppDateInput obbligatorio | **1** | `CreateRequestForm.vue` riga 57 |
| `locales.ts` centralizzato | **1** | `AdminShiftTable.vue` riga 53 |
