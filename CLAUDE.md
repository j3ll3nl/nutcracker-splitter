# Bladmuziek Knipper — CLAUDE.md

## Projectdoel

Een webapplicatie waarmee presentatoren van kerkdiensten automatisch bladmuziek-afbeeldingen kunnen opsplitsen in PowerPoint slides. De gebruiker plakt een afbeelding (zwarte achtergrond, witte noten), de app detecteert de notenbalken automatisch en knipt ze op in groepen van max. 4 regels. Per slide is er een **Kopieer** knop waarmee de afbeelding direct naar het clipboard wordt gekopieerd zodat de gebruiker het met Ctrl+V in een bestaande PowerPoint presentatie kan plakken. Daarnaast is er een volledige `.pptx` export en een ZIP export met losse PNG bestanden.

---

## Bestandsstructuur

```
├── CLAUDE.md
├── Dockerfile
├── Makefile
├── README.md
├── docker-compose.yml
├── nginx.conf
└── app/
    ├── index.html          ← HTML shell + importmap
    ├── css/
    │   └── styles.css      ← alle stijlen
    └── js/
        ├── main.js         ← entry point, state, event wiring
        ├── processor.js    ← beeldanalyse algoritme
        ├── renderer.js     ← slide lijst DOM rendering
        ├── clipboard.js    ← Clipboard API kopieer functie
        ├── exports.js      ← ZIP en PPTX export
        └── loader.js       ← afbeelding laden (file, drag-drop, paste)
```

Alle logica draait **client-side in de browser**. Er is geen backend, geen API, geen database.

---

## Tech stack

| Onderdeel | Keuze |
|---|---|
| Frontend | Vanilla HTML5 + CSS + JavaScript (ES6 modules, geen framework) |
| Beeldanalyse | Browser Canvas API (`getImageData`) |
| PowerPoint export | PptxGenJS 3.12 — geladen als UMD global via CDN script tag |
| ZIP export | JSZip 3.10 — geladen als ES module via importmap + CDN |
| Iconen | Tabler Icons (webfont, CDN) |
| Deployment | Nginx in Docker, beheerd via Docker Compose |

### CDN laden strategie

`index.html` laadt de externe libraries op twee manieren:

```html
<!-- JSZip als ES module via importmap -->
<script type="importmap">
{ "imports": { "jszip": "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm" } }
</script>

<!-- PptxGenJS als UMD global (exposeert window.PptxGenJS) -->
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
```

In `exports.js`:
- `import JSZip from 'jszip'` — via importmap
- `PptxGenJS` — direct als global, beschikbaar vanuit de script tag

---

## Module overzicht

### `app/js/main.js`
Entry point. Bevat module-level state (`loadedImage`, `chunks`), wired alle event listeners, en coördineert de flow tussen modules. Exporteert niets.

**Geëxporteerde API:** geen (entry point)

**Interne helpers:**
- `readSettings()` → `{ linesPerSlide, threshold, minGap, titleAuto, titleManualPx }`
- `filename()` → string
- `setStatus(msg, type?)` → update status element
- `setDropzoneLoaded(name, w, h)` → update dropzone UI naar geladen staat
- `setTitleHint(state)` — `state` is `'pending' | 'found' | 'none'`

---

### `app/js/processor.js`
Beeldanalyse algoritme. Gebruikt een module-level offscreen `<canvas>` (aangemaakt bij import, niet in de DOM).

**Geëxporteerde API:**
```js
processImage(img, settings) → Promise<chunk[]>
```

**`settings` object:**
| Veld | Type | Standaard | Beschrijving |
|---|---|---|---|
| `linesPerSlide` | number | 4 | Notenregels per slide |
| `threshold` | number | 12 | Helderheidsdrempel (0–60) — rijen onder deze waarde gelden als donker |
| `minGap` | number | 6 | Minimale hoogte (px) van een donkere zone om als gap te tellen |
| `titleAuto` | boolean | true | Automatische titelzone detectie |
| `titleManualPx` | number | 80 | Titelzone hoogte bij handmatige override |

**`chunk` object (resultaat per slide):**
```js
{
  blob: Blob,       // PNG blob voor Clipboard API en ZIP
  idx: number,      // 0-gebaseerde slide index
  lines: number,    // aantal notenregels in deze groep
  hasTitle: boolean,// true als titelzone meegenomen is
  b64: string,      // base64 PNG data (zonder data URI prefix) voor PptxGenJS
  imgW: number,     // breedte van de uitgesneden afbeelding
  imgH: number,     // hoogte van de uitgesneden afbeelding
}
```

**Algoritme stappen:**
1. Teken afbeelding op offscreen canvas
2. Bereken per rij de gemiddelde helderheid (`rowBright: Float32Array`)
3. Markeer donkere rijen (`rowBright[y] < threshold`)
4. Detecteer aaneengesloten donkere zones ≥ `minGap` px → `gaps[]`
5. Zones tussen gaps = content zones → filter op ≥ 10 px hoogte → `allZones[]`
6. Titelzone detectie: vergelijk staffScore van zone 0 met gemiddelde van de rest; als score < 75% → titelzone
7. Filter zones onder titelzone → `staffZones[]`
8. Groepeer per `linesPerSlide`; eerste groep krijgt titelzone mee als `top = 0`
9. Knip elke groep uit als PNG blob + base64 → `chunk[]`

**Interne functies:**
- `computeRowBrightness(data, W, H)` → `Float32Array`
- `detectGaps(rowBright, H, threshold, minGap)` → `{s, e}[]`
- `extractZones(gaps, H)` → `{s, e}[]`
- `staffScore(zone, rowBright, threshold)` → number (fractie heldere rijen)
- `resolveTitle(allZones, rowBright, threshold, titleAuto, titleManualPx)` → number (titleBottom px)
- `groupZones(staffZones, linesPerSlide, titleBottom)` → `{top, bottom, lines, hasTitle}[]`
- `cropGroup(img, grp, idx, W)` → `Promise<chunk>`

---

### `app/js/renderer.js`
Bouwt de slide lijst in de DOM. Importeert `copyToClipboard` uit `clipboard.js`.

**Geëxporteerde API:**
```js
renderSlides(chunks, { listEl, titleEl, sectionEl, bannerEl })
```

Bouwt elke slide als `.slide-row` div met thumbnail (via `URL.createObjectURL`), metadata en actie-knoppen. Gebruikt `innerHTML` met template literal voor de structuur, daarna `querySelector` voor event listeners (om XSS-risico op de statische template-strings te vermijden — deze bevatten geen user input).

**Interne functies:**
- `createSlideRow(chunk)` → `HTMLElement`
- `slideTemplate({ idx, lines, hasTitle }, thumbUrl)` → HTML string

---

### `app/js/clipboard.js`
Clipboard API wrapper.

**Geëxporteerde API:**
```js
copyToClipboard(blob, btn) → Promise<void>
```

Kopieert de blob naar het clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`. Bij succes: knop krijgt klasse `copied` en tekst "Gekopieerd!" voor 2500 ms. Bij fout (Firefox, niet-HTTPS): toont "Niet beschikbaar" voor 2500 ms.

**Vereisten:**
- HTTPS in productie (of `localhost` in development)
- Chrome/Edge: volledig ondersteund
- Firefox: niet ondersteund — catch-branch geeft "Niet beschikbaar"

---

### `app/js/exports.js`
ZIP en PPTX export. Importeert `JSZip` via importmap; gebruikt `PptxGenJS` als global.

**Geëxporteerde API:**
```js
exportZip(chunks, filename) → Promise<void>
exportPptx(chunks, filename) → Promise<void>
```

**PptxGenJS regels (kritiek):**
- Nooit `#` voor hex kleuren: `'000000'` ✅ — `'#000000'` ❌ corrupteert het bestand
- Elke export maakt een verse `new PptxGenJS()` instantie
- Layout: `LAYOUT_16x9` (10" × 5.625")
- Afbeelding gecentreerd met behoud van beeldverhouding (`centerFit`)

**Interne functies:**
- `centerFit(imgW, imgH)` → `{ x, y, w, h }` in inches, gecentreerd op 10×5.625" slide
- `triggerDownload(blob, filename)` → maakt tijdelijke `<a>` en klikt erop

---

### `app/js/loader.js`
Zet alle afbeelding-laad-mechanismen op.

**Geëxporteerde API:**
```js
setupLoader(dropzone, fileInput, onLoad)
// onLoad: (img: HTMLImageElement, name: string) => void
```

Ondersteunt:
- Klik op dropzone → `fileInput.click()`
- `<input type="file">` change event
- Drag-and-drop op dropzone
- `document` paste event (Ctrl+V / Cmd+V)

Gebruikt `URL.createObjectURL` voor snelle preview (niet base64). Filtert op `file.type.startsWith('image/')`.

---

## UI componenten

### Dropzone
- Standaard: gestippeld, `ti-photo-up` icoon
- Na laden: groene rand, `ti-circle-check` icoon, bestandsnaam + dimensies
- Dragover: blauwe rand + lichtere achtergrond (klasse `dragover`)

### Instellingen paneel (`.card`)
Drie secties gescheiden door `border-top`:

| Sectie | Controls |
|---|---|
| Notenbalken | `linesPerSlide` (number), `threshold` (range 1–60), `minGap` (number) |
| Titelregel | `titleAuto` (checkbox), `titleManualPx` (number, verborgen als auto aan), hint tekst |
| Export | `filename` (text) |

### Slide lijst
- Zichtbaar na verwerking (klasse `visible` op `#slidesSection`)
- Per slide: `.slide-row` met 220px thumbnail links, metadata + acties rechts
- Eerste slide met titelzone: blauwe rand (klasse `has-title`)
- "incl. titel" badge alleen op slide met `hasTitle: true`

### Status regel (`#status`)
- Geen klasse: grijs (muted)
- `.success`: groen
- `.error`: rood

---

## Bekende valkuilen

| Valkuil | Oplossing |
|---|---|
| PptxGenJS `#` in hex kleur | Gebruik altijd `'000000'`, nooit `'#000000'` |
| Clipboard API in Firefox | catch-branch toont "Niet beschikbaar" — correct gedrag |
| Clipboard API zonder HTTPS | Werkt alleen op `localhost` of via HTTPS |
| `URL.createObjectURL` lekt geheugen | Acceptabel voor deze use case — pagina wordt toch herladen |
| `PptxGenJS` global niet beschikbaar | Script tag moet vóór `<script type="module">` staan |
| Importmap vóór module scripts | `<script type="importmap">` moet vóór alle `type="module"` scripts staan |
| Canvas `getImageData` cross-origin | Geen probleem bij file-input of paste; werkt niet bij `<img>` van andere origin |

---

## Docker deployment

### Opstarten (lokaal)
```bash
make up        # docker compose up -d
make logs      # docker compose logs -f
make open      # open http://localhost:8080
make down      # docker compose down
make rebuild   # volledige herbouw zonder cache
make shell     # shell in de container
```

### Productie achter Nginx Proxy Manager

Pas `docker-compose.yml` aan (verwijder `ports`, voeg netwerk toe):

```yaml
services:
  bladmuziek:
    build: .
    container_name: bladmuziek-app
    restart: unless-stopped
    volumes:
      - ./app:/usr/share/nginx/html:ro
    networks:
      - npm_network

networks:
  npm_network:
    external: true
    name: npm_network
```

In Nginx Proxy Manager: Forward Host `bladmuziek-app`, Port `80`, met SSL (vereist voor Clipboard API).

---

## Instructies voor Claude Code

1. **Wijzig nooit de module-grens** — elke module heeft één verantwoordelijkheid
2. **Voeg geen state toe buiten `main.js`** — `loadedImage` en `chunks` leven alleen in `main.js`
3. **Chunks zijn immutable** na aanmaak door `processImage` — niet achteraf muteren
4. **PptxGenJS is een global** — importeer het niet, gebruik `PptxGenJS` direct in `exports.js`
5. **JSZip komt via importmap** — `import JSZip from 'jszip'` in `exports.js`
6. **CSS aanpassen** — alleen in `app/css/styles.css`, niet inline in HTML of JS
7. **HTML aanpassen** — alleen in `app/index.html`; geen JS-logica in het HTML bestand
