# Phase 35 — Candidatura Multi-Scenario
## Piano d'Azione Ottimizzato (Post-Analisi Approfondita)

---

## ⚠️ Problemi Critici NON Coperti dal Piano Precedente

### 🔴 Problema 1 — `getMyOffer()` è Single-Offer By Design (§1.12 violazione)
**File:** `useRequestsFilter.ts` righe 326-330

La funzione `getMyOffer()` usa `.find()` che restituisce **solo la prima offerta** trovata per quell'operatore.
Con offerte multiple, questa funzione restituirebbe sempre solo la prima proposta, rompendo:
- `getMyOfferTimestamp()` → mostra solo il timestamp della prima offerta
- `getMyOfferLabel()` → mostra solo lo scenario della prima offerta
- `getMyOfferStatusLabel()` → confronta `acceptedOfferId` con la prima offerta, potrebbe non riconoscere le approvazioni
- **Conseguenza**: L'utente vedrebbe "Rifiutata / Coperta da altri" anche se una sua seconda proposta è stata approvata.

**Soluzione**: Refactoring a `getMyOffers()` (plurale) che restituisce **tutti** gli oggetti offerta dell'operatore corrente. Lo storico mostra una riga per ogni proposta invitata.

---

### 🔴 Problema 2 — `offeringOperatorIds` ha semantica ambigua (integrità dati)
**File:** `useRequestsFilter.ts` riga 264, `useRequestsFilter.ts` riga 157-158

`offeringOperatorIds` viene usato per:
1. Filtrare le opportunità (non mostrare richieste a cui hai già risposto)
2. Interrogare lo storico `where('offeringOperatorIds', 'array-contains', myOpId)`

Con selezione multipla, se un utente seleziona 2 scenari, l'operatorId viene aggiunto **una sola volta** ad `offeringOperatorIds` (grazie a `arrayUnion`), quindi la semantica rimane corretta.

**Nessuna modifica necessaria** — questo punto era già gestito correttamente nel piano precedente.

---

### 🔴 Problema 3 — Logica de-duplicazione scenari nella UI vs logica di invio (§1.12 violazione)
**File:** `useRequestsFilter.ts` righe 233-243

La de-duplicazione degli scenari avviene con la chiave `roleLabel|newShift|incentive`. Questo significa che se l'utente vede due righe distinte nel dialogo, sono garantite essere **differenti**. Bene.

**MA**: nel `submitOffer` attuale si invia un'offerta per `selectedScenario`. Con selezione multipla, potremmo inviare offerte con `newShift` diversi (es. MP e P) per lo stesso turno. L'Admin vede queste come due candidature distinte dello stesso operatore per ruoli diversi. **Questo è il comportamento corretto** e coincide con la logica Phase 33 §8 del `project_logic_map.md`:
> "L'Admin può selezionare l'offerta specifica che preferisce"

---

### 🟡 Problema 4 — `ActiveRequestsCard.vue` esporta `selectedScenario` (singolo) — breaking change
**File:** `ActiveRequestsCard.vue` riga 19

Il componente destructura `selectedScenario` da `useRequestsFilter`. Il cambio a `selectedScenarios` (array) richiede:
1. Aggiornare `useRequestsFilter` (composable)
2. Aggiornare `ActiveRequestsCard.vue` (template)

Sono **solo 2 file** — la decomposizione §1.11 ha già isolato la logica. Il breaking change è contenuto.

---

### 🟡 Problema 5 — Notifica all'Admin: rischio spam se multi-select
**File:** `useRequestsFilter.ts` riga 272-276

Attualmente, ad ogni `submitOffer` parte **una notifica** agli admin.
Con 3 scenari selezionati, se iteriamo e inviamo 3 volte separatamente, l'Admin riceve 3 notifiche per lo stesso operatore.

**Soluzione nel piano migliorato**: `submitOffer` esegue **un unico** `updateDoc` con `arrayUnion(...tutteLeOfferte)` e **una sola notifica** con messaggio aggregato: `"CHIFEAC VASILE si è offerto con 2 opzioni di copertura per il turno P del 21/05"`.

---

### 🟡 Problema 6 — Storico "Le mie candidature": granularità per richiesta vs per offerta
**Logica attuale**: Nel tab "history", ogni `ShiftRequest` appare come **una riga** (anche se l'utente ha fatto 2 offerte per quella richiesta).

**Con Multi-Offer, due possibili approcci:**

| Approccio | Pro | Contro |
|---|---|---|
| **A) Riga per Richiesta** (attuale) con sotto-lista delle proprie offerte | Compatto, mantiene la struttura | Logica `getMyOfferLabel` da rifattorizzare |
| **B) Riga per Offerta** (nuovo) — ogni proposta è una voce separata | Massima chiarezza | Può diventare lungo |

**Raccomandazione**: Approccio A — mantieni una riga per richiesta, espandi per mostrare le tue offerte multiple con i rispettivi stati individuali. Più user-friendly su mobile.

---

## ✅ Piano d'Azione Ottimizzato — 5 Step

### Step 1 — Refactoring `useRequestsFilter.ts` (Core Logic)

**Cambiamenti:**
1. `selectedScenario: ref<CompatibleScenario | null>(null)` → `selectedScenarios: ref<CompatibleScenario[]>([])`
2. `openOfferDialog()`: reset con `selectedScenarios.value = []` invece di `null`
3. `submitOffer()`: 
   - Guard: `if (selectedScenarios.value.length === 0 || ...)` 
   - Genera array offerte: `selectedScenarios.value.map(s => ({ id: ..., roleLabel: s.roleLabel, ... }))`
   - Unico `arrayUnion(...offers)` — operazione atomica
   - Unica notifica admin aggregata
4. `getMyOffer()` → `getMyOffers()` che ritorna `Offer[]`
5. Aggiornare tutti i helpers (`getMyOfferStatusLabel`, ecc.) per gestire array di offerte

**Impatto §1.12**: Single Source of Truth preservata — tutta la logica rimane in `useRequestsFilter.ts`

---

### Step 2 — Aggiornamento UI `ActiveRequestsCard.vue` (Dialog)

**Cambiamenti nel template (righe 256-274):**
- `q-radio` → `q-checkbox`
- `v-model` su array: `:model-value="selectedScenarios.includes(scenario)"` + `@update` handler
- Righe attive evidenziate: `:active="selectedScenarios.includes(scenario)"` (già supportato da Quasar)
- Pulsante dinamico: `"Invia {{ selectedScenarios.length }} Propost{{ selectedScenarios.length === 1 ? 'a' : 'e' }}"`
- Disable: `:disable="selectedScenarios.length === 0"`

**UX Premium (§1.10 standard)**:
- Badge sul pulsante con contatore delle proposte selezionate
- Micro-animazione quando una riga viene selezionata (già gestita da `q-ripple` + `active-class`)

---

### Step 3 — Aggiornamento Storico Candidature (History Tab)

**`getMyOffers()` (plurale)** usato nel tab history per mostrare tutte le proposte dello stesso operatore per quella richiesta.

**Layout consigliato**:
```
ShiftRequest (riga principale — data + turno originale)
  ├── Proposta 1: MP — In Valutazione
  └── Proposta 2: P (Straordinario) — Rifiutata dall'Admin
```

Usando `q-expansion-item` o una sotto-lista `q-list` condensata dentro la riga principale.

---

### Step 4 — Verifica Lato Admin (NESSUNA MODIFICA NECESSARIA)

La Phase 33 ha già implementato il Batch Approval Workflow lato Admin:
> "L'Admin può selezionare tramite checkbox più operatori all'interno dello stesso scenario combinato."

L'Admin vedrà già le offerte multiple dello stesso operatore nella sezione "Monitoraggio Offerte" — ognuna con il suo `roleLabel` (es. "MP" o "P Straordinario"). Può scegliere quale accettare o ignorarle entrambe.

**Nessuna modifica** a `useAdminRequests.ts` o ai componenti Admin.

---

### Step 5 — Aggiornamento `project_logic_map.md`

Aggiungere nella sezione §8 (Phase 33 - Expert System Advance) la nuova capacità:

> **Multi-Scenario Offer (Phase 35)**: L'operatore può selezionare più scenari di copertura compatibili in un'unica candidatura. Il sistema invia un'unica operazione atomica su Firestore e una sola notifica aggregata all'Admin. Nello storico, ogni offerta individuale è visibile sotto la relativa richiesta con il proprio stato di approvazione.

---

## 📋 File Modificati

| File | Tipo Modifica | Righe Stimate |
|---|---|---|
| `src/composables/useRequestsFilter.ts` | Refactoring stato + logica | ~20 righe cambiate |
| `src/components/dashboard/ActiveRequestsCard.vue` | UI dialog (radio→checkbox) | ~15 righe cambiate |
| `project_logic_map.md` | Documentazione | ~5 righe aggiunte |

> [!NOTE]
> **`useShiftLogic.ts` NON va modificato.** La logica di compatibilità degli scenari rimane invariata (§1.12). La modifica riguarda solo **quanti** scenari compatibili l'utente può selezionare, non **come** vengono calcolati.

> [!IMPORTANT]
> **Nessuna modifica al backend Firestore** (schema, rules). Il campo `offers` è già un array — accetta più oggetti dello stesso operatore. `offeringOperatorIds` rimane corretto perché `arrayUnion` con lo stesso ID è idempotente.

> [!WARNING]
> **Breaking Change Controllato**: `selectedScenario` (singolo) → `selectedScenarios` (array). Essendo esposto solo da `useRequestsFilter` e consumato solo da `ActiveRequestsCard.vue`, l'impatto è **zero** su altri componenti. Verificare con `yarn vue-tsc --noEmit` dopo il refactoring.
