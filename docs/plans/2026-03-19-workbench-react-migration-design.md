# Workbench React Migration Design

**Date:** 2026-03-19
**Status:** Approved

## Goal

Migrate the workbench UI from monolithic inline-styled HTML files (~10k lines across v1 + v2) to a proper Vite + React + Tailwind + shadcn/ui frontend in a separate `web/` package. Apply the Well-Tailored brand (light theme from BRAND.md). Keep the workbench functional throughout the migration.

## Decisions

- **Approach B (monorepo-lite)**: `web/` is a separate package with its own `package.json`, Vite config, and Tailwind setup. CLI and frontend don't share dependencies.
- **Light theme first**: Apply BRAND.md ivory/navy/charcoal palette. Dark theme (already defined in `docs/branding/src/styles/theme.css` via `.dark` class) slots in later.
- **Component library from `docs/branding/`**: Copy shadcn/ui components, brand tokens, and styles into `web/src/`. The branding package stays in `docs/branding/` as reference documentation.
- **State management**: Single `useReducer` in `App.tsx` — same shape as v2's `state` object. No Redux/Zustand needed at this scale.
- **Fallback during migration**: Server continues serving `index-v2.html` until the React app is complete. No big-bang switch.

## Directory Structure

```
web/
├── package.json          # Vite, React, Tailwind, shadcn/ui deps
├── vite.config.ts        # Dev server proxies /api/* to Node backend (:4312)
├── postcss.config.mjs
├── index.html            # Vite entry point
├── src/
│   ├── main.tsx
│   ├── App.tsx           # Top-level layout, useReducer state, panel routing
│   ├── styles/
│   │   ├── theme.css     # Brand tokens (from docs/branding)
│   │   ├── fonts.css     # Manrope + Inter
│   │   └── tailwind.css  # Tailwind directives
│   ├── components/
│   │   └── ui/           # shadcn/ui components (from docs/branding)
│   ├── api/              # Thin fetch wrappers for /api/* endpoints
│   ├── lib/
│   │   └── markdown.ts   # parseMarkdown, date helpers, linkify (from v2 JS)
│   └── features/
│       ├── jobs/         # JobsPanel, JobList, JobDetail, StageFilter
│       ├── editor/       # EditorColumn, EditorSection, SectionRegenerate
│       ├── preview/      # PreviewColumn, DiffView, PreviewIframe
│       ├── scores/       # ScoreCards, ScoreCard, ScoreDetailsModal
│       ├── sources/      # SourcesPanel, SourceItem
│       ├── config/       # ConfigPanel, ProviderSelect, ModelSelect
│       ├── prompts/      # PromptsPanel
│       └── workspace/    # TopBar (save/load/delete), WorkspacePicker
└── dist/                 # Build output (gitignored)
```

## Component Decomposition

| Component | Maps to v2 | Key responsibility |
|-----------|-----------|-------------------|
| `TopBar` | `.top-bar` | Workspace name, save/load/delete, run status feedback |
| `IconRail` | `.icon-rail` | Panel selection (Jobs, Sources, Config, Prompts) |
| `JobsPanel` | `#panel-jobs` | Job list with stage filters, job detail form, Huntr import |
| `SourcesPanel` | `#panel-sources` | Resume/bio/cover letter file display + content editing |
| `ConfigPanel` | `#panel-config` | Provider and model selection dropdowns |
| `PromptsPanel` | `#panel-prompts` | System/user prompt override textareas |
| `ScoreCards` | `.scores-row` | Grid of score cards, opens ScoreDetailsModal |
| `EditorColumn` | `.editor-col` | Markdown sections with per-section regeneration |
| `PreviewColumn` | `.preview-col` | Rendered HTML preview, diff toggle, resume/cover switch |
| `MissingKeywords` | `.keywords-bar` | Gap analysis keyword pills |
| `TailorConfirmModal` | `#tailorModal` | Batch tailor confirmation dialog |
| `PasteJDModal` | `#pasteJdModal` | Manual job entry form |
| `ScoreDetailsModal` | `#scoreDetailsModal` | Expanded score view with grouped metrics |

## Dev & Build Wiring

### Scripts

```
npm run web          # Vite dev server on :5173, proxies /api/* → :4312
npm run web:build    # Builds web/ to web/dist/
npm run serve        # Existing Node API server on :4312 (unchanged)
```

### Vite Config

```ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4312',
    },
  },
  build: { outDir: 'dist' },
});
```

### Server Changes

One change to `server.ts`: when `web/dist/index.html` exists, serve static files from `web/dist/`. Otherwise fall back to `index-v2.html`.

## Migration Phases

### Phase 1: Scaffold (no behavior change)
- Create `web/` with package.json, Vite, Tailwind, PostCSS config
- Copy shadcn/ui components + styles from `docs/branding/src/`
- Render a hello-world React app via Vite dev server
- Server unchanged — still serves `index-v2.html`

### Phase 2: Shell components (still no behavior change)
- Build outer layout: `App` → `TopBar` + `IconRail` + panel container + main area
- Wire up `useReducer` with same state shape as v2's `state` object
- Skeleton with brand styling, no API calls yet

### Phase 3: Port features one panel at a time
Order from simplest to most complex:
1. `ConfigPanel` — dropdowns, simple state
2. `SourcesPanel` — file display, textareas
3. `PromptsPanel` — textarea overrides
4. `JobsPanel` — list, filters, detail form, Huntr loading
5. `ScoreCards` — display + modal
6. `EditorColumn` — markdown sections, section regeneration
7. `PreviewColumn` — HTML preview iframe, diff view
8. `MissingKeywords` — gap analysis pills
9. Modals — TailorConfirm, PasteJD, ScoreDetails

Each panel is independently testable against the running API server.

### Phase 4: Cut over
- Update server to serve `web/dist/` when available
- Delete `index-v2.html` and `index.html`
- Add `web:build` to the main build script

## What Stays Unchanged
- `npm run build` (CLI TypeScript compilation)
- `npm test`, `npm run typecheck`, `npm run lint`
- All API endpoints in `server.ts`
- Resume/cover letter templates and PDF rendering
- TUI review mode (`src/tui/`)
