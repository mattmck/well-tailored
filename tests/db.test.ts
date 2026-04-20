import { describe, it, expect } from 'vitest';
import { createSqliteAdapter } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrations.js';
import { WorkspaceRepo } from '../src/repositories/workspaces.js';
import { JobRepo } from '../src/repositories/jobs.js';
import { DocumentRepo } from '../src/repositories/documents.js';
import { TaskRepo } from '../src/repositories/tasks.js';
import type { DatabaseAdapter } from '../src/db/adapter.js';
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
      expect(tables).toContain('job_scores');
      expect(tables).toContain('job_gap_analyses');
      expect(tables).toContain('gap_keywords');
      expect(tables).toContain('resume_headers');
      expect(tables).toContain('resume_sections');
      expect(tables).toContain('resume_job_entries');
      expect(tables).toContain('resume_bullets');
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
      const w1 = repo.create({ name: 'First' });
      repo.create({ name: 'Second' });
      // Explicitly touch 'First' so it has the most-recent updatedAt
      repo.update(w1.id, { name: 'First' });
      const list = repo.list();
      expect(list[0].name).toBe('First');
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

  it('stores Huntr list-added timestamps', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = makeWorkspace(db);
      const repo = new JobRepo(db);
      const job = repo.create({
        workspaceId: ws.id,
        company: 'X',
        listAddedAt: '2026-04-18T12:00:00.000Z',
      });
      expect(repo.findById(job.id)?.listAddedAt).toBe('2026-04-18T12:00:00.000Z');

      repo.update(job.id, { listAddedAt: '2026-04-19T12:00:00.000Z' });
      expect(repo.findById(job.id)?.listAddedAt).toBe('2026-04-19T12:00:00.000Z');
    } finally {
      cleanup();
    }
  });

  it('updates an existing Huntr job instead of creating a duplicate', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const ws = makeWorkspace(db);
      const repo = new JobRepo(db);
      const first = repo.createOrUpdate({
        workspaceId: ws.id,
        company: 'Acme',
        title: 'Engineer',
        stage: 'wishlist',
        source: 'huntr',
        huntrId: 'huntr-1',
        listAddedAt: '2026-04-18T12:00:00.000Z',
      });
      const second = repo.createOrUpdate({
        workspaceId: ws.id,
        company: 'Acme Updated',
        title: 'Staff Engineer',
        stage: 'interview',
        source: 'huntr',
        huntrId: 'huntr-1',
        listAddedAt: '2026-04-19T12:00:00.000Z',
      });

      expect(second.id).toBe(first.id);
      expect(second.company).toBe('Acme Updated');
      expect(second.stage).toBe('interview');
      expect(second.listAddedAt).toBe('2026-04-19T12:00:00.000Z');
      expect(repo.listByWorkspace(ws.id)).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
});

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
