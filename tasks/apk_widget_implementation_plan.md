# ✅ Checklist: APK Debug & Widget Turni
> **Versione**: 3.0 — 2026-05-15 · Ordinata per priorità
> **Regole**: `project-rules.md` §1.1–§1.12 · `project_logic_map.md` Phase 30.1, 34, 37
> **Stack**: Quasar 2.16.0 · Java 21 ✅ · Android SDK API 35 ✅ · `$ANDROID_HOME=~/Android/Sdk` ✅

---

## 🔴 PRIORITÀ 1 — Refactor DRY (§1.12) — PRIMA di tutto il resto

> Blocca il widget: `getShiftStyles()` è duplicata in 2 file → il widget sarebbe la 3ª copia illegale.

- [x] **`src/composables/useShiftLogic.ts`** — aggiungere funzione esportata:
  ```typescript
  export function getShiftStyleForCode(code: ShiftCode | null): ShiftStyle { ... }
  ```
  (copiare la `map` già presente in `ShiftMonthView.vue` riga ~119)
- [x] **`src/components/calendar/ShiftMonthView.vue`** — rimuovere la `getShiftStyles()` locale, importare `getShiftStyleForCode` da `useShiftLogic`; aggiornare `@modified`
- [x] **`src/components/dashboard/ShiftCalendar.vue`** — idem; aggiornare `@modified`
- [x] `yarn vue-tsc --noEmit && yarn lint` → 0 errori
- [x] `git commit -m "refactor: extract getShiftStyleForCode to useShiftLogic (§1.12)"`

---

## 🔴 PRIORITÀ 2 — Capacitor Setup + APK Debug

> Prerequisito per tutto il mobile (widget, FCM nativo, deep link).

### 2A — Installazione (§1.1 yarn only)
- [x] `yarn add @capacitor/core @capacitor/android @capacitor/app`
- [x] `yarn add --dev @quasar/capacitor @capacitor/cli`

### 2B — Aggiungere modalità Capacitor
- [x] `quasar mode add capacitor` → crea `src-capacitor/`
- [x] Verificare che `src-capacitor/capacitor.config.ts` esista

### 2C — Configurare `src-capacitor/capacitor.config.ts`
- [x] Impostare `appId: 'com.nursehub.app'`
- [x] Impostare `appName: 'NurseHub'`
- [x] Impostare `webDir: '../dist/capacitor'`
- [x] Aggiungere `server.allowNavigation: ['nursehub-cbb32.firebaseapp.com']`
- [x] Aggiungere `server.androidScheme: 'https'`

### 2D — Icone
- [ ] `yarn quasar icongenie generate -i public/icons/icon-512x512.png`

### 2E — `google-services.json` ⚠️ CRITICO (senza questo FCM nativo non funziona)
- [ ] Firebase Console → Impostazioni Progetto → App Android → aggiungere `com.nursehub.app`
- [ ] Scaricare `google-services.json`
- [ ] Copiarlo in `src-capacitor/android/app/google-services.json`

### 2F — Scripts `package.json` (§1.1)
- [x] Aggiungere `"dev:android": "quasar dev -m capacitor -T android"`
- [x] Aggiungere `"build:android": "quasar build -m capacitor -T android"` (Fix: rimosso sync manuale ridondante)

### 2G — Prima build e test APK debug
- [x] `quasar build -m capacitor -T android`
- [x] `quasar dev -m capacitor -T android` → server attivo (Fix: `linuxAndroidStudio: '/usr/bin/true'` in quasar.config.ts — corretto da `'true'` che non era un path valido)
- [x] Build riuscita: APK generato in `src-capacitor/android/app/build/outputs/apk/release/`

---

## 🟠 PRIORITÀ 3 — Widget In-App "I Tuoi Turni"

> Dipende da Priorità 1 (DRY) e Priorità 2 (APK funzionante).

### 3A — `src/pages/WidgetShiftsPage.vue` (nuovo file)
- [x] JSDoc header obbligatorio (§1.7): `@file`, `@description`, `@author`, `@created`, `@modified`
- [x] Struttura `<script setup lang="ts">` → `<template>` → `<style scoped>` (§2)
- [x] Importare `getShiftStyleForCode` da `useShiftLogic` (§1.12)
- [x] Importare `useAuthStore`, `useSecureLogger` (§1.3)
- [x] Dati da `authStore.currentOperator?.schedule` — zero fetch aggiuntivi (Phase 30.1)
- [x] Display: oggi + prossimi 4 giorni con badge codice turno colorato
- [x] Visibilità ruoli (Phase 27 + Phase 34):
  - [x] `User` → sempre visibile
  - [x] `Admin` in `viewMode === 'admin'` → solo su mobile (`$q.screen.lt.md`)
  - [x] `Admin` in `viewMode === 'user'` (Modalità Operatore) → sempre visibile
- [x] `q-skeleton` durante attesa `authStore.isInitialized` (§1.10)
- [x] Nessun `any` (§1.8) · nessun `console.log` (§1.3)
- [x] Pagina < 120 righe (§1.11)

### 3B — `src/router/routes.ts`
- [x] Aggiungere route `{ path: '/widget/shifts', component: ..., meta: { requiresAuth: true } }`
- [x] Aggiornare `@modified` nell'header JSDoc

### 3C — `src/pages/DashboardPage.vue`
- [x] Aggiungere button/chip "Vista Widget" con `v-if="$q.screen.lt.md"` → `router.push('/widget/shifts')`
- [x] Aggiornare `@modified`

### 3D — Check e commit
- [x] `yarn vue-tsc --noEmit && yarn lint` → 0 errori
- [x] `git commit -m "feat: add WidgetShiftsPage with 5-day shift preview (Phase 38)"`

---

## 🟡 PRIORITÀ 4 — FCM Nativo (Layer Condizionale)

> Non riscrive il Web Push esistente — aggiunge solo un branch `isNativePlatform()`.

- [ ] `yarn add @capacitor-firebase/messaging`
- [ ] **`src/services/NotificationService.ts`** — aggiungere import `Capacitor` e `FirebaseMessaging`
- [ ] Avvolgere il codice esistente in `if (!Capacitor.isNativePlatform()) { ... }`
- [ ] Aggiungere branch nativo:
  ```typescript
  if (Capacitor.isNativePlatform()) {
    await FirebaseMessaging.requestPermissions();
    const { token } = await FirebaseMessaging.getToken();
    await registerFCMToken(userId, token);
  }
  ```
- [ ] Verificare `google-services.json` presente (Priorità 2E)
- [ ] Aggiornare `@modified` in `NotificationService.ts`
- [ ] `yarn vue-tsc --noEmit && yarn lint` → 0 errori
- [ ] `git commit -m "feat: add platform-aware FCM layer for native Android"`

---

## 🟡 PRIORITÀ 5 — Deep Linking

> Permette di aprire l'app direttamente su una richiesta ricevuta via notifica.

- [ ] **`src-capacitor/android/app/src/main/AndroidManifest.xml`** — aggiungere `<intent-filter>`:
  ```xml
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="nursehub" android:host="open" />
  </intent-filter>
  ```
- [ ] **`src/boot/firebase.ts`** — aggiungere listener `appUrlOpen` (solo se `Capacitor.isNativePlatform()`):
  ```typescript
  CapApp.addListener('appUrlOpen', ({ url }) => {
    const path = url.replace('nursehub://open', '');
    if (path) void router.push(path);
  });
  ```
- [ ] `npx cap sync android`
- [ ] Test: notifica push → tap → app si apre sulla pagina corretta
- [ ] `git commit -m "feat: add deep linking intent filter for Android"`

---

## 🟢 PRIORITÀ 6 — Biometria (Opzionale — Phase 38+)

> Solo dopo Priorità 1–5 stabili in produzione.

- [ ] `yarn add @aparajita/capacitor-biometric-auth`
- [ ] `npx cap sync android`
- [ ] **`src/pages/LoginPage.vue`** — aggiungere opt-in biometria dopo primo login
- [ ] Credenziali salvate in Keystore Android (§1.5 GDPR — nessuna password in chiaro)
- [ ] `yarn vue-tsc --noEmit && yarn lint` → 0 errori
- [ ] `git commit -m "feat: add biometric auth opt-in for Android (Phase 38)"`

---

## 📋 Regola post-ogni-fase (§1.6)

```bash
yarn vue-tsc --noEmit   # 0 errori TypeScript
yarn lint               # 0 errori ESLint
```

> **Riferimenti**: `project-rules.md` (§1.1–§1.12, §2) · `project_logic_map.md` (Phase 30.1, Phase 34, Phase 37)
> **Stack confermato**: Quasar 2.16.0 + `@quasar/app-vite` 2.1.0 · Java 21 ✅ · Android SDK API 35 ✅ · `$ANDROID_HOME` = `~/Android/Sdk` ✅

---

## Stato Prerequisiti (Verificato)

| Prerequisito | Stato | Note |
|---|---|---|
| Java | ✅ OpenJDK 21 | >= 17 richiesto per API 35 |
| Android SDK | ✅ API 35, build-tools 36.0.0 | |
| ADB | ✅ `~/Android/Sdk/platform-tools/adb` | |
| `$ANDROID_HOME` | ✅ `~/Android/Sdk` | |
| Router mode | ✅ `hash` in `quasar.config.ts` | Obbligatorio per Capacitor (no web server) |
| FCM Web Push | ✅ già implementato | `NotificationService.ts` + `firebase/messaging` |

---

## Ordine di Esecuzione e Dipendenze

```
Fase 0 (DRY refactor §1.12)
    └── Fase 1 (Capacitor setup + APK debug)
            ├── Fase 2 (Widget in-app "I Tuoi Turni")
            ├── Fase 3 (FCM nativo — layer condizionale)
            └── Fase 4 (Deep Linking)
                    └── Fase 5 (Biometria — opzionale, Phase 38+)
```

---

## Fase 0 — Refactor §1.12: `getShiftStyles` → `useShiftLogic.ts`

> **Priorità**: PRIMA di creare il widget — altrimenti si crea una terza copia illegale.

**Problema**: `getShiftStyles(code)` è definita localmente **due volte**:
- `src/components/calendar/ShiftMonthView.vue` (riga ~119)
- `src/components/dashboard/ShiftCalendar.vue` (riga ~98)

Viola §1.12 (Single Source of Truth). Il widget sarebbe la terza copia.

**Fix**: Aggiungere `getShiftStyleForCode(code: ShiftCode | null): ShiftStyle` in `src/composables/useShiftLogic.ts` (che già esporta `isOperatorEligibleForRole`). Entrambi i componenti esistenti + il nuovo widget importeranno da lì.

**File toccati**: `useShiftLogic.ts`, `ShiftMonthView.vue`, `ShiftCalendar.vue`
**Regole rispettate**: §1.12 DRY, §1.7 `@modified`, §1.6 check prima di commit

---

## Fase 1 — App Nativa APK (Capacitor)

### 1.1 — Installazione dipendenze (§1.1 yarn only)

```bash
yarn add @capacitor/core @capacitor/android @capacitor/app
yarn add --dev @quasar/capacitor @capacitor/cli
```

### 1.2 — Aggiungere modalità Capacitor

```bash
quasar mode add capacitor
# Crea: src-capacitor/
#   ├── capacitor.config.ts
#   ├── package.json
#   └── android/   (generato da npx cap add android)
```

### 1.3 — `src-capacitor/capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nursehub.app',
  appName: 'NurseHub',
  webDir: '../dist/capacitor',
  server: {
    // Necessario per Firebase Auth (signInWithEmailAndPassword funziona in WebView)
    allowNavigation: ['nursehub-cbb32.firebaseapp.com'],
    androidScheme: 'https',
  },
};

export default config;
```

> **Nota sicurezza**: `signInWithEmailAndPassword` funziona nativamente in WebView Capacitor — nessuna modifica ad `authStore.ts` necessaria. Il JWT-First (Phase 30.1) rimane invariato.

### 1.4 — Icone (§1.7 branding)

```bash
yarn quasar icongenie generate -i public/icons/icon-512x512.png
```

Genera tutte le dimensioni richieste da Android (mipmap-*).

### 1.5 — `google-services.json` ⚠️ CRITICO

Scaricare da **Firebase Console → Impostazioni Progetto → App Android** (aggiungere app con `com.nursehub.app`) e copiare in:
```
src-capacitor/android/app/google-services.json
```
Senza questo file le notifiche native FCM non funzionano.

### 1.6 — Build e debug

```bash
# Build PWA assets per Capacitor
quasar build -m capacitor -T android

# Sincronizza assets + plugin nativi nel progetto Android
npx cap sync android

# Dev con HMR su dispositivo/emulatore
quasar dev -m capacitor -T android

# Generare APK debug senza Android Studio
cd src-capacitor/android && ./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

> `npx cap sync` va eseguito **dopo ogni `quasar build`** — copia gli assets web aggiornati nel progetto nativo.

### 1.7 — `package.json` scripts (§1.1)

Aggiungere in `package.json`:
```json
"dev:android": "quasar dev -m capacitor -T android",
"build:android": "quasar build -m capacitor -T android && npx cap sync android"
```

---

## Fase 2 — Widget In-App "I Tuoi Turni"

> **Chiarimento importante**: Un vero Android Home Screen Widget richiede codice nativo Java/Kotlin (`AppWidgetProvider` + `WorkManager`) — fuori scope per questo progetto. Il plugin `capacitor-android-widgets` è sperimentale e non mantenuto. **Il widget è implementato come pagina in-app ultra-minimale** accessibile dall'interno dell'app (scorciatoia dalla dashboard). Questo corrisponde allo screenshot di riferimento.

### 2.1 — Nuova pagina `src/pages/WidgetShiftsPage.vue`

**Dati**: `authStore.currentOperator?.schedule` (già in memoria via `scheduleStore` — **zero fetch aggiuntivi**, allineato a Phase 30.1 Filtro Maestro).

**Logica shift styles**: usa `getShiftStyleForCode()` da `useShiftLogic.ts` (Fase 0 — §1.12).

**Visibilità per ruolo** (allineata a Phase 27 + Phase 34):
- `User`: widget visibile sempre
- `Admin` in `viewMode === 'admin'`: widget accessibile solo se `$q.screen.lt.md` (mobile)
- `Admin` in `viewMode === 'user'` (Modalità Operatore, Phase 34): widget sempre visibile

**Layout**: pagina senza header/footer (`meta: { requiresAuth: true, layout: 'none' }`).

**Display**: oggi + prossimi 4 giorni, una riga per giorno:

```
┌──────────────────────────────┐
│  👤 Mario Rossi · TI Inf.    │
├─────────┬────────────────────┤
│  OGGI   │  [M]  Mattina  07:00│
│  GIO 15 │  [P]  Pomeriggio   │
│  VEN 16 │  [R]  Riposo       │
│  SAB 17 │  [N]  Notte        │
│  DOM 18 │  [-]  Non definito │
└─────────┴────────────────────┘
```

**Regole progetto**:
- §1.7: JSDoc header obbligatorio
- §1.8: no `any` — tipizzazione `ShiftCode | null`
- §1.10: `q-skeleton` durante attesa `authStore.isInitialized`
- §1.11: pagina < 120 righe — nessuna decomposizione richiesta
- §1.12: `getShiftStyleForCode` da `useShiftLogic.ts` (Fase 0)
- §1.3: `useSecureLogger` — nessun `console.log`
- §2: `<script setup lang="ts">` → `<template>` → `<style scoped>`

### 2.2 — Route in `src/router/routes.ts`

```typescript
{
  path: '/widget/shifts',
  component: () => import('pages/WidgetShiftsPage.vue'),
  meta: { requiresAuth: true },
},
```

### 2.3 — Accesso dalla Dashboard

In `src/pages/DashboardPage.vue`: aggiungere un button/chip compatto visibile solo su mobile (`v-if="$q.screen.lt.md"`), che naviga a `/widget/shifts`. Non aggiunge logica — solo `router.push`.

---

## Fase 3 — FCM Nativo (Layer Condizionale)

> **Non è una riscrittura** di `NotificationService.ts` — è l'aggiunta di un branch platform-aware. FCM Web Push esistente rimane invariato per la PWA.

### 3.1 — Dipendenza

```bash
yarn add @capacitor-firebase/messaging
```

### 3.2 — `src/services/NotificationService.ts` — platform check

```typescript
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

export async function requestNotificationPermission(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // Path nativo: FCM via plugin Capacitor
    await FirebaseMessaging.requestPermissions();
    const { token } = await FirebaseMessaging.getToken();
    await registerFCMToken(userId, token);
    logger.info('Native FCM token registered');
  } else {
    // Path Web: codice esistente invariato (firebase/messaging + service worker)
    // ... existing code ...
  }
}
```

**Prerequisito**: `google-services.json` in `src-capacitor/android/app/` (Fase 1.5).

---

## Fase 4 — Deep Linking (Intent Android)

### 4.1 — `AndroidManifest.xml`

File: `src-capacitor/android/app/src/main/AndroidManifest.xml`

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="nursehub" android:host="open" />
</intent-filter>
```

### 4.2 — Listener in `src/boot/firebase.ts` (o `MainLayout.vue`)

```typescript
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  void CapApp.addListener('appUrlOpen', ({ url }) => {
    // nursehub://open/requests/abc123  →  /requests/abc123
    const path = url.replace('nursehub://open', '');
    if (path) void router.push(path);
  });
}
```

**Allineamento Phase 30.1**: il deep link aggiorna solo la navigazione router — nessun cambio a `configStore.activeConfigId` o JWT.

---

## Fase 5 — Biometria (Opzionale, Phase 38+)

> Implementare solo dopo Fase 1–4 stabili in produzione.

**Plugin corretto**: `@aparajita/capacitor-biometric-auth` (mantenuto attivamente — non `capacitor-biometric-auth` che è deprecato).

```bash
yarn add @aparajita/capacitor-biometric-auth
```

**UX**: Prima login normale → opt-in biometria → credenziali salvate in Keystore Android (sicuro). Login successivi: impronta/FaceID. Allineato a §1.5 GDPR (nessuna password in chiaro, Keystore = encryption nativa).

---

## Checklist Pre-Commit (§1.6 — Obbligatoria per ogni fase)

```bash
yarn vue-tsc --noEmit   # 0 errori TypeScript
yarn lint               # 0 errori ESLint
# (build Android non richiesta per ogni commit — solo per release)
```

**Git commit messages** (§3 — English):
```
feat: add Capacitor Android mode with debug APK support
feat: add WidgetShiftsPage with shift preview (Phase 38)
refactor: extract getShiftStyleForCode to useShiftLogic (§1.12)
feat: add platform-aware FCM notification layer for native Android
feat: add deep linking intent filter for Android
```
