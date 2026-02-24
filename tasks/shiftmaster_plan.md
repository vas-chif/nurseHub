# 🚀 Nurse Hub - Development Roadmap

> **Obiettivo**: Migrare/Evolvere "TurnoFacile" in "Nurse Hub" usando Vue 3, Quasar, Firebase e Google Sheets.

## 📦 Fase 1: Setup & Pulizia (Foundation)

- [x] **Validazione Regole**: Verificare corrispondenza tra `project-rules.md` e configurazione attuale. <!-- id: 10 -->
- [x] **Cleanup**: Rimuovere file non necessari (es. `pnpm-workspace.yaml` se usiamo Yarn) e `tempFolder` (dopo migrazione). <!-- id: 11 -->
- [x] **Struttura Cartelle**: Assicurare la presenza di:
  - [x] `src/types` (Centralized Types) <!-- id: 12 -->
  - [x] `src/composables` (Business Logic) <!-- id: 13 -->
  - [x] `src/stores` (Pinia) <!-- id: 14 -->
  - [x] `src/services` (API integrations) <!-- id: 15 -->

## 🛠️ Fase 2: Core Architecture

- [x] **Definizione Tipi (TypeScript)**:
  - [x] Portare `ShiftCode`, `Operator`, `ShiftRequest` in `src/types/models.ts`. <!-- id: 20 -->
  - [x] Definire interfacce per Google Sheets (Adapter Pattern). <!-- id: 21 -->
- [x] **Google Sheets Integration (Read-Only)**:
  - [x] Implementare `GoogleSheetsService.ts` per leggere i dati JSON (Gviz). <!-- id: 22 -->
  - [x] Testare lettura turni e anagrafiche. <!-- id: 23 -->
- [x] **Firebase Integration (Write/Auth)**:
  - [x] Configurare Firebase in `src/boot/firebase.ts`. <!-- id: 24 -->
  - [x] Implementare "Magic Link" handling (gestione parametri URL). <!-- id: 25 -->
  - [x] **Sync Engine**: Implementare `SyncService` per:
    - [x] Pull iniziale (Sheets -> Firestore) all'avvio/login.
    - [x] Gestione conflitti base (Sheets vince su dati statici).
    - [x] Propagazione scritture (Firestore -> Sheets).

## 🔐 Fase 2.5: Authentication & Authorization

- [x] **Data Model & Types**:
  - [x] Aggiungere interfaccia `User` a `models.ts`. <!-- id: 25 -->
  - [x] Aggiungere campo `dateOfBirth` a interfaccia `Operator`. <!-- id: 25b -->
- [x] **User Service (Firestore)**:
  - [x] Implementare `UserService.ts` con CRUD operazioni su collection `users`. <!-- id: 26a -->
  - [x] Logica matching email + data nascita per collegamento automatico. <!-- id: 26b -->
  - [x] Funzioni: `createUserDocument`, `linkUserToOperator`, `updateUserRole`, `getPendingUsers`. <!-- id: 26c -->
- [x] **Autenticazione UI**:
  - [x] Pagina `LoginPage.vue` (Email/Password + Google OAuth). <!-- id: 27 -->
  - [x] Pagina `RegisterPage.vue` con campi: email, password, nome completo, **data di nascita**. <!-- id: 28 -->
  - [x] Pagina `PendingVerificationPage.vue` per utenti in attesa di approvazione. <!-- id: 28b -->
- [x] **State Management**:
  - [x] Store Pinia `authStore.ts` (currentUser, currentOperator, selectedOperatorIds). <!-- id: 29 -->
  - [x] Composable `useUserContext.ts` (getActiveOperators, canViewRequest, isAdmin). <!-- id: 29a -->
- [x] **Route Guards**:
  - [x] `authGuard.ts` - Verifica autenticazione + `isVerified`. <!-- id: 30a -->
  - [x] `roleGuard.ts` - Verifica ruolo admin. <!-- id: 30b -->
  - [x] Aggiornare `routes.ts` con meta `requiresAuth`, `requiresAdmin`, `requiresVerified`. <!-- id: 30c -->
- [x] **Admin Panel - Gestione Utenti**:
  - [x] `AdminUsersPage.vue` - Tabella utenti (pendenti/attivi) con azioni. <!-- id: 31 -->
  - [x] Implementare logica approvazione (`userService.approveUser`). <!-- id: 32 -->
  - [x] Aggiungere rotta `/admin/users` e voce menu. <!-- id: 33 -->
- [x] **Excel - Aggiungere Colonne Obbligatorie**:
  - [x] Verificare presenza colonna Email in foglio Operators. <!-- id: 34a -->
  - [x] Aggiungere colonna Date of Birth (formato YYYY-MM-DD). <!-- id: 34b -->

## 🧩 Fase 3: UI Implementation (Mobile First)

- [x] **Layout Principale**: `MainLayout.vue` con **Bottom Tabs Navigation** (mobile-first). <!-- id: 30 -->
- [x] **Dashboard Operatore**:
  - [x] Componente `ShiftCalendar` (**Multi-Select** & **Search** Personale). <!-- id: 31 -->
  - [x] Componente `ActiveRequestsCard` (richieste pendenti). <!-- id: 32 -->
- [x] **Admin Panel**:
  - [x] Pagina creazione richieste. <!-- id: 33 -->
  - [x] Monitoraggio offerte. <!-- id: 34 -->

## 🧠 Fase 4: Business Logic & Compliance

- [x] **Migrazione Logic**: Portare `checkCompliance` e `getCompatibleScenarios` da `turnofacile` a `src/composables/useShiftLogic.ts`. <!-- id: 40 -->
- [x] **Shift Offer Flow**: Implementare il flusso di "Offerta Turno" con validazione regole. <!-- id: 41 -->

## 🧪 Fase 5: Testing & Verification

- [ ] **Test Manuali**: Verificare flusso operatore (Link -> Dashboard -> Offerta). <!-- id: 50 -->
- [ ] **Test Compliance**: Verificare che la regola dei 14 giorni blocchi le offerte non valide. <!-- id: 51 -->

## 👤 Fase 7: User Experience & Compliance (Current)

- [x] **Profilo Utente Avanzato**:
  - [x] Gestione Avatar (Upload/Storage). <!-- id: 70 -->
  - [x] **Modifica Dati (Nome, Cognome, Telefono)** (Abilitata solo da Impostazioni). <!-- id: 76 -->
  - [x] Dropdown Menu (Dati, Impostazioni, Logout). <!-- id: 71 -->
- [x] **Termini e Condizioni**:
  - [x] Pagina `TermsPage.vue`. <!-- id: 72 -->
  - [x] Checkbox obbligatorio in registrazione. <!-- id: 73 -->
  - [x] Link nel footer. <!-- id: 74 -->
- [x] **Legal Pages Expansion**:
  - [x] Create `src/types/legal.ts`. <!-- id: 80 -->
  - [x] Create `src/data/privacy.ts` & `src/data/terms.ts`. <!-- id: 81 -->
  - [x] Implement `PrivacyPage.vue`. <!-- id: 82 -->
  - [x] Refactor `TermsPage.vue`. <!-- id: 83 -->
  - [x] Implement `LicensePage.vue`. <!-- id: 84 -->
  - [x] Update Routes. <!-- id: 85 -->
- [ ] **Google Sheets Integration (Real Data)**:
  - [x] Collegare foglio turni reale. <!-- id: 75 -->

## 📅 Fase 8: Advanced User Features & Admin Tools

- [x] **User Absence Request** (Phase 8):
  - [x] Create `UserRequestsPage.vue`.
  - [x] Add Time Range & Full Shift inputs.

- [x] **Phase 8: Admin Approval Panel**
  - [x] Create `AdminRequestsPage.vue` with tabs for Pending/History.
  - [x] Fetch `shiftRequests` from Firestore.
  - [x] Implement Approve logic (update status + operator schedule).
  - [x] Implement Reject logic (update status).
  - [x] Add route `/admin/requests`.

- [x] **Phase 9: User Management & refinements**
  - [x] Add "Block User" functionality in `AdminUsersPage`.
  - [x] Update `User` model with `isBlocked`.
  - [x] Filter "Richieste Urgenti" on Dashboard (exclude own requests).
  - [x] Fix `ShiftCalendar` crash (Personnel selection).
  - [x] Standardize `shiftRequests` collection name usage in `UserRequestsPage`.

- [x] **Phase 9.5: Admin Shift Table UX Enhancements**
  - [x] Custom stacked date headers (DD/MMM/ddd format).
  - [x] Holiday detection & styling (Sundays + Italian holidays).
  - [x] Compact layout (200px name column, 32px date columns, ~30 days visible).
  - [x] Validation summary rows (Mattina/Pomeriggio/Notte counts).
  - [x] Red highlighting when count ≠ 6 per shift type.
  - [x] Improved color scheme for better distinction (amber-9, deep-orange-6, yellow-7).
  - [x] Local storage caching with 5-minute TTL.
  - [x] Legend dialog with shift code explanations.
  - [x] Preserve Google Sheets row order (by operator ID).
  - [x] Filter validation rows from sync to prevent duplicates.

- [ ] **Phase 10: Shift Request Management & Offers**

  **10.1 Admin Workflow Refinements** (Foundation)
  - [x] Add bulk actions in `AdminRequestsPage` (approve/reject multiple).
  - [x] Add request filtering (by date range, status, operator).
  - [x] Add sorting options (date, priority, operator name).
  - [x] Implement request details modal/drawer.
  - [x] Add rejection reason field (required when rejecting).
  - [x] Add notification to requester on approval/rejection.

  **10.2 Analytics & Reports Dashboard** (Visibility)
  - [x] Create `AdminAnalyticsPage.vue` with route `/admin/analytics`.
  - [x] Display key metrics:
    - [x] Total requests (by status: pending/approved/rejected).
    - [x] Average approval time.
    - [x] Most active operators (by request count).
    - [x] Request trends (chart by week/month).
  - [x] Add date range picker for analytics.
  - [ ] Export functionality (CSV/PDF).

  **10.3 "Offer to Cover" Feature & Smart Admin** (Core Functionality)
  - [x] **Smart Admin Approval**:
    - [x] Show requester Name/Surname in Admin Requests (Join with Operators/Users).
    - [x] Add "Expand" view for request details.
    - [x] Implement "Publish/Find Substitutes" action.
    - [x] Algorithm to suggest valid substitutes (Same Role, Rest day, check `useShiftLogic`).
  - [x] **Integrated Dashboard Coverage**:
    - [x] Integrate coverage offers directly in Dashboard home.
    - [x] Visual separation of Urgent vs General requests.
    - [x] Restore 14-day shift preview for logged-in user.
    - [x] Search functionality in operator selector (Admin flow).
  - [x] Implement shift selection UI (pick date + shift type via Dialog).
  - [x] Add validation: user must have compatible shift or R (riposo).
  - [x] Implement admin review flow for coverage offers in `AdminRequestsPage`.
  - [x] Implement admin review flow for coverage offers in `AdminRequestsPage`.
  - [x] Sync approved offers to Google Sheets (swap shifts).

  **10.4 Real-time Notifications** (Integration)
  - [x] Set up Firestore listeners in `AdminRequestsPage` for new requests.
  - [x] Set up Firestore listeners in `UserRequestsPage` for status updates.
  - [x] Add in-app notification component (toast/banner).
  - [x] Implement notification badge on tabs (show pending count).
  - [x] Add notification preferences in user settings (General > Notifications).
  - [x] Implement push notifications via Firebase Cloud Messaging.

  **10.5 Advanced Features** (Polish)
  - [x] Add request comments/notes (admin ↔ user communication).
  - [x] Implement request history view for users.
  - [x] **Phase 12: Structured Coverage Scenarios (React-style)**
    - [x] Hierarchical grouping (Scenario > Position > Candidate).
    - [x] Operator phone numbers in suggestions.
    - [x] Bulk selection ("Select All") per position.
  - [x] **Phase 13: Advanced Approval Workflow**
    - [x] Approval Sync Mode Dialog (Automatic vs Manual).
    - [x] Resolution of operator names in history (De-normalization).
  - [x] **Phase 14: User Sync & Real-time Integration**
    - [x] "Aggiorna Turni" button in User Home.
    - [ ] Real-time sync from Google Sheets (push/webhooks).

- [x] **Phase 16: Push Notifications (Real FCM)**
  - [x] **Setup**: Configure FCM in `src/boot/firebase.ts` and set VAPID key.
  - [x] **Service Worker**: Switch to `InjectManifest` and implement push listeners in `custom-service-worker.ts`.
  - [x] **Settings Integration**: Implement Toggle in "Impostazioni > Notifiche" to request permission and save/remove FCM Token in Firestore.
  - [x] **Notifications Backend**: Create Vercel Serverless API to trigger push on new requests or status changes (Replaced Cloud Functions).
  - [x] Add recurring absence requests (e.g., every Monday for 3 months).
  - [ ] Implement shift swap matching algorithm (suggest compatible swaps).
  - [x] Add calendar preview in offer/request pages.

## 🎨 Phase 19: UI/UX Refinements (Admin & User Views)

- [x] **19.1 Admin Dashboard Visibility**
  - [x] Hide the main "Dashboard" (Home) tab for Admin users.
- [x] **19.2 Admin Requests Page (Pending Tab)**
  - [x] Ensure absentee name is always displayed correctly in the header.
  - [x] Add a visual badge/label indicating the number of pending offers.
- [x] **19.3 Admin Requests Page (History Tab)**
  - [x] Display the name of the Admin who managed/closed the request.
  - [x] Explicitly show "Coperto da: [Nome]" in the details if an offer was accepted.
- [x] **19.4 User Requests Page (Le mie Candidature / History)**
  - [x] Improve "Le mie Candidature" view: show request date/time, candidacy date, and status.
  - [x] Improve "Le mie Richieste" view: ensure creation date/time is clearly visible.

## 🔔 Phase 16: Push Notifications (Real FCM)

- [x] Configure FCM in `src/boot/firebase.ts` & set VAPID key.
- [x] Switch PWA to `InjectManifest` mode & implement push listeners in `custom-service-worker.ts`.
- [x] Implement Settings Toggle to request permission and save/remove FCM Token in Firestore.
- [x] **Backend (Vercel Serverless)**: `api/send-notification.js` calls FCM HTTP v1 API. Replaces Cloud Functions (avoids Blaze plan).
  - [x] CORS headers added for cross-origin calls from Firebase Hosting.
  - [x] Bearer token authentication (`VERCEL_API_SECRET`).
  - [x] Fix GitHub Actions to inject `VITE_VERCEL_API_SECRET` during build.
- [x] `notifyUser()` — saves in-app notification + triggers Vercel push.
- [x] `notifyEligibleOperators()` — notifies compatible operators (deduplication via `Set`).
- [x] `notifyAdmins()` — notifies admins on new offer (deduplication via `Set`).
- [x] Rejection notification for substitute operator.
- [x] Fix duplicate push notifications (removed duplicate `showNotification()` from `firebase-messaging-sw.js`).

## 🗃️ Phase 18: Request History & Archiving

- [x] Update data model (`offeringOperatorIds`, `hiddenBy`, `isArchived`).
- [x] Implement history tab in Dashboard.
- [x] Detailed resolution view in User & Admin pages.
- [x] Archive System (Auto > 3 months, Manual Delete, Empty Archive).
- [x] Visual indicator for archive storage level.

## 🎨 Phase 19: UI/UX Refinements (Admin & User Views)

- [x] **19.1** Hide main "Dashboard" tab for Admin users.
- [x] **19.2** Admin Requests (Pending Tab): absentee name always shown; badge with offer count.
- [x] **19.3** Admin Requests (History Tab): show Admin name; "Coperto da: [Nome]" in details.
- [x] **19.4** User Requests: candidacy date/time visible; creation date/time visible in history.

## 🔄 Phase 20: Cambio Turno (Shift Swaps) ✅

- [x] **20.1** User creates a Shift Swap request (tab toggle in `UserRequestsPage.vue`): form with date, cedi/vuoi shift selectors; writes to `shiftSwaps` Firestore collection.
- [x] **20.2** User swap history list — shows each proposal with status chip (Aperta / Accordo / In revisione / Approvata / Rifiutata) and counterpart name after match.
- [x] **20.3** `ShiftSwap` interface and `ShiftSwapStatus` type added to `models.ts`; new notification types `SWAP_MATCHED | SWAP_APPROVED | SWAP_REJECTED`.
- [x] **20.4** Admin approval tab "Cambi Turno" in `AdminRequestsPage.vue`: auto-loads on tab switch; Approva (updates both operators' schedules) / Rifiuta (with note prompt) buttons.

## ⚙️ Phase 21: Admin Scenario Management ✅

- [x] **21.1** Auto-seed `REPLACEMENT_SCENARIOS` from `sheets.ts` to Firestore on first config expand (lazy, per-config).
- [x] **21.2** Scenario CRUD inside "Configurazione Sistema" (no new page).
- [x] **21.3** Elegant full-screen edit dialog (primary header, role cards with left border, shift chips).
- [x] **21.4** Added `startTime` / `endTime` fields to `ReplacementRole` model for precise hour configuration.
- [x] **21.5** New `scenarioStore.ts` Pinia store caches Firestore scenarios per configId; `useShiftLogic.getCompatibleScenarios` and `AdminRequestsPage.findSubstitutes` now use live Firestore scenarios with graceful fallback to hardcoded defaults.
