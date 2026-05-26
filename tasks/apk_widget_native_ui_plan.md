# Piano di Refactoring UI: Widget Nativo Android (Strada Estrema)

## 1. Analisi dello Stato Attuale
In base all'analisi della cartella `src-capacitor/android` e del file `project_logic_map.md` (Fase 44):
- **Provider**: Esiste già `ShiftWidgetProvider.java` che gestisce i dati e mappa i colori.
- **Layout**: Esiste `widget_shifts.xml` che definisce una griglia di 42 celle (`cell_r0c0` ... `cell_r5c6`).
- **Problema Visivo**: Attualmente il widget mostra sfondi piatti semi-trasparenti, bordi neri spessi, e il testo (Giorno e Lettera) ha la stessa dimensione, rendendolo disordinato e lontano dal design "Premium" dell'app Vue.

## 2. Obiettivo (Regola §1.12 e Elite UI)
Replicare la "Elite UI" dell'app Quasar (Immagine 1) direttamente nel widget nativo Android (Immagine 2) **senza usare WebViews**, sfruttando al massimo le `RemoteViews` native.
Dobbiamo ottenere:
- Sfondo generale del widget bianco con bordi arrotondati e ombra.
- Celle separate (margini) con bordi arrotondati.
- Numero del giorno piccolo e grigio in alto.
- Lettera del turno grande, in grassetto e colorata al centro.
- (Opzionale) Piccola icona identificativa sotto la lettera.

---

## 3. Piano di Implementazione (Step-by-Step)

### Step 1: Container Principale e Layout Griglia (`widget_shifts.xml`)
Non modificheremo il numero di celle (che rimangono 42), ma modificheremo il contenitore.
- **Sfondo Container**: Creare un nuovo file `res/drawable/widget_container_bg.xml` (Rettangolo bianco con `corners radius="16dp"`).
- **Spaziatura Griglia**: Aggiungere un `padding` interno al contenitore.
- **Eliminazione Bordi Neri**: Rimuovere eventuali divisori neri hardcoded nel `GridLayout` o `TableLayout`. Assicurarsi che le celle abbiano un `layout_margin="2dp"` per creare spazio ("gap") tra di loro.

### Step 2: Ridisegnare i Background delle Celle (`res/drawable/widget_cell_bg_*.xml`)
Attualmente i background riempiono l'intera cella con il colore del turno. Li trasformeremo in vere "Card":
- Modificare i file esistenti (es. `widget_cell_bg_m.xml`) per utilizzare un `<layer-list>`.
- **Livello base**: Sfondo solido bianco (`#FFFFFF`) con bordi arrotondati (`radius="8dp"`).
- **Livello superiore (Striscia)**: Un rettangolo colorato (es. Giallo per la M) posizionato solo nella parte superiore (`top="0dp"`, `bottom="40dp"`) per simulare la striscia colorata superiore dell'app.
- Creare un file `widget_cell_bg_empty.xml` per i giorni vuoti (trasparente o grigio chiarissimo).

### Step 3: Stile del Testo via HTML (Java `ShiftWidgetProvider.java`)
Per evitare di appesantire il widget con centinaia di View annidate (che rallenterebbero il telefono), useremo la formattazione HTML nativa per avere due dimensioni di testo nello stesso elemento.
Nel ciclo Java, cambieremo la riga di assegnazione del testo:

```java
// Vecchio codice:
// String cellText = dayNum + "\n" + shift;
// views.setTextViewText(resId, cellText);

// Nuovo codice (HtmlCompat per multi-styling):
String hexColor = getHexForShift(shift); // Metodo da creare per avere l'HEX string
String htmlText = "<small><font color='#94a3b8'>" + dayNum + "</font></small><br/>" +
                  "<b><big><font color='" + hexColor + "'>" + shift + "</font></big></b>";

views.setTextViewText(resId, android.text.Html.fromHtml(htmlText, android.text.Html.FROM_HTML_MODE_COMPACT));
```
In questo modo:
- Il giorno (`dayNum`) appare piccolo e grigio.
- Il turno (`shift`) appare grande, in grassetto e del colore corretto.

### Step 4: Aggiunta delle Icone SVG (Compound Drawables)
Per replicare l'icona del letto, del sole o della luna sotto la lettera (visibile nell'App Quasar):
1. Importare i file SVG delle icone (Sole, Luna, Letto, ecc.) come `VectorDrawable` in Android Studio (cartella `res/drawable/ic_sun.xml`, `ic_moon.xml`, ecc.).
2. In `ShiftWidgetProvider.java`, usare il metodo `setCompoundDrawablesWithIntrinsicBounds` o il relativo equivalente `RemoteViews` (es. `views.setTextViewCompoundDrawables(resId, 0, 0, 0, iconResId)`) per iniettare l'icona *sotto* il testo.

## 4. Conformità alle Regole di Progetto
- **GDPR (§1.5)**: Il widget mostra solo dati del turno ("M", "P"), senza esporre dati sensibili in chiaro (nessun ID utente o password in cache).
- **Single Source of Truth (§1.12)**: I colori (`#F59E0B`, `#EA580C`, ecc.) usati nel widget nativo saranno estratti e copiati fedelmente dalla mappa `SHIFT_STYLE_MAP` in `useShiftLogic.ts`.
- **Prestazioni**: L'uso di `Html.fromHtml` su una singola `TextView` invece di usare 3 `TextView/ImageView` separate per ogni cella (42 * 3 = 126 views) mantiene il widget leggerissimo per la RAM di Android, rispettando l'ottimizzazione del progetto.

## Conclusioni
Seguendo questo piano, si otterrà un Home Widget nativo per Android visivamente quasi identico all'interfaccia Vue/Quasar, senza compromessi prestazionali.
