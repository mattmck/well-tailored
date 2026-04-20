# Backfill Normalized Resume Tables from Markdown Blobs

## Problem

The database has 96 resume documents stored as markdown blobs in `job_documents` (with `doc_type = 'resume'`), but the normalized tables (`resume_headers`, `resume_sections`, `resume_job_entries`, `resume_bullets`) are completely empty. The structured editor needs these normalized rows to render the section-level editing UI.

Current counts (production DB at `~/.well-tailored/well-tailored.db`):
- `job_documents` where `doc_type = 'resume'`: ~48 rows
- `resume_sections`: 0
- `resume_bullets`: 0
- `resume_job_entries`: 0
- `resume_headers`: 0

## Goal

Create a one-time backfill migration that:
1. Reads each resume markdown blob from `job_documents`
2. Parses it into structured `EditorData` (header, sections, job entries, bullets)
3. Writes the structured data into the normalized tables via `ResumeRepo.saveEditorData()`
4. Runs automatically on server startup (idempotent — skips jobs that already have sections)

## Architecture

### The parser already exists — but in the wrong package

`web/src/lib/markdown.ts` has `parseResumeEditorData()` which does exactly what we need — it takes resume markdown and returns an `EditorData` object with header, sections (text/bullets/jobs), job entries, and bullets. However, it lives in the frontend package and imports frontend types.

**Solution:** Port the parser to a new backend module `src/lib/resume-markdown-parser.ts`. The parser is pure string manipulation (no DOM, no React) so this is a straightforward copy with type adjustments.

### The writer already exists

`src/repositories/resume.ts` has `ResumeRepo.saveEditorData(jobId, editorData)` which atomically writes an `EditorData` object into the normalized tables. It already handles upserts, cascading deletes, sort ordering, etc.

### EditorData type compatibility

The backend `EditorData` type is defined in `src/repositories/resume.ts` (lines 85-89):
```typescript
export interface EditorData {
  kind: 'resume' | 'generic';
  header?: EditorHeaderFields;
  sections: EditorSection[];
}
```

The frontend `EditorData` in `web/src/types.ts` (line 80) is structurally identical. The ported parser must produce the backend type.

---

## Implementation Steps

### Step 1: Create `src/lib/resume-markdown-parser.ts`

Port the resume parser from `web/src/lib/markdown.ts` to a backend module.

**Source function to port:** `parseResumeEditorData()` (lines 98-313 of `web/src/lib/markdown.ts`)

**Also port these helper functions** (they are used by the parser):
- `genId()` (line 15) — generates short random IDs
- `isDateSegment()` (lines 60-65)
- `looksLikeDateLine()` (lines 68-74)
- `looksLikeJobTitle()` (lines 77-78)
- `splitDateLocation()` (lines 81-91)

**Import types from the backend:** Use `EditorData`, `EditorSection`, `EditorJobEntry`, `EditorBulletItem`, `EditorHeaderFields` from `../repositories/resume.js`.

**Exported function signature:**
```typescript
import type { EditorData } from '../repositories/resume.js';

export function parseResumeMarkdown(markdown: string): EditorData;
```

**Key differences from the web version:**
- Do NOT accept a `previous` parameter (there is no previous parse to merge with during backfill)
- All sections should have `accepted: true` (these are already-tailored resumes being imported)
- Import types from `../repositories/resume.js` not `@/types`
- Use `.js` extension in imports (backend ESM convention)
- The `EditorJobEntry` type in `resume.ts` does NOT have `detailsMode` or `detailsText` fields, so don't set those

**The parser logic itself is identical** — copy lines 60-313 from `web/src/lib/markdown.ts` verbatim, adjusting only the type imports and the `accepted: true` default.

### Step 2: Create `src/services/backfill-resume-structures.ts`

This is the migration service that reads blobs and writes normalized data.

```typescript
import type { DatabaseAdapter } from '../db/adapter.js';
import { ResumeRepo } from '../repositories/resume.js';
import { parseResumeMarkdown } from '../lib/resume-markdown-parser.js';

export function backfillResumeStructures(db: DatabaseAdapter): number {
  const resumeRepo = new ResumeRepo(db);

  // Find all job_ids that have a resume document but NO resume_sections rows yet
  const jobsToBackfill = db.all<{ job_id: string; markdown: string }>(
    `SELECT d.job_id, d.markdown
     FROM job_documents d
     LEFT JOIN resume_sections s ON s.job_id = d.job_id
     WHERE d.doc_type = 'resume'
       AND s.id IS NULL
     GROUP BY d.job_id
     ORDER BY d.version DESC`
  );

  let count = 0;
  for (const row of jobsToBackfill) {
    try {
      const editorData = parseResumeMarkdown(row.markdown);
      if (editorData.sections.length > 0) {
        resumeRepo.saveEditorData(row.job_id, editorData);
        count++;
      }
    } catch (err) {
      console.warn(`[backfill] Failed to parse resume for job ${row.job_id}: ${(err as Error).message}`);
    }
  }

  if (count > 0) {
    console.log(`[backfill] Parsed ${count} resume(s) into normalized tables`);
  }

  return count;
}
```

**Important SQL detail:** The query should get the *latest version* of each resume (highest `version` number). Use a subquery or `GROUP BY` + `ORDER BY version DESC` to ensure we parse the most recent markdown. A more precise query:

```sql
SELECT d.job_id, d.markdown
FROM job_documents d
INNER JOIN (
  SELECT job_id, MAX(version) as max_ver
  FROM job_documents
  WHERE doc_type = 'resume'
  GROUP BY job_id
) latest ON d.job_id = latest.job_id AND d.version = latest.max_ver
LEFT JOIN resume_sections s ON s.job_id = d.job_id
WHERE d.doc_type = 'resume'
  AND s.id IS NULL
```

### Step 3: Wire into `src/db/instance.ts`

Add the backfill call after the existing migration calls. The file currently looks like:

```typescript
// src/db/instance.ts (current)
import { migrateJsonWorkspaces } from '../services/migrate-workspaces.js';
// ...
runMigrations(_db);
migrateJsonWorkspaces(_db);
```

Add:
```typescript
import { backfillResumeStructures } from '../services/backfill-resume-structures.js';
// ...
runMigrations(_db);
migrateJsonWorkspaces(_db);
backfillResumeStructures(_db);
```

### Step 4: Write tests in `tests/backfill.test.ts`

Create a test file that:

1. Creates a temp SQLite DB
2. Runs migrations
3. Inserts a workspace + job + resume document (markdown blob) directly via repos
4. Calls `backfillResumeStructures(db)`
5. Asserts that `resume_headers` has a row for the job
6. Asserts that `resume_sections` has rows (experience, skills, summary, etc.)
7. Asserts that `resume_bullets` has rows
8. Asserts that `resume_job_entries` has rows for experience sections
9. Calls backfill again — asserts it's idempotent (returns 0, doesn't duplicate)

Use this sample resume markdown for the test:
```markdown
# Jane Doe

## Senior Software Engineer

jane@example.com | (555) 123-4567
linkedin.com/in/janedoe | github.com/janedoe

## Summary

Experienced engineer with 10 years building distributed systems.

## Technical Skills

- TypeScript, JavaScript, Python, Go
- AWS, Kubernetes, Docker, Terraform
- PostgreSQL, Redis, Kafka

## Experience

### Staff Engineer | Acme Corp | San Francisco, CA

2020 – Present

- Led migration of monolithic application to microservices architecture
- Reduced deployment time from 2 hours to 15 minutes via CI/CD automation
- Mentored team of 5 junior engineers

### Senior Engineer | BigCo | Remote

2016 – 2020

- Built real-time data pipeline processing 1M events/second
- Implemented observability stack reducing MTTR by 60%

## Education

### B.S. Computer Science | MIT

2012 – 2016
```

Expected assertions:
- Header: name="Jane Doe", role="Senior Software Engineer", contact="jane@example.com | (555) 123-4567", links="linkedin.com/in/janedoe | github.com/janedoe"
- Sections count: 4 (Summary, Technical Skills, Experience, Education)
- Summary section: type='text', content contains "Experienced engineer"
- Technical Skills section: type='bullets', 3 bullet items
- Experience section: type='jobs', 2 job entries
- First job entry: title="Staff Engineer", company="Acme Corp", 3 bullets
- Second job entry: title="Senior Engineer", company="BigCo", 2 bullets
- Education section: type='jobs', 1 job entry (MIT)

### Step 5: Run tests and typecheck

```bash
npx vitest run tests/backfill.test.ts
npm run typecheck
```

---

## File inventory

| Action | File | Description |
|--------|------|-------------|
| Create | `src/lib/resume-markdown-parser.ts` | Backend port of web resume parser |
| Create | `src/services/backfill-resume-structures.ts` | Startup migration: blob → normalized tables |
| Create | `tests/backfill.test.ts` | Tests for parser + backfill idempotency |
| Modify | `src/db/instance.ts` | Add `backfillResumeStructures(db)` call after migrations |

## Reference files (read-only, do not modify)

- `web/src/lib/markdown.ts` — **source of truth** for the parser logic to port (lines 60-313)
- `src/repositories/resume.ts` — `ResumeRepo` class with `saveEditorData()` / `loadEditorData()` and all `EditorData` types
- `src/db/migrations.ts` — schema definitions for all normalized tables
- `tests/db-normalized.test.ts` — existing tests for `ResumeRepo` round-trip (good reference for how `saveEditorData` / `loadEditorData` work)

## Verification

After implementation, verify against the production DB:

```bash
# Start server (triggers backfill on startup)
npm run serve

# Check normalized tables are populated
sqlite3 ~/.well-tailored/well-tailored.db "SELECT COUNT(*) FROM resume_headers"
sqlite3 ~/.well-tailored/well-tailored.db "SELECT COUNT(*) FROM resume_sections"
sqlite3 ~/.well-tailored/well-tailored.db "SELECT COUNT(*) FROM resume_bullets"
sqlite3 ~/.well-tailored/well-tailored.db "SELECT COUNT(*) FROM resume_job_entries"

# Spot-check a specific job
sqlite3 ~/.well-tailored/well-tailored.db "
  SELECT s.heading, s.type, COUNT(b.id) as bullet_count
  FROM resume_sections s
  LEFT JOIN resume_bullets b ON b.section_id = s.id
  WHERE s.job_id = (SELECT job_id FROM job_documents WHERE doc_type='resume' LIMIT 1)
  GROUP BY s.id
  ORDER BY s.sort_order
"
```

Expected: each resume should have ~4-6 sections, experience sections should have job entries with bullets, skills sections should have bullet items, summary should be text type.
