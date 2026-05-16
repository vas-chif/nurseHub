# 📱 Guida: Autenticazione Biometrica su Android (Capacitor 7 + Quasar)
> **Progetto**: NurseHub · **Data**: 2026-05-15 · **Phase**: 38 P6
> **Stack**: Quasar 2.16.0 · Capacitor 7 · `@aparajita/capacitor-biometric-auth@9.1.2`

---

## 1. Come trovare il plugin giusto

### 1.1 — Dove cercare
1. **GitHub** → cerca `capacitor biometric android`
2. **npm** → `npm search capacitor biometric`
3. **[Awesome Capacitor](https://github.com/riderx/awesome-capacitor)** → lista curata di plugin Capacitor

### 1.2 — Perché `@aparajita/capacitor-biometric-auth` (non altri)
| Plugin | Stato | Note |
|---|---|---|
| `capacitor-biometric-auth` | ❌ deprecato | abbandonato da anni |
| `@capacitor-community/biometric-auth` | ⚠️ non mantenuto | |
| `@aparajita/capacitor-biometric-auth` | ✅ **attivo** | mantenuto, TypeScript completo, supporta Android + iOS |

### 1.3 — Come verificare la compatibilità con Capacitor 7
Il README del plugin non è sempre aggiornato. Il metodo affidabile:
```bash
# controlla le peerDependencies di ogni versione
npm info @aparajita/capacitor-biometric-auth@9.1.2 --json | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('peerDependencies'), d.get('dependencies',{}).get('@capacitor/core'))"
```

**Regola versioni** (verificata 2026-05-15):
| Versione plugin | Richiede `@capacitor/core` | Usare per |
|---|---|---|
| `8.x` | `^6.0.0` | Capacitor 6 |
| `9.x` | `>=6.1.0` (peerDep) | **Capacitor 7 ✅** |
| `10.x` | `^8.0.2` (dep diretta) | Capacitor 8 |

> ⚠️ Il README dice "9.0.0 → requires Capacitor 8+" — ma è il README di `main` che documenta la versione 10.
> Le peerDeps reali di `9.x` sono `>=6.1.0`, quindi Capacitor 7 è compatibile.

---

## 2. Architettura scelta — App-Lock Pattern

### Perché NON memorizzare le credenziali
L'alternativa (memorizzare email+password in Android Keystore) richiederebbe:
- Un secondo plugin: `@aparajita/capacitor-secure-storage`
- Gestione del caso "password cambiata lato server" (token invalidato, biometrica bloccata)
- Maggiore superficie di attacco

### App-Lock Pattern (scelto per NurseHub)
```
App si apre (cold start)
    ↓
Firebase ripristina la sessione persistente (IndexedDB)
    ↓
MainLayout.onMounted() → se biometric opt-in → PROMPT BIOMETRICO
    ↓
✅ Successo → sessionUnlocked = true → app normale
❌ Fallimento → authStore.logout() → redirect /login
```

**Vantaggi**:
- ✅ Nessuna credenziale memorizzata → GDPR Art. 32 / §1.5 compliant
- ✅ Un solo plugin (`@aparajita/capacitor-biometric-auth`)
- ✅ Firebase gestisce refresh token automaticamente
- ✅ Comportamento corretto su logout esplicito (biometrica non si attiva)

---

## 3. Passi di implementazione (per riprodurre in futuro)

### Passo 1 — Installazione nel progetto root (per i tipi TypeScript)
```bash
# Da /home/chif-vas/projects/nurseHub
yarn add @aparajita/capacitor-biometric-auth@^9.0.0
```

### Passo 2 — Aggiungere a `src-capacitor/package.json`
Il progetto Capacitor (in `src-capacitor/`) ha un `package.json` separato.
I plugin nativi devono essere elencati LÌ per essere trovati da `cap sync`.

Aprire `src-capacitor/package.json` e aggiungere:
```json
"@aparajita/capacitor-biometric-auth": "^9.0.0"
```

Poi installare:
```bash
cd src-capacitor
npm install --legacy-peer-deps
cd ..
```

> ⚠️ `--legacy-peer-deps` è necessario perché le versioni dei plugin Capacitor possono avere
> peer deps in conflitto tra loro (es. `@capacitor/core@^6` vs `^7`).

### Passo 3 — Sincronizzare il progetto Android
```bash
cd src-capacitor
npx cap sync android
# Output atteso: Found 3 Capacitor plugins for android:
#   @aparajita/capacitor-biometric-auth@9.1.2
#   @capacitor-firebase/messaging@7.5.0
#   @capacitor/app@7.1.2
```

### Passo 4 — Creare il composable `src/composables/useBiometricAuth.ts`
Logica centralizzata (§1.12 DRY). Esporta:
- `isOptedIn()` — l'utente ha attivato la biometrica?
- `hasBeenAsked()` — il dialog è già stato mostrato?
- `setOptIn(value)` — imposta la preferenza in localStorage
- `isSessionUnlocked()` — la biometrica è già stata verificata in questa sessione?
- `setSessionUnlocked()` — marca la sessione come verificata
- `isBiometricAvailable()` — il dispositivo supporta la biometrica?
- `authenticate()` — mostra il prompt nativo → restituisce `true/false`

La chiave localStorage usata: `nursehub_biometric_opt_in` (`'true'`/`'false'`/`null`)

> **`sessionUnlocked`** è una variabile a livello di modulo (non reattiva).
> Viene azzerata solo al riavvio dell'app (hard reload), non al re-mount del layout.

### Passo 5 — Modificare `src/pages/LoginPage.vue`
Aggiungere **dopo** il login con password, **una volta sola**:
```typescript
if (Capacitor.isNativePlatform() && !biometric.hasBeenAsked()) {
  const available = await biometric.isBiometricAvailable();
  if (available) {
    showBiometricOptIn.value = true;
    return; // la navigazione viene delegata al dialog
  }
}
navigateAfterLogin();
```

Pattern dialog:
```html
<q-dialog v-model="showBiometricOptIn" persistent>
  <!-- ... -->
  <q-btn @click="handleBiometricOptIn(false)" label="No grazie" />
  <q-btn @click="handleBiometricOptIn(true)" color="primary" label="Sì, abilita" />
</q-dialog>
```

`handleBiometricOptIn(accepted)` → `biometric.setOptIn(accepted)` → `navigateAfterLogin()`

### Passo 6 — Modificare `src/layouts/MainLayout.vue`
Aggiungere ALL'INIZIO di `onMounted(async () => {`:
```typescript
if (Capacitor.isNativePlatform() && biometricAuth.isOptedIn() && !biometricAuth.isSessionUnlocked()) {
  $q.loading.show({ message: 'Verifica biometrica...' });
  const unlocked = await biometricAuth.authenticate();
  $q.loading.hide();
  if (unlocked) {
    biometricAuth.setSessionUnlocked();
  } else {
    await authStore.logout();
    void router.push('/login');
    return;
  }
}
```

### Passo 7 — Controllo pre-commit (§1.6)
```bash
cd /home/chif-vas/projects/nurseHub
yarn vue-tsc --noEmit   # deve essere: "Done in Xs." senza errori
yarn lint               # deve essere: "Done in Xs." senza errori
```

### Passo 8 — Build APK con il nuovo plugin
```bash
# Ricostruire la web app
yarn build:android   # quasar build -m capacitor -T android

# APK debug senza Android Studio
cd src-capacitor/android
./gradlew assembleDebug
# APK → android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. File modificati in questa implementazione

| File | Modifica |
|---|---|
| `src/composables/useBiometricAuth.ts` | **NUOVO** — composable app-lock |
| `src/pages/LoginPage.vue` | Opt-in dialog dopo primo login |
| `src/layouts/MainLayout.vue` | Biometric lock in `onMounted` |
| `src-capacitor/package.json` | Aggiunto `@aparajita/capacitor-biometric-auth ^9.0.0` |
| `package.json` | Aggiornato da `yarn add` |

---

## 5. Come testare su dispositivo reale

### Test opt-in
1. Installare APK debug su dispositivo Android con impronta configurata
2. Fare login con email/password
3. Dovrebbe apparire il dialog "Vuoi usare la biometria?"
4. Accettare → al successivo avvio dell'app il prompt biometrico si attiva

### Test app-lock
1. Chiudere l'app completamente (non solo mettere in background)
2. Riaprire → comparirà il prompt biometrico
3. Annullare → l'utente viene reindirizzato a `/login`

### Test su emulatore Android Studio
Per simulare l'impronta digitale sull'emulatore:
```bash
# Mentre è aperto il prompt biometrico nell'emulatore:
adb -e emu finger touch 1
# 1 = dito registrato, 2 = dito NON registrato (simula fallimento)
```

### Disattivare la biometrica (debug)
```javascript
// Nella console del browser (web view devtools Capacitor)
localStorage.removeItem('nursehub_biometric_opt_in');
```

---

## 6. Fonti usate per la ricerca

| Fonte | URL | Usata per |
|---|---|---|
| GitHub del plugin | `github.com/aparajita/capacitor-biometric-auth` | API, BREAKING CHANGES, versioni |
| npm info CLI | `npm info @aparajita/capacitor-biometric-auth@9.1.2 --json` | Verifica peerDependencies reali |
| Docs Capacitor | `capacitorjs.com/docs/android` | Procedura `cap sync`, plugin discovery |
| Android docs | `developer.android.com/reference/android/hardware/biometrics` | Comportamento `androidBiometryStrength` |

> **Nota**: il README pubblicato su GitHub era per la versione 10.x (current branch).
> Per capire la compatibilità con Capacitor 7 è stato necessario ispezionare le
> `peerDependencies` direttamente via `npm info`, non fidarsi del README.

---

## 7. Gotcha / problemi comuni

### ❌ `cap sync` non trova il plugin
**Causa**: il plugin è solo in root `node_modules`, non in `src-capacitor/`.
**Fix**: aggiungere a `src-capacitor/package.json` + `cd src-capacitor && npm install --legacy-peer-deps`.

### ❌ `npm install` fallisce con peer deps
**Fix**: usare sempre `--legacy-peer-deps` in `src-capacitor/`.

### ❌ La biometrica si attiva ad ogni navigazione interna
**Causa**: `MainLayout.vue` si smonta e rimonta su certi cambi di route.
**Fix**: il flag `sessionUnlocked` (a livello di modulo in `useBiometricAuth.ts`) impedisce il re-prompt.

### ❌ Il dialog opt-in compare ad ogni login
**Causa**: `hasBeenAsked()` controlla `localStorage.getItem(BIOMETRIC_KEY) !== null`.
Se la chiave è stata rimossa (es. pulizia localStorage), il dialog ricompare.
**Fix**: questo è intenzionale per i casi di reset del dispositivo/app.

### ❌ `@aparajita/capacitor-biometric-auth@10` NON funziona con Capacitor 7
La versione 10.x usa `@capacitor/core: "^8.0.2"` come **dependency diretta** (non peerDep),
il che causa l'installazione di Capacitor 8 in conflitto con il Capacitor 7 del progetto.
**Fix**: usare sempre `@aparajita/capacitor-biometric-auth@^9.0.0` con Capacitor 7.
