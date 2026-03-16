# Workbench V2 — Unified Review & Editing Experience

**Date:** 2026-03-16
**Status:** Approved

## Overview

Redesign the workbench into a focused, single-screen workflow: select jobs, tailor, and review/edit/preview all in one place. The current scattered panels (job target, source docs, prompts, scores, review, diff, gap analysis) consolidate into a clear activity hierarchy with the review/editing experience at the center.

## Activity Hierarchy

| Tier | Activity | UI Pattern |
|------|----------|------------|
| Primary | Job selection, tailoring, review/edit/preview | Main screen, always visible |
| Secondary | Source document editing (resume.md, bio.md) | Slide-out panel from icon rail |
| Tertiary | Prompt customization, model config | Slide-out panel behind gear icon |

## Layout

```
+--------+------------------------------------------------------------+
| WORKSPACE [autocomplete/dropdown] [Save] [Delete]  [gear] ~/.job-shit|
+--+-----+---------------------------+-------------------+-----------+
|  |  SCORE CARDS                    | ANALYSIS NOTES                |
|J |  Resume: 8  Cover: 7  Acc: 6   | Reviewer notes, fit, risk     |
|O |  [-> ? stale indicator]         |              [Re-grade Scores]|
|B +-----+---------------------------+-------------------+-----------+
|  |     | [md]copy [html]copy [pdf]copy | {Preview|Diff}  | MISSING |
|L |     |                          | Theme [dropdown]    | * terraf |
|I |     |                          |                     | * pulumi |
|S |     | INTERACTIVE EDITOR    |drag| PREVIEW / DIFF   | * gcp    |
|T |     |                       |   |                    | * ci/cd  |
|  |     | [kube] [ts] pills     |   |                    |          |
|  | [x] | +- section fields --+ |   |                    |          |
|  | [x] | | bullet inputs     | |   |                    |          |
|  | [ ] | | + Add bullet      | |   |                    |          |
|  | ... | +-------------------+ |   |                    |          |
+--+-----+-----------------------+---+--------------------+----------+
|src|                                                                 |
|gear|                                                                |
+----+----------------------------------------------------------------+
```

### Icon Rail (Left Edge)

Thin vertical icon bar, always visible:

- **Jobs** (briefcase) — job list with status indicators. Visible by default.
- **Sources** (document) — slide-out panel for resume/bio structured editing.
- **Config** (gear) — slide-out panel for prompt templates, model settings.

Clicking an icon slides a ~300px panel in/out. Main review area compresses but stays visible.

### Top Bar

- **Workspace picker** — autocomplete input that doubles as a dropdown. Type to filter or click to browse.
- **Save** — saves current workspace state.
- **Delete** — available after loading a workspace. Confirms before deleting.
- **Copy** — type a new name in the autocomplete field, copy button glows/animates to confirm.
- **Gear icon** — opens config slide-out.
- **Storage indicator** — subtle `~/.job-shit` label in the corner. All data (workspaces, config) lives there.

### Workspace Management

- Workspaces save to `~/.job-shit/workspaces/`.
- Create, load, save, copy (with animated confirmation), delete.
- **Export** — download workspace as `.zip` (JSON state + generated outputs) for backup/sharing.
- Path shown subtly so power users know where to find files on disk.

## Job Flow & Status Lifecycle

### Status States

```
— (loaded) -> ... (pending/tailoring) -> * (needs review) -> check (reviewed/saved)
```

### Job List Rail

```
+-------------------------+
| JOBS                    |
| [Load Huntr Jobs]       |
| [+ Paste JD]            |
+-------------------------+
| [x] Acme Corp       check  <- Reviewed
|     Sr. Engineer        |
| [x] Stripe          *   <- Needs review
|     Platform Eng        |
| [ ] Vercel          ... <- Pending
|     Frontend Lead       |
| [x] Datadog         —   <- Not yet tailored
|     SRE                 |
+-------------------------+
| [Tailor Selected (3)]   |
+-------------------------+
```

### Flow

1. Load jobs from Huntr or paste JD manually (just enough UI to confirm it pasted in entirety).
2. Check jobs to tailor.
3. Hit **"Tailor Selected (N)"**.
4. **Confirmation modal** — table with editable Company + Title per job, checkboxes to skip.
5. Confirm -> jobs go to pending status.
6. As each completes -> status flips to needs review, first completed job auto-loads into review panel.
7. User reviews, edits in structured editor, checks preview.
8. Hits **"Save & Mark Reviewed"** -> status flips to reviewed, confirmation flash.
9. Downloads (md/html/pdf) available anytime after tailoring completes.

## Interactive Editor Panel

Replaces the current review section cards with the structured editor's field-level editing.

### Section Types

Auto-detected from parsed resume (same `parseResumeSections()` logic):

- **Text sections** (Summary, Skills) — single textarea field.
- **Bullet sections** (Selected Impact) — individual bullet inputs + "Add bullet" button.
- **Job sections** (Experience entries) — title, company, date range fields + bullet inputs.

### Per-Section Keyword Coverage

Above each section's fields:

- **Green pills** — matched keywords found in this section's content.
- **Yellow pills** — partial matches (e.g., `cloud ~ gcp`).
- Pills are computed per-section from gap analysis, not global.
- Update live as user edits content.

### Section Actions

- **Regenerate** button per section — calls `regenerateResumeSection()` API, replaces section fields with AI result.
- All sections expanded by default, collapsible.
- All edits sync to preview in real-time (debounced ~300ms).

### No Accept/Reject Toggle

The old card-based accept/unaccept is removed. User edits until happy, then saves the whole resume with "Save & Mark Reviewed."

## Right Rail

### Preview / Diff Panel

- **Segmented toggle**: `{ Preview | Diff }` switches the view.
- **Preview**: live-updating themed HTML render. Theme selector dropdown.
- **Diff**: always vs base resume (original before tailoring). Uses existing diff engine.
- **Draggable splitter** between editor and preview. Default 50/50. Position persists in workspace state.

### Export Buttons

```
[Markdown] copy  [HTML] copy  [PDF] copy
```

- Clicking the label downloads the file.
- Clicking the copy icon copies to clipboard.
- Copy button animates: brief green glow + "Copied!" text, fades back.

### Missing Keywords Column

- Fixed width (~130px) on the far right edge.
- Red/dimmed pills for JD keywords not found in the resume.
- Scrolls independently.
- Count at top: `6 missing`.
- Updates live — adding "terraform" to Skills removes it from missing.

## Re-grade & Feedback Loop

### Stale Score Indicators

After any edit in the structured editor, score cards show `-> ?` next to each score. User knows grades are outdated.

### Re-grade Button

- **"Re-grade Scores"** button appears when scores are stale.
- Gentle pulse/glow to draw attention (activated state).
- Clicking re-runs scorecard + gap analysis in one shot.
- Scores animate from old to new values.
- Missing/matched pills update across all sections.
- Button deactivates after grading (no stale scores = nothing to do).

### The Edit Loop

```
Tailor -> Review scores -> Edit sections -> Scores show "-> ?"
    -> Re-grade -> Scores update -> Missing pills update
    -> Edit more -> Re-grade again -> Happy -> Save & Mark Reviewed
```

## Secondary Panels (Slide-outs)

### Sources Panel (Document Icon)

- Structured editor for resume.md and bio.md.
- Same field-level editing as the review panel.
- Changes here update the base resume for future tailoring runs.
- Slides in from the left, ~300px wide.

### Config Panel (Gear Icon)

- System prompt editor (resume prompt, cover letter prompt, gap analysis prompt).
- Model selection (tailor model, score model).
- API key configuration.
- Slides in from the left, ~300px wide.

## Data & Storage

- All data in `~/.job-shit/`:
  - `workspaces/` — workspace JSON files with state.
  - `config.json` — API keys, model preferences, prompt overrides.
  - Generated outputs per workspace.
- Workspace export as `.zip` for backup.
- Subtle `~/.job-shit` storage indicator always visible.

## Button Activation Pattern

Buttons throughout the UI activate/deactivate based on context:

- **Save** — active when there are unsaved changes.
- **Delete** — active after a workspace is loaded.
- **Tailor Selected** — active when jobs are checked.
- **Re-grade** — active when scores are stale.
- **Save & Mark Reviewed** — active when viewing a tailored job.
- **Copy (workspace)** — glows with animation on action.
- **Export buttons** — active after tailoring completes.

Inactive buttons are visually dimmed, not hidden. User always sees what's possible.

## Migration from Current UI

This is a full redesign, not an incremental change. The current workbench panels (Job Target, Resume/Bio textareas, Results cards, Review cards, Gap Analysis card, Diff card) are replaced by the new layout. Key code to preserve and adapt:

- `parseResumeSectionsClient()` — section parsing for the editor.
- `sectionCoverageClient()` — per-section keyword matching.
- `computeGap()` / `computeDiff()` — API calls for analysis.
- `renderClientDiffHtml()` — diff rendering.
- `regenerateReviewSection()` — AI section regeneration.
- Resume editor field rendering from `docs/resume-editor.html`.
- Workspace save/load logic.
- Theme rendering from the preview pane.

## Out of Scope

- TUI changes (terminal review remains separate).
- New AI features (prompt chaining, multi-model comparison).
- Collaborative/multi-user features.
- Huntr write-back (updating Huntr job status from workbench).
