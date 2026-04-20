# Structured Editor Persistence — Implementation Plan

## Goal

Wire up the existing DB schema and repositories so that structured editor data (`EditorData` — resume header, sections, bullets, job entries) persists across page reloads and workspace loads. Currently the structured editor works entirely in-memory: the frontend parses markdown into `EditorData` on first view, lets the user edit it, and reconstructs markdown — but `_editorData` is always `null` on workspace load.

## Current State (what already exists)

### DB schema (src/db/migrations.ts)
- `job_documents` table has an `editor_data_json TEXT` column — never populated
- Normalized resume tables exist: `resume_headers`, `resume_sections`, `resume_job_entries`, `resume_bullets` — never used outside tests

### Repositories
- `src/repositories/documents.ts` — `DocumentRepo` with `save()` that accepts `editorDataJson`, `findLatest()` that returns it, and `findLatestForJobs()` batch query
- `src/repositories/resume.ts` — `ResumeRepo` with `saveEditorData()`/`loadEditorData()` — fully tested but not wired in (leave this alone for now; it's for future use)

### Server routes (src/server.ts)
- `PUT /api/jobs/:jobId/documents/:docType` — accepts `{ markdown, editorDataJson? }` body, calls `docRepo.save()`
- `GET /api/workspaces/:id` — calls `DocumentRepo.findLatestForJobs()` to include documents in the response

### Frontend
- `web/src/api/client.ts` — `saveDocument(jobId, docType, markdown, editorDataJson?)` — defined but never called
- `web/src/features/workspace/workspacePersistence.ts` — `dbWorkspaceToState()` hydrates jobs from DB workspace response, currently sets `_editorData: null` always
- `web/src/features/editor/EditorColumn.tsx` — `patchEditorData()` updates React state via `SET_JOB_DOCUMENT_STATE` action; this is the mutation point for all editor changes
- `web/src/lib/job-documents.ts` — helpers for reading markdown from job state

## Changes Required

### 1. `src/repositories/documents.ts` — Update `findLatestForJobs` return type

**File**: `src/repositories/documents.ts`
**What**: The `findLatestForJobs` method currently only selects `job_id, doc_type, markdown`. Add `editor_data_json` to the SELECT and return it in the result object.

**ALREADY DONE** — This change was already applied. The method now returns `{ resume?, cover?, resumeEditorDataJson?, coverEditorDataJson? }` per job ID. The SQL now includes `d.editor_data_json` in the SELECT.

### 2. `web/src/features/workspace/workspacePersistence.ts` — Hydrate `_editorData` on workspace load

**File**: `web/src/features/workspace/workspacePersistence.ts`

**ALREADY DONE** — These changes were already applied:
- Import `EditorData` type
- `DbJobRecord.documents` type updated to include `resumeEditorDataJson?: string | null` and `coverEditorDataJson?: string | null`
- Added `tryParseEditorData(json)` helper function that safely parses JSON to `EditorData | null`
- `dbWorkspaceToState()` now calls `tryParseEditorData(job.documents?.resumeEditorDataJson)` and sets `_editorData` on each job

### 3. `web/src/hooks/useEditorAutoSave.ts` — New auto-save hook

**File**: `web/src/hooks/useEditorAutoSave.ts`

**ALREADY DONE** — This file was already created with:
- Watches `state.activeJobId`, `state.activeDoc`, and `state.jobs` for changes
- On each change, finds the active job, checks if it has `_editorData`
- Builds a fingerprint string `${jobId}:${activeDoc}:${JSON.stringify(editorData)}`
- If fingerprint changed from last save, starts a debounce timer (1500ms default)
- On timer fire, calls `api.saveDocument(jobId, docType, markdown, editorDataJson)`
- Logs success/failure to console

**NEEDS REVIEW/FIX**: The current implementation has a subtle issue — the `useEffect` cleanup clears the timer, but a new effect re-runs on every `state.jobs` reference change (which happens on every dispatch). The fingerprint comparison prevents unnecessary API calls, but the timer restarts on every render. This is actually correct behavior for debouncing — each edit resets the timer. However, we should also handle the case where the user switches jobs: we should flush (save immediately) the pending save for the previous job before switching. See step 6 below.

### 4. `web/src/App.tsx` — Wire the auto-save hook

**File**: `web/src/App.tsx`

**ALREADY DONE** — These changes were already applied:
- Import `useEditorAutoSave` from `./hooks/useEditorAutoSave`
- Call `useEditorAutoSave()` in `AppShell` alongside `useTailorQueue()` and `useRegradeQueue()`

### 5. Remaining: Flush on job switch / unmount

**File**: `web/src/hooks/useEditorAutoSave.ts`

**TODO**: Improve the auto-save hook to flush pending saves when:
- The active job changes (user clicks a different job)
- The active doc tab changes (user switches from resume to cover letter)
- The component unmounts (user navigates away)

Implementation approach:
- Track `prevJobId` and `prevActiveDoc` in refs
- When they change, immediately fire the pending save (if any) for the previous job/doc before starting to track the new one
- On unmount, fire any pending save synchronously via `navigator.sendBeacon` or just fire-and-forget the fetch

Here's the specific change needed in `useEditorAutoSave.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useWorkspace } from '../context';
import { reconstructEditorData } from '../lib/markdown';
import type { EditorData } from '../types';
import * as api from '../api/client';

interface PendingSave {
  jobId: string;
  docType: 'resume' | 'cover';
  editorData: EditorData;
}

export function useEditorAutoSave(debounceMs = 1500) {
  const { state } = useWorkspace();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  const pendingRef = useRef<PendingSave | null>(null);

  // Flush helper — saves immediately if there's a pending change
  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    const markdown = reconstructEditorData(pending.editorData);
    const editorDataJson = JSON.stringify(pending.editorData);
    const fingerprint = `${pending.jobId}:${pending.docType}:${editorDataJson}`;
    if (fingerprint === lastSavedRef.current) return;

    lastSavedRef.current = fingerprint;
    api.saveDocument(pending.jobId, pending.docType, markdown, editorDataJson)
      .then(() => console.info('[workbench] Auto-saved editor data', { jobId: pending.jobId, docType: pending.docType }))
      .catch((err) => console.warn('[workbench] Auto-save failed', err));
  }

  useEffect(() => {
    const job = state.activeJobId
      ? state.jobs.find((j) => j.id === state.activeJobId)
      : null;

    if (!job?.result || !job._editorData) return;

    const editorData = job._editorData;
    const jobId = job.id;
    const docType = state.activeDoc === 'resume' ? 'resume' as const : 'cover' as const;

    const fingerprint = `${jobId}:${docType}:${JSON.stringify(editorData)}`;
    if (fingerprint === lastSavedRef.current) return;

    // If there's a pending save for a DIFFERENT job/doc, flush it first
    if (pendingRef.current && (pendingRef.current.jobId !== jobId || pendingRef.current.docType !== docType)) {
      flush();
    }

    pendingRef.current = { jobId, docType, editorData };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.activeJobId, state.activeDoc, state.jobs, debounceMs]);

  // Flush on unmount
  useEffect(() => {
    return () => flush();
  }, []);
}
```

### 6. Verify: Server route handles `editorDataJson` correctly

**File**: `src/server.ts` lines 511-516

The existing `PUT /api/jobs/:jobId/documents/:docType` route already does:
```typescript
const body = await readJsonBody<{ markdown: string; editorDataJson?: string }>(req);
const doc = new DocumentRepo(getDb()).save({ jobId: docMatch[1], docType: docMatch[2], ...body });
```

And `DocumentRepo.save()` already accepts and stores `editorDataJson`. **No changes needed.**

### 7. Verify: Workspace GET includes editor data in response

**File**: `src/server.ts` lines 452-461

The existing route does:
```typescript
const docs = new DocumentRepo(db).findLatestForJobs(jobs.map(j => j.id));
const jobsWithDocs = jobs.map(j => ({ ...j, documents: docs[j.id] ?? {} }));
sendJson(res, 200, { ...ws, jobs: jobsWithDocs });
```

Since `findLatestForJobs` now returns `resumeEditorDataJson`/`coverEditorDataJson` in each entry, these fields will be included in the JSON response automatically. **No changes needed.**

### 8. Verify: Frontend `loadWorkspace` → `workspaceRecordToState` data flow

The `loadWorkspace()` function returns `WorkspaceRecord` (which has `snapshot: unknown`). The response from a DB workspace has no `snapshot` field but has top-level `sourceResume` etc. + `jobs[]` array. `workspaceRecordToState()` detects this via `!workspace.snapshot && workspace.sourceResume !== undefined` and calls `dbWorkspaceToState()`.

In `dbWorkspaceToState`, each job's `documents` field comes from the server response's `documents` object. The `tryParseEditorData()` function reads `job.documents?.resumeEditorDataJson`, parses it, and sets `_editorData`. **No changes needed** — already wired up in step 2.

## Summary of changes still TODO

Only **step 5** remains — rewriting `useEditorAutoSave.ts` with the improved flush-on-switch logic. The code is provided above in full.

Everything else (steps 1-4, 6-8) is either already done or verified to need no changes.

## Testing

After implementing step 5:

1. **Manual test — auto-save fires**: Open the app, tailor a job, edit a section heading in the editor. Wait 2 seconds. Check browser console for `[workbench] Auto-saved editor data`. Check the DB: `SELECT editor_data_json FROM job_documents ORDER BY created_at DESC LIMIT 1` — should have JSON content.

2. **Manual test — survives reload**: Edit a section, wait for auto-save, reload the page. The editor should show the edited section data (not re-parsed from markdown).

3. **Manual test — job switch flushes**: Edit a section, immediately click a different job (before the 1.5s debounce). The save for the first job should fire immediately. Check console for the log.

4. **Unit test** (optional): Add a test in `tests/db.test.ts` that:
   - Creates a workspace + job
   - Saves a document with `editorDataJson`
   - Calls `findLatestForJobs` and verifies `resumeEditorDataJson` is returned
   - Loads workspace via the API and verifies `_editorData` is hydrated

## Files modified (complete list)

| File | Status | Description |
|------|--------|-------------|
| `src/repositories/documents.ts` | DONE | `findLatestForJobs` returns `editor_data_json` |
| `web/src/features/workspace/workspacePersistence.ts` | DONE | `dbWorkspaceToState` hydrates `_editorData` from `resumeEditorDataJson` |
| `web/src/hooks/useEditorAutoSave.ts` | CREATED, NEEDS REWRITE | Auto-save hook with debounce; needs flush-on-switch improvement (step 5) |
| `web/src/App.tsx` | DONE | `useEditorAutoSave()` wired into `AppShell` |
| `src/server.ts` | NO CHANGES NEEDED | Routes already handle `editorDataJson` |
| `web/src/api/client.ts` | NO CHANGES NEEDED | `saveDocument` already accepts `editorDataJson` |
