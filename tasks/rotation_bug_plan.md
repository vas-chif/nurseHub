# Bug Report & Piano d'Azione: Rotazione Setting — Avanzamento Automatico

**Progetto:** NurseHub | **Fase:** 36 — Rotation Auto-Advance
**Regole:** `project-rules.md` | **Logica:** `project_logic_map.md`

---

## 🔬 Analisi Root-Cause (3 Bug Distinti)

### 🔴 Bug 1 — Il Timer esiste ma nessuno lo "legge" (causa principale)

**File:** `RotationWidget.vue` righe 39–60, 105–115

Quando salvi il timer con "Salva Timer", `setNextTimer()` scrive su Firestore:
```
nextChangeTimestamp: <timestamp del 16/05 ore 14:00>
currentColumnIndex: 14 (Colonna 15)
```

**Il problema**: nessuno nel frontend verifica se `Date.now() >= nextChangeTimestamp`.

Il widget ha un `setInterval` ogni 60 secondi (riga 64) che aggiorna solo il ref `now` per il countdown visivo — **ma non esegue alcuna azione** quando il timer scade. Quando il tempo è passato, il testo diventa "Scaduto" (riga 76), ma lo step in Firestore rimane **invariato**.

**In sintesi**: il timer è un orologio decorativo, non un trigger.

---

### 🔴 Bug 2 — Dopo l'avanzamento, il "prossimo" non viene ricalcolato

**File:** `RotationService.ts` funzione `updateTimerState()` (riga 76–96)

Anche se il timer scattasse, `updateTimerState` aggiorna solo i campi passati come parametri. Non c'è **nessuna logica** che, dopo aver avanzato da step 15 → 16, calcoli e scriva il prossimo appuntamento (step 16 → 17 tra 5 giorni).

Il sistema quindi si blocca sempre dopo il primo cambio programmato.

---

### 🟡 Bug 3 — `RotationWidget` usa `getDocs` (one-shot) invece di `onSnapshot` (real-time)

**File:** `RotationWidget.vue` riga 45

```typescript
const allGroups = await rotationService.getGroups(configId); // ← one-shot
```

Se Firestore viene aggiornato (es. da un altro dispositivo, o da una Cloud Function futura), il widget **non si aggiorna** fino al prossimo `loadMyGroups()` manuale. L'utente deve ricaricare la pagina per vedere il cambio avvenuto.

---

## ✅ Soluzione Architettonica (Rispettando project-rules.md)

### Scelta: Clock Guard Lato Frontend (§1.12 DRY)

Non useremo Cloud Functions (costo + complessità). Il meccanismo "Clock Guard" già usato in `useShiftLogic.ts` per le richieste scadute viene applicato anche qui.

**Logica:**
- L'`setInterval` ogni 60s nel widget controlla se `Date.now() >= group.nextChangeTimestamp`
- Se sì → chiama `advanceRotation(group)` che:
  1. Avanza `currentColumnIndex` di +1 (mod 18)
  2. Calcola il prossimo timestamp: `nextChangeTimestamp + (intervalDays * 86400000)`
  3. Scrive entrambi su Firestore con `updateTimerState()`
- Usa `onSnapshot` invece di `getDocs` per aggiornamento real-time

---

## 📋 Piano d'Azione Dettagliato — 4 Step

### Step 1 — `RotationService.ts`: Aggiungere `advanceGroup()`

Aggiungere una funzione pura `advanceGroup()` che riceve il gruppo corrente e l'intervallo in giorni, e aggiorna Firestore in modo atomico:

```typescript
async advanceGroup(configId: string, group: RotationGroup, intervalDays: number): Promise<void> {
  const totalCols = group.operators[0]?.pattern.length || 18;
  const nextIndex = advance(group.currentColumnIndex, totalCols);
  // Ricalcola il PROSSIMO timestamp dalla scadenza attuale (non da Date.now())
  // Questo evita drift se l'utente apre l'app in ritardo
  const baseTs = group.nextChangeTimestamp ?? Date.now();
  const nextTs = baseTs + intervalDays * 24 * 60 * 60 * 1000;
  
  await this.updateTimerState(configId, group.id, true, nextIndex, nextTs);
}
```

> **Perché `baseTs + N giorni` e non `Date.now() + N giorni`?**
> Se l'utente apre l'app 2 ore dopo la scadenza, `Date.now()` porterebbe uno slittamento di 2 ore ad ogni ciclo. Usando il timestamp originale come base, il ritmo rimane esatto (es. sempre alle 14:00).

---

### Step 2 — Aggiungere `intervalDays` al modello `RotationGroup`

**File:** `src/types/models.ts`

Il modello attuale non prevede l'intervallo di rotazione. Va aggiunto:

```typescript
// In RotationGroup interface:
intervalDays?: number; // Default: 5. Admin-configurable.
```

Valore di default: `5` giorni (come da tua descrizione).

---

### Step 3 — `RotationWidget.vue`: Clock Guard + onSnapshot

**Cambiamenti:**

1. **`setInterval` → aggiunge la verifica di avanzamento:**
```typescript
timerInterval.value = setInterval(async () => {
  now.value = Date.now();
  // Clock Guard: check if any group needs advancing
  for (const group of userGroups.value) {
    if (group.isActive && group.nextChangeTimestamp && Date.now() >= group.nextChangeTimestamp) {
      const days = group.intervalDays ?? 5;
      await rotationService.advanceGroup(group.configId, group, days);
      // onSnapshot aggiornerà userGroups automaticamente
    }
  }
}, 60000);
```

2. **`getDocs` → `onSnapshot` per aggiornamento real-time:**
```typescript
// Invece di: const allGroups = await rotationService.getGroups(configId);
// Usare onSnapshot con una unsubscribe reference
```

3. **Aggiungere `intervalDays` nel dialog "Gestisci Timer":**
   - Campo `q-select` o `q-input` per scegliere ogni quanti giorni avviene la rotazione (default: 5)
   - Salvato su Firestore insieme al timer

---

### Step 4 — `RotationManager.vue`: Aggiungere `intervalDays` nel form Admin

Permettere all'Admin di configurare l'intervallo di giorni per ogni gruppo al momento della creazione. Campo numerico semplice con default `5`.

---

## 📋 File Modificati

| File | Tipo | Cambiamento |
|---|---|---|
| `src/types/models.ts` | Modello | Aggiungere `intervalDays?: number` a `RotationGroup` |
| `src/services/RotationService.ts` | Service | Aggiungere `advanceGroup()` |
| `src/components/calendar/RotationWidget.vue` | Component | Clock Guard in `setInterval`, `onSnapshot`, campo `intervalDays` nel dialog |
| `src/components/admin/RotationManager.vue` | Component | Campo `intervalDays` nel form di creazione |

> [!NOTE]
> `useShiftLogic.ts` non viene modificato — la logica di rotazione è separata dalla logica di compatibilità turni.

> [!IMPORTANT]
> **Nessuna Cloud Function necessaria.** Il Clock Guard frontend è sufficiente perché:
> 1. Il sistema di rotazione non è safety-critical (se l'app non è aperta di notte, lo step avanza al primo accesso del mattino)
> 2. Rispetta il vincolo §1.2 (Firebase solo come backend operativo, non come cron-server)

> [!WARNING]
> **Migration**: I gruppi esistenti su Firestore non hanno `intervalDays`. Al primo avanzamento, se il campo è `undefined`, si usa il default `5`. Nessuna migration script necessaria.
