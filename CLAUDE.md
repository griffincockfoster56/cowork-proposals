# Cowork Proposals

React + Vite application for building customized PDF proposals from coworking space templates. Users upload a master PDF template, configure page types and regions in a setup editor, then build proposals by selecting pages, customizing prices/text, and exporting a final PDF.

## Quick Reference

```
npm run dev      # Start dev server
npm run build    # Production build
npx vitest run   # Run tests
```

## Architecture

### App Modes

The app has three modes, managed by `src/App.jsx` via `appMode` state:

| Mode | Component | Purpose |
|------|-----------|---------|
| `manager` | `TemplateManager` | List templates, upload new PDFs, delete templates |
| `setup` | `TemplateSetup` | Configure page types, draw rectangles, set defaults |
| `builder` | `ProposalBuilder` | Select pages, enter custom values, preview & export PDF |

### Data Flow

```
Upload PDF → Create blank config → Setup (tag pages, draw rects, set defaults)
                                        ↓
                                   Save config
                                        ↓
                              Build (select pages, customize) → Export PDF
```

---

## File Structure

```
src/
├── App.jsx                     # Root: mode routing, config/PDF loading, default template seeding
├── App.css                     # All component styles (~1020 lines)
├── index.css                   # Global typography
├── main.jsx                    # React DOM entry
│
├── components/
│   ├── TemplateManager.jsx     # Manager mode: template grid, upload, delete
│   ├── TemplateCard.jsx        # Individual template card with stats
│   ├── TemplateSetup.jsx       # Setup mode: two-panel layout (tagger + editor)
│   ├── PageTagger.jsx          # Left panel of setup: page list, type dropdown, labels
│   ├── ConfigEditor.jsx        # Right panel of setup: type-specific config UI
│   ├── RectangleDrawer.jsx     # Interactive SVG overlay for drawing rects on PDF pages
│   ├── ProposalBuilder.jsx     # Builder mode: page selection, auto-select, export
│   ├── PageSelector.jsx        # Left panel of builder: page thumbnails with inputs
│   └── PdfPreview.jsx          # Right panel of builder: live rendered preview
│
├── config/
│   ├── templateConfig.js       # createBlankConfig(), migrateHardcodedConfig()
│   └── suiteHighlights.js      # getHighlightsForOverviewPage() + legacy constants
│
├── storage/
│   ├── configStorage.js        # Config CRUD (Supabase primary, localStorage fallback)
│   └── pdfStorage.js           # PDF blob CRUD (Supabase primary, IndexedDB fallback)
│
├── utils/
│   └── pdfExport.js            # exportSelectedPages(): PDF generation with redaction
│
└── lib/
    └── supabase.js             # Supabase client init (optional)
```

---

## Page Types

Every page in a template config is tagged with one of four types. Each type enables different configuration options in setup and different behavior in export.

### `other`
Generic page with no special configuration. Included as-is when selected.

### `overview`
Floor plan page that shows suite locations. In setup, the user links suite pages to this overview via checkboxes. During export, red border rectangles are drawn on the overview to highlight which suites are included in the proposal.

**Config shape:**
```js
overviewConfig: {
  suitePageIndices: number[]  // 0-indexed positions of linked suite pages
}
```

### `suite`
Individual suite/office page with pricing. The user draws highlight rectangles (marking the suite's location on its linked overview page), price redaction rectangles (marking the list price and founding price rows), and enters default prices and desk count.

During export, if a custom price is provided, the original price rows are covered with a cream fill and replaced with a styled "Price | $X,XXX" badge. A summary page is also auto-generated listing all selected suites with their prices and desk counts.

**Config shape:**
```js
suiteConfig: {
  overviewPageIndex: number | null,          // 0-indexed overview page this suite belongs to
  highlightRects: [{ x, y, width, height }], // Suite markers drawn on overview page
  priceRedaction: {
    listPrice: { x, y, width, height },      // Region to cover for list price
    foundingPrice: { x, y, width, height },  // Region to cover for founding price
  },
  deskCount: number | null,
  rented: boolean,
  listPrice: string | null,                  // e.g. "$9,625" (auto-extracted or manual)
  foundingMemberPrice: string | null,
}
```

### `conference`
Conference room page with customizable text (e.g., "Includes 30 hours/month"). The user draws a text redaction rectangle over the text to replace, and enters default replacement text. During export, if custom text is provided (or defaults exist), the original text area is covered with cream fill and the replacement text is drawn centered.

**Config shape:**
```js
conferenceConfig: {
  textRedaction: { x, y, width, height } | null,  // Text area to redact
  defaultText: string | null,                       // e.g. "Includes 30 hours/month"
}
```

---

## Full Config Object Structure

```js
{
  id: string,                    // UUID
  name: string,                  // Display name (e.g. "123 Main St")
  pdfStorageKey: string,         // Key for PDF blob in storage
  pageDimensions: {
    width: number,               // PDF page width in points (~540)
    height: number,              // PDF page height in points (~779)
  },
  style: {
    backgroundFill: { r, g, b },  // Cream/background color (default: 255, 253, 245)
    badgeBlue: { r, g, b },       // Blue accent color (default: 43, 58, 103)
    badgeGray: { r, g, b },       // Gray accent color (default: 235, 235, 235)
  },
  pages: [
    {
      pageIndex: number,           // 0-indexed position in PDF
      label: string,               // User-editable display name
      type: 'other' | 'overview' | 'suite' | 'conference',
      overviewConfig?: { ... },    // Present only when type === 'overview'
      suiteConfig?: { ... },       // Present only when type === 'suite'
      conferenceConfig?: { ... },  // Present only when type === 'conference'
    },
    // ... one entry per PDF page
  ],
}
```

---

## Coordinate System

PDF and canvas/SVG use different coordinate origins. This is a critical detail for rectangle drawing and rendering.

| System | Origin | Y Direction | Used By |
|--------|--------|-------------|---------|
| PDF (pdf-lib) | Bottom-left | Up | Config storage, export rendering |
| Canvas/SVG | Top-left | Down | RectangleDrawer, PdfPreview highlights |

**Conversion:**
```js
// PDF → SVG/Canvas
svgY = pageHeight - pdfY - rectHeight

// SVG/Canvas → PDF
pdfY = pageHeight - svgY - rectHeight
```

All rectangles in config are stored in **PDF coordinates** (bottom-left origin). The `RectangleDrawer` component converts on draw completion, and `PdfPreview` converts when rendering highlights on canvas.

---

## Page Number Indexing

| Context | Indexing | Example |
|---------|---------|---------|
| Config `pages` array | 0-indexed | `config.pages[0]` = first page |
| `pageIndex` field | 0-indexed | `pageIndex: 0` = first page |
| `selectedPages` Set | 1-indexed | `selectedPages.has(1)` = first page selected |
| `exportSelectedPages` param | 1-indexed | `[1, 3, 5]` = pages 1, 3, 5 |
| `getHighlightsForOverviewPage` | 1-indexed | `overviewPageNum = 1` |
| `suitePageIndices` in overviewConfig | 0-indexed | `[1, 2]` = pages 2 and 3 |
| `overviewPageIndex` in suiteConfig | 0-indexed | `0` = first page |

**Conversion:** `pageIndex = pageNum - 1` / `pageNum = pageIndex + 1`

---

## Component Details

### TemplateManager (`src/components/TemplateManager.jsx`)

Displays all templates as cards in a grid. Handles PDF upload: reads the file as ArrayBuffer, extracts page count and dimensions via pdf-lib's `PDFDocument.load()`, creates a blank config via `createBlankConfig()`, saves both to storage, then navigates to setup mode.

**Props:** `{ onBuild(configId), onEdit(configId) }`

### TemplateSetup (`src/components/TemplateSetup.jsx`)

Two-panel layout. Left: `PageTagger` for browsing pages and setting types/labels. Right: `ConfigEditor` for the selected page's detailed configuration. Manages its own copy of the config and calls `onSave(config)` when the user clicks Save.

**Props:** `{ config, pdfBlobUrl, onSave(config), onCancel() }`

### PageTagger (`src/components/PageTagger.jsx`)

Renders a scrollable list of page thumbnails (generated at 0.25x scale on mount). Each page has a label text input and a type dropdown (`other`, `overview`, `suite`, `conference`). When type changes, initializes the appropriate sub-config and cleans up the old one.

**Props:** `{ config, pdfBlobUrl, selectedPageIndex, onSelectPage(idx), onUpdatePage(idx, updates) }`

### ConfigEditor (`src/components/ConfigEditor.jsx`)

Renders different UI sections based on the selected page's type:

- **Suite:** Draw mode toolbar (highlight/listPrice/foundingPrice), overview page dropdown, rented checkbox, desk count input, price text inputs with auto-formatting, `RectangleDrawer`, rect coordinate list. Auto-extracts price text from PDF when price rects are drawn.
- **Overview:** Checkbox list of all suite pages to link/unlink.
- **Conference:** `RectangleDrawer` for text redaction rect, default text input. Auto-extracts text from PDF when rect is drawn.
- **Other:** Informational message.

**Props:** `{ config, pageIndex, pageConfig, pdfBlobUrl, onUpdatePage(idx, updates) }`

**Draw modes (suite):**
| Mode | Color | Stores To |
|------|-------|-----------|
| `highlight` | Blue | `suiteConfig.highlightRects[]` |
| `listPrice` | Orange | `suiteConfig.priceRedaction.listPrice` |
| `foundingPrice` | Green | `suiteConfig.priceRedaction.foundingPrice` |

**Draw mode (conference):**
| Mode | Color | Stores To |
|------|-------|-----------|
| `conferenceText` | Purple | `conferenceConfig.textRedaction` |

### RectangleDrawer (`src/components/RectangleDrawer.jsx`)

Renders a PDF page as an image with an SVG overlay for interactive rectangle drawing. The user clicks and drags to draw rectangles. Existing rectangles are displayed with colored fill/border and have a delete button. Converts mouse coordinates to PDF coordinate system on completion.

**Props:** `{ pdfBlobUrl, pageIndex, pageDimensions, rects, onAddRect(rect), onDeleteRect(index), rectColor, rectBorder }`

**Important:** When drawing suite highlights, the `pageIndex` is set to the suite's linked overview page (not the suite page itself), since highlights mark the suite's location on the floor plan.

### ProposalBuilder (`src/components/ProposalBuilder.jsx`)

Main builder interface. Left panel: selection controls, auto-select groups, `PageSelector`. Right panel: `PdfPreview`. Manages state for selected pages, custom prices, custom conference text, and auto-select filters.

**Props:** `{ config, pdfBlobUrl, onBack() }`

**State:**
- `selectedPages` — `Set<number>` (1-indexed page numbers)
- `customPrices` — `{ [pageNum]: string }` — custom price overrides per suite page
- `customConferenceText` — `{ [pageNum]: string }` — custom text overrides per conference page
- `autoSelectState` — `{ [overviewIdx]: { minDesks, maxDesks, excludeRented } }`

**Auto-Select:** Groups suites by their linked overview page. Filters by desk count range and rented status. Clicking "Select" adds the overview page and all matching suites to the selection.

**Export flow:**
1. Collects custom prices for selected suite pages that have `priceRedaction`
2. Calls `exportSelectedPages(url, sortedPages, prices, config, conferenceText)`
3. PDF is generated and downloaded as `proposal-YYYY-MM-DD.pdf`

### PageSelector (`src/components/PageSelector.jsx`)

Scrollable list of all template pages with thumbnails (0.3x scale), checkboxes, labels, and conditional inputs. Shows "Custom Price" input for selected suite pages with price redaction. Shows "Conference Hours" input for selected conference pages with text redaction. Shows desk count and "Rented" badge where applicable.

**Props:** `{ templateUrl, selectedPages, onTogglePage, onPageCountChange, pageData, customPrices, onSetCustomPrice, customConferenceText, onSetConferenceText, config }`

### PdfPreview (`src/components/PdfPreview.jsx`)

Renders selected pages at 1.5x scale in a scrollable preview. Draws red border rectangles on overview pages for selected suites (using `getHighlightsForOverviewPage()`). Generates and inserts a summary page after the first overview page when suites are selected.

**Props:** `{ templateUrl, selectedPages, config, customPrices, customConferenceText }`

**Note:** Text/price replacement is NOT shown in preview — only in the exported PDF. The preview shows the original PDF pages with highlight overlays. This matches the design: preview shows what the template looks like, export applies all transformations.

### TemplateCard (`src/components/TemplateCard.jsx`)

Displays a template's stats: page count, suite count, total available desks, overview count. Has "Build Proposal", "Edit Config", and "Delete" action buttons.

**Props:** `{ config, onBuild(), onEdit(), onDelete() }`

---

## PDF Export (`src/utils/pdfExport.js`)

### `exportSelectedPages(pdfSource, selectedPageNumbers, customPrices, config, customConferenceText)`

Main export function. Generates a new PDF from selected template pages with all transformations applied.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `pdfSource` | `string \| ArrayBuffer` | Template PDF URL or raw bytes |
| `selectedPageNumbers` | `number[]` | 1-indexed page numbers to include |
| `customPrices` | `object` | Map of `pageNum → price string` (e.g. `{ 3: "$5,000" }`) |
| `config` | `object \| undefined` | Template config (enables config-based behavior) |
| `customConferenceText` | `object` | Map of `pageNum → text string` |

**Processing per page:**

1. **Price redaction** (suite pages with custom price):
   - Cover list price and founding price rows with cream fill
   - Draw a two-tone badge: blue left half with "Price" label, gray right half with price value
   - Badge is centered vertically between the original two rows

2. **Conference text redaction** (conference pages with custom or default text):
   - Cover text redaction rect with cream fill
   - Draw replacement text centered in the rect (12pt Helvetica, dark gray)
   - If no custom text AND no default text, no redaction occurs (original stays)

3. **Highlight rectangles** (overview pages):
   - Draw red 2px border rectangles for each selected suite's highlight rects

4. **Summary page** (inserted after first overview, if any suites selected):
   - 3-column table: Suite Name (blue bg) | Price (gray bg) | Desk Count (blue bg)
   - Uses custom price if set, otherwise suite's default `listPrice`
   - Page dimensions match template

**Fonts:** Helvetica and Helvetica-Bold (embedded via pdf-lib `StandardFonts`)

**Colors:** Resolved from `config.style` or hardcoded defaults:
- Cream (background): rgb(255, 253, 245)
- Badge Blue: rgb(43, 58, 103)
- Badge Gray: rgb(235, 235, 235)

---

## Suite Highlights (`src/config/suiteHighlights.js`)

### `getHighlightsForOverviewPage(overviewPageNum, selectedPages, config)`

Returns an array of `{ x, y, width, height }` rectangles to draw on an overview page, representing the locations of selected suites.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `overviewPageNum` | `number` | 1-indexed overview page number |
| `selectedPages` | `Set<number>` | 1-indexed selected page numbers |
| `config` | `object \| undefined` | Template config (optional) |

**Behavior:**
- If `config` provided: Looks up `overviewConfig.suitePageIndices`, collects `highlightRects` from each linked suite that is in `selectedPages`
- If no config: Falls back to hardcoded `FLOOR_OVERVIEW_PAGES` and `SUITE_HIGHLIGHT_COORDS` maps (legacy default template support)

---

## Storage

### Config Storage (`src/storage/configStorage.js`)

| Function | Description |
|----------|-------------|
| `listConfigs()` | Returns array of all configs |
| `loadConfig(id)` | Returns single config by ID |
| `saveConfig(config)` | Upsert config (create or update) |
| `deleteConfig(id)` | Remove config by ID |

**Backend selection:** If Supabase client is available, uses Supabase (`configs` table with `id` and `data` jsonb columns). Otherwise falls back to localStorage under key `cowork-template-configs`.

### PDF Storage (`src/storage/pdfStorage.js`)

| Function | Description |
|----------|-------------|
| `loadPdf(key)` | Returns PDF as ArrayBuffer |
| `savePdf(key, arrayBuffer)` | Store PDF blob |
| `deletePdf(key)` | Remove PDF blob |

**Backend selection:** If Supabase client is available, uses Supabase Storage (`pdfs` bucket). Otherwise falls back to IndexedDB (database: `cowork-proposals`, object store: `pdfs`).

**Special case:** The default template uses the static file `/template.pdf` served by Vite, not stored in IndexedDB. Its `pdfStorageKey` is `'default-template'` and `App.jsx` handles it by using the static URL directly.

---

## Template Config Creation (`src/config/templateConfig.js`)

### `createBlankConfig(id, name, numPages, dims)`

Creates a minimal config for a newly uploaded PDF. All pages are tagged as `other` with labels "Page 1", "Page 2", etc.

### `migrateHardcodedConfig()`

Creates the default "123 Main St" template config with 11 pages. Pages 1 and 6 are overviews, pages 2-5 and 7-8 are suites with hardcoded highlight rects, price redaction rects, desk counts, and prices. Pages 9-11 are tagged as `other`.

---

## Testing

**Framework:** Vitest + @testing-library/react

**Test files:**
- `src/config/suiteHighlights.test.js` — 19 tests for highlight logic (config-based and legacy)
- `src/utils/pdfExport.test.js` — 10 tests for PDF export
- `src/components/ProposalBuilder.test.jsx` — 1 test for builder rendering
- `src/components/PdfPreview.test.jsx` — 6 tests (5 currently timeout due to unmocked canvas methods from summary page feature)

**Mocking patterns:**
- `pdfjs-dist` is mocked globally with `vi.mock()`, providing `getDocument` → `getPage` → `render`
- Canvas operations are mocked via `vi.spyOn(document, 'createElement')` to intercept canvas creation and mock `getContext`, `toDataURL`
- `suiteHighlights` is mocked to control highlight return values

**Known issue:** PdfPreview tests 2-6 timeout because `renderSummaryCanvas()` calls canvas methods (`measureText`, `fillText`, `fillRect`, `font`) that aren't provided by the mock context.

---

## Key Patterns

1. **Config as source of truth** — All page metadata (type, rects, prices, labels) lives in the config object. Components derive display state from config.

2. **Legacy fallback** — `suiteHighlights.js` and `pdfExport.js` support operating without a config object, falling back to hardcoded constants for the default template.

3. **Sub-config initialization on type change** — When a page's type changes in `PageTagger`, the appropriate sub-config (`suiteConfig`, `overviewConfig`, `conferenceConfig`) is initialized with defaults, and the previous type's sub-config is set to `undefined`.

4. **Auto-extraction** — When drawing price or text redaction rectangles in `ConfigEditor`, the app extracts text from the PDF within the drawn region using pdfjs-dist's `getTextContent()` API and pre-populates the default value.

5. **Cancellation tokens** — All `useEffect` hooks that perform async work use a `cancelled` boolean to prevent state updates after unmount.

6. **Blob URL management** — `App.jsx` creates object URLs for PDF blobs and revokes them via `useEffect` cleanup when switching templates.

7. **Preview vs. export** — Price/text redaction is only applied in the exported PDF, not in the live preview. The preview shows the original PDF pages with highlight overlays only.
