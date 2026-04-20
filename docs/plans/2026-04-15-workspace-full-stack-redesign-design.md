# Workspace Full-Stack Redesign

**Date**: 2026-04-15  
**Status**: Approved

## Overview

Two parallel tracks:

1. **Layout redesign**: Replace the current resizable three-panel layout with a clean two-column design that puts scores/keywords/jobs in a scrollable left sidebar and the editor/preview in the right column.
2. **Backend persistence**: Move from in-memory React state + JSON file snapshots to a SQLite-backed persistent queue and workspace store, making the app survive page reloads, server restarts, and eventually Azure deployment.

The structured editor already exists (`EditorData`, `EditorSection`, `EditorColumn`). This is not a data model rewrite — the editor components stay. The work is layout + infrastructure.

---

## Section 1: Two-Column Layout

### Current State

`App.tsx` uses Radix `ResizablePanelGroup` with three panels: icon rail, left panel (switching between jobs/scores/sources/prompts/config views), and right panel (editor/preview). Fixed-height panel regions cause content to get lost and make the experience feel cramped.

### New Layout

**Left column** (~320px default, resizable via single Radix divider, min 280px / max 450px):
- Single scrollable column (no fixed-height sub-regions)
- Score card (overall score, confidence, verdict label)
- AI suggestions (scorecard notes + gap narrative, inline prose)
- Keywords bar (matched/total count, red-yellow-green bar, expandable to Missing/Partial/Represented pill groups)
- Job list (stage filter accordions: Wishlist, Applied, Interview, Rejected, Timeout, Offer)

**Right column** (flex-grow):
- Tab bar: `Edit | Preview` → `Resume | Cover Letter` → download buttons (Markdown, HTML, PDF)
- Content: structured editor (resume) or plain text editor (cover letter) in Edit mode; rendered HTML in Preview mode
- Cover letter stays as a markdown textarea for now — structured cover letter editing is future work

**Top bar**: Stays as-is. Settings, prompts, sources, and config (currently in the icon rail / left panel) move to the top bar.

**No collapsing panels**: The icon rail is removed. All content is visible in the scrollable left sidebar, forcing cleanup of what's actually shown rather than hiding clutter behind collapse affordances.

---

## Section 2: Persistent Backend Queue

### Current State

Tailoring runs are fire-and-forget HTTP requests (`POST /api/runs/manual`, `POST /api/runs/huntr`). The frontend holds the connection while the AI generates. Page refresh or server restart loses all in-flight work.

### New Model

The backend owns a persistent task queue backed by the database.

**Flow**:
1. Frontend POSTs to `POST /api/tasks` with job inputs → gets back a `taskId` immediately
2. Backend writes task record to SQLite with `status: 'pending'`
3. A server-side worker loop polls for pending tasks, processes them, writes results back
4. Frontend polls `GET /api/tasks` for status updates
5. On page reload, frontend fetches current workspace and task states — nothing lost
6. On server restart, worker resumes any `pending` or `running` tasks

**Task types**: `tailor`, `score`, `gap`, `regenerate-section`

**Worker behavior**:
- Sequential by default (one AI call at a time, avoids rate limits)
- Concurrency configurable later via env var
- Failed tasks: `status: 'failed'` with `error` field, retryable from the UI

---

## Section 3: Database Schema

**Database location**: `~/.well-tailored/well-tailored.db` (SQLite locally). Azure: Postgres via env var `DATABASE_URL`, with a simple adapter interface hiding the driver difference.

### Tables

**`workspaces`**
```sql
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
slug TEXT NOT NULL,
source_resume TEXT,
source_bio TEXT,
source_cover_letter TEXT,
source_supplemental TEXT,
prompt_resume_system TEXT,
prompt_cover_letter_system TEXT,
prompt_scoring_system TEXT,
theme_json TEXT,         -- ResumeTheme as JSON
agent_config_json TEXT,  -- provider/model selections as JSON
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

**`jobs`**
```sql
id TEXT PRIMARY KEY,
workspace_id TEXT NOT NULL REFERENCES workspaces(id),
company TEXT NOT NULL,
title TEXT,
jd TEXT,
stage TEXT NOT NULL DEFAULT 'wishlist',
source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'huntr'
huntr_id TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

**`job_documents`**
```sql
id TEXT PRIMARY KEY,
job_id TEXT NOT NULL REFERENCES jobs(id),
doc_type TEXT NOT NULL,  -- 'resume' | 'cover'
markdown TEXT NOT NULL,
editor_data_json TEXT,   -- EditorData as JSON, nullable
version INTEGER NOT NULL DEFAULT 1,
created_at TEXT NOT NULL
```
(Latest version per job+type is the active document. Version history kept for undo/diff.)

**`tasks`**
```sql
id TEXT PRIMARY KEY,
workspace_id TEXT NOT NULL REFERENCES workspaces(id),
job_id TEXT NOT NULL REFERENCES jobs(id),
type TEXT NOT NULL,      -- 'tailor' | 'score' | 'gap' | 'regenerate-section'
status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
input_json TEXT NOT NULL,
result_json TEXT,
error TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

---

## Section 4: Frontend State Management

### New Model

The `useReducer` in `App.tsx` becomes a **client-side cache** that syncs with the backend.

**What stays in the reducer (UI state only)**:
- `activeJobId`, `activeDoc`, `viewMode`
- Optimistic editor content (what the user is typing before debounced save fires)
- Panel sizes

**What moves to the backend**:
- Jobs list and stage
- Document content (markdown + editor data)
- Scores, gap analysis
- Task queue status
- Workspace config (sources, prompts, theme, agents)

**Sync patterns**:
- **Workspace load**: Single fetch to hydrate all state
- **Job select**: Fetch latest documents + scores for that job (cached in reducer after first fetch)
- **Task poll**: `GET /api/tasks` on a short interval (~2s) while any tasks are pending/running; pause polling when idle
- **Editor save**: Debounced PUT after ~1s of no typing, optimistic local update
- **No heavy libraries**: Existing `web/src/api/client.ts` + `useEffect` for polling. SWR/React Query can be added later if needed.

---

## Section 5: API Surface

### Endpoints That Stay Unchanged
- `POST /api/render` — markdown to HTML
- `POST /api/export/pdf` — PDF export
- `GET /api/huntr/jobs`, `GET /api/huntr/wishlist` — Huntr integration
- `GET /api/config` — provider/model config

### New/Replaced Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/workspaces` | List workspaces |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces/:id` | Load workspace + jobs + latest docs |
| PATCH | `/api/workspaces/:id` | Update workspace settings |
| DELETE | `/api/workspaces/:id` | Delete workspace |
| GET | `/api/workspaces/:id/jobs` | List jobs |
| POST | `/api/workspaces/:id/jobs` | Add job (manual or Huntr) |
| PATCH | `/api/workspaces/:id/jobs/:jobId` | Update job (stage, JD, etc.) |
| DELETE | `/api/workspaces/:id/jobs/:jobId` | Remove job |
| GET | `/api/jobs/:jobId/documents/:type` | Get latest document |
| PUT | `/api/jobs/:jobId/documents/:type` | Save document edit |
| GET | `/api/jobs/:jobId/documents/:type/versions` | Version history |
| GET | `/api/tasks` | List active/recent tasks (poll endpoint) |
| POST | `/api/tasks` | Enqueue a task |
| GET | `/api/tasks/:id` | Task status + result |

### Removed Endpoints
- `POST /api/runs/manual`, `POST /api/runs/huntr` → replaced by `POST /api/tasks`
- `POST /api/gap`, `POST /api/score`, `POST /api/regenerate-section` → become task types
- `POST /api/workspaces/save` → replaced by auto-save
- `POST /api/diff` → compute client-side or add as query param on document fetch

---

## Section 6: Migration

**Existing JSON workspaces** (`~/.well-tailored/workspaces/*.json`): On first startup, the server detects these files and migrates each one into SQLite — creating workspace, job, and document records from the snapshot. After successful migration, JSON files are moved to `~/.well-tailored/workspaces/migrated/` (not deleted).

**CLI commands** (`tailor`, `huntr tailor`, etc.): Remain functional as thin wrappers that create a workspace + job record, enqueue a task, then poll for completion and print results. Same UX, backed by the queue.

**Database adapter interface**: A simple `DatabaseAdapter` interface over `better-sqlite3` (local) and `pg` (Azure/Postgres). The swap is a single env var (`DATABASE_URL`); all SQL is written to be compatible with both dialects (standard SQL, no SQLite-specific pragmas in the query layer).

**No user-facing breaking changes**: App starts up, migrates if needed, workspaces appear as before.

---

## Out of Scope (Future Work)

- Structured cover letter editing
- Category grouping within keyword pills
- Multi-user / auth
- Real message queue (Redis/BullMQ) — SQLite queue is sufficient
- Azure deployment specifics (infra, CI/CD)
