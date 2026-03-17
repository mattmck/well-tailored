# Tailoring Queue & Persistent Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the one-shot tailoring loop with a proper queue — jobs can be added while running, status lives persistently in the top bar, Huntr reloads preserve existing job state, and errors are visible per-job.

**Architecture:** All changes are in `src/workbench/index-v2.html`. Replace `state.isTailoring` with `state.tailorQueue[]` + `state.tailorRunning`. A single `tailorLoop()` drains the queue sequentially; `ensureTailorLoop()` starts it if idle. `syncTopBarStatus()` owns the `#docs-status` span — it shows queue progress during runs and reverts to docs status when idle. `loadHuntrJobs()` merges by ID instead of replacing.

**Tech Stack:** Vanilla JS in a single HTML file, no build step. Tests are Vitest in `tests/` but all changes here are browser-only (no testable server logic).

---

### Task 1: Replace `isTailoring` with queue state

**Files:**
- Modify: `src/workbench/index-v2.html:2523` (state init block)

**Step 1: Replace the state fields**

Find the state init block around line 2523. Replace:
```js
isTailoring: false,
```
With:
```js
tailorQueue: [],       // string[] — job IDs waiting to run
tailorRunning: null,   // string | null — ID of currently-running job
tailorDoneTimer: null, // setTimeout handle for post-run fade
```
Also remove these fields that are moving to the top-bar status system (they stay in state for `setRunFeedback` which still drives `#analysis-text` for re-grade — don't remove them):
- Keep `runFeedbackTimer`, `runFeedbackStartedAt`, `runFeedbackBaseText` — still used by `setRunFeedback` for re-grade.

**Step 2: Verify the page still loads without JS errors**

Restart the server (`npx tsx src/server.ts`) and open `http://localhost:4312`. Check browser console for errors.

**Step 3: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "refactor: replace isTailoring bool with tailorQueue/tailorRunning state"
```

---

### Task 2: Add `error` status styling and icon

**Files:**
- Modify: `src/workbench/index-v2.html:1666` (CSS), `src/workbench/index-v2.html:2952` (STATUS_ICONS)

**Step 1: Add error CSS class** after line 1666:
```css
.job-item__status--error { color: #c0392b; }
```

**Step 2: Add error icon** in `STATUS_ICONS` (around line 2952):
```js
const STATUS_ICONS = {
  loaded:   '—',
  pending:  '⋯',
  tailored: '●',
  reviewed: '✓',
  error:    '⚠',   // ADD THIS
};
```

**Step 3: Update job row rendering** to include tooltip on error

Find the job row HTML template (around line 3116–3129). The status span is:
```js
const statusClass = 'job-item__status--' + (job.status || 'loaded');
const statusIcon = STATUS_ICONS[job.status] || STATUS_ICONS.loaded;
```
And the span:
```js
<span class="job-item__status ${statusClass}">${statusIcon}</span>
```
Change to:
```js
const statusClass = 'job-item__status--' + (job.status || 'loaded');
const statusIcon = STATUS_ICONS[job.status] || STATUS_ICONS.loaded;
const statusTitle = job.status === 'error' && job.error
  ? ` title="${job.error.replace(/"/g, '&quot;')}"`
  : '';
```
And the span:
```js
<span class="job-item__status ${statusClass}"${statusTitle}>${statusIcon}</span>
```

**Step 4: Update job status assignment on failure** (around line 3415)

Find where failed jobs are set back to `'loaded'`:
```js
job.status = 'loaded';
```
Change to:
```js
job.status = 'error';
```

**Step 5: Verify visually** — manually trigger a tailor failure (e.g. clear the API key temporarily) and confirm the ⚠ icon appears red in the job row with a tooltip.

**Step 6: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "feat: add error status icon with tooltip to job list items"
```

---

### Task 3: Show error in job detail panel

**Files:**
- Modify: `src/workbench/index-v2.html:3166` (`renderJobDetail` function)

**Step 1: Add error banner to `renderJobDetail()`**

Find `renderJobDetail()` (line 3166). After setting the field values (lines 3175–3177), add:
```js
// Show/hide error banner
let errorBanner = detail.querySelector('.job-detail__error');
if (!errorBanner) {
  errorBanner = document.createElement('div');
  errorBanner.className = 'job-detail__error';
  // Insert before the JD label/textarea
  const jdLabel = detail.querySelector('label[for="detail-jd"], .detail-jd-label');
  if (jdLabel) jdLabel.before(errorBanner);
  else detail.prepend(errorBanner);
}
if (job.status === 'error' && job.error) {
  errorBanner.textContent = `⚠ Tailoring failed: ${job.error}`;
  errorBanner.style.display = '';
} else {
  errorBanner.style.display = 'none';
}
```

**Step 2: Add CSS for error banner** (near the other `.job-detail` styles):
```css
.job-detail__error {
  background: #3a1a1a;
  color: #e07070;
  border: 1px solid #6b2020;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  margin-bottom: 8px;
}
```

**Step 3: Verify** — click a failed job and confirm the error message appears above the JD.

**Step 4: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "feat: show tailoring error message in job detail panel"
```

---

### Task 4: `syncTopBarStatus()` — persistent queue status in `#docs-status`

**Files:**
- Modify: `src/workbench/index-v2.html` — add new function near `updateDocsIndicator()` (around line 2573)

**Step 1: Add queue status timer to state** (already done in Task 1 — `tailorDoneTimer`)

**Step 2: Add `syncTopBarStatus()` function** right after `updateDocsIndicator()` (line ~2579):

```js
function syncTopBarStatus() {
  const el = document.getElementById('docs-status');
  if (!el) return;

  // If a done-fade timer is pending, cancel it whenever we re-sync
  if (state.tailorDoneTimer) {
    clearTimeout(state.tailorDoneTimer);
    state.tailorDoneTimer = null;
  }
  // Also cancel any existing tick timer
  if (state.queueTickTimer) {
    clearInterval(state.queueTickTimer);
    state.queueTickTimer = null;
  }

  const running = state.tailorRunning
    ? state.jobs.find(j => j.id === state.tailorRunning)
    : null;

  if (running) {
    // Show live progress with elapsed time
    const queuedCount = state.tailorQueue.length;
    const startedAt = state.tailorRunningStartedAt || Date.now();
    const renderTick = () => {
      const elapsed = formatElapsed(startedAt);
      const label = `${running.company || 'Job'} — ${running.title || ''}`.trim().replace(/\s*—\s*$/, '');
      const queued = queuedCount > 0 ? ` · ${queuedCount} queued` : '';
      el.textContent = `⟳ ${label}... (${elapsed})${queued}`;
      el.style.color = '#d4a843';
    };
    renderTick();
    state.queueTickTimer = setInterval(renderTick, 1000);
    return;
  }

  // Not running — check if we just finished (tailorLastSummary set by onQueueDrained)
  if (state.tailorLastSummary) {
    const { tailored, failed } = state.tailorLastSummary;
    if (failed > 0) {
      el.textContent = `✓ ${tailored} tailored · ⚠ ${failed} failed — see job list`;
      el.style.color = '#c0392b';
    } else {
      el.textContent = `✓ Tailored ${tailored} job${tailored === 1 ? '' : 's'}.`;
      el.style.color = '#4e9d78';
      // Fade back to docs status after 4s
      state.tailorDoneTimer = setTimeout(() => {
        state.tailorLastSummary = null;
        updateDocsIndicator();
      }, 4000);
    }
    return;
  }

  // Idle — show docs status
  updateDocsIndicator();
}
```

**Step 3: Add `queueTickTimer` and `tailorRunningStartedAt` and `tailorLastSummary` to state init** (Task 1 block, add alongside `tailorDoneTimer`):
```js
queueTickTimer: null,
tailorRunningStartedAt: 0,
tailorLastSummary: null,  // { tailored: N, failed: N } | null
```

**Step 4: Replace all direct calls to `updateDocsIndicator()`** with `syncTopBarStatus()` — find all call sites and update them. (Search: `updateDocsIndicator()`)

**Step 5: Verify** — the top bar still shows docs status on load.

**Step 6: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "feat: add syncTopBarStatus() for persistent queue progress in top bar"
```

---

### Task 5: `ensureTailorLoop()` + `tailorLoop()`

**Files:**
- Modify: `src/workbench/index-v2.html` — replace the existing tailor confirmation handler (around line 3350–3443)

**Step 1: Add `ensureTailorLoop()` and `tailorLoop()` after `loadHuntrJobs()`** (around line 3249):

```js
function ensureTailorLoop() {
  if (state.tailorRunning !== null) return; // already running
  if (state.tailorQueue.length === 0) return; // nothing to do
  tailorLoop();
}

async function tailorLoop() {
  let tailoredCount = 0;
  const failedJobs = [];

  while (state.tailorQueue.length > 0) {
    const jobId = state.tailorQueue.shift();
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) continue; // job was removed

    state.tailorRunning = jobId;
    state.tailorRunningStartedAt = Date.now();
    job.status = 'pending';
    job.error = null;
    syncTopBarStatus();
    renderJobList();

    try {
      const res = await fetch('/api/runs/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agents: currentAgents(),
          promptOverrides: currentPromptOverrides(),
          input: {
            resume: state.sourceResume,
            bio: state.sourceBio,
            baseCoverLetter: state.sourceCoverLetter,
            resumeSupplemental: state.sourceSupplemental,
            jobDescription: job.jd,
            company: job.company,
            jobTitle: job.title,
          },
          includeScoring: true,
        }),
      });

      if (!res.ok) throw new Error(await res.text() || res.statusText);

      const result = await res.json();
      job.status = 'tailored';
      job.result = result;
      job.error = null;
      job._editorData = null;
      tailoredCount++;

      // Auto-select first completed job
      if (tailoredCount === 1) {
        state.activeJobId = job.id;
        renderJobDetail();
        renderScoreCards();
        renderEditor();
        renderPreviewPanel();
        renderMissingKeywords();
      }
    } catch (e) {
      job.status = 'error';
      job.error = e.message || String(e);
      failedJobs.push(job);
      console.error(`Tailor failed for ${job.company} — ${job.title}:`, e);
    }

    state.tailorRunning = null;
    state.tailorRunningStartedAt = 0;
    renderJobList();
    syncTopBarStatus();
  }

  // Queue drained
  onQueueDrained(tailoredCount, failedJobs);
}

function onQueueDrained(tailoredCount, failedJobs) {
  state.tailorRunning = null;
  state.tailorLastSummary = { tailored: tailoredCount, failed: failedJobs.length };
  renderJobList();
  syncTopBarStatus();
}
```

**Step 2: Remove the old tailor for-loop block** — find the section starting around line 3350:
```js
// Set checked jobs to pending
const toTailor = state.jobs.filter(j => j.checked);
toTailor.forEach(j => { j.status = 'pending'; j.error = null; });
state.isTailoring = true;
// ... through to ...
state.isTailoring = false;
renderJobList();
// Auto-select first completed job and render all panels
// ... through setRunFeedback('Tailoring did not produce a result.', 'error');
```
Replace the entire body of the confirm modal OK handler (everything after reading the company/title edits, up to the closing of the handler) with:
```js
// Enqueue checked jobs (deduplicate against queue + running)
const alreadyQueued = new Set([
  ...state.tailorQueue,
  ...(state.tailorRunning ? [state.tailorRunning] : []),
]);
const toEnqueue = state.jobs.filter(j => j.checked && !alreadyQueued.has(j.id));
toEnqueue.forEach(j => { j.status = 'pending'; j.error = null; });
state.tailorQueue.push(...toEnqueue.map(j => j.id));
state.tailorLastSummary = null;
renderJobList();
syncTopBarStatus();
ensureTailorLoop();
```

**Step 3: Update `renderJobList()` tailor button logic** (around line 3107):

Replace:
```js
tailorBtn.disabled = checkedCount === 0 || state.isTailoring;
tailorBtn.textContent = state.isTailoring
  ? `Tailoring… (${checkedCount})`
  : checkedCount > 0
  ? `Tailor Selected (${checkedCount})`
  : 'Tailor Selected';
```
With:
```js
tailorBtn.disabled = checkedCount === 0;
tailorBtn.textContent = checkedCount > 0
  ? `Tailor Selected (${checkedCount})`
  : 'Tailor Selected';
```

**Step 4: Verify** — select 2 jobs, click Tailor Selected. Confirm:
- Top bar shows `⟳ Company — Role... (Ns)`
- Queue count appears if you check more jobs and click again mid-run
- Job rows update live
- On completion, top bar shows `✓ Tailored 2 jobs.` then fades

**Step 5: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "feat: replace inline tailor loop with queue-based tailorLoop() + ensureTailorLoop()"
```

---

### Task 6: Huntr reload merge by ID

**Files:**
- Modify: `src/workbench/index-v2.html:3207` (`loadHuntrJobs`)

**Step 1: Replace the jobs assignment** inside `loadHuntrJobs()`.

Find (lines 3213–3228):
```js
if (data.jobs) {
  const manualJobs = state.jobs.filter((job) => job.source === 'manual');
  const huntrJobs = data.jobs.map(j => ({
    id: j.id || sid(),
    company: j.company || '',
    title: j.title || '',
    jd: j.descriptionText || j.description || '',
    stage: j.listName || j.stage || '',
    source: 'huntr',
    status: 'loaded',
    checked: false,
    result: null,
    error: null,
    _editorData: null,
  }));
  state.jobs = manualJobs.concat(huntrJobs);
```

Replace with:
```js
if (data.jobs) {
  // Build a lookup of existing jobs by ID to preserve status/results
  const existingById = new Map(state.jobs.map(j => [j.id, j]));

  const huntrJobs = data.jobs.map(j => {
    const existing = existingById.get(j.id);
    if (existing && existing.source === 'huntr') {
      // Refresh metadata only — preserve status, result, error, checked, _editorData
      existing.company = j.company || existing.company;
      existing.title = j.title || existing.title;
      existing.jd = j.descriptionText || j.description || existing.jd;
      existing.stage = j.listName || j.stage || existing.stage;
      return existing;
    }
    return {
      id: j.id || sid(),
      company: j.company || '',
      title: j.title || '',
      jd: j.descriptionText || j.description || '',
      stage: j.listName || j.stage || '',
      source: 'huntr',
      status: 'loaded',
      checked: false,
      result: null,
      error: null,
      _editorData: null,
    };
  });

  const manualJobs = state.jobs.filter((job) => job.source === 'manual');
  state.jobs = manualJobs.concat(huntrJobs);
```

**Step 2: Verify merge behavior** — tailor a job, then click "Load Huntr Jobs". Confirm the tailored job still shows its result and status after reload.

**Step 3: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "fix: preserve job status/results when reloading Huntr jobs (merge by ID)"
```

---

### Task 7: Wire `syncTopBarStatus()` into all relevant state changes

**Files:**
- Modify: `src/workbench/index-v2.html` — call sites for `updateDocsIndicator()`

**Step 1: Find all `updateDocsIndicator()` calls**
```bash
grep -n "updateDocsIndicator" src/workbench/index-v2.html
```

**Step 2: Replace each with `syncTopBarStatus()`** — it calls `updateDocsIndicator()` internally when idle so behavior is identical when queue is empty.

**Step 3: Also call `syncTopBarStatus()` at the end of `loadHuntrJobs()`** in the `finally` block (around line 3244), replacing or supplementing the existing `renderJobList()` call.

**Step 4: Also call `syncTopBarStatus()` when docs are loaded** — find where `updateDocsIndicator()` was called after source file loads and make sure `syncTopBarStatus()` is there.

**Step 5: Verify** — full flow: load docs → top bar shows `● Docs loaded`. Load Huntr → top bar briefly shows loading state, then reverts. Start tailoring → top bar shows queue progress. Complete → summary. Idle → docs status.

**Step 6: Commit**
```bash
git add src/workbench/index-v2.html
git commit -m "refactor: replace all updateDocsIndicator() calls with syncTopBarStatus()"
```

---

### Task 8: Final cleanup & push

**Step 1: Run tests**
```bash
cd /Users/matt.mcknight/job-shit-diff-gap-parser-foundation
npm test
```
Expected: all 125 tests pass (no server-side changes, so all existing tests should be green).

**Step 2: Check for leftover `isTailoring` references**
```bash
grep -n "isTailoring" src/workbench/index-v2.html
```
Expected: zero results.

**Step 3: Smoke test in browser**
- Load page, confirm docs status
- Load Huntr jobs, confirm job status preserved on reload
- Tailor 1 job, watch top bar timer, confirm completion summary
- Tailor 2 jobs, mid-run check 2 more + click Tailor Selected, confirm queue count updates
- Let a job fail (or simulate), confirm ⚠ icon + tooltip + detail panel error + persistent top bar message
- Retry failed job via Tailor Selected, confirm it re-queues

**Step 4: Push**
```bash
git push
```
