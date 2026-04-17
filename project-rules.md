# 🎯 Regole Progetto Nurse Hub - Linee Guida AI

> **IMPORTANTE**: Questo file contiene TUTTE le regole del progetto.
> L'AI deve seguire SEMPRE queste linee guida.
> **Livello di Codice Richiesto**: Senior Full-Stack Developer + GDPR Compliance
> **Stack**: Quasar (Vue 3) + Firebase + TypeScript + Google Sheets Integration

---

## 📋 **INDICE REGOLE PRINCIPALI**

### **§1. REGOLE FONDAMENTALI (Priorità MASSIMA)**

1. **§1.1 Package Manager**: YARN only, MAI npm
2. **§1.2 Google Sheets as Backend**:
   - **Source of Truth**: Google Sheets resta la fonte primaria per Turni e Anagrafica
   - **Operational Backend**: Firebase (Firestore) è il backend operativo per l'app
   - **Sync**: Sincronizzazione obbligatoria (Sheets → Firestore)
   - **Write**: Scritture su Firestore → propagate a Sheets (via Cloud Functions)
3. **§1.3 useSecureLogger**: MAI console.log in production (GDPR Art. 32)
4. **§1.4 Centralized Types**: Tutti i tipi in `src/types/`, mai duplicati
5. **§1.5 GDPR Compliance**: Art. 30 (audit logs) + Art. 32 (data security)
6. **§1.6 Pre-Commit Error Check**: TypeScript + ESLint PRIMA di commit/build
7. **§1.7 JSDoc File Headers**: OBBLIGATORIO per tutti i file .ts/.vue
8. **§1.8 No `any`**: MAI usare `any` (Sostituire con interfacce o `unknown`)
9. **§1.9 No `eslint-disable`**: MAI disabilitare le regole di linting

---

## 📦 **§1.1 Package Manager - OBBLIGATORIO**

```bash
# ✅ SEMPRE USARE YARN
yarn install
yarn dev
yarn build

# ❌ MAI USARE NPM
# npm install  ← NO!
# npm run dev  ← NO!
```

**REGOLA**: Ogni comando deve usare `yarn`, MAI `npm`.

**Motivo**: Consistenza lock file, performance migliori, workspace support.

---

## 📝 **§1.7 File Header JSDoc - OBBLIGATORIO**

**OGNI file `.ts`, `.vue`, `.js` DEVE iniziare con questo header:**

```typescript
/**
 * @file filename.ts
 * @description Brief description of what this file does (1-2 sentences max)
 * @author Nurse Hub Team
 * @created YYYY-MM-DD
 * @modified YYYY-MM-DD
 * @example
 * // Usage example
 * import { functionName } from './filename';
 *
 * functionName(params);
 * @notes
 * - Architecture pattern: Component/Composable/Service/etc.
 * - Key technical decisions
 * - Important implementation details
 * @dependencies
 * - List of critical dependencies
 * - External libraries used
 */
```

**Priorità File da Documentare**:

1. ✅ **CRITICAL**: Services (`src/services/*.ts`)
2. ✅ **CRITICAL**: Stores (`src/stores/*.ts`)
3. ✅ **HIGH**: Pages (`src/pages/*.vue`)
4. ✅ **MEDIUM**: Components (`src/components/*.vue`)
5. ✅ **LOW**: Utils (`src/utils/*.ts`)

---

## 🔍 **§1.6 Pre-Commit/Build Error Check - OBBLIGATORIO**

### **WORKFLOW OBBLIGATORIO**:

```bash
# ✅ STEP 1: Check TypeScript errors
yarn vue-tsc --noEmit

# ✅ STEP 2: Check ESLint errors
yarn lint

# ✅ STEP 3: Build production (verifica compilazione OK)
yarn build

# ❌ Se QUALSIASI step fallisce:
# → FIX errori PRIMA di commit/push/deploy
# → NON fare commit con errori pendenti
```

### **Checklist Pre-Commit OBBLIGATORIA**:

```bash
- [ ] TypeScript: yarn vue-tsc --noEmit → 0 errors
- [ ] ESLint: yarn lint → 0 errors, 0 warnings
- [ ] Build: yarn build → SUCCESS
- [ ] Git status: No sensitive files (*.env, keys)
```

---

## 🔒 **§1.3 Secure Logging - GDPR Compliance**

### **REGOLA OBBLIGATORIA: Sostituire console.log con secureLogger**

```typescript
// ❌ VIETATO - console.log diretto
console.log('User data:', user);
console.error('Error:', error);

// ✅ CORRETTO - useSecureLogger
import { useSecureLogger } from '@/utils/secureLogger';
const logger = useSecureLogger();

logger.info('User data:', user); // Auto-sanitizza dati sensibili
logger.error('Error:', error); // Traccia errori con context
logger.warn('Warning:', data); // Warning con auto-redaction
logger.debug('Debug info:', obj); // Solo in development
```

**Benefici SecureLogger:**

- 🔒 Auto-redaction dati sensibili (email, phone, dateOfBirth, uid)
- 💰 Zero cost in development, pay-per-use in production
- 📊 Structured logging con timestamp e context
- 🐛 Better debugging con log levels (DEBUG/INFO/WARN/ERROR)
- ✅ GDPR Art. 32 compliant (data security)

**PII Auto-Redacted:**

- Email addresses
- Phone numbers
- Date of birth
- Firebase UIDs
- Passwords (ovviamente!)

---

## 🏗️ **§2. ARCHITETTURA & CODICE**

### **Framework & Tools**

- **Framework**: Quasar CLI con Vite
- **Vue**: Vue 3 Composition API (`<script setup lang="ts">`)
- **State**: Pinia stores
- **Types**: TypeScript Strict Mode (NO `any` implicito)
- **Backend**: Firebase (Auth + Firestore) + Google Sheets

### **File Structure**

```
src/
├── components/      # Componenti UI riutilizzabili
├── pages/          # Pagine dell'applicazione
├── stores/         # Pinia stores
├── composables/    # Logica riutilizzabile
├── services/       # Google Sheets + Firebase services
├── types/          # Definizioni TypeScript centralizzate
├── utils/          # Utility functions (logger, etc.)
├── config/         # Configuration (smartEnvironment)
└── boot/           # Quasar boot files (Firebase init)
```

### **Vue Component Structure Order**

**TUTTI i file `.vue` DEVONO seguire questo ordine:**

```vue
<!-- 1. Script (Logic) -->
<script setup lang="ts">
// Imports, state, functions
</script>

<!-- 2. Template (UI) -->
<template>
  <!-- HTML structure -->
</template>

<!-- 3. Style (CSS) -->
<style scoped lang="scss">
/* CSS styles */
</style>
```

**REGOLA CRITICA**:

- ❌ **MAI** mettere `<template>` prima di `<script>`
- ✅ **SEMPRE** rispettare ordine: `<script>` → `<template>` → `<style>`

---

## 📚 **§3. STILE COMMENTI & DOCUMENTAZIONE**

### **1. Lingua**

- **Codice (variabili, funzioni, commenti tecnici)**: INGLESE
- **Documentazione (.md files)**: ITALIANO
- **Chat con utente**: ITALIANO
- **Commit messages**: INGLESE (convenzione standard)

### **2. JSDoc Completo per Funzioni**

````typescript
/**
 * Validates user profile completeness for registration flow
 *
 * @param profile - User profile object to validate
 * @param requiredFields - Array of field names that must be present
 * @returns Validation result with error messages
 *
 * @remarks
 * - Used in registration wizard
 * - GDPR compliance: validates data format
 * - Performance: <5ms for typical profile
 *
 * @throws {ValidationError} If required fields are missing or invalid
 *
 * @example
 * ```typescript
 * const result = validateProfile(userProfile, ['firstName', 'lastName']);
 * if (!result.isValid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
const validateProfile = (profile: UserProfile, requiredFields: string[]): ValidationResult => {
  // Implementation
}; /*end validateProfile*/
````

### **3. Marcatori Fine Funzione**

```typescript
// ✅ SEMPRE aggiungere commento fine funzione
const calculateCost = (reads: number): number => {
  return reads * 0.00006;
}; /*end calculateCost*/
```

---

## 🔐 **§1.5 GDPR Compliance**

### **Healthcare Data Protection Requirements**

**Articolo 30 - Processing Records:**

- ✅ Audit logging con `firestoreLogger` (tutte le operazioni DB)
- ✅ Timestamp su ogni operazione
- ✅ User ID tracciato per ogni azione

**Articolo 32 - Security Measures:**

- ✅ PII redaction automatica nei log (`secureLogger`)
- ✅ Encryption delle password (Firebase Auth gestisce)
- ✅ Firestore Security Rules (principle of least privilege)
- ✅ HTTPS enforced (Netlify/Firebase auto)

### **Dati Sensibili da Proteggere**

```typescript
// ✅ Auto-redacted da secureLogger:
- email
- phone
- dateOfBirth
- fiscalCode (se presente)
- password (SEMPRE!)
- uid (opzionale, redatto se in log pubblici)
```

---

## 🛡️ **§1.8 No `any` - STRICT TYPING**

**REGOLA**: L'uso del tipo `any` è categoricamente VIETATO.

```typescript
// ❌ VIETATO
const data: any = await fetchData();

// ✅ CORRETTO - Interfaccia specifica
interface UserData { id: string; name: string; }
const data: UserData = await fetchData();

// ✅ CORRETTO - Se il tipo è ignoto
const data: unknown = await fetchData();
if (typeof data === 'string') { ... }
```

**Motivo**: Lavoriamo con dati sanitari. Un errore di tipo può causare malfunzionamenti critici in situazioni di emergenza.

---

## 🚫 **§1.9 No `eslint-disable` - CODE QUALITY**

**REGOLA**: È VIETATO l'uso di commenti `eslint-disable`.

**Motivo**: Le regole di linting sono lì per proteggere l'integrità del codice. Se una regola viene violata, va risolta la causa, non nascosto l'avviso.

---

## 📊 **§4. DATA MODELS (Centralizzati in `src/types/`)**

### **Core Models**

1. **User**:

   ```typescript
   {
     uid: string;
     email: string;
     role: 'user' | 'admin';
     operatorId: string | null;
     isVerified: boolean;
     pendingApproval: boolean;
     firstName: string;
     lastName: string;
     dateOfBirth: string; // YYYY-MM-DD
     createdAt: number;
     updatedAt: number;
   }
   ```

2. **Operator**:

   ```typescript
   {
     id: string;
     name: string;
     surname: string;
     email: string;
     phone: string;
     dateOfBirth: string; // YYYY-MM-DD
     region: string;
     province: string;
     role: string;
   }
   ```

3. **ShiftCode**: `'M' | 'P' | 'N' | 'R' | 'A' | 'S' | 'MP' | 'N11' | 'N12'`

4. **ShiftRequest**:
   ```typescript
   {
     id: string;
     date: string;
     originalShift: ShiftCode;
     status: 'pending' | 'approved' | 'rejected';
     reason: string;
     creatorId: string;
   }
   ```

---

## 🔧 **§5. IMPLEMENTAZIONE SPECIFICA**

### **Environment Variables**

**Smart Environment Pattern:**

```typescript
// ❌ Accesso diretto (deprecato)
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// ✅ Smart environment (type-safe)
import { smartEnv } from '@/config/smartEnvironment';
const apiKey = smartEnv.getRequiredEnv('VITE_FIREBASE_API_KEY');
```

### **Google Sheets Bridge**

Service `GoogleSheetsService` astrae la lettura dati. Il resto dell'app non deve sapere che i dati vengono da Sheets.

### **Firebase Integration**

- **Auth**: Firebase Authentication (email/password)
- **Database**: Firestore (operational backend)
- **Security Rules**: `firestore.rules` (deployed with Firebase CLI)
- **Region**: eur3 (Europe)

### **Compliance Check**

Funzioni di validazione devono essere pure e testabili:

```typescript
// ✅ Pure function - testabile
const checkCompliance = (operator: Operator, shifts: Shift[]): boolean => {
  // No side effects, deterministic
  return /* validation logic */;
};
```

---

## 📦 **Workflow Sviluppo**

### **1. Branch Strategy**

```bash
main        # Production (protected)
develop     # Development (merge qui)
feature/*   # Feature branches
fix/*       # Bug fixes
```

### **2. Commit Workflow**

```bash
# 1. Create feature branch
git checkout -b feature/add-shift-manager

# 2. Make changes
# ... code ...

# 3. Pre-commit checks (OBBLIGATORIO!)
yarn vue-tsc --noEmit  # TypeScript check
yarn lint              # ESLint check
yarn build             # Production build test

# 4. Commit (solo se tutti i check passano)
git add .
git commit -m "feat: add shift manager component"

# 5. Push and create PR
git push origin feature/add-shift-manager
```

### **3. Task Tracking**

Aggiornare `task.md` man mano che si completano i punti:

```markdown
- [x] Completed task
- [/] In progress task
- [ ] Todo task
```

### **4. Verifica Costante**

Confrontare sempre l'implementazione con le regole di business originali:

- 14 giorni riposo tra turni
- Scenari di copertura
- Compliance checks

---

## 🚨 **SECURITY CHECKLIST**

### **File da SEMPRE escludere (.gitignore)**

```bash
# Environment variables
.env
.env.*

# Firebase credentials
serviceAccountKey.json
*-firebase-adminsdk-*.json

# Build artifacts
dist/
.quasar/
node_modules/

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db
```

### **Firebase Security Rules**

```javascript
// Principle of Least Privilege
allow read: if isAuthenticated() && isVerified();
allow write: if isAdmin();
```

---

## 📚 **Reference Links**

- **Quasar**: https://quasar.dev
- **Vue 3**: https://vuejs.org
- **TypeScript**: https://www.typescriptlang.org
- **Firebase**: https://firebase.google.com
- **GDPR**: https://gdpr.eu

---

**Ultimo aggiornamento**: 2026-02-12
**Versione**: 2.0.0
