# Tailoring Queue & Persistent Status Design

**Date:** 2026-03-17
**Status:** Approved

## Problem

1. Loading Huntr jobs wipes tailoring status — fresh job objects replace existing ones, losing `pending`/`tailored`/`error` state and results.
2. No way to add jobs to the queue while tailoring is running — `isTailoring` blocks the button and the run is a closed `for...of` snapshot.
3. Tailoring progress lives in `#analysis-text` (scores row) which is per-job context, not a persistent global status — it disappears when focus changes.
4. Failed jobs silently revert to `loaded` with no visible error message.

## Approved Design

### State

Replace `state.isTailoring: boolean` with:

```js
state.tailorQueue   // string[] — job IDs waiting to run, in order
state.tailorRunning // string | null — ID of the currently-running job
```

Remove `isTailoring` entirely. "Is tailoring active?" = `tailorRunning !== null`.

### Queue loop

`ensureTailorLoop()` — called after any enqueue. Starts `tailorLoop()` only if `tailorRunning === null`. The loop:

1. Shifts next ID from `tailorQueue`, sets `tailorRunning`
2. Fetches `/api/runs/manual` for that job
3. On success: sets `job.status = 'tailored'`, `job.result`, clears `job.error`
4. On error: sets `job.status = 'error'`, `job.error = message`
5. Sets `tailorRunning = null`, calls `syncTopBarStatus()` + `renderJobList()`
6. Recurses (picks up next queued job) until queue is empty
7. On empty: calls `onQueueDrained(completedCount, failedJobs[])`

### Enqueueing

"Tailor Selected" button:
- Enabled whenever ≥1 job is checked (regardless of whether queue is running)
- On click: appends checked job IDs to `tailorQueue` (skip duplicates already in queue or currently running), sets each to `pending`, clears `error`, calls `ensureTailorLoop()`
- Button label: `Tailor Selected (N)` showing checked count; never shows "tailoring…" since that's the status bar's job now

### Huntr reload merge

`loadHuntrJobs()` merges incoming jobs by Huntr job ID:

- **Existing job found:** update only `title`, `company`, `stage`, `jd` metadata. Preserve `status`, `result`, `error`, `_editorData`, `checked`.
- **New job:** append to list with `status: 'loaded'`.
- **Manual jobs:** always preserved (unchanged).

### Status display — `#docs-status`

`syncTopBarStatus()` replaces whatever is in `#docs-status` based on current state:

| Condition | Message |
|-----------|---------|
| Queue empty, not running | `● Local docs loaded.` (original docs status) |
| Running, queue empty | `⟳ Acme Corp — Eng... (8s)` |
| Running, N queued | `⟳ Acme Corp — Eng... (8s) · 2 queued` |
| All done, no failures | `✓ Tailored N jobs.` → fades to docs status after 4s |
| Done with failures | `✓ N tailored · ⚠ M failed — see job list` → **no fade**, persists |
| Huntr loading | `Loading Huntr jobs…` (existing, unchanged) |

The elapsed timer ticks every second via `setInterval`, same pattern as the existing `analysis-text` timer. Timer is cleared when the job completes or fails.

### Error display

**`STATUS_ICONS`:** Add `error: '⚠'` entry.
**CSS:** Add `.job-item__status--error { color: #c0392b; }`.
**Job row:** Status icon gets `title="${job.error}"` as a hover tooltip.
**Job detail panel:** When active job has `status === 'error'`, show error message inline above the JD textarea.
**Retry:** Errored jobs can be re-checked and re-queued via "Tailor Selected" — clears `job.error`, sets `pending`, appends to queue.

### `#analysis-text` (scores row)

Unchanged — continues to show result detail / re-grade status for the **active job**. No longer used for queue progress.

## Files to Change

- `src/workbench/index-v2.html` — all changes are in this file:
  - State initialization (replace `isTailoring`)
  - `renderJobsMeta()` / `renderJobList()` — error icon + tooltip
  - `loadHuntrJobs()` — merge-by-ID instead of replace
  - Tailor button handler — enqueue instead of run inline
  - New `ensureTailorLoop()` + `tailorLoop()` functions
  - New `syncTopBarStatus()` function (replaces direct `docs-status` writes)
  - `onQueueDrained()` for post-run summary
  - Job detail panel — error message display

## Non-Goals

- Parallel tailoring (still sequential, one at a time)
- Cancelling in-flight jobs
- Queue persistence across page reload
