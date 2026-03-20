# Workbench v2 — Unified Review Panel

**Date:** 2026-03-16
**Status:** Implementation started (skeleton + JS complete)

## Overview

Replaces the existing multi-card workbench with a single unified review panel:
three-column layout with interactive structured editor, live preview/diff,
and missing keyword sidebar.

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE [autocomplete▾] [Save] [Delete]    [⚙]    💾 ~/.well-tailored     │
├──┬──────────────────────────────────────────────────────────────────────┤
│  │ ┌─ SCORE CARDS ──────────────┬─ ANALYSIS NOTES ───────────────────┐ │
│J │ │ Resume: 8  Cover: 7  ...   │ Reviewer notes, accuracy, etc     │ │
│O │ └───────────────────────────┴───────────────────────────────────┘ │
│B │ ┌─ EXPORT ──────────────────┬─ VIEW SWITCHER ──┬─ MISSING ──────┐ │
│  │ │ [md]📋 [html]📋 [pdf]📋   │ {Preview | Diff}  │ ● terraform    │ │
│L │ ├───────────────────────────┤  Theme ▾          │ ● pulumi       │ │
│I │ │                           │                   │ ● gcp          │ │
│S │ │  INTERACTIVE EDITOR    ▐▌  PREVIEW / DIFF    │ ● ci/cd        │ │
│T │ │                        ▐▌                    │                │ │
│  │ │  [kube] [ts] pills     ▐▌                    │                │ │
│  │ │  ┌─ section fields ──┐ ▐▌                    │                │ │
│☑ │ │  │ bullet inputs     │ ▐▌                    │                │ │
│☑ │ │  │ + Add bullet      │ ▐▌                    │                │ │
│☐ │ │  └──────────────────┘ ▐▌                    │                │ │
│  │ │                   drag ▐▌                    │                │ │
└──┴─└───────────────────────┴───────────────────┴────────────────┘──┘
```

### Three columns

| Column | Width | Scrolls | Content |
|--------|-------|---------|---------|
| Editor | flexible (left of drag) | independently | Structured resume fields with keyword pills |
| Preview/Diff | flexible (right of drag) | independently | Themed HTML preview or line diff |
| Missing KWs | fixed ~130px | independently | Red pills for unaddressed JD keywords |

### Icon rail (far left, 48px)

| Icon | Panel | Priority |
|------|-------|----------|
| 💼 Jobs | Job list + status | Primary |
| 📄 Sources | Resume/bio source editing | Secondary (slide-out) |
| ⚙ Config | Prompts, model settings | Tertiary (slide-out) |

## Activity Hierarchy

1. **Primary:** Select jobs → Tailor → Review/edit in structured editor → Preview → Save
2. **Secondary:** Edit source documents (resume, bio)
3. **Tertiary:** Edit prompts, model config (behind ⚙ gear)

## Job Flow & Status Lifecycle

```
— (loaded) → ⋯ (pending/tailoring) → ● (needs review) → ✓ (reviewed/saved)
```

1. User loads jobs from Huntr (`Load Huntr Jobs`) or pastes JD manually (`+ Paste JD`)
2. Checks boxes for jobs to tailor
3. Clicks **"Tailor Selected (N)"**
4. **Confirmation modal** — editable Company + Title table, checkboxes to skip
5. Confirms → jobs go to ⋯ pending
6. As each completes → ● needs review, first completed auto-loads into editor
7. User reviews in structured editor, checks preview
8. Clicks **"Save & Mark Reviewed"** → ✓ with confirmation flash
9. Downloads (md/html/pdf) available anytime after ● status

## Interactive Editor

Each resume section rendered as structured fields:

- **Header:** name, title, contact (text inputs)
- **Text sections** (Summary, Skills): textarea with content
- **Job sections** (Experience): company, title, date pickers, bullet inputs
- **Education:** institution, degree, date

### Per-section keyword coverage

Above each section's fields, colored pills show:
- **Green pills:** Matched keywords found in that section
- **Yellow pills:** Partial matches in that section
- Pills computed per-section from gap analysis
- Update live as user edits content

### Section actions

- **Regenerate ↻** — AI regenerates that section via `/api/regenerate-section`
- **Add/Remove/Reorder** bullets and sub-items
- **Move sections** up/down

## Right Rail

### Export row
- `[Markdown] 📋` — click label downloads `.md`, click 📋 copies to clipboard
- `[HTML] 📋` — same for styled `.html`
- `[PDF] 📋` — same for `.pdf`
- Clipboard button: brief green glow + "Copied!" → fades back

### Preview panel
- Live HTML render with themed styling
- Theme selector dropdown (Default, Ocean, Forest, Slate, Warm, Monochrome)
- Updates on editor changes (debounced ~300ms)

### Diff panel (same space, toggled)
- `{ Preview | Diff }` segmented toggle
- Diff always vs base resume (pre-tailoring)
- Green additions, red deletions, gray context

### Missing keywords column (fixed ~130px)
- Red/dimmed pills for JD keywords not in resume
- Updates live as user edits
- Subtle count: `6 missing`
- Scrolls independently

## Draggable Splitter

- Between editor and preview/diff columns
- Default 50/50 split
- Minimum 200px each side
- Position persists in workspace state

## Re-grade After Edits

- After any edit, score cards show `→ ?` stale indicator
- **"Re-grade Scores"** button activates (gentle pulse)
- One click re-runs scoring + gap analysis
- Scores animate old → new
- Missing pills update, section pills update
- Button deactivates when scores are fresh

## Workspace Management

- **Autocomplete + dropdown** picker for workspace selection
- **Save** — persists current state
- **Delete** — available after loading a workspace
- **Copy** — type new name in autocomplete field, action button glows
- **Export** — download workspace as `.zip` (JSON + outputs)
- **Path label:** `💾 ~/.well-tailored` always visible in corner
- Buttons activate/deactivate based on context (no dead buttons)

## Files

| File | Purpose |
|------|---------|
| `src/workbench/index-v2.html` | Complete v2 implementation (HTML + CSS + JS) |
| `src/server.ts` | `/v2` route serves the new workbench |

## Implementation Status

- [x] HTML skeleton with three-column layout
- [x] CSS for all panels, modals, themes
- [x] Draggable splitter JS
- [x] Icon rail panel switching
- [x] Job list with status lifecycle
- [x] Tailor confirmation modal
- [x] Paste JD modal
- [x] Batch tailoring with sequential execution
- [x] Structured editor (parseMarkdown, field rendering)
- [x] Per-section keyword coverage pills
- [x] Section regeneration via API
- [x] Preview panel with themes
- [x] Diff panel with view switcher
- [x] Missing keywords column
- [x] Export buttons with clipboard copy
- [ ] Re-grade button with stale indicators
- [ ] Workspace save/load/delete/copy/export
- [ ] Source documents panel (📄)
- [ ] Config/prompts panel (⚙)
- [ ] Live preview debounced sync
- [ ] Storage path indicator
