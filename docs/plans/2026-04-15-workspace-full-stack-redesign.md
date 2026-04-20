# Workspace Full-Stack Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-panel resizable layout with a two-column design and move from in-memory React state + JSON file snapshots to a SQLite-backed persistent queue and workspace store.

**Architecture:** A `DatabaseAdapter` interface hides `better-sqlite3` (local) behind a simple `run/get/all/transaction` surface so Postgres can be swapped in for Azure. The server starts a worker loop on boot that polls for pending tasks and runs them sequentially. The React frontend becomes a thin cache over the REST API, polling for task completion rather than holding open connections.

**Tech Stack:** `better-sqlite3` (SQLite), Vitest, React 19, Radix `react-resizable-panels` (single divider), existing `web/src/api/client.ts` fetch wrapper.

**Reference design doc:** `docs/plans/2026-04-15-workspace-full-stack-redesign-design.md`

---

## Phase 1: Database Foundation

### Task 1: Install `better-sqlite3` and create the database adapter interface

**Files:**
- Modify: `package.json`
- Create: `src/db/adapter.ts`
- Create: `src/db/sqlite.ts`
- Create: `src/db/index.ts`

**Step 1: Install the dependency**

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

Expected: packages added to `package.json` and `node_modules`.

**Step 2: Write the adapter interface**

Create `src/db/adapter.ts`:
```typescript
export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void;
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
  transaction<T>(fn: () => T): T;
  close(): void;
}
```

**Step 3: Write the SQLite adapter**

Create `src/db/sqlite.ts`:
```typescript
import BetterSqlite3 from 'better-sqlite3';
import type { DatabaseAdapter } from './adapter.js';

export function createSqliteAdapter(path: string): DatabaseAdapter {
  const db = new BetterSqlite3(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    run(sql, params = []) {
      db.prepare(sql).run(params);
    },
    get<T>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(params) as T | undefined;
    },
    all<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(params) as T[];
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close() {
      db.close();
    },
  };
}
```

**Step 4: Write the module barrel**

Create `src/db/index.ts`:
```typescript
export type { DatabaseAdapter } from './adapter.js';
export { createSqliteAdapter } from './sqlite.js';
```

**Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/db/ package.json package-lock.json
git commit -m "feat: add DatabaseAdapter interface and better-sqlite3 implementation"
```

---

### Task 2: Schema migrations

**Files:**
- Create: `src/db/migrations.ts`
- Create: `tests/db.test.ts`

**Step 1: Write the failing test**

Create `tests/db.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSqliteAdapter } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrations.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-test-'));
  const path = join(dir, 'test.db');
  const db = createSqliteAdapter(path);
  return { db, cleanup: () => { db.close(); rmSync(dir, { recursive: true }); } };
}

describe('runMigrations', () => {
  it('creates all required tables', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const tables = db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).map(r => r.name);
      expect(tables).toContain('workspaces');
      expect(tables).toContain('jobs');
      expect(tables).toContain('job_documents');
      expect(tables).toContain('tasks');
    } finally {
      cleanup();
    }
  });

  it('is idempotent — running twice does not throw', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      expect(() => runMigrations(db)).not.toThrow();
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL — `runMigrations` not found.

**Step 3: Write the migrations**

Create `src/db/migrations.ts`:
```typescript
import type { DatabaseAdapter } from './adapter.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
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
  theme_json TEXT,
  agent_config_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT,
  jd TEXT,
  stage TEXT NOT NULL DEFAULT 'wishlist',
  source TEXT NOT NULL DEFAULT 'manual',
  huntr_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_documents (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  markdown TEXT NOT NULL,
  editor_data_json TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function runMigrations(db: DatabaseAdapter): void {
  db.transaction(() => {
    for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
      db.run(statement);
    }
  })();
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (2 tests).

**Step 5: Export from barrel**

Add to `src/db/index.ts`:
```typescript
export { runMigrations } from './migrations.js';
```

**Step 6: Commit**

```bash
git add src/db/migrations.ts src/db/index.ts tests/db.test.ts
git commit -m "feat: add SQLite schema migrations for workspaces, jobs, documents, tasks"
```

---

### Task 3: Workspace repository

**Files:**
- Create: `src/repositories/workspaces.ts`
- Modify: `tests/db.test.ts`

**Step 1: Write failing tests**

Append to `tests/db.test.ts`:
```typescript
import { WorkspaceRepo } from '../src/repositories/workspaces.js';

describe('WorkspaceRepo', () => {
  it('creates and retrieves a workspace', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const repo = new WorkspaceRepo(db);
      const ws = repo.create({ name: 'Test WS', sourceResume: '# Matt' });
      expect(ws.id).toBeTruthy();
      expect(ws.name).toBe('Test WS');

      const found = repo.findById(ws.id);
      expect(found?.sourceResume).toBe('# Matt');
    } finally {
      cleanup();
    }
  });

  it('lists workspaces sorted by updatedAt desc', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const repo = new WorkspaceRepo(db);
      repo.create({ name: 'First' });
      repo.create({ name: 'Second' });
      const list = repo.list();
      expect(list[0].name).toBe('Second');
    } finally {
      cleanup();
    }
  });

  it('updates workspace fields', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const repo = new WorkspaceRepo(db);
      const ws = repo.create({ name: 'Original' });
      const updated = repo.update(ws.id, { name: 'Renamed' });
      expect(updated?.name).toBe('Renamed');
    } finally {
      cleanup();
    }
  });

  it('deletes a workspace', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const repo = new WorkspaceRepo(db);
      const ws = repo.create({ name: 'ToDelete' });
      repo.delete(ws.id);
      expect(repo.findById(ws.id)).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL — `WorkspaceRepo` not found.

**Step 3: Create the repository**

Create `src/repositories/workspaces.ts`:
```typescript
import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  sourceResume: string | null;
  sourceBio: string | null;
  sourceCoverLetter: string | null;
  sourceSupplemental: string | null;
  promptResumeSystem: string | null;
  promptCoverLetterSystem: string | null;
  promptScoringSystem: string | null;
  themeJson: string | null;
  agentConfigJson: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateInput = Partial<Omit<WorkspaceRow, 'id' | 'slug' | 'createdAt' | 'updatedAt'>> & { name: string };
type UpdateInput = Partial<Omit<WorkspaceRow, 'id' | 'slug' | 'createdAt' | 'updatedAt'>>;

function toRow(raw: Record<string, unknown>): WorkspaceRow {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    sourceResume: (raw.source_resume as string) ?? null,
    sourceBio: (raw.source_bio as string) ?? null,
    sourceCoverLetter: (raw.source_cover_letter as string) ?? null,
    sourceSupplemental: (raw.source_supplemental as string) ?? null,
    promptResumeSystem: (raw.prompt_resume_system as string) ?? null,
    promptCoverLetterSystem: (raw.prompt_cover_letter_system as string) ?? null,
    promptScoringSystem: (raw.prompt_scoring_system as string) ?? null,
    themeJson: (raw.theme_json as string) ?? null,
    agentConfigJson: (raw.agent_config_json as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export class WorkspaceRepo {
  constructor(private db: DatabaseAdapter) {}

  create(input: CreateInput): WorkspaceRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    const slug = slugify(input.name);
    this.db.run(
      `INSERT INTO workspaces (id,name,slug,source_resume,source_bio,source_cover_letter,
       source_supplemental,prompt_resume_system,prompt_cover_letter_system,prompt_scoring_system,
       theme_json,agent_config_json,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, input.name, slug,
       input.sourceResume ?? null, input.sourceBio ?? null,
       input.sourceCoverLetter ?? null, input.sourceSupplemental ?? null,
       input.promptResumeSystem ?? null, input.promptCoverLetterSystem ?? null,
       input.promptScoringSystem ?? null, input.themeJson ?? null,
       input.agentConfigJson ?? null, now, now],
    );
    return this.findById(id)!;
  }

  findById(id: string): WorkspaceRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM workspaces WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  list(): WorkspaceRow[] {
    return this.db.all<Record<string, unknown>>('SELECT * FROM workspaces ORDER BY updated_at DESC').map(toRow);
  }

  update(id: string, input: UpdateInput): WorkspaceRow | undefined {
    const now = new Date().toISOString();
    const fields: Record<string, unknown> = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.sourceResume !== undefined && { source_resume: input.sourceResume }),
      ...(input.sourceBio !== undefined && { source_bio: input.sourceBio }),
      ...(input.sourceCoverLetter !== undefined && { source_cover_letter: input.sourceCoverLetter }),
      ...(input.sourceSupplemental !== undefined && { source_supplemental: input.sourceSupplemental }),
      ...(input.promptResumeSystem !== undefined && { prompt_resume_system: input.promptResumeSystem }),
      ...(input.promptCoverLetterSystem !== undefined && { prompt_cover_letter_system: input.promptCoverLetterSystem }),
      ...(input.promptScoringSystem !== undefined && { prompt_scoring_system: input.promptScoringSystem }),
      ...(input.themeJson !== undefined && { theme_json: input.themeJson }),
      ...(input.agentConfigJson !== undefined && { agent_config_json: input.agentConfigJson }),
      updated_at: now,
    };
    const keys = Object.keys(fields);
    if (keys.length === 1) return this.findById(id); // only updated_at
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    this.db.run(`UPDATE workspaces SET ${setClauses} WHERE id = ?`, [...Object.values(fields), id]);
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.run('DELETE FROM workspaces WHERE id = ?', [id]);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add src/repositories/workspaces.ts tests/db.test.ts
git commit -m "feat: add WorkspaceRepo with CRUD operations"
```

---

### Task 4: Jobs repository

**Files:**
- Create: `src/repositories/jobs.ts`
- Modify: `tests/db.test.ts`

**Step 1: Write failing tests**

Append to `tests/db.test.ts`:
```typescript
import { JobRepo } from '../src/repositories/jobs.js';

describe('JobRepo', () => {
  function makeWorkspace(db: DatabaseAdapter) {
    runMigrations(db);
    return new WorkspaceRepo(db).create({ name: 'Test' });
  }

  it('creates and retrieves a job', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = makeWorkspace(db);
      const repo = new JobRepo(db);
      const job = repo.create({ workspaceId: ws.id, company: 'Acme', title: 'Engineer' });
      expect(job.company).toBe('Acme');
      expect(job.stage).toBe('wishlist');
      expect(repo.findById(job.id)?.title).toBe('Engineer');
    } finally {
      cleanup();
    }
  });

  it('lists jobs for a workspace', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = makeWorkspace(db);
      const repo = new JobRepo(db);
      repo.create({ workspaceId: ws.id, company: 'A' });
      repo.create({ workspaceId: ws.id, company: 'B' });
      expect(repo.listByWorkspace(ws.id)).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('updates job stage', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = makeWorkspace(db);
      const repo = new JobRepo(db);
      const job = repo.create({ workspaceId: ws.id, company: 'X' });
      repo.update(job.id, { stage: 'applied' });
      expect(repo.findById(job.id)?.stage).toBe('applied');
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL — `JobRepo` not found.

**Step 3: Create the repository**

Create `src/repositories/jobs.ts`:
```typescript
import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';

export interface JobRow {
  id: string;
  workspaceId: string;
  company: string;
  title: string | null;
  jd: string | null;
  stage: string;
  source: string;
  huntrId: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateInput = { workspaceId: string; company: string; title?: string; jd?: string; stage?: string; source?: string; huntrId?: string };
type UpdateInput = Partial<Pick<JobRow, 'title' | 'jd' | 'stage' | 'source' | 'huntrId' | 'company'>>;

function toRow(raw: Record<string, unknown>): JobRow {
  return {
    id: raw.id as string,
    workspaceId: raw.workspace_id as string,
    company: raw.company as string,
    title: (raw.title as string) ?? null,
    jd: (raw.jd as string) ?? null,
    stage: raw.stage as string,
    source: raw.source as string,
    huntrId: (raw.huntr_id as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export class JobRepo {
  constructor(private db: DatabaseAdapter) {}

  create(input: CreateInput): JobRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.run(
      `INSERT INTO jobs (id,workspace_id,company,title,jd,stage,source,huntr_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, input.workspaceId, input.company, input.title ?? null, input.jd ?? null,
       input.stage ?? 'wishlist', input.source ?? 'manual', input.huntrId ?? null, now, now],
    );
    return this.findById(id)!;
  }

  findById(id: string): JobRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM jobs WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  listByWorkspace(workspaceId: string): JobRow[] {
    return this.db.all<Record<string, unknown>>(
      'SELECT * FROM jobs WHERE workspace_id = ? ORDER BY created_at ASC', [workspaceId]
    ).map(toRow);
  }

  update(id: string, input: UpdateInput): JobRow | undefined {
    const now = new Date().toISOString();
    const map: Record<string, unknown> = { updated_at: now };
    if (input.company !== undefined) map.company = input.company;
    if (input.title !== undefined) map.title = input.title;
    if (input.jd !== undefined) map.jd = input.jd;
    if (input.stage !== undefined) map.stage = input.stage;
    if (input.source !== undefined) map.source = input.source;
    if (input.huntrId !== undefined) map.huntr_id = input.huntrId;
    const keys = Object.keys(map);
    this.db.run(
      `UPDATE jobs SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(map), id],
    );
    return this.findById(id);
  }

  delete(id: string): void {
    this.db.run('DELETE FROM jobs WHERE id = ?', [id]);
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (9 tests).

**Step 5: Commit**

```bash
git add src/repositories/jobs.ts tests/db.test.ts
git commit -m "feat: add JobRepo with CRUD and workspace scoping"
```

---

### Task 5: Job documents repository (versioned)

**Files:**
- Create: `src/repositories/documents.ts`
- Modify: `tests/db.test.ts`

**Step 1: Write failing tests**

Append to `tests/db.test.ts`:
```typescript
import { DocumentRepo } from '../src/repositories/documents.js';

describe('DocumentRepo', () => {
  function makeJob(db: DatabaseAdapter) {
    runMigrations(db);
    const ws = new WorkspaceRepo(db).create({ name: 'WS' });
    return new JobRepo(db).create({ workspaceId: ws.id, company: 'Corp' });
  }

  it('saves and retrieves latest document', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const job = makeJob(db);
      const repo = new DocumentRepo(db);
      repo.save({ jobId: job.id, docType: 'resume', markdown: '# Matt' });
      const doc = repo.findLatest(job.id, 'resume');
      expect(doc?.markdown).toBe('# Matt');
      expect(doc?.version).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('increments version on subsequent saves', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const job = makeJob(db);
      const repo = new DocumentRepo(db);
      repo.save({ jobId: job.id, docType: 'resume', markdown: 'v1' });
      repo.save({ jobId: job.id, docType: 'resume', markdown: 'v2' });
      const latest = repo.findLatest(job.id, 'resume');
      expect(latest?.markdown).toBe('v2');
      expect(latest?.version).toBe(2);
    } finally {
      cleanup();
    }
  });

  it('keeps cover letter and resume versions independent', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const job = makeJob(db);
      const repo = new DocumentRepo(db);
      repo.save({ jobId: job.id, docType: 'resume', markdown: 'resume' });
      repo.save({ jobId: job.id, docType: 'cover', markdown: 'cover' });
      expect(repo.findLatest(job.id, 'resume')?.markdown).toBe('resume');
      expect(repo.findLatest(job.id, 'cover')?.markdown).toBe('cover');
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

**Step 3: Create the repository**

Create `src/repositories/documents.ts`:
```typescript
import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';

export interface DocumentRow {
  id: string;
  jobId: string;
  docType: 'resume' | 'cover';
  markdown: string;
  editorDataJson: string | null;
  version: number;
  createdAt: string;
}

type DocType = 'resume' | 'cover';
type SaveInput = { jobId: string; docType: DocType; markdown: string; editorDataJson?: string | null };

function toRow(raw: Record<string, unknown>): DocumentRow {
  return {
    id: raw.id as string,
    jobId: raw.job_id as string,
    docType: raw.doc_type as DocType,
    markdown: raw.markdown as string,
    editorDataJson: (raw.editor_data_json as string) ?? null,
    version: raw.version as number,
    createdAt: raw.created_at as string,
  };
}

export class DocumentRepo {
  constructor(private db: DatabaseAdapter) {}

  save(input: SaveInput): DocumentRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    const latest = this.findLatest(input.jobId, input.docType);
    const version = (latest?.version ?? 0) + 1;
    this.db.run(
      `INSERT INTO job_documents (id,job_id,doc_type,markdown,editor_data_json,version,created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [id, input.jobId, input.docType, input.markdown, input.editorDataJson ?? null, version, now],
    );
    return this.findById(id)!;
  }

  findById(id: string): DocumentRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM job_documents WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  findLatest(jobId: string, docType: DocType): DocumentRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM job_documents WHERE job_id = ? AND doc_type = ? ORDER BY version DESC LIMIT 1',
      [jobId, docType],
    );
    return raw ? toRow(raw) : undefined;
  }

  listVersions(jobId: string, docType: DocType): DocumentRow[] {
    return this.db.all<Record<string, unknown>>(
      'SELECT * FROM job_documents WHERE job_id = ? AND doc_type = ? ORDER BY version DESC',
      [jobId, docType],
    ).map(toRow);
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (12 tests).

**Step 5: Commit**

```bash
git add src/repositories/documents.ts tests/db.test.ts
git commit -m "feat: add DocumentRepo with versioned document storage"
```

---

### Task 6: Tasks repository (queue)

**Files:**
- Create: `src/repositories/tasks.ts`
- Modify: `tests/db.test.ts`

**Step 1: Write failing tests**

Append to `tests/db.test.ts`:
```typescript
import { TaskRepo } from '../src/repositories/tasks.js';

describe('TaskRepo', () => {
  function makeJobAndWorkspace(db: DatabaseAdapter) {
    runMigrations(db);
    const ws = new WorkspaceRepo(db).create({ name: 'WS' });
    const job = new JobRepo(db).create({ workspaceId: ws.id, company: 'Corp' });
    return { ws, job };
  }

  it('creates a pending task', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { ws, job } = makeJobAndWorkspace(db);
      const repo = new TaskRepo(db);
      const task = repo.create({ workspaceId: ws.id, jobId: job.id, type: 'tailor', inputJson: '{}' });
      expect(task.status).toBe('pending');
      expect(task.type).toBe('tailor');
    } finally {
      cleanup();
    }
  });

  it('claims next pending task atomically', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { ws, job } = makeJobAndWorkspace(db);
      const repo = new TaskRepo(db);
      repo.create({ workspaceId: ws.id, jobId: job.id, type: 'tailor', inputJson: '{}' });
      const claimed = repo.claimNext();
      expect(claimed?.status).toBe('running');
      expect(repo.claimNext()).toBeNull(); // no more pending
    } finally {
      cleanup();
    }
  });

  it('completes a task with result', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { ws, job } = makeJobAndWorkspace(db);
      const repo = new TaskRepo(db);
      const task = repo.create({ workspaceId: ws.id, jobId: job.id, type: 'tailor', inputJson: '{}' });
      repo.complete(task.id, '{"resume":"..."}');
      expect(repo.findById(task.id)?.status).toBe('completed');
    } finally {
      cleanup();
    }
  });

  it('fails a task with error message', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { ws, job } = makeJobAndWorkspace(db);
      const repo = new TaskRepo(db);
      const task = repo.create({ workspaceId: ws.id, jobId: job.id, type: 'tailor', inputJson: '{}' });
      repo.fail(task.id, 'rate limit hit');
      const found = repo.findById(task.id);
      expect(found?.status).toBe('failed');
      expect(found?.error).toBe('rate limit hit');
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

**Step 3: Create the repository**

Create `src/repositories/tasks.ts`:
```typescript
import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';

export type TaskType = 'tailor' | 'score' | 'gap' | 'regenerate-section';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskRow {
  id: string;
  workspaceId: string;
  jobId: string;
  type: TaskType;
  status: TaskStatus;
  inputJson: string;
  resultJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateInput = { workspaceId: string; jobId: string; type: TaskType; inputJson: string };

function toRow(raw: Record<string, unknown>): TaskRow {
  return {
    id: raw.id as string,
    workspaceId: raw.workspace_id as string,
    jobId: raw.job_id as string,
    type: raw.type as TaskType,
    status: raw.status as TaskStatus,
    inputJson: raw.input_json as string,
    resultJson: (raw.result_json as string) ?? null,
    error: (raw.error as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export class TaskRepo {
  constructor(private db: DatabaseAdapter) {}

  create(input: CreateInput): TaskRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.run(
      `INSERT INTO tasks (id,workspace_id,job_id,type,status,input_json,result_json,error,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, input.workspaceId, input.jobId, input.type, 'pending', input.inputJson, null, null, now, now],
    );
    return this.findById(id)!;
  }

  findById(id: string): TaskRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM tasks WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  listByWorkspace(workspaceId: string): TaskRow[] {
    return this.db.all<Record<string, unknown>>(
      'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100',
      [workspaceId],
    ).map(toRow);
  }

  /** Atomically claim the oldest pending task, marking it running. Returns null if queue is empty. */
  claimNext(): TaskRow | null {
    return this.db.transaction(() => {
      const next = this.db.get<Record<string, unknown>>(
        "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1",
      );
      if (!next) return null;
      const now = new Date().toISOString();
      this.db.run(`UPDATE tasks SET status = 'running', updated_at = ? WHERE id = ?`, [now, next.id]);
      return this.findById(next.id as string)!;
    });
  }

  complete(id: string, resultJson: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE tasks SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?`,
      [resultJson, now, id],
    );
  }

  fail(id: string, error: string): void {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE tasks SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
      [error, now, id],
    );
  }

  /** Reset any tasks stuck in 'running' (e.g. after server crash) back to 'pending' */
  resetStuck(): number {
    const now = new Date().toISOString();
    this.db.run(`UPDATE tasks SET status = 'pending', updated_at = ? WHERE status = 'running'`, [now]);
    return (this.db.get<{ count: number }>('SELECT changes() as count') ?? { count: 0 }).count;
  }
}
```

**Step 4: Run all tests**

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS (16 tests).

**Step 5: Commit**

```bash
git add src/repositories/tasks.ts tests/db.test.ts
git commit -m "feat: add TaskRepo with atomic claim, complete, fail, and stuck-reset"
```

---

## Phase 2: Task Worker

### Task 7: Worker loop

**Files:**
- Create: `src/worker.ts`
- Create: `tests/worker.test.ts`

The worker polls the tasks table, runs tailoring jobs, and writes results back. It uses the existing `runTailorWorkflow()`, `analyzeGapWithAI()`, `scoreTailoredOutput()`, and `regenerateResumeSection()` service functions.

**Step 1: Write failing tests**

Create `tests/worker.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWorker } from '../src/worker.js';
import { createSqliteAdapter } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrations.js';
import { WorkspaceRepo } from '../src/repositories/workspaces.js';
import { JobRepo } from '../src/repositories/jobs.js';
import { TaskRepo } from '../src/repositories/tasks.js';
import { DocumentRepo } from '../src/repositories/documents.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-worker-'));
  const db = createSqliteAdapter(join(dir, 'test.db'));
  runMigrations(db);
  return { db, cleanup: () => { db.close(); rmSync(dir, { recursive: true }); } };
}

describe('createWorker', () => {
  it('processes a tailor task and marks it completed', async () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = new WorkspaceRepo(db).create({ name: 'WS', sourceResume: '# Matt', sourceBio: 'bio' });
      const job = new JobRepo(db).create({ workspaceId: ws.id, company: 'Acme', jd: 'Build things' });
      const taskRepo = new TaskRepo(db);
      const task = taskRepo.create({
        workspaceId: ws.id, jobId: job.id, type: 'tailor',
        inputJson: JSON.stringify({ resume: '# Matt', bio: 'bio', company: 'Acme', jobDescription: 'Build things' }),
      });

      const mockRun = vi.fn().mockResolvedValue({
        output: { resume: '# Tailored Matt', coverLetter: 'Dear Hiring Manager' },
      });

      const worker = createWorker(db, { runTailor: mockRun });
      await worker.processOne();

      expect(mockRun).toHaveBeenCalledOnce();
      const updated = taskRepo.findById(task.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.resultJson).toBeTruthy();

      const docRepo = new DocumentRepo(db);
      expect(docRepo.findLatest(job.id, 'resume')?.markdown).toBe('# Tailored Matt');
      expect(docRepo.findLatest(job.id, 'cover')?.markdown).toBe('Dear Hiring Manager');
    } finally {
      cleanup();
    }
  });

  it('marks task failed when runTailor throws', async () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = new WorkspaceRepo(db).create({ name: 'WS' });
      const job = new JobRepo(db).create({ workspaceId: ws.id, company: 'X' });
      const taskRepo = new TaskRepo(db);
      const task = taskRepo.create({
        workspaceId: ws.id, jobId: job.id, type: 'tailor',
        inputJson: JSON.stringify({}),
      });

      const worker = createWorker(db, {
        runTailor: vi.fn().mockRejectedValue(new Error('API timeout')),
      });
      await worker.processOne();

      const updated = taskRepo.findById(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toContain('API timeout');
    } finally {
      cleanup();
    }
  });

  it('returns false from processOne when queue is empty', async () => {
    const { db, cleanup } = makeTempDb();
    try {
      const worker = createWorker(db, { runTailor: vi.fn() });
      const result = await worker.processOne();
      expect(result).toBe(false);
    } finally {
      cleanup();
    }
  });
});
```

**Step 2: Run to verify they fail**

```bash
npx vitest run tests/worker.test.ts
```

**Step 3: Create the worker**

Create `src/worker.ts`:
```typescript
import type { DatabaseAdapter } from './db/adapter.js';
import { TaskRepo } from './repositories/tasks.js';
import { DocumentRepo } from './repositories/documents.js';
import type { TailorInput } from './types/index.js';

export interface WorkerDeps {
  runTailor: (input: TailorInput) => Promise<{ output: { resume: string; coverLetter: string } }>;
}

export interface Worker {
  /** Process the next pending task. Returns true if a task was processed, false if queue was empty. */
  processOne(): Promise<boolean>;
  /** Start a polling loop. Call the returned stop() function to halt. */
  start(intervalMs?: number): { stop: () => void };
}

export function createWorker(db: DatabaseAdapter, deps: WorkerDeps): Worker {
  const taskRepo = new TaskRepo(db);
  const docRepo = new DocumentRepo(db);

  async function processOne(): Promise<boolean> {
    const task = taskRepo.claimNext();
    if (!task) return false;

    try {
      if (task.type === 'tailor') {
        const input = JSON.parse(task.inputJson) as TailorInput;
        const result = await deps.runTailor(input);
        docRepo.save({ jobId: task.jobId, docType: 'resume', markdown: result.output.resume });
        docRepo.save({ jobId: task.jobId, docType: 'cover', markdown: result.output.coverLetter });
        taskRepo.complete(task.id, JSON.stringify(result));
      } else {
        taskRepo.fail(task.id, `Unknown task type: ${task.type}`);
      }
    } catch (err) {
      taskRepo.fail(task.id, (err as Error).message ?? String(err));
    }

    return true;
  }

  function start(intervalMs = 2000): { stop: () => void } {
    let running = true;
    async function loop() {
      while (running) {
        await processOne();
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
    loop().catch(console.error);
    return { stop: () => { running = false; } };
  }

  return { processOne, start };
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/worker.test.ts
```

Expected: PASS (3 tests).

**Step 5: Run all tests**

```bash
npm test
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/worker.ts tests/worker.test.ts
git commit -m "feat: add task worker with processOne loop and tailor task handling"
```

---

### Task 8: Wire database and worker into server startup

**Files:**
- Create: `src/db/instance.ts`
- Modify: `src/server.ts` (startup section only)

**Step 1: Create the singleton database module**

Create `src/db/instance.ts`:
```typescript
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { createSqliteAdapter } from './sqlite.js';
import { runMigrations } from './migrations.js';
import type { DatabaseAdapter } from './adapter.js';

let _db: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (!_db) {
    const dir = join(homedir(), '.well-tailored');
    mkdirSync(dir, { recursive: true });
    _db = createSqliteAdapter(join(dir, 'well-tailored.db'));
    runMigrations(_db);
  }
  return _db;
}
```

**Step 2: Find where the server starts listening in `src/server.ts`**

Look for `server.listen(` in `src/server.ts`. Add the following immediately before that line:

```typescript
// --- DB + Worker startup ---
import { getDb } from './db/instance.js';
import { createWorker } from './worker.js';
import { runTailorWorkflow } from './services/runs.js';
import { TaskRepo } from './repositories/tasks.js';

const db = getDb();
// Reset any tasks that were mid-flight when server last stopped
new TaskRepo(db).resetStuck();
const worker = createWorker(db, {
  runTailor: (input) => runTailorWorkflow({ input }),
});
const { stop: stopWorker } = worker.start(2000);

process.on('SIGTERM', () => { stopWorker(); process.exit(0); });
process.on('SIGINT',  () => { stopWorker(); process.exit(0); });
// --- end DB + Worker startup ---
```

(The `import` statements go at the top of the file with the existing imports.)

**Step 3: Start the server and verify it boots without errors**

```bash
npm run serve
```

Expected: server starts on port 4312, no errors, `well-tailored.db` created in `~/.well-tailored/`.

```bash
ls ~/.well-tailored/well-tailored.db
```

Expected: file exists.

Stop the server with Ctrl-C.

**Step 4: Commit**

```bash
git add src/db/instance.ts src/server.ts
git commit -m "feat: wire database and task worker into server startup with stuck-task recovery"
```

---

## Phase 3: New REST API Endpoints

### Task 9: Workspace and jobs endpoints

**Files:**
- Modify: `src/server.ts` (add new route handlers)

Add the following route handlers to `src/server.ts`. Find the block where routes are handled (the large `if/else if` chain on `pathname`) and add these cases:

**Step 1: Add workspace routes**

```typescript
// GET /api/workspaces
if (method === 'GET' && pathname === '/api/workspaces') {
  const workspaceRepo = new WorkspaceRepo(db);
  return sendJson(res, 200, { workspaces: workspaceRepo.list() });
}

// POST /api/workspaces
if (method === 'POST' && pathname === '/api/workspaces') {
  const body = await readJson<{ name: string; sourceResume?: string; sourceBio?: string }>(req);
  const workspaceRepo = new WorkspaceRepo(db);
  const ws = workspaceRepo.create({ name: body.name ?? 'Untitled', ...body });
  return sendJson(res, 201, ws);
}

// GET /api/workspaces/:id
const wsMatch = pathname.match(/^\/api\/workspaces\/([a-z0-9-]+)$/);
if (method === 'GET' && wsMatch) {
  const workspaceRepo = new WorkspaceRepo(db);
  const jobRepo = new JobRepo(db);
  const ws = workspaceRepo.findById(wsMatch[1]);
  if (!ws) return sendJson(res, 404, { error: 'Not found' });
  const jobs = jobRepo.listByWorkspace(ws.id);
  return sendJson(res, 200, { ...ws, jobs });
}

// PATCH /api/workspaces/:id
if (method === 'PATCH' && wsMatch) {
  const body = await readJson<Record<string, unknown>>(req);
  const workspaceRepo = new WorkspaceRepo(db);
  const updated = workspaceRepo.update(wsMatch[1], body as never);
  if (!updated) return sendJson(res, 404, { error: 'Not found' });
  return sendJson(res, 200, updated);
}

// DELETE /api/workspaces/:id
if (method === 'DELETE' && wsMatch) {
  const workspaceRepo = new WorkspaceRepo(db);
  workspaceRepo.delete(wsMatch[1]);
  return sendJson(res, 204, null);
}
```

**Step 2: Add job routes**

```typescript
// POST /api/workspaces/:id/jobs
const wsJobsMatch = pathname.match(/^\/api\/workspaces\/([a-z0-9-]+)\/jobs$/);
if (method === 'POST' && wsJobsMatch) {
  const body = await readJson<{ company: string; title?: string; jd?: string; stage?: string }>(req);
  const jobRepo = new JobRepo(db);
  const job = jobRepo.create({ workspaceId: wsJobsMatch[1], ...body });
  return sendJson(res, 201, job);
}

// PATCH /api/workspaces/:wsId/jobs/:jobId
const wsJobMatch = pathname.match(/^\/api\/workspaces\/([a-z0-9-]+)\/jobs\/([a-z0-9-]+)$/);
if (method === 'PATCH' && wsJobMatch) {
  const body = await readJson<Record<string, unknown>>(req);
  const jobRepo = new JobRepo(db);
  const updated = jobRepo.update(wsJobMatch[2], body as never);
  if (!updated) return sendJson(res, 404, { error: 'Not found' });
  return sendJson(res, 200, updated);
}

// DELETE /api/workspaces/:wsId/jobs/:jobId
if (method === 'DELETE' && wsJobMatch) {
  const jobRepo = new JobRepo(db);
  jobRepo.delete(wsJobMatch[2]);
  return sendJson(res, 204, null);
}
```

**Step 3: Verify with curl**

Start server: `npm run serve`

```bash
# Create workspace
curl -s -X POST http://localhost:4312/api/workspaces \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test WS"}' | jq .

# List workspaces
curl -s http://localhost:4312/api/workspaces | jq .
```

Expected: workspace created and listed with an id.

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: add REST endpoints for workspace and job CRUD"
```

---

### Task 10: Document and task endpoints

**Files:**
- Modify: `src/server.ts`

**Step 1: Add document endpoints**

```typescript
// GET /api/jobs/:jobId/documents/:type
const docMatch = pathname.match(/^\/api\/jobs\/([a-z0-9-]+)\/documents\/(resume|cover)$/);
if (method === 'GET' && docMatch) {
  const docRepo = new DocumentRepo(db);
  const doc = docRepo.findLatest(docMatch[1], docMatch[2] as 'resume' | 'cover');
  if (!doc) return sendJson(res, 404, { error: 'Not found' });
  return sendJson(res, 200, doc);
}

// PUT /api/jobs/:jobId/documents/:type
if (method === 'PUT' && docMatch) {
  const body = await readJson<{ markdown: string; editorDataJson?: string }>(req);
  const docRepo = new DocumentRepo(db);
  const doc = docRepo.save({ jobId: docMatch[1], docType: docMatch[2] as 'resume' | 'cover', ...body });
  return sendJson(res, 200, doc);
}

// GET /api/jobs/:jobId/documents/:type/versions
const versionsMatch = pathname.match(/^\/api\/jobs\/([a-z0-9-]+)\/documents\/(resume|cover)\/versions$/);
if (method === 'GET' && versionsMatch) {
  const docRepo = new DocumentRepo(db);
  const versions = docRepo.listVersions(versionsMatch[1], versionsMatch[2] as 'resume' | 'cover');
  return sendJson(res, 200, { versions });
}
```

**Step 2: Add task endpoints**

```typescript
// GET /api/tasks?workspaceId=xxx
if (method === 'GET' && pathname === '/api/tasks') {
  const workspaceId = url.searchParams.get('workspaceId');
  if (!workspaceId) return sendJson(res, 400, { error: 'workspaceId required' });
  const taskRepo = new TaskRepo(db);
  return sendJson(res, 200, { tasks: taskRepo.listByWorkspace(workspaceId) });
}

// POST /api/tasks
if (method === 'POST' && pathname === '/api/tasks') {
  const body = await readJson<{ workspaceId: string; jobId: string; type: string; input: unknown }>(req);
  const taskRepo = new TaskRepo(db);
  const task = taskRepo.create({
    workspaceId: body.workspaceId,
    jobId: body.jobId,
    type: body.type as 'tailor' | 'score' | 'gap' | 'regenerate-section',
    inputJson: JSON.stringify(body.input),
  });
  return sendJson(res, 201, task);
}

// GET /api/tasks/:id
const taskMatch = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)$/);
if (method === 'GET' && taskMatch) {
  const taskRepo = new TaskRepo(db);
  const task = taskRepo.findById(taskMatch[1]);
  if (!task) return sendJson(res, 404, { error: 'Not found' });
  return sendJson(res, 200, task);
}
```

**Step 3: Verify**

```bash
npm run serve
# create a workspace and job first, then:
WS_ID=$(curl -s -X POST http://localhost:4312/api/workspaces -H 'Content-Type: application/json' -d '{"name":"WS"}' | jq -r .id)
JOB_ID=$(curl -s -X POST http://localhost:4312/api/workspaces/$WS_ID/jobs -H 'Content-Type: application/json' -d '{"company":"Acme"}' | jq -r .id)
curl -s -X POST http://localhost:4312/api/tasks -H 'Content-Type: application/json' \
  -d "{\"workspaceId\":\"$WS_ID\",\"jobId\":\"$JOB_ID\",\"type\":\"tailor\",\"input\":{}}" | jq .
curl -s "http://localhost:4312/api/tasks?workspaceId=$WS_ID" | jq .
```

Expected: task created with `status: "pending"`, visible in list.

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: add document versioning and task queue REST endpoints"
```

---

### Task 11: Migrate existing JSON workspaces on startup

**Files:**
- Create: `src/services/migrate-workspaces.ts`
- Modify: `src/db/instance.ts`

**Step 1: Create migration service**

Create `src/services/migrate-workspaces.ts`:
```typescript
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { DatabaseAdapter } from '../db/adapter.js';
import { WorkspaceRepo } from '../repositories/workspaces.js';
import { JobRepo } from '../repositories/jobs.js';
import { DocumentRepo } from '../repositories/documents.js';
import type { SavedWorkspace } from '../types/index.js';

const WORKSPACES_DIR = join(homedir(), '.well-tailored', 'workspaces');
const MIGRATED_DIR = join(WORKSPACES_DIR, 'migrated');

export function migrateJsonWorkspaces(db: DatabaseAdapter): number {
  if (!existsSync(WORKSPACES_DIR)) return 0;

  const files = readdirSync(WORKSPACES_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return 0;

  mkdirSync(MIGRATED_DIR, { recursive: true });
  const wsRepo = new WorkspaceRepo(db);
  const jobRepo = new JobRepo(db);
  const docRepo = new DocumentRepo(db);

  let count = 0;
  for (const file of files) {
    const filePath = join(WORKSPACES_DIR, file);
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as SavedWorkspace;
      const snap = raw.snapshot;

      const ws = wsRepo.create({
        name: raw.name,
        sourceResume: snap.resume ?? null,
        sourceBio: snap.bio ?? null,
        sourceCoverLetter: snap.baseCoverLetter ?? null,
        sourceSupplemental: snap.resumeSupplemental ?? null,
        themeJson: snap.theme ? JSON.stringify(snap.theme) : null,
        agentConfigJson: snap.agents ? JSON.stringify(snap.agents) : null,
      });

      for (const job of snap.jobs ?? []) {
        const dbJob = jobRepo.create({
          workspaceId: ws.id,
          company: job.company,
          title: job.title,
          jd: job.jd,
          stage: job.stage ?? 'wishlist',
          source: job.source ?? 'manual',
        });
        if (job.result?.output?.resume) {
          docRepo.save({ jobId: dbJob.id, docType: 'resume', markdown: job.result.output.resume });
        }
        if (job.result?.output?.coverLetter) {
          docRepo.save({ jobId: dbJob.id, docType: 'cover', markdown: job.result.output.coverLetter });
        }
      }

      renameSync(filePath, join(MIGRATED_DIR, file));
      count++;
    } catch (err) {
      console.warn(`[migrate] Skipping ${file}: ${(err as Error).message}`);
    }
  }

  if (count > 0) {
    console.log(`[migrate] Migrated ${count} workspace(s) to SQLite. Originals moved to ${MIGRATED_DIR}`);
  }

  return count;
}
```

**Step 2: Call migration in `src/db/instance.ts`**

Add after `runMigrations(_db)`:
```typescript
import { migrateJsonWorkspaces } from '../services/migrate-workspaces.js';
// ...
runMigrations(_db);
migrateJsonWorkspaces(_db);
```

**Step 3: Verify**

If you have existing workspace JSON files, start the server and check they appear in the API:

```bash
npm run serve
curl -s http://localhost:4312/api/workspaces | jq '.workspaces | length'
```

**Step 4: Commit**

```bash
git add src/services/migrate-workspaces.ts src/db/instance.ts
git commit -m "feat: auto-migrate legacy JSON workspaces to SQLite on startup"
```

---

## Phase 4: Frontend State Updates

### Task 12: Add new API client methods

**Files:**
- Modify: `web/src/api/client.ts`

**Step 1: Add types and functions for new endpoints**

Append to `web/src/api/client.ts`:

```typescript
// ---------------------------------------------------------------------------
// New DB-backed workspace / job / document / task endpoints
// ---------------------------------------------------------------------------

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  sourceResume: string | null;
  sourceBio: string | null;
  sourceCoverLetter: string | null;
  sourceSupplemental: string | null;
  agentConfigJson: string | null;
  themeJson: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: JobRecord[];
}

export interface JobRecord {
  id: string;
  workspaceId: string;
  company: string;
  title: string | null;
  jd: string | null;
  stage: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  jobId: string;
  docType: 'resume' | 'cover';
  markdown: string;
  editorDataJson: string | null;
  version: number;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  workspaceId: string;
  jobId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputJson: string;
  resultJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listWorkspacesV2(): Promise<{ workspaces: WorkspaceSummary[] }> {
  return request<{ workspaces: WorkspaceSummary[] }>('/api/workspaces');
}

export function getWorkspace(id: string): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>(`/api/workspaces/${encodeURIComponent(id)}`);
}

export function createWorkspace(input: { name: string }): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateWorkspace(id: string, patch: Partial<WorkspaceDetail>): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function createJob(workspaceId: string, input: { company: string; title?: string; jd?: string }): Promise<JobRecord> {
  return request<JobRecord>(`/api/workspaces/${encodeURIComponent(workspaceId)}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateJob(workspaceId: string, jobId: string, patch: Partial<JobRecord>): Promise<JobRecord> {
  return request<JobRecord>(`/api/workspaces/${encodeURIComponent(workspaceId)}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function getDocument(jobId: string, docType: 'resume' | 'cover'): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/api/jobs/${encodeURIComponent(jobId)}/documents/${docType}`);
}

export function saveDocument(jobId: string, docType: 'resume' | 'cover', markdown: string, editorDataJson?: string): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/api/jobs/${encodeURIComponent(jobId)}/documents/${docType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, editorDataJson }),
  });
}

export function listTasks(workspaceId: string): Promise<{ tasks: TaskRecord[] }> {
  return request<{ tasks: TaskRecord[] }>(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function enqueueTask(input: { workspaceId: string; jobId: string; type: string; input: unknown }): Promise<TaskRecord> {
  return request<TaskRecord>('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getTask(id: string): Promise<TaskRecord> {
  return request<TaskRecord>(`/api/tasks/${encodeURIComponent(id)}`);
}
```

**Step 2: Run typecheck**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat: add typed API client methods for workspaces, jobs, documents, and tasks"
```

---

### Task 13: Task polling hook

**Files:**
- Create: `web/src/hooks/useTaskPolling.ts`

This hook polls `GET /api/tasks?workspaceId=...` every 2 seconds whenever there are pending or running tasks, and fires a callback when a task completes.

**Step 1: Create the hook**

Create `web/src/hooks/useTaskPolling.ts`:
```typescript
import { useEffect, useRef } from 'react';
import { listTasks, type TaskRecord } from '../api/client.js';

interface UseTaskPollingOptions {
  workspaceId: string | null;
  onTaskCompleted: (task: TaskRecord) => void;
  onTaskFailed: (task: TaskRecord) => void;
  intervalMs?: number;
}

export function useTaskPolling({ workspaceId, onTaskCompleted, onTaskFailed, intervalMs = 2000 }: UseTaskPollingOptions) {
  const knownTasksRef = useRef<Map<string, TaskRecord>>(new Map());

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const { tasks } = await listTasks(workspaceId!);
        const known = knownTasksRef.current;

        for (const task of tasks) {
          const prev = known.get(task.id);
          if (prev && prev.status !== task.status) {
            if (task.status === 'completed') onTaskCompleted(task);
            if (task.status === 'failed') onTaskFailed(task);
          }
          known.set(task.id, task);
        }

        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'running');
        if (hasActive && !cancelled) {
          setTimeout(poll, intervalMs);
        } else if (!cancelled) {
          // slow poll when idle
          setTimeout(poll, intervalMs * 5);
        }
      } catch {
        if (!cancelled) setTimeout(poll, intervalMs * 5);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [workspaceId, onTaskCompleted, onTaskFailed, intervalMs]);
}
```

**Step 2: Run typecheck**

```bash
cd web && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add web/src/hooks/useTaskPolling.ts
git commit -m "feat: add useTaskPolling hook for adaptive backend task polling"
```

---

## Phase 5: Two-Column Layout Redesign

### Task 14: Replace three-panel layout with two-column layout

**Files:**
- Modify: `web/src/App.tsx`

This is the main layout change. Replace the `IconRail + PanelContainer + main` triple with a simple two-column layout: left sidebar (fixed-ish, resizable) and right editor area.

**Step 1: Update `AppShell` in `web/src/App.tsx`**

Replace the inner layout div (the one with `IconRail`, `PanelContainer`, and `main`) with:

```tsx
<div className={`flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-2 ${isDesktop ? 'flex-row overflow-hidden' : 'flex-col overflow-auto'}`}>
  {isDesktop ? (
    <PanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
      {/* Left sidebar */}
      <Panel defaultSize={22} minSize={18} maxSize={35} className="min-h-0 min-w-0 flex flex-col">
        <LeftSidebar />
      </Panel>

      <PanelResizeHandle className="group relative flex items-center justify-center bg-transparent mx-1 w-4">
        <div className="h-24 w-[3px] rounded-full bg-border/90 transition-colors duration-200 group-hover:bg-primary/35" />
      </PanelResizeHandle>

      {/* Right editor/preview column */}
      <Panel defaultSize={78} minSize={50} className="min-h-0 min-w-0 flex flex-col">
        <RightColumn />
      </Panel>
    </PanelGroup>
  ) : (
    <>
      <LeftSidebar />
      <RightColumn />
    </>
  )}
</div>
```

Remove the `IconRail` and `PanelContainer` imports and usages (they're replaced by `LeftSidebar`).

**Step 2: Create placeholder components (to be filled in subsequent tasks)**

Create `web/src/features/layout/LeftSidebar.tsx`:
```tsx
export function LeftSidebar() {
  return (
    <aside className="flex flex-col gap-3 overflow-y-auto h-full pr-1">
      {/* Score card, keywords, job list go here */}
      <div className="text-muted-foreground text-sm p-4">Sidebar (coming soon)</div>
    </aside>
  );
}
```

Create `web/src/features/layout/RightColumn.tsx`:
```tsx
import { EditorColumn } from '../editor/EditorColumn.js';
import { PreviewColumn } from '../preview/PreviewColumn.js';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

export function RightColumn() {
  return (
    <section className="panel-surface flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.65rem] min-h-0">
      <div className="flex flex-1 min-h-0 overflow-hidden px-3 pb-3">
        <div className="paper-pane flex min-h-0 flex-1 overflow-hidden rounded-[1.45rem]">
          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0">
            <Panel defaultSize={50} minSize={30} className="min-h-0 min-w-0 flex">
              <div className="h-full min-h-0 flex w-full">
                <EditorColumn />
              </div>
            </Panel>
            <PanelResizeHandle className="group relative flex items-center justify-center bg-transparent mx-1 w-4">
              <div className="h-24 w-[3px] rounded-full bg-border/90 transition-colors duration-200 group-hover:bg-primary/35" />
            </PanelResizeHandle>
            <Panel defaultSize={50} minSize={30} className="min-h-0 min-w-0 flex">
              <div className="h-full min-h-0 flex w-full">
                <PreviewColumn />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Start the Vite dev server and verify layout renders**

```bash
npm run serve &
npm run web
```

Navigate to `http://localhost:5173`. Expected: two-column layout with a narrow left sidebar placeholder and the existing editor/preview in the right column.

**Step 4: Commit**

```bash
git add web/src/App.tsx web/src/features/layout/LeftSidebar.tsx web/src/features/layout/RightColumn.tsx
git commit -m "feat: replace three-panel layout with two-column sidebar + editor"
```

---

### Task 15: Left sidebar — score card and AI suggestions

**Files:**
- Modify: `web/src/features/layout/LeftSidebar.tsx`

Move the existing `ScoreCards` component and add the AI suggestions text (gap narrative + scorecard notes) into the sidebar.

**Step 1: Find what ScoreCards currently renders**

Read `web/src/features/scores/ScoreCards.tsx`. Understand its current markup and props.

**Step 2: Update LeftSidebar to include scores and suggestions**

```tsx
import { useContext } from 'react';
import { WorkspaceContext } from '../../context.js';
import { ScoreCards } from '../scores/ScoreCards.js';
import { JobList } from '../jobs/JobList.js';
import { KeywordsPanel } from './KeywordsPanel.js';

export function LeftSidebar() {
  const { state } = useContext(WorkspaceContext);
  const activeJob = state.jobs.find(j => j.id === state.activeJobId);
  const gapNarrative = activeJob?.result?.gapAnalysis?.narrative;
  const scorecardNotes = activeJob?.result?.scorecard?.notes ?? [];

  return (
    <aside className="flex flex-col gap-3 overflow-y-auto h-full pr-1 py-1">
      <ScoreCards />

      {(gapNarrative || scorecardNotes.length > 0) && (
        <div className="panel-surface rounded-2xl px-4 py-3 text-sm text-muted-foreground space-y-2">
          {gapNarrative && <p>{gapNarrative}</p>}
          {scorecardNotes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
        </div>
      )}

      <KeywordsPanel />
      <JobList />
    </aside>
  );
}
```

**Step 3: Create KeywordsPanel placeholder**

Create `web/src/features/layout/KeywordsPanel.tsx`:
```tsx
import { useContext } from 'react';
import { WorkspaceContext } from '../../context.js';

export function KeywordsPanel() {
  const { state } = useContext(WorkspaceContext);
  const activeJob = state.jobs.find(j => j.id === state.activeJobId);
  const gap = activeJob?.result?.gapAnalysis;
  if (!gap) return null;

  const matched = gap.matchedKeywords ?? gap.matched ?? [];
  const missing = gap.missingKeywords ?? gap.missing ?? [];
  const partial = gap.partialMatches ?? gap.partial ?? [];
  const total = matched.length + missing.length + partial.length;

  return (
    <div className="panel-surface rounded-2xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>Keywords</span>
        <span className="text-muted-foreground">{matched.length}/{total}</span>
      </div>

      {/* Red-yellow-green bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {missing.length > 0 && (
          <div className="bg-destructive" style={{ width: `${(missing.length / total) * 100}%` }} />
        )}
        {partial.length > 0 && (
          <div className="bg-yellow-400" style={{ width: `${(partial.length / total) * 100}%` }} />
        )}
        {matched.length > 0 && (
          <div className="bg-green-500" style={{ width: `${(matched.length / total) * 100}%` }} />
        )}
      </div>

      {/* Pill groups */}
      {missing.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Missing</p>
          <div className="flex flex-wrap gap-1">
            {missing.map((kw, i) => (
              <span key={i} className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                {typeof kw === 'string' ? kw : kw.term}
              </span>
            ))}
          </div>
        </div>
      )}

      {partial.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Partial</p>
          <div className="flex flex-wrap gap-1">
            {partial.map((kw, i) => (
              <span key={i} className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                {typeof kw === 'string' ? kw : kw.term}
              </span>
            ))}
          </div>
        </div>
      )}

      {matched.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Represented</p>
          <div className="flex flex-wrap gap-1">
            {matched.map((kw, i) => (
              <span key={i} className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                {typeof kw === 'string' ? kw : kw.term}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run typecheck**

```bash
cd web && npx tsc --noEmit
```

**Step 5: Verify visually**

Check the dev server. The left sidebar should now show score card, AI suggestions (when a tailored job is selected), and the keywords panel.

**Step 6: Commit**

```bash
git add web/src/features/layout/LeftSidebar.tsx web/src/features/layout/KeywordsPanel.tsx
git commit -m "feat: add score cards, AI suggestions, and keyword pills to left sidebar"
```

---

### Task 16: Left sidebar — job list

**Files:**
- Modify: `web/src/features/layout/LeftSidebar.tsx`

The job list is already in `web/src/features/jobs/JobList.tsx` (or similar — read the existing component). It just needs to be included in the sidebar. The goal is that the whole sidebar scrolls as a unit, so the job list doesn't get its own fixed-height sub-region.

**Step 1: Read the existing job list component**

Read `web/src/features/jobs/` to find the current job list component and understand what CSS classes control its height.

**Step 2: Remove any fixed-height constraints from the job list component**

Find `max-h-`, `h-`, `overflow-y-auto` classes on the job list's outer wrapper and remove them — the sidebar's own scroll handles this now.

**Step 3: Verify the sidebar scrolls properly**

With many jobs loaded, scroll the left sidebar. Expected: the entire sidebar (scores + keywords + job list) scrolls as one.

**Step 4: Commit**

```bash
git add web/src/features/jobs/ web/src/features/layout/LeftSidebar.tsx
git commit -m "feat: integrate job list into scrollable left sidebar"
```

---

### Task 17: Move settings/prompts/sources/config to top bar

**Files:**
- Modify: `web/src/features/workspace/TopBar.tsx`
- Read first: `web/src/features/layout/IconRail.tsx`, `web/src/features/layout/PanelContainer.tsx`

The `IconRail` and `PanelContainer` currently host settings, prompts, sources, and config behind icon buttons. These need a new home in the top bar now that the icon rail is gone.

**Step 1: Read the existing icon rail and panel container**

Read both files to understand what panels exist and how they're toggled.

**Step 2: Add icon buttons to TopBar for each displaced panel**

In `web/src/features/workspace/TopBar.tsx`, add icon buttons (matching the existing style) for each panel: Sources, Prompts, Config. Clicking them dispatches `SET_ACTIVE_PANEL` the same way the icon rail did.

**Step 3: Delete `IconRail` and `PanelContainer` from the layout and codebase**

Remove the import from `App.tsx`. Delete the component files if they have no other usages.

**Step 4: Run typecheck and verify no dead imports**

```bash
cd web && npx tsc --noEmit
```

**Step 5: Verify panels still open/close correctly**

Click each icon in the top bar. The corresponding panel should appear (it can slide in over the right column, or open as a drawer/modal — keep whatever mechanism `PanelContainer` used).

**Step 6: Commit**

```bash
git add web/src/ 
git commit -m "feat: move settings/prompts/sources/config to top bar, remove icon rail"
```

---

## Phase 6: Wire it together

### Task 18: Replace tailoring fire-and-forget with enqueue + poll

**Files:**
- Modify: `web/src/hooks/useTailorQueue.ts`
- Modify: `web/src/App.tsx`

**Step 1: Read `useTailorQueue.ts`**

Understand how it currently dispatches tailoring runs.

**Step 2: Update `useTailorQueue` to use `enqueueTask` instead of `runManualTailor`**

Replace the `runManualTailor` call with:
```typescript
const task = await enqueueTask({
  workspaceId: state.activeWorkspaceId!,
  jobId: job.id,
  type: 'tailor',
  input: { resume, bio, company, jobTitle, jobDescription, baseCoverLetter, resumeSupplemental },
});
dispatch({ type: 'SET_TAILOR_RUNNING', id: job.id });
// task result comes via useTaskPolling callback
```

**Step 3: Wire `useTaskPolling` in `App.tsx`**

In the `App` component, add:
```typescript
useTaskPolling({
  workspaceId: state.activeWorkspaceId,
  onTaskCompleted: async (task) => {
    if (task.type === 'tailor') {
      const result = JSON.parse(task.resultJson!);
      dispatch({ type: 'UPDATE_JOB', id: task.jobId, patch: { status: 'tailored', result } });
      dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
    }
  },
  onTaskFailed: (task) => {
    dispatch({ type: 'UPDATE_JOB', id: task.jobId, patch: { status: 'error' } });
    dispatch({ type: 'SET_TAILOR_RUNNING', id: null });
  },
});
```

**Step 4: Test end-to-end**

1. Start server: `npm run serve`
2. Start web: `npm run web`
3. Open browser, select a job, trigger tailoring
4. Expected: tailoring enqueues (job shows "tailoring" status), page can be refreshed while it runs, and when the worker completes, the job shows the result

**Step 5: Commit**

```bash
git add web/src/hooks/useTailorQueue.ts web/src/App.tsx
git commit -m "feat: replace fire-and-forget tailoring with persistent task queue"
```

---

### Task 19: Final typecheck, tests, and cleanup

**Step 1: Run full test suite**

```bash
npm test
```

Expected: all pass.

**Step 2: Run typecheck for both backend and frontend**

```bash
npm run typecheck
cd web && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Lint**

```bash
npm run lint
```

Fix any warnings.

**Step 4: Remove dead code**

- Check if `src/services/workspace-store.ts` can be deleted (it's replaced by the database repos). Keep it until all references in `src/server.ts` old endpoints are removed.
- Remove the old `/api/runs/manual`, `/api/runs/huntr`, `/api/workspaces/save` endpoints from `src/server.ts` once the new ones are confirmed working.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove legacy workspace-store and deprecated run endpoints"
```

---

## Quick Reference

### Key files
- `src/db/` — database adapter, migrations, singleton
- `src/repositories/` — workspaces, jobs, documents, tasks
- `src/worker.ts` — task processing loop
- `src/services/migrate-workspaces.ts` — one-time JSON migration
- `web/src/features/layout/LeftSidebar.tsx` — new left column
- `web/src/features/layout/KeywordsPanel.tsx` — keyword pills
- `web/src/features/layout/RightColumn.tsx` — editor + preview wrapper
- `web/src/hooks/useTaskPolling.ts` — polls task queue

### Test commands
```bash
npm test                              # all tests
npx vitest run tests/db.test.ts      # DB layer only
npx vitest run tests/worker.test.ts  # worker only
npm run typecheck                    # backend types
cd web && npx tsc --noEmit          # frontend types
```
