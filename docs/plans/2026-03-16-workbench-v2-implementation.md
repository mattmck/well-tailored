# Workbench V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the workbench into a single-screen unified review experience with icon rail, structured editor, draggable preview/diff panel, and missing keywords column.

**Architecture:** Replace the current multi-panel `index.html` (4100+ lines) with a new layout. The structured editor code from `resume-editor.html` is inlined directly (no iframe). Existing JS functions (`parseResumeSectionsClient`, `sectionCoverageClient`, `computeGap`, `computeDiff`, `renderClientDiffHtml`, workspace save/load) are preserved and adapted. The server (`server.ts`) needs no changes — all existing API endpoints are reused.

**Tech Stack:** Vanilla HTML/CSS/JS (single file), existing Node/Express server, existing Vitest tests.

**Design doc:** `docs/plans/2026-03-16-workbench-v2-design.md`

---

## Phase 1: Layout Shell & Icon Rail

### Task 1: Create the new HTML skeleton

**Files:**
- Create: `src/workbench/index-v2.html`

**Step 1: Write the HTML skeleton**

Create `src/workbench/index-v2.html` with the full layout structure but no JS logic yet. Include:

```html
<!-- Top bar: workspace picker, save, delete, gear, storage indicator -->
<div class="top-bar">
  <div class="top-bar__workspace">
    <label>WORKSPACE</label>
    <input type="text" id="workspaceName" list="workspaceList" placeholder="Untitled workspace" autocomplete="off">
    <datalist id="workspaceList"></datalist>
    <button class="btn-icon" id="saveWorkspaceBtn" disabled>Save</button>
    <button class="btn-icon" id="deleteWorkspaceBtn" disabled>Delete</button>
    <button class="btn-icon" id="exportWorkspaceBtn" disabled>Export</button>
  </div>
  <div class="top-bar__right">
    <span class="storage-indicator">~/.well-tailored</span>
  </div>
</div>

<!-- Main layout: icon rail + content -->
<div class="app-layout">
  <!-- Icon rail -->
  <nav class="icon-rail">
    <button class="icon-rail__btn active" data-panel="jobs" title="Jobs">briefcase</button>
    <button class="icon-rail__btn" data-panel="sources" title="Sources">doc</button>
    <div class="icon-rail__spacer"></div>
    <button class="icon-rail__btn" data-panel="config" title="Config">gear</button>
  </nav>

  <!-- Slide-out panels -->
  <aside class="slide-panel" id="panel-jobs"><!-- job list --></aside>
  <aside class="slide-panel" id="panel-sources" hidden><!-- source editor --></aside>
  <aside class="slide-panel" id="panel-config" hidden><!-- config --></aside>

  <!-- Main content area -->
  <main class="main-content">
    <!-- Score cards row -->
    <div class="scores-row" id="scoresRow"><!-- score cards + analysis --></div>

    <!-- Three-column editor area -->
    <div class="editor-layout">
      <!-- Left: interactive editor -->
      <div class="editor-column" id="editorColumn">
        <div class="editor-sections" id="editorSections"></div>
      </div>

      <!-- Draggable splitter -->
      <div class="splitter" id="splitter"></div>

      <!-- Center: preview/diff -->
      <div class="preview-column" id="previewColumn">
        <div class="preview-toolbar">
          <div class="export-buttons" id="exportButtons"></div>
          <div class="view-switcher" id="viewSwitcher"></div>
        </div>
        <div class="preview-content" id="previewContent"></div>
      </div>

      <!-- Right: missing keywords -->
      <div class="missing-column" id="missingColumn">
        <div class="missing-header"><span id="missingCount">0 missing</span></div>
        <div class="missing-pills" id="missingPills"></div>
      </div>
    </div>
  </main>
</div>
```

CSS for the skeleton layout:

```css
/* App layout */
.app-layout {
  display: flex;
  height: calc(100vh - var(--top-bar-height));
  overflow: hidden;
}

/* Icon rail - thin vertical bar */
.icon-rail {
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: #141414;
  border-right: 1px solid var(--line);
  flex-shrink: 0;
}

/* Slide-out panels */
.slide-panel {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--line);
  background: var(--surface);
  transition: width 0.2s, opacity 0.2s;
}
.slide-panel[hidden] { display: none; }

/* Main content fills remaining space */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Scores row */
.scores-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

/* Three-column editor layout */
.editor-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-column {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.splitter {
  width: 6px;
  cursor: col-resize;
  background: var(--line);
  flex-shrink: 0;
  transition: background 0.15s;
}
.splitter:hover, .splitter.active { background: var(--accent); }

.preview-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.missing-column {
  width: 130px;
  flex-shrink: 0;
  overflow-y: auto;
  border-left: 1px solid var(--line);
  padding: 8px;
}
```

**Step 2: Add the server route for v2**

In `src/server.ts`, add a route to serve the v2 file:

```typescript
// Add alongside existing '/' route
if (req.method === 'GET' && url.pathname === '/v2') {
  const html = readFileSync(join(__dirname, 'workbench', 'index-v2.html'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
  return;
}
```

Also add a dev fallback path (same pattern as the existing `/` route).

**Step 3: Verify the skeleton loads**

Run: `npm run dev -- serve`
Navigate to: `http://localhost:4312/v2`
Expected: Empty layout shell with icon rail on left, three columns in main area.

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html src/server.ts
git commit -m "feat: scaffold workbench v2 layout shell with icon rail"
```

---

### Task 2: Draggable splitter

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add splitter JS**

```javascript
function initSplitter() {
  const splitter = document.getElementById('splitter');
  const editor = document.getElementById('editorColumn');
  const preview = document.getElementById('previewColumn');
  const layout = document.querySelector('.editor-layout');
  let dragging = false;

  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    splitter.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    const missingWidth = document.getElementById('missingColumn').offsetWidth;
    const available = rect.width - splitter.offsetWidth - missingWidth;
    const offset = e.clientX - rect.left;
    const editorWidth = Math.max(200, Math.min(available - 200, offset));
    editor.style.flex = 'none';
    editor.style.width = editorWidth + 'px';
    preview.style.flex = '1';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}
```

**Step 2: Verify drag works**

Navigate to `/v2`, drag the splitter left and right. Editor and preview columns should resize.

**Step 3: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add draggable splitter between editor and preview columns"
```

---

### Task 3: Icon rail panel switching

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add icon rail click handler**

```javascript
function initIconRail() {
  const buttons = document.querySelectorAll('.icon-rail__btn');
  const panels = {
    jobs: document.getElementById('panel-jobs'),
    sources: document.getElementById('panel-sources'),
    config: document.getElementById('panel-config'),
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.panel;
      const panel = panels[target];
      if (!panel) return;

      // Toggle: if already open, close it
      if (!panel.hidden) {
        panel.hidden = true;
        btn.classList.remove('active');
        return;
      }

      // Close all panels, open this one
      Object.values(panels).forEach(p => p.hidden = true);
      buttons.forEach(b => b.classList.remove('active'));
      panel.hidden = false;
      btn.classList.add('active');
    });
  });
}
```

**Step 2: Style the icon rail buttons**

```css
.icon-rail__btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.icon-rail__btn:hover { background: var(--surface-raised); color: var(--text); }
.icon-rail__btn.active {
  background: rgba(190,80,60,0.12);
  color: var(--accent);
}
.icon-rail__spacer { flex: 1; }
```

**Step 3: Verify panel switching**

Click jobs icon → jobs panel shows. Click sources icon → sources panel shows, jobs hides. Click sources again → sources hides.

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add icon rail panel switching for jobs/sources/config"
```

---

## Phase 2: Job List & Tailoring Flow

### Task 4: Job list panel with status lifecycle

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add job state management**

Port the existing job loading code from `index.html`. The state model:

```javascript
const state = {
  jobs: [],           // { id, company, title, jd, stage, status: 'loaded'|'pending'|'tailored'|'reviewed', result: null }
  activeJobId: null,  // currently viewing in editor
  workspaceName: '',
  workspaces: [],
  splitterPosition: null,
  scoresStale: false,
  // ... carried over from v1
};
```

Job status values and their icons:
- `loaded` → `—`
- `pending` → `⋯` (animated)
- `tailored` → `●` (orange)
- `reviewed` → `✓` (green)

**Step 2: Render job list**

```javascript
function renderJobList() {
  const el = document.getElementById('panel-jobs');
  const checkedCount = state.jobs.filter(j => j.checked).length;

  el.innerHTML = `
    <div class="panel-header">
      <h3>Jobs</h3>
      <div class="panel-actions">
        <button class="btn-icon" onclick="loadHuntrJobs()">Load Huntr</button>
        <button class="btn-icon" onclick="addManualJob()">+ Paste JD</button>
      </div>
    </div>
    <div class="job-list">
      ${state.jobs.map(job => `
        <div class="job-item ${state.activeJobId === job.id ? 'active' : ''}" data-job-id="${job.id}">
          <label class="job-checkbox">
            <input type="checkbox" ${job.checked ? 'checked' : ''} data-job-check="${job.id}">
          </label>
          <div class="job-info" data-job-select="${job.id}">
            <strong>${escHtml(job.company || 'Untitled')}</strong>
            <span>${escHtml(job.title || 'No title')}</span>
          </div>
          <span class="job-status job-status--${job.status}">
            ${job.status === 'loaded' ? '—' : job.status === 'pending' ? '⋯' : job.status === 'tailored' ? '●' : '✓'}
          </span>
        </div>
      `).join('')}
    </div>
    <div class="panel-footer">
      <button class="primary" id="tailorSelectedBtn"
        ${checkedCount === 0 ? 'disabled' : ''}
        onclick="showTailorConfirmation()">
        Tailor Selected (${checkedCount})
      </button>
    </div>
  `;
}
```

**Step 3: Add job list event delegation**

```javascript
document.getElementById('panel-jobs').addEventListener('click', (e) => {
  const selectTarget = e.target.closest('[data-job-select]');
  if (selectTarget) {
    setActiveJob(selectTarget.dataset.jobSelect);
    return;
  }
});

document.getElementById('panel-jobs').addEventListener('change', (e) => {
  const check = e.target.closest('[data-job-check]');
  if (check) {
    const job = state.jobs.find(j => j.id === check.dataset.jobCheck);
    if (job) job.checked = check.checked;
    renderJobList();
  }
});
```

**Step 4: Port Huntr loading from v1**

Copy `loadHuntrJobs()` from `index.html` — the `fetch('/api/huntr/jobs')` call — and adapt to populate `state.jobs[]` with status `'loaded'`.

**Step 5: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add job list panel with status lifecycle and Huntr loading"
```

---

### Task 5: Tailor confirmation modal & batch execution

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add modal HTML and CSS**

```html
<div class="modal-overlay" id="tailorModal" hidden>
  <div class="modal">
    <h3>Confirm Tailoring</h3>
    <p>Review company and title for each job before tailoring.</p>
    <table class="confirm-table" id="confirmTable">
      <thead><tr><th></th><th>Company</th><th>Title</th><th>JD Preview</th></tr></thead>
      <tbody></tbody>
    </table>
    <div class="modal-actions">
      <button class="btn-icon" onclick="closeTailorModal()">Cancel</button>
      <button class="primary" id="confirmTailorBtn" onclick="executeBatchTailor()">Tailor All</button>
    </div>
  </div>
</div>
```

**Step 2: Populate confirmation table**

```javascript
function showTailorConfirmation() {
  const checked = state.jobs.filter(j => j.checked);
  if (checked.length === 0) return;

  const tbody = document.querySelector('#confirmTable tbody');
  tbody.innerHTML = checked.map(job => `
    <tr data-confirm-job="${job.id}">
      <td><input type="checkbox" checked data-confirm-check="${job.id}"></td>
      <td><input type="text" value="${escHtml(job.company)}" data-confirm-company="${job.id}"></td>
      <td><input type="text" value="${escHtml(job.title)}" data-confirm-title="${job.id}"></td>
      <td class="jd-preview">${escHtml((job.jd || '').slice(0, 80))}...</td>
    </tr>
  `).join('');

  document.getElementById('tailorModal').hidden = false;
}
```

**Step 3: Execute batch tailoring**

```javascript
async function executeBatchTailor() {
  closeTailorModal();

  // Read confirmed values from modal inputs
  const rows = document.querySelectorAll('[data-confirm-job]');
  const jobsToTailor = [];
  rows.forEach(row => {
    const id = row.dataset.confirmJob;
    const checked = row.querySelector(`[data-confirm-check="${id}"]`).checked;
    if (!checked) return;
    const job = state.jobs.find(j => j.id === id);
    if (!job) return;
    job.company = row.querySelector(`[data-confirm-company="${id}"]`).value;
    job.title = row.querySelector(`[data-confirm-title="${id}"]`).value;
    job.status = 'pending';
    jobsToTailor.push(job);
  });

  renderJobList();

  // Tailor each job sequentially (or parallel with concurrency limit)
  for (const job of jobsToTailor) {
    try {
      const result = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: getSourceResume(),
          bio: getSourceBio(),
          jobDescription: job.jd,
          company: job.company,
          jobTitle: job.title,
          model: state.tailorModel || 'auto',
        }),
      }).then(r => r.json());

      job.status = 'tailored';
      job.result = result;

      // Auto-select first completed job
      if (!state.activeJobId || state.jobs.find(j => j.id === state.activeJobId)?.status === 'loaded') {
        setActiveJob(job.id);
      }
    } catch (error) {
      job.status = 'loaded'; // Reset on failure
      job.error = error.message;
    }
    renderJobList();
  }
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add tailor confirmation modal and batch execution"
```

---

## Phase 3: Interactive Structured Editor

### Task 6: Port structured editor rendering (no iframe)

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Port core editor functions from resume-editor.html**

Copy and adapt these functions from `docs/resume-editor.html` into the v2 workbench `<script>`:

- `parseMarkdown(md)` — parses markdown into editor data model
- `toMarkdown()` — serializes editor data back to markdown
- `makeHeaderBlock()` — renders name/role/contact fields
- `makeSectionBlock(sec, idx)` — renders section fields (text/bullets/jobs)
- `renderDatePicker()` — date range picker for job entries
- `esc()`, `inlineMd()`, `linkify()` — utility functions
- Section operations: `addSection`, `removeSection`, `moveSection`, `changeType`
- Bullet operations: `addBullet`, `removeBullet`, `addJobBullet`, `removeJobBullet`
- Job operations: `addJob`, `removeJob`, `moveJob`

Key adaptation: instead of rendering to a global `data` object, render from the active job's result:

```javascript
function getEditorData() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  if (!job?.result?.output?.resume) return null;

  // Parse the result resume into editor data model
  if (!job._editorData) {
    job._editorData = parseMarkdown(job.result.output.resume);
  }
  return job._editorData;
}

function syncEditorToResult() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  if (!job?._editorData) return;
  const md = toMarkdown(job._editorData);
  job.result.output.resume = md;
  state.scoresStale = true;
  renderPreviewPanel();
  renderScoresRow();
}
```

**Step 2: Render editor sections**

```javascript
function renderEditor() {
  const el = document.getElementById('editorSections');
  const data = getEditorData();

  if (!data) {
    el.innerHTML = '<div class="editor-empty">Select a tailored job to start reviewing.</div>';
    return;
  }

  el.innerHTML = '';
  el.appendChild(makeHeaderBlock(data));
  data.sections.forEach((sec, i) => {
    el.appendChild(makeSectionBlock(sec, i, data));
  });
}
```

**Step 3: Verify editor renders with mock data**

Temporarily inject a test resume and verify structured fields appear.

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: port structured editor into workbench v2 (no iframe)"
```

---

### Task 7: Per-section keyword coverage pills

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Port sectionCoverageClient from v1**

Copy `sectionCoverageClient(section, gapAnalysis)` from `index.html`. This computes which matched/partial keywords appear in a given section's content.

**Step 2: Add pills above each section's fields**

Modify `makeSectionBlock()` to inject keyword pills:

```javascript
function makeSectionBlock(sec, idx, editorData) {
  const div = document.createElement('div');
  div.className = 'section-block';
  div.dataset.id = sec.id;

  // Compute coverage for this section
  const job = state.jobs.find(j => j.id === state.activeJobId);
  const gapAnalysis = job?.result?.gapAnalysis;
  let pillsHtml = '';

  if (gapAnalysis) {
    const sectionContent = sectionContentForCoverage(sec);
    const coverage = computeSectionCoverage(sectionContent, gapAnalysis);
    pillsHtml = `<div class="section-pills">
      ${coverage.matched.map(kw => `<span class="pill pill--matched">${escHtml(kw)}</span>`).join('')}
      ${coverage.partial.map(p => `<span class="pill pill--partial">${escHtml(p.resumeTerm)}≈${escHtml(p.jdTerm)}</span>`).join('')}
    </div>`;
  }

  // ... rest of section rendering with pillsHtml prepended
}
```

**Step 3: Style the pills**

```css
.section-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}
.pill--matched {
  background: rgba(78,157,120,0.15);
  color: #93d0b1;
  border: 1px solid rgba(78,157,120,0.3);
}
.pill--partial {
  background: rgba(184,138,53,0.12);
  color: #e4c27f;
  border: 1px solid rgba(184,138,53,0.3);
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add per-section keyword coverage pills above editor fields"
```

---

### Task 8: Regenerate section button

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add regenerate button to each section block**

In `makeSectionBlock()`, add at the bottom of each section:

```html
<div class="section-footer">
  <button class="btn-icon btn-regenerate" data-regenerate="${sec.id}"
    ${state.regeneratingSection === sec.id ? 'disabled' : ''}>
    ${state.regeneratingSection === sec.id ? 'Regenerating...' : 'Regenerate ↻'}
  </button>
</div>
```

**Step 2: Add regenerate handler**

```javascript
async function regenerateSection(sectionId) {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  if (!job?.result) return;

  state.regeneratingSection = sectionId;
  renderEditor();

  try {
    const result = await fetch('/api/regenerate-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: job.result.output.resume,
        bio: getSourceBio(),
        jobDescription: job.jd,
        jobTitle: job.title,
        sectionId,
        model: state.tailorModel || 'auto',
      }),
    }).then(r => r.json());

    job.result.output.resume = result.markdown;
    job._editorData = parseMarkdown(result.markdown);
    state.scoresStale = true;
  } catch (error) {
    console.error('Regeneration failed:', error);
  } finally {
    state.regeneratingSection = null;
    renderEditor();
    renderPreviewPanel();
    renderScoresRow();
  }
}
```

**Step 3: Wire event delegation**

```javascript
document.getElementById('editorSections').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-regenerate]');
  if (btn) regenerateSection(btn.dataset.regenerate);
});
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add per-section regenerate button with API integration"
```

---

## Phase 4: Right Rail — Preview, Diff, Missing Keywords

### Task 9: Preview panel with theme selector

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Port preview rendering from resume-editor.html**

Copy `renderPreview()` and theme-related code. Adapt to render from active job's editor data:

```javascript
function renderPreviewPanel() {
  const data = getEditorData();
  const content = document.getElementById('previewContent');

  if (!data) {
    content.innerHTML = '<div class="preview-empty">No resume to preview.</div>';
    return;
  }

  if (state.viewMode === 'diff') {
    renderDiffPanel();
    return;
  }

  // Render themed HTML preview (same as resume-editor.html renderPreview)
  let html = '<div id="previewRender" class="preview-render">';
  html += `<h1>${inlineMd(data.name)}</h1>`;
  html += `<h2 class="role">${inlineMd(data.role)}</h2>`;
  // ... (same as resume-editor.html renderPreview)
  html += '</div>';
  content.innerHTML = html;
  applyPreviewTheme(state.previewTheme);
}
```

**Step 2: Add view switcher and theme dropdown**

```javascript
function renderPreviewToolbar() {
  const toolbar = document.querySelector('.preview-toolbar');
  toolbar.innerHTML = `
    <div class="export-buttons">
      <button class="btn-export" onclick="downloadFormat('md')">Markdown</button>
      <button class="btn-copy" onclick="copyFormat('md')" title="Copy">📋</button>
      <button class="btn-export" onclick="downloadFormat('html')">HTML</button>
      <button class="btn-copy" onclick="copyFormat('html')" title="Copy">📋</button>
      <button class="btn-export" onclick="downloadFormat('pdf')">PDF</button>
      <button class="btn-copy" onclick="copyFormat('pdf')" title="Copy">📋</button>
    </div>
    <div class="view-controls">
      <div class="segmented-toggle">
        <button class="${state.viewMode === 'preview' ? 'active' : ''}" onclick="setViewMode('preview')">Preview</button>
        <button class="${state.viewMode === 'diff' ? 'active' : ''}" onclick="setViewMode('diff')">Diff</button>
      </div>
      <select id="themeSelect" onchange="setPreviewTheme(this.value)">
        <!-- theme options -->
      </select>
    </div>
  `;
}
```

**Step 3: Add copy-to-clipboard with animation**

```javascript
async function copyFormat(format) {
  const data = getEditorData();
  if (!data) return;
  const content = format === 'md' ? toMarkdown(data) : renderPreviewHtml(data);

  try {
    await navigator.clipboard.writeText(content);
    const btn = event.target;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '📋'; btn.classList.remove('copied'); }, 1500);
  } catch (e) {
    console.error('Copy failed:', e);
  }
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add preview panel with theme selector and export buttons"
```

---

### Task 10: Diff panel

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Port diff rendering from v1**

Copy `computeDiff()` and `renderClientDiffHtml()` from `index.html`.

```javascript
async function renderDiffPanel() {
  const content = document.getElementById('previewContent');
  const job = state.jobs.find(j => j.id === state.activeJobId);
  if (!job?.result) {
    content.innerHTML = '<div class="preview-empty">No diff available.</div>';
    return;
  }

  content.innerHTML = '<div class="diff-loading">Computing diff...</div>';

  const baseResume = getSourceResume();
  const currentResume = job.result.output.resume;
  const diff = await computeDiff(baseResume, currentResume);
  content.innerHTML = renderClientDiffHtml(diff);
}
```

**Step 2: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add diff panel with view switcher toggle"
```

---

### Task 11: Missing keywords column

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Render missing keywords**

```javascript
function renderMissingKeywords() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  const gapAnalysis = job?.result?.gapAnalysis;
  const header = document.getElementById('missingCount');
  const pills = document.getElementById('missingPills');

  if (!gapAnalysis) {
    header.textContent = '0 missing';
    pills.innerHTML = '';
    return;
  }

  const missing = gapAnalysis.missingKeywords || [];
  header.textContent = `${missing.length} missing`;
  pills.innerHTML = missing.map(kw =>
    `<div class="missing-pill">${escHtml(kw.term)}</div>`
  ).join('');
}
```

**Step 2: Style missing pills**

```css
.missing-column {
  width: 130px;
  flex-shrink: 0;
  overflow-y: auto;
  border-left: 1px solid var(--line);
  padding: 8px;
}
.missing-header {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.missing-pill {
  padding: 4px 8px;
  margin-bottom: 4px;
  border-radius: 999px;
  font-size: 10px;
  background: rgba(220,80,60,0.1);
  color: #e8857a;
  border: 1px solid rgba(220,80,60,0.25);
}
```

**Step 3: Wire live updates**

Call `renderMissingKeywords()` whenever the editor syncs or gap analysis refreshes.

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add missing keywords column with live updates"
```

---

## Phase 5: Scores, Re-grade & Save

### Task 12: Score cards with stale indicators

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Port score rendering from v1**

Copy `renderScores()` logic from `index.html`. Add stale indicator:

```javascript
function renderScoresRow() {
  const el = document.getElementById('scoresRow');
  const job = state.jobs.find(j => j.id === state.activeJobId);

  if (!job?.result?.scorecard) {
    el.innerHTML = '<div class="scores-empty">Scores appear after tailoring.</div>';
    return;
  }

  const sc = job.result.scorecard;
  const stale = state.scoresStale ? ' → ?' : '';

  el.innerHTML = `
    <div class="scores-grid">
      ${renderScoreCard('Resume Fit', sc.resume_fit, stale)}
      ${renderScoreCard('Cover Letter', sc.cover_letter_fit, stale)}
      ${renderScoreCard('Accuracy', sc.accuracy_risk, stale)}
      <!-- analysis notes -->
    </div>
    <div class="scores-actions">
      <button class="btn-icon ${state.scoresStale ? 'btn-pulse' : ''}"
        id="regradeBtn"
        ${state.scoresStale ? '' : 'disabled'}
        onclick="regradeScores()">
        Re-grade Scores ↻
      </button>
    </div>
  `;
}
```

**Step 2: Add re-grade function**

```javascript
async function regradeScores() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  if (!job?.result) return;

  const btn = document.getElementById('regradeBtn');
  btn.disabled = true;
  btn.textContent = 'Re-grading...';

  try {
    const [scorecard, gapAnalysis] = await Promise.all([
      fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: job.result.output.resume,
          coverLetter: job.result.output.coverLetter,
          jobDescription: job.jd,
          model: state.scoreModel || 'auto',
        }),
      }).then(r => r.json()),
      computeGap(job.result.output.resume, job.jd),
    ]);

    job.result.scorecard = scorecard;
    job.result.gapAnalysis = gapAnalysis;
    state.scoresStale = false;
  } catch (error) {
    console.error('Re-grade failed:', error);
  }

  renderScoresRow();
  renderEditor(); // refresh pills
  renderMissingKeywords();
}
```

**Step 3: Add pulse animation CSS**

```css
.btn-pulse {
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(190,80,60,0); }
  50% { box-shadow: 0 0 0 4px rgba(190,80,60,0.25); }
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add score cards with stale indicators and re-grade button"
```

---

### Task 13: Save & Mark Reviewed + workspace management

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add Save & Mark Reviewed button**

This appears in the main content area when viewing a tailored job:

```javascript
function renderSaveBar() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  const el = document.getElementById('saveBar');

  if (!job || job.status === 'loaded' || job.status === 'pending') {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  el.innerHTML = `
    <button class="primary ${job.status === 'reviewed' ? '' : 'btn-pulse'}"
      onclick="saveAndMarkReviewed()"
      ${job.status === 'reviewed' ? 'disabled' : ''}>
      ${job.status === 'reviewed' ? '✓ Reviewed' : 'Save & Mark Reviewed'}
    </button>
  `;
}
```

**Step 2: Port workspace save/load/delete from v1**

Copy workspace management functions from `index.html`:
- `saveWorkspace()` — POST to `/api/workspace`
- `loadWorkspace(name)` — GET from `/api/workspace/:name`
- `deleteWorkspace(name)` — DELETE `/api/workspace/:name`
- `listWorkspaces()` — GET `/api/workspaces`
- `exportWorkspace()` — download as zip

Adapt the autocomplete picker to use `<datalist>` for suggestions.

**Step 3: Add workspace export**

```javascript
async function exportWorkspace() {
  // Save current state first
  await saveWorkspace();

  // Create zip with workspace JSON + all generated outputs
  const data = {
    workspace: state,
    outputs: state.jobs
      .filter(j => j.result)
      .map(j => ({
        company: j.company,
        title: j.title,
        resume: j.result.output.resume,
        coverLetter: j.result.output.coverLetter,
      })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workspace-${state.workspaceName || 'untitled'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add save/mark reviewed, workspace management, and export"
```

---

## Phase 6: Secondary Panels & Polish

### Task 14: Sources slide-out panel

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Render source document editor in the sources panel**

```javascript
function renderSourcesPanel() {
  const el = document.getElementById('panel-sources');
  el.innerHTML = `
    <div class="panel-header"><h3>Source Documents</h3></div>
    <div class="source-editor">
      <label>RESUME</label>
      <div class="source-file-indicator">${state.resumePath || 'No file loaded'}</div>
      <textarea id="sourceResume" rows="20" oninput="debouncedSyncSources()">${escHtml(state.sourceResume || '')}</textarea>

      <label style="margin-top:12px">BIO</label>
      <div class="source-file-indicator">${state.bioPath || 'No file loaded'}</div>
      <textarea id="sourceBio" rows="12" oninput="debouncedSyncSources()">${escHtml(state.sourceBio || '')}</textarea>
    </div>
  `;
}
```

**Step 2: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add sources slide-out panel for resume and bio editing"
```

---

### Task 15: Config slide-out panel

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Render config panel with model selectors and prompt editors**

```javascript
function renderConfigPanel() {
  const el = document.getElementById('panel-config');
  el.innerHTML = `
    <div class="panel-header"><h3>Configuration</h3></div>
    <div class="config-section">
      <label>TAILOR MODEL</label>
      <select id="configTailorModel" onchange="state.tailorModel=this.value">
        <option value="auto">Auto</option>
        <!-- model options populated from /api/models -->
      </select>

      <label>SCORE MODEL</label>
      <select id="configScoreModel" onchange="state.scoreModel=this.value">
        <option value="auto">Auto</option>
      </select>

      <label style="margin-top:16px">RESUME PROMPT (system)</label>
      <textarea id="configResumePrompt" rows="8"
        oninput="state.customResumePrompt=this.value">${escHtml(state.customResumePrompt || '')}</textarea>

      <label>COVER LETTER PROMPT (system)</label>
      <textarea id="configCoverPrompt" rows="8"
        oninput="state.customCoverPrompt=this.value">${escHtml(state.customCoverPrompt || '')}</textarea>
    </div>
  `;
}
```

**Step 2: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add config slide-out panel for models and prompts"
```

---

### Task 16: Button activation states

**Files:**
- Modify: `src/workbench/index-v2.html`

**Step 1: Add updateButtonStates() function**

```javascript
function updateButtonStates() {
  const job = state.jobs.find(j => j.id === state.activeJobId);
  const hasResult = !!job?.result;
  const hasTailored = state.jobs.some(j => j.status !== 'loaded');
  const hasChecked = state.jobs.some(j => j.checked);

  // Workspace buttons
  setEnabled('saveWorkspaceBtn', state.workspaceName);
  setEnabled('deleteWorkspaceBtn', state.workspaceName);
  setEnabled('exportWorkspaceBtn', hasTailored);

  // Tailor button
  setEnabled('tailorSelectedBtn', hasChecked);

  // Re-grade
  setEnabled('regradeBtn', state.scoresStale && hasResult);

  // Export buttons
  document.querySelectorAll('.btn-export, .btn-copy').forEach(btn => {
    btn.disabled = !hasResult;
    btn.classList.toggle('btn-disabled', !hasResult);
  });
}

function setEnabled(id, condition) {
  const el = document.getElementById(id);
  if (el) el.disabled = !condition;
}
```

**Step 2: Call updateButtonStates() after every state change**

Add calls in: `renderJobList()`, `renderScoresRow()`, `renderEditor()`, `setActiveJob()`, workspace load/save.

**Step 3: Style disabled buttons**

```css
button:disabled, .btn-disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
```

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html
git commit -m "feat: add context-aware button activation states"
```

---

### Task 17: Wire up initialization and swap route

**Files:**
- Modify: `src/workbench/index-v2.html`
- Modify: `src/server.ts`

**Step 1: Add init function**

```javascript
async function init() {
  initSplitter();
  initIconRail();

  // Load source docs
  try {
    const docs = await fetch('/api/local-docs').then(r => r.json());
    state.sourceResume = docs.resume || '';
    state.sourceBio = docs.bio || '';
    state.resumePath = docs.resumePath || '';
    state.bioPath = docs.bioPath || '';
  } catch (e) {
    console.warn('Failed to load local docs:', e);
  }

  // Load workspace list
  await refreshWorkspaceList();

  // Render initial state
  renderJobList();
  renderSourcesPanel();
  renderConfigPanel();
  renderEditor();
  renderPreviewPanel();
  renderMissingKeywords();
  renderScoresRow();
  updateButtonStates();
}

init();
```

**Step 2: Make `/v2` the default route (optional, or keep `/` as v1)**

In `server.ts`, update the `/` handler to serve `index-v2.html`, keep old version at `/v1`:

```typescript
// Swap: / serves v2, /v1 serves old
if (req.method === 'GET' && url.pathname === '/') {
  // serve index-v2.html
}
if (req.method === 'GET' && url.pathname === '/v1') {
  // serve index.html (old)
}
```

**Step 3: Smoke test full flow**

1. Navigate to `http://localhost:4312/`
2. Click "Load Huntr" or "+ Paste JD" to add a job
3. Check job, click "Tailor Selected"
4. Confirm modal appears with editable company/title
5. After tailoring: editor shows sections with keyword pills
6. Preview updates live on edits
7. Missing keywords column shows gaps
8. Re-grade button pulses, scores refresh on click
9. Save & Mark Reviewed saves the job

**Step 4: Commit**

```bash
git add src/workbench/index-v2.html src/server.ts
git commit -m "feat: wire up v2 initialization and promote to default route"
```

---

## Phase 7: Testing

### Task 18: Add integration tests for new client-side functions

**Files:**
- Create: `tests/workbench-v2.test.ts`

**Step 1: Write tests for parseMarkdown round-trip**

```typescript
import { describe, it, expect } from 'vitest';

// Extract parseMarkdown and toMarkdown for testing
// (these are pure functions that can be extracted to a shared module)

describe('parseMarkdown', () => {
  it('parses a full resume into editor data model', () => {
    const md = `# Matt McKnight\n\n## Senior Engineer\n\nContact info\n\n## Summary\n\nExperienced engineer.\n\n## Experience\n\n### Staff Engineer | Acme Corp\n\n2022 – Present\n\n- Led platform team\n- Built infra\n`;
    const data = parseMarkdown(md);
    expect(data.name).toBe('Matt McKnight');
    expect(data.role).toBe('Senior Engineer');
    expect(data.sections).toHaveLength(2);
    expect(data.sections[1].type).toBe('jobs');
  });

  it('round-trips markdown through parse and serialize', () => {
    const input = `# Name\n\n## Role\n\n## Skills\n\nTypeScript, Go\n`;
    const data = parseMarkdown(input);
    const output = toMarkdown(data);
    expect(output.trim()).toContain('# Name');
    expect(output).toContain('TypeScript, Go');
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/workbench-v2.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add tests/workbench-v2.test.ts
git commit -m "test: add workbench v2 parseMarkdown round-trip tests"
```

---

## Notes for Implementer

### Key files to reference:
- **Design doc:** `docs/plans/2026-03-16-workbench-v2-design.md`
- **Current workbench:** `src/workbench/index.html` (4100+ lines — mine for reusable JS functions)
- **Structured editor:** `docs/resume-editor.html` (1039 lines — port editor rendering logic)
- **Server:** `src/server.ts` (all API endpoints already exist, no new endpoints needed)
- **Resume parser:** `src/lib/resume-parser.ts` (server-side section parsing)
- **Gap analysis:** `src/services/gap.ts` (server-side gap analysis)

### API endpoints to reuse (all existing):
- `POST /api/tailor` — run tailoring
- `POST /api/score` — run scorecard
- `POST /api/gap` — run gap analysis
- `POST /api/diff` — compute diff
- `POST /api/regenerate-section` — regenerate one section
- `GET /api/local-docs` — load resume/bio from filesystem
- `GET /api/huntr/jobs` — load Huntr jobs
- `GET /api/workspaces` — list workspaces
- `GET/POST/DELETE /api/workspace/:name` — workspace CRUD

### CSS variables (already defined in v1, copy to v2):
- `--accent: #BE503C`
- `--surface: #1e1e1e`
- `--surface-strong: #161616`
- `--surface-raised: #2a2a2a`
- `--line: #2f2f2f`
- `--text: #e8e8e8`
- `--muted: #777`
- `--deep: #c8c8c8`
- `--radius-sm: 8px`
