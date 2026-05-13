# Piano di Risoluzione — Identity & User Management (v2.0 — 2026-05-15)

> **STATO**: ✅ Diagnosi completa + Piano aggiornato in checklist. Implementazione fase per fase.
> **Analisi**: incrociata Copilot + Antigravity AI — risultati concordi.
> **Riferimenti progetto**: `project-rules.md` (§1.1–§1.11, §2) + `project_logic_map.md` (Phase 27, Phase 30.1).

---

## Progresso Globale

| Fase | Titolo | File | Priorità | Stato |
|------|--------|------|----------|-------|
| 0 | Slug IDs + Sync fix + Self-heal | GoogleSheetsService, SyncService, UserService, authStore | 🔴 CRITICA | ✅ FATTO |
| 1 | JWT Refresh dopo Self-Healing | `authStore.ts` | 🔴 CRITICA | ✅ FATTO |
| 2 | Endpoint `api/delete-user.js` | `api/delete-user.js` (nuovo) | 🟠 ALTA | ✅ FATTO |
| 3 | `UserService.deleteUser()` | `UserService.ts` | 🟠 ALTA | ⬜ pending |
| 4 | UI "Elimina Utente" | `AdminUsersPage.vue` | 🟠 ALTA | ⬜ pending |
| 5 | `UserService.transferUserToConfig()` | `UserService.ts` | 🟡 MEDIA | ⬜ pending |
| 6 | Componente `TransferUserDialog.vue` | nuovo componente | 🟡 MEDIA | ⬜ pending |
| 7 | UI "Trasferisci Reparto" | `AdminUsersPage.vue` | 🟡 MEDIA | ⬜ pending |
| 8 | Campo `department` + dropdown Registrazione | `models.ts`, `RegisterPage.vue`, `firestore.rules` | 🟡 MEDIA | ⬜ pending |
| 9 | `syncUserToOperator()` bimodale | `UserService.ts` | 🟡 MEDIA | ⬜ pending |

> **Nota utente**: Fase 1 e Fase 8 possono essere implementate insieme nello stesso commit
> (Bug JWT stale + selezione reparto alla registrazione si completano reciprocamente: la Fase 8
> riduce i casi in cui il JWT fix è necessario per nuovi utenti; la Fase 1 copre gli utenti legacy).

---

## Coerenza Priorità Antigravity

Antigravity propone: Fase 1 → Fase 2-3 → Fase 3b (dept) → Fase 4b (bimodal). **Valutazione**:

- ✅ **Fase 1 prima**: corretto — 1 riga, impatto immediato su bug esistente, nessuna dipendenza
- ✅ **Fase 2-3-4 subito dopo**: corretto — strumenti admin critici, dipendenze lineari
- ⚠️ **Fase 8 separata da Fase 1**: parzialmente corretto — la Fase 8 è più complessa (models +
  UI + rules), non può essere "1 riga". Unirle nello stesso commit è ragionevole per efficienza
  ma non per semplicità. Consiglio: fare Fase 1 standalone, poi Fase 8 come secondo commit.
- ✅ **Fase 9 ultima**: corretto — ottimizzazione, nessun bug attivo bloccato da questa

**Ordine consigliato finale** (conforme a Antigravity + nota utente): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

---

## 0. Architettura di Riferimento

### JWT-First Principle (project_logic_map.md Phase 30.1 — Filtro Maestro)

Le Firestore Security Rules di NurseHub si basano **esclusivamente** sul JWT per le
verifiche di appartenenza a un reparto:

```
isUserInConfig(configId) → request.auth.token.get('configId', '') == configId
```

**Conseguenza diretta**: qualsiasi operazione che modifica `configId` nel documento
Firestore **DEVE** essere seguita da un refresh forzato del token JWT, altrimenti
tutte le letture Firestore dell'utente risulteranno negate dalla Security Rule.

> **project_logic_map.md §1.10 — Refresh Obbligatorio**: "dopo ogni modifica di ruolo
> o config, il frontend DEVE forzare il refresh del token JWT"

### Gerarchia di autorizzazione (project_logic_map.md Phase 27 — Gestione Utenti)

```
SuperAdmin  →  accesso universale (tutte le configurazioni)
Admin       →  accesso alle proprie managedConfigIds
User        →  accesso solo alla propria configId (config-fenced)
```

---

## 1. Diagnosi Confermata

### Bug 1 — Turni vuoti dopo Self-Healing al login (🔴 CRITICA)

**Causa principale — JWT stale post self-healing:**

`authStore.loadUserProfile()` chiama `repairOperatorLink()` che scrive correttamente
`operatorId` e `configId` su Firestore (`users/{uid}` + `operators/{id}`), ma **NON**
chiama `forceTokenRefresh()`. Il JWT dell'utente mantiene il vecchio `configId` (o
`null`). La Security Rule `isUserInConfig(configId)` fallisce → tutti i read sulla
subcollection `operators` sono bloccati → calendario vuoto.

**Causa secondaria — RAM stale (risolta altrove):**

`SyncOperatorCard.vue` (usato in `PendingVerificationPage`) chiama già
`authStore.loadUserProfile(uid)` dopo la sync manuale. Quel path è OK perché
`syncUserToOperator()` → `updateUserRole()` → `/api/update-role` → `getIdToken(true)`
già aggiorna il JWT. Il problema stale-RAM rimane **solo** nel path self-healing di login.

**Prova della diagnosi**: eliminando e ri-registrando l'utente, il JWT viene emesso
fresh con `configId` corretto → tutto funziona. Questo è esattamente il sintomo: il
re-login forza un nuovo JWT, la self-healing invece ricicla quello vecchio.

**File impattato**: `src/stores/authStore.ts`

---

### Bug 2 — "Elimina Utente" assente nelle Azioni (🟠 ALTA)

**Problema A — Identity lock**: eliminare solo il documento `/users/{uid}` senza
rimuovere `userId` dal documento `operators/{id}` lascia l'operatore "claimed" da un
account Auth inesistente. L'identity guard (`if (recovered.userId && recovered.userId !== uid)`)
bloccherà ogni futuro tentativo di self-healing per quell'operatore.

**Problema B — Auth orphan**: il client SDK Firebase non può eliminare account Auth.
Serve `firebase-admin` via Vercel serverless. Senza questa pulizia, l'email rimane
"occupata" in Firebase Auth (blocca re-registrazione).

**File impattati**: `src/services/UserService.ts`, `src/pages/AdminUsersPage.vue`,
nuovo file `api/delete-user.js`

---

### Bug 2.1 — "Trasferisci Reparto" assente nelle Azioni (🟠 ALTA)

**Problema — JWT post-transfer**: se si aggiorna `configId` solo in Firestore senza
aggiornare il JWT, l'utente trasferito ricade esattamente nel Bug 1 — calendario vuoto
nel nuovo reparto per JWT stale. Il fix è lo stesso principio: dopo ogni modifica di
`configId` bisogna aggiornare JWT via `/api/update-role`.

**Problema — Atomicità**: il trasferimento tocca 3 documenti diversi (vecchio operatore,
utente, nuovo operatore). Serve un `writeBatch` per garantire consistenza. Un fallimento
a metà lascerebbe un utente con `configId` incoerente.

**File impattati**: `src/services/UserService.ts`, nuovo componente
`src/components/admin/TransferUserDialog.vue`, `src/pages/AdminUsersPage.vue`

---

## 2. Piano di Implementazione per Fasi

---

### ✅ Fase 0 — Slug IDs + Sync crash fix + Self-healing base (COMMITTATA)

- [x] `models.ts`: aggiunto `userId?: string` all'interfaccia `Operator`
- [x] `GoogleSheetsService.ts`: `slugifyName()` privato, sostituite entrambe le istanze di `` `op-${i}` ``
- [x] `SyncService.ts`: `syncOperatorsFromSheets()` riscritto — Caso A/B/C + orphan cleanup + `set+merge`
- [x] `OperatorsService.ts`: aggiunto `findOperatorByName()` con normalizzazione NFD
- [x] `UserService.ts`: aggiunto `repairOperatorLink()` con `set+merge`
- [x] `authStore.ts`: aggiunto identity guard + self-healing in `loadUserProfile()`, safe fullName construction

---

### ✅ Fase 1 — JWT Refresh dopo Self-Healing (🔴 CRITICA)

**Checklist**:
- [x] `authStore.ts`: aggiungere `await forceTokenRefresh()` dopo `repairOperatorLink()` nel blocco self-healing
- [x] `authStore.ts`: aggiornare `@modified` nell'header JSDoc
- [x] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
- [ ] Test: login con utente in stato self-healing → calendario mostra turni senza re-registrazione

**File**: `src/stores/authStore.ts`

**Modifica minima** nel blocco self-healing di `loadUserProfile()`:

```typescript
// DOPO:
await userService.repairOperatorLink(uid, user.configId, recovered.id);
// AGGIUNGERE subito dopo:
await forceTokenRefresh();   // ← 1 riga — JWT ora riflette il configId aggiornato
// continua come ora:
currentUser.value = { ...user, operatorId: recovered.id };
currentOperator.value = recovered;
logger.info('Self-healed stale operatorId link for user');
```

**Perché funziona**: `forceTokenRefresh()` esiste già in authStore — chiama
`authUser.value.getIdToken(true)` (invalidazione lato Firebase) + `refreshClaimRole(authUser.value)`
(aggiornamento RAM dello store). Il JWT risultante conterrà il `configId` aggiornato
(impostato durante `approveUserWithConfig` o `syncUserToOperator` via `/api/update-role`).
Da quel momento `isUserInConfig()` passa → letture Firestore sbloccate.

**Regole project-rules.md**:
- §1.7 — aggiornare `@modified` nell'header JSDoc del file
- §1.3 — nessun `console.log`: il `logger.info` già presente è sufficiente
- §1.8 — nessun `any` introdotto
- Nessun nuovo import necessario (`forceTokenRefresh` esiste già nello stesso file)

---

### ✅ Fase 2 — Endpoint Vercel `api/delete-user.js` (🟠 ALTA)

**Checklist**:
- [x] Creare `api/delete-user.js` con schema `initAdmin()` + auth check `VERCEL_API_SECRET`
- [x] Blocco self-deletion (`uid === callerUid`) a livello API
- [x] Test: risponde `401` senza secret, `403` se uid === callerUid

**Pattern da rispettare**: stesso schema di `api/update-role.js` —
`initAdmin()` helper + auth check `Authorization: Bearer ${VERCEL_API_SECRET}`.

**Schema del file**:

```javascript
/**
 * @file delete-user.js
 * @description Vercel Serverless API: elimina un account Firebase Auth tramite
 * firebase-admin. Il client SDK non ha questo privilegio. Chiamato da
 * UserService.deleteUser(). Richiede VERCEL_API_SECRET nell'header Authorization.
 * @author Nurse Hub Team
 * @created 2026-05-15
 * @modified 2026-05-15
 */
'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length) return { auth: getAuth() };
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saEnv) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  const app = initializeApp({ credential: cert(JSON.parse(saEnv)) });
  return { auth: getAuth(app) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check — identico a update-role.js
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { uid, callerUid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  // Hardening: blocca self-deletion a livello API (difesa in profondità)
  if (uid === callerUid) {
    return res.status(403).json({ error: 'Self-deletion not allowed' });
  }

  let admin;
  try {
    admin = initAdmin();
  } catch (err) {
    return res.status(500).json({ error: 'Backend misconfiguration', details: err.message });
  }

  try {
    await admin.auth.deleteUser(uid);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
}
```

**Note sicurezza (OWASP A01)**:
- `VERCEL_API_SECRET` verificato su ogni chiamata
- `uid === callerUid` bloccato sia qui che in UI (difesa in profondità)
- Nessun dato sensibile nel body di risposta in caso di errore generico

---

### ⬜ Fase 3 — `UserService.deleteUser()` (🟠 ALTA)

**Checklist**:
- [ ] `UserService.ts`: aggiungere `deleteField` alla destructuring `firebase/firestore`
- [ ] `UserService.ts`: aggiungere metodo `deleteUser(uid, callerUid): Promise<void>` con batch atomico
- [ ] `UserService.ts`: aggiornare `@modified` nell'header JSDoc
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
- [ ] Test: dopo chiamata, `operators/{id}.userId` non esiste in Firestore console
```typescript
import { ..., deleteField } from 'firebase/firestore';
// (aggiungere deleteField alla destructuring esistente — no import duplicato)
```

**Metodo da aggiungere** — tipizzazione esplicita, nessun `any`:

```typescript
/**
 * Elimina un utente completamente: libera l'operatore associato, rimuove
 * il documento Firestore e cancella l'account Firebase Auth via Vercel API.
 * @param uid - UID dell'utente da eliminare
 * @param callerUid - UID del SuperAdmin che esegue l'operazione (per self-deletion check)
 */
async deleteUser(uid: string, callerUid: string): Promise<void> {
  const userSnap = await getDoc(doc(this.usersCollection, uid));
  const userData = userSnap.data() as User | undefined;

  const batch = writeBatch(db);

  // Libera il campo userId sull'operatore associato
  // Senza questo, l'operatore rimane "claimed" da un account inesistente
  if (userData?.configId && userData?.operatorId) {
    batch.update(
      doc(db, 'systemConfigurations', userData.configId, 'operators', userData.operatorId),
      { userId: deleteField() }
    );
  }

  batch.delete(doc(this.usersCollection, uid));
  await batch.commit();

  // Elimina l'account Firebase Auth via firebase-admin (client SDK non può farlo)
  const response = await fetch(`${import.meta.env.VITE_VERCEL_URL}/api/delete-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_VERCEL_API_SECRET ?? ''}`,
    },
    body: JSON.stringify({ uid, callerUid }),
  });

  if (!response.ok) {
    const errorData = await response.json() as { error: string };
    throw new Error(`Auth deletion failed: ${errorData.error}`);
  }

  logger.info('deleteUser: utente eliminato completamente', { uid });
}
```

**Regole project-rules.md**:
- §1.7 — JSDoc sul metodo, `@modified` nell'header del file
- §1.8 — `User | undefined` invece di `any`; `{ error: string }` per il response JSON
- §1.3 — `logger.info` (già importato in UserService)
- §1.9 — nessun `eslint-disable`

---

### ⬜ Fase 4 — UI "Elimina Utente" in `AdminUsersPage.vue` (🟠 ALTA)

**Checklist**:
- [ ] `AdminUsersPage.vue`: aggiungere `q-item` "Elimina Utente" nel `q-btn-dropdown` (solo SuperAdmin, disabilitato su se stesso)
- [ ] `AdminUsersPage.vue`: aggiungere `deleteUserDialog` ref + `confirmDeleteUser()` + `executeDeleteUser()`
- [ ] `AdminUsersPage.vue`: aggiungere `q-dialog` di conferma inline con avviso irreversibilità
- [ ] `AdminUsersPage.vue`: aggiornare `@modified` nell'header JSDoc
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
- [ ] Test: pulsante non visibile se non SuperAdmin; pulsante disabilitato su se stesso

**Nota §1.11**: la pagina supera già la soglia. La dialog di conferma va implementata
come un ref `q-dialog` inline minimo (nessuna logica complessa estratta separatamente)
per non creare un componente astratto per una singola operazione semplice.

**Aggiunta al `q-btn-dropdown` Azioni** (solo SuperAdmin, disabilitato su se stesso):

```html
<q-separator v-if="authStore.isSuperAdmin" />
<q-item
  v-if="authStore.isSuperAdmin"
  clickable
  v-close-popup
  :disable="props.row.uid === authStore.currentUser?.uid"
  @click="confirmDeleteUser(props.row)"
>
  <q-item-section avatar>
    <q-icon name="delete_forever" color="negative" />
  </q-item-section>
  <q-item-section>
    <q-item-label class="text-negative">Elimina Utente</q-item-label>
    <q-item-label caption v-if="props.row.uid === authStore.currentUser?.uid">
      Non puoi eliminare te stesso
    </q-item-label>
  </q-item-section>
</q-item>
```

**Dialog di conferma inline** (in `<template>`, accanto agli altri `q-dialog`):

```html
<q-dialog v-model="deleteUserDialog.show">
  <q-card style="min-width: 350px">
    <q-card-section class="row items-center">
      <q-avatar icon="warning" color="negative" text-color="white" />
      <span class="q-ml-sm text-h6">Elimina Utente</span>
    </q-card-section>
    <q-card-section>
      Stai per eliminare <strong>{{ deleteUserDialog.targetName }}</strong>.
      Questa operazione è <strong>irreversibile</strong>: il documento Firestore
      e l'account Firebase Auth verranno cancellati permanentemente.
    </q-card-section>
    <q-card-actions align="right">
      <q-btn flat label="Annulla" v-close-popup />
      <q-btn
        label="Elimina"
        color="negative"
        :loading="deleteUserDialog.loading"
        @click="executeDeleteUser"
      />
    </q-card-actions>
  </q-card>
</q-dialog>
```

**Logica `<script setup>`** da aggiungere:

```typescript
const deleteUserDialog = ref<{
  show: boolean;
  targetUid: string;
  targetName: string;
  loading: boolean;
}>({ show: false, targetUid: '', targetName: '', loading: false });

function confirmDeleteUser(user: User) {
  deleteUserDialog.value = {
    show: true,
    targetUid: user.uid,
    targetName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    loading: false,
  };
}

async function executeDeleteUser() {
  deleteUserDialog.value.loading = true;
  try {
    await userService.deleteUser(
      deleteUserDialog.value.targetUid,
      authStore.currentUser?.uid ?? ''
    );
    deleteUserDialog.value.show = false;
    $q.notify({ type: 'positive', message: 'Utente eliminato con successo.' });
    await loadUsers();
  } catch (err) {
    logger.error('executeDeleteUser failed', { err });
    $q.notify({ type: 'negative', message: "Errore durante l'eliminazione." });
  } finally {
    deleteUserDialog.value.loading = false;
  }
}
```

---

### ⬜ Fase 5 — `UserService.transferUserToConfig()` (🟡 MEDIA)

**Checklist**:
- [ ] `UserService.ts`: verificare firma `updateUserRole()` — accetta `configId` come 5° parametro
- [ ] `UserService.ts`: aggiungere metodo `transferUserToConfig(uid, newConfigId, newOperatorId, newProfession): Promise<void>`
- [ ] Batch atomico: libera vecchio operatore + aggiorna utente + claim nuovo operatore
- [ ] Dopo batch: chiamata a `updateUserRole()` con nuovo `configId` per aggiornare JWT (Phase 30.1)
- [ ] `UserService.ts`: aggiornare `@modified` nell'header JSDoc
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori

**Garanzia di atomicità**: un `writeBatch` singolo tocca 3 documenti. Solo se il batch
ha successo si procede con il JWT refresh. Qualsiasi eccezione lascia Firestore invariato.

**Pre-verifica**: controllare la firma attuale di `updateUserRole()`. Se non accetta
`configId` come quinto parametro, va estesa. L'API `/api/update-role` già deserializza
`configId` dal body (vedere `update-role.js` ~riga 60).

```typescript
/**
 * Trasferisce un utente da una configurazione a un'altra in modo atomico.
 * Aggiorna i documenti Firestore in batch, poi aggiorna i JWT claims per
 * garantire che il nuovo configId sia subito riflesso nel token (Phase 30.1).
 * @param uid - UID dell'utente da trasferire
 * @param newConfigId - ID della nuova configurazione (reparto)
 * @param newOperatorId - ID dell'operatore nel nuovo reparto da associare
 * @param newProfession - Professione dell'operatore di destinazione
 */
async transferUserToConfig(
  uid: string,
  newConfigId: string,
  newOperatorId: string,
  newProfession: string,
): Promise<void> {
  const userSnap = await getDoc(doc(this.usersCollection, uid));
  const userData = userSnap.data() as User | undefined;

  const batch = writeBatch(db);

  // Step 1 — Libera il vecchio operatore
  if (userData?.configId && userData?.operatorId) {
    batch.update(
      doc(db, 'systemConfigurations', userData.configId, 'operators', userData.operatorId),
      { userId: deleteField() }
    );
  }

  // Step 2 — Aggiorna il documento utente
  batch.update(doc(this.usersCollection, uid), {
    configId: newConfigId,
    operatorId: newOperatorId,
    profession: newProfession,
    isVerified: true,
    pendingApproval: false,
    updatedAt: Date.now(),
  });

  // Step 3 — Claim il nuovo operatore
  batch.update(
    doc(db, 'systemConfigurations', newConfigId, 'operators', newOperatorId),
    { userId: uid }
  );

  await batch.commit();

  // Step 4 — Aggiorna JWT claims con il nuovo configId (Phase 30.1 — JWT-First)
  await this.updateUserRole(
    uid,
    userData?.role ?? 'user',
    userData?.managedConfigIds ?? [],
    userData?.permissions ?? { manageAdmins: false, manageSystem: false, viewAuditLogs: false },
    newConfigId,  // ← nuovo configId nel JWT
  );

  logger.info('transferUserToConfig: utente trasferito', { uid, newConfigId, newOperatorId });
}
```

---

### ⬜ Fase 6 — Componente `TransferUserDialog.vue` (🟡 MEDIA)

**Checklist**:
- [ ] Creare `src/components/admin/TransferUserDialog.vue`
- [ ] JSDoc header completo (`@file`, `@description`, `@author`, `@created`, `@modified`)
- [ ] Props tipizzate: `user: User | null`, `modelValue: boolean`
- [ ] Emits tipizzati: `update:modelValue`, `transferred`
- [ ] Fetch operatori per config selezionata via `OperatorsService`
- [ ] UX "Da → A" visivo (config origine + operatore attuale vs destinazione)
- [ ] `q-skeleton` durante caricamento operatori (§1.10)
- [ ] `useSecureLogger` importato, nessun `console.log` (§1.3)
- [ ] Struttura `<script>→<template>→<style>` (§2)
- [ ] Nessun `any` (§1.8)
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
impone decomposizione sopra 500). La dialog di trasferimento richiede logica propria:
fetch operatori per il config selezionato, stati di caricamento separati, validazione
della selezione config+operatore.

**UX "Elite" (analisi Antigravity)**: il dialogo mostra visivamente il confronto
"Da: [Reparto origine / Operatore attuale] → A: [Reparto dest / Operatore dest]"
così il SuperAdmin ha piena visibilità del trasferimento prima di confermare.

**Schema struttura** (rispettando §2 — ordine `<script>→<template>→<style>`):

```vue
<script setup lang="ts">
/**
 * @file TransferUserDialog.vue
 * @description Dialog per il trasferimento di un utente tra configurazioni (reparti).
 * Mostra confronto visivo "Da → A" e gestisce atomicamente la selezione
 * config+operatore di destinazione. Accessibile solo a SuperAdmin.
 * @author Nurse Hub Team
 * @created 2026-05-15
 * @modified 2026-05-15
 */
import { ref, computed, watch } from 'vue';
import { useConfigStore } from 'src/stores/configStore';
import { useOperatorsService } from 'src/services/OperatorsService';
import { useUserService } from 'src/services/UserService';
import { useSecureLogger } from 'src/utils/useSecureLogger';
import type { User, Operator } from 'src/types/models';

const props = defineProps<{ user: User | null; modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'transferred'): void;
}>();

// ... logica: selectedConfigId, availableOperators, selectedOperatorId,
//     loading, loadingOperators, watch su selectedConfigId per caricare
//     operatori via OperatorsService, executeTransfer() → userService.transferUserToConfig()
//     → emit('transferred'), currentConfigName, selectedConfigName,
//     currentOperatorName, selectedOperatorName (computed per UX confronto visivo)
</script>

<template>
  <q-dialog :model-value="props.modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 500px">
      <q-card-section class="row items-center bg-warning text-white">
        <q-icon name="swap_horiz" size="sm" class="q-mr-sm" />
        <span class="text-h6">Trasferisci Reparto</span>
      </q-card-section>

      <!-- Confronto visivo Da → A (UX Elite Antigravity) -->
      <q-card-section>
        <div class="row items-center q-gutter-md">
          <div class="col">
            <div class="text-caption text-grey">Da:</div>
            <div class="text-subtitle2">{{ currentConfigName }}</div>
            <div class="text-caption">{{ currentOperatorName }}</div>
          </div>
          <q-icon name="arrow_forward" color="warning" size="lg" />
          <div class="col">
            <div class="text-caption text-grey">A:</div>
            <div class="text-subtitle2 text-warning">{{ selectedConfigName || '—' }}</div>
            <div class="text-caption">{{ selectedOperatorName || '—' }}</div>
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <q-select v-model="selectedConfigId" :options="configOptions"
          label="Reparto di destinazione"
          option-value="id" option-label="name" emit-value map-options />
      </q-card-section>

      <!-- q-skeleton durante caricamento operatori (§1.10) -->
      <q-card-section>
        <q-skeleton v-if="loadingOperators" type="QInput" />
        <q-select v-else v-model="selectedOperatorId" :options="availableOperators"
          label="Operatore di destinazione"
          option-value="id" option-label="fullName"
          emit-value map-options :disable="!selectedConfigId" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annulla" @click="emit('update:modelValue', false)" />
        <q-btn label="Trasferisci" color="warning"
          :loading="loading"
          :disable="!selectedOperatorId"
          @click="executeTransfer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
```

**Regole project-rules.md**:
- §1.7 — JSDoc completo nell'header del file
- §1.8 — props/emits tipizzate con `User`, `Operator` da `models.ts`; nessun `any`
- §1.10 — `q-skeleton` durante caricamento operatori
- §2 — ordine `<script>→<template>→<style>` rispettato
- §1.3 — `useSecureLogger` importato, nessun `console.log`

---

### ⬜ Fase 7 — UI "Trasferisci Reparto" in `AdminUsersPage.vue` (🟡 MEDIA)

**Checklist**:
- [ ] `AdminUsersPage.vue`: importare `TransferUserDialog`
- [ ] `AdminUsersPage.vue`: aggiungere `q-item` "Trasferisci Reparto" nel `q-btn-dropdown` (solo SuperAdmin)
- [ ] `AdminUsersPage.vue`: aggiungere `transferDialog` ref + `openTransferDialog()` + `onUserTransferred()`
- [ ] `AdminUsersPage.vue`: aggiungere `<TransferUserDialog>` nel template
- [ ] `AdminUsersPage.vue`: aggiornare `@modified` nell'header JSDoc
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
- [ ] Test: dopo trasferimento, Vue DevTools → `authStore.currentUser.configId` = nuovo configId

```html
<q-item
  v-if="authStore.isSuperAdmin"
  clickable
  v-close-popup
  @click="openTransferDialog(props.row)"
>
  <q-item-section avatar>
    <q-icon name="swap_horiz" color="warning" />
  </q-item-section>
  <q-item-section>
    <q-item-label>Trasferisci Reparto</q-item-label>
  </q-item-section>
</q-item>
```

**Import e logica** da aggiungere in `<script setup>`:

```typescript
import TransferUserDialog from 'src/components/admin/TransferUserDialog.vue';

const transferDialog = ref<{ show: boolean; targetUser: User | null }>({
  show: false, targetUser: null,
});

function openTransferDialog(user: User) {
  transferDialog.value = { show: true, targetUser: user };
}

async function onUserTransferred() {
  transferDialog.value.show = false;
  $q.notify({ type: 'positive', message: 'Utente trasferito con successo.' });
  await loadUsers();
}
```

**Tag nel template** (vicino agli altri `q-dialog`):

```html
<TransferUserDialog
  v-if="transferDialog.targetUser"
  v-model="transferDialog.show"
  :user="transferDialog.targetUser"
  @transferred="onUserTransferred"
/>
```

---

### ⬜ Fase 8 — Campo `department` + Dropdown Registrazione (🟡 MEDIA)

> **Contesto**: attualmente `RegisterPage.vue` non raccoglie alcuna informazione di reparto.
> L'utente si registra con dati personali e viene assegnato al reparto dall'admin durante
> l'approvazione. Aggiungere la selezione del reparto alla registrazione riduce il carico
> di lavoro admin e pre-popola `configId` già al momento del signup.

**Checklist**:
- [ ] `src/types/models.ts`: aggiungere `department?: string` all'interfaccia `SystemConfiguration`
  (campo opzionale, retrocompatibile con configurazioni esistenti senza il campo)
- [ ] `src/pages/SystemConfig.vue` (o pagina admin configurazioni): aggiungere campo "Nome Reparto"
  per permettere all'admin di descrivere il reparto (es. "Chirurgia A", "Terapia Intensiva")
- [ ] `firestore.rules`: permettere `allow read: if true` solo sui campi `id` e `name` di
  `systemConfigurations/{id}` (non subcollections) — necessario per dropdown pubblico GDPR-safe
- [ ] `src/pages/RegisterPage.vue`: aggiungere `q-select` che fetcha `systemConfigurations`
  (solo `id` + `name`, via query limitata) — bindato a `formData.configId`
- [ ] `src/stores/authStore.ts` → `register()`: passare `configId` opzionale alla creazione
  del documento `/users/{uid}` se selezionato dall'utente
- [ ] Test: nuovo utente seleziona reparto → documento `/users/{uid}` ha `configId` pre-impostato
- [ ] Test: la pagina di registrazione è accessibile senza login e fetcha solo `name`/`id` dei config
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori

**Nota architetturale (Phase 30.1 — JWT-First)**: il `configId` pre-impostato in Firestore
NON viene automaticamente messo nel JWT al momento della registrazione. Il JWT viene aggiornato
solo quando l'admin approva l'utente via `approveUserWithConfig()` → `/api/update-role`.
Il pre-fill del `configId` a registrazione è solo un hint per l'admin, non un bypass dell'approvazione.

**Schema modifica `RegisterPage.vue`**:
```typescript
// formData da estendere con:
const formData = ref({
  // ... campi esistenti ...
  configId: '' as string | '',  // reparto selezionato (opzionale)
});

// Fetch configurazioni pubbliche (solo id + name) — senza autenticazione
const publicConfigs = ref<Array<{ id: string; name: string }>>([]);

async function loadPublicConfigs(): Promise<void> {
  const snap = await getDocs(collection(db, 'systemConfigurations'));
  publicConfigs.value = snap.docs.map((d) => ({
    id: d.id,
    name: (d.data() as { name: string }).name,
  }));
}
onMounted(() => { void loadPublicConfigs(); });
```

**Schema modifica `firestore.rules`** (aggiunta a `systemConfigurations`):
```
match /systemConfigurations/{configId} {
  // Lettura pubblica SOLO del documento radice (id + name + profession)
  // Non include subcollections (operators, shifts) che restano protette
  allow get: if true;      // solo GET singolo doc, non list completa
  // ... regole esistenti ...
}
```

---

### ⬜ Fase 9 — `syncUserToOperator()` Bimodale (🟡 MEDIA)

> **Contesto**: `syncUserToOperator()` in `UserService.ts` scansiona TUTTE le configurazioni
> (30+) × TUTTI gli operatori (50+) = 1.500+ letture Firestore per ogni registrazione.
> Con la Fase 8, molti utenti avranno `configId` pre-impostato → si può ottimizzare drasticamente.

**Checklist**:
- [ ] `UserService.ts`: refactoring di `syncUserToOperator()` per modalità bimodale:
  - **Modalità fast** (utente ha `configId`): cerca solo negli operatori di quella configurazione (~50 reads)
  - **Modalità legacy** (nessun `configId`): scansiona tutti i config come ora (fallback per compatibilità)
- [ ] Aggiungere log `logger.info` che indica quale modalità è stata usata
- [ ] `UserService.ts`: aggiornare `@modified` nell'header JSDoc
- [ ] `yarn vue-tsc --noEmit && yarn lint` — 0 errori
- [ ] Test: utente con `configId` pre-impostato → log mostra "fast path, 1 config scanned"

**Schema bimodale**:
```typescript
async syncUserToOperator(uid: string): Promise<SyncResult> {
  const userSnap = await getDoc(doc(this.usersCollection, uid));
  const userData = userSnap.data() as User | undefined;

  // Modalità fast: configId già noto → cerca solo in quella config
  if (userData?.configId) {
    logger.info('syncUserToOperator: fast path', { configId: userData.configId });
    return this.syncInConfig(uid, userData, userData.configId);
  }

  // Modalità legacy: scansione completa (utenti senza configId pre-impostato)
  logger.info('syncUserToOperator: legacy scan-all path', { uid });
  const allConfigs = await getDocs(this.configurationsCollection);
  for (const configDoc of allConfigs.docs) {
    const result = await this.syncInConfig(uid, userData, configDoc.id);
    if (result.matched) return result;
  }
  return { matched: false };
}

private async syncInConfig(uid: string, userData: User | undefined, configId: string): Promise<SyncResult> {
  // ... logica di match per nome + assegnazione operatorId ...
}
```

---

## 3. Sicurezza — OWASP Hardening

| Rischio | Mitigazione |
|---|---|
| A01 — Broken Access Control: delete/transfer senza autorizzazione | `v-if="authStore.isSuperAdmin"` in UI + `VERCEL_API_SECRET` sull'endpoint |
| A01 — SuperAdmin self-delete | `:disable="uid === authStore.currentUser?.uid"` in UI + `uid === callerUid` nell'API |
| A03 — Injection: UID non validato in API | Firebase Admin SDK valida internamente; errori 404/500 gestiti con catch |
| A04 — Insecure Design: half-transfer su errore | `writeBatch` garantisce atomicità — o tutto o niente |
| A07 — JWT stale post-modifica configId | `forceTokenRefresh()` (Fase 1) + `updateUserRole()` (Fase 5) obbligatori |
| A01 — Lettura pubblica configurazioni in registrazione | `allow get: if true` solo sul doc radice, mai sulle subcollections (Fase 8) |

---

## 5. Checklist Pre-Commit Globale (§1.6)

Eseguire dopo ogni fase prima di committare:

```bash
yarn vue-tsc --noEmit   # → 0 errori TypeScript
yarn lint               # → 0 warning/errori ESLint
```

Conformità regole (spuntare per ogni commit):
- [ ] Nessun `any` introdotto (§1.8)
- [ ] `@modified` aggiornato in header JSDoc di ogni file modificato (§1.7)
- [ ] JSDoc completo su ogni nuovo file e metodo pubblico (§1.7)
- [ ] `deleteField()` aggiunto alla destructuring esistente di `firebase/firestore` (no import duplicato)
- [ ] `TransferUserDialog.vue`: struttura `<script>→<template>→<style>` (§2)
- [ ] `TransferUserDialog.vue`: `useSecureLogger` usato (§1.3)
- [ ] Nessun `eslint-disable` in nessun file (§1.9)
- [ ] `q-skeleton` usato dove ci sono caricamenti asincroni (§1.10)
