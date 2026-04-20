import { describe, it, expect } from 'vitest';
import { createSqliteAdapter } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrations.js';
import { WorkspaceRepo } from '../src/repositories/workspaces.js';
import { JobRepo } from '../src/repositories/jobs.js';
import { TaskRepo } from '../src/repositories/tasks.js';
import { ScoreRepo } from '../src/repositories/scores.js';
import { GapRepo } from '../src/repositories/gap.js';
import { ResumeRepo } from '../src/repositories/resume.js';
import type { DatabaseAdapter } from '../src/db/adapter.js';
import type { EvaluatorScorecard } from '../src/types/index.js';
import type { GapAnalysis } from '../src/types/index.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-norm-test-'));
  const path = join(dir, 'test.db');
  const db = createSqliteAdapter(path);
  return { db, cleanup: () => { db.close(); rmSync(dir, { recursive: true }); } };
}

function makeJob(db: DatabaseAdapter) {
  runMigrations(db);
  const ws = new WorkspaceRepo(db).create({ name: 'WS' });
  const job = new JobRepo(db).create({ workspaceId: ws.id, company: 'Acme', title: 'Engineer' });
  return { ws, job };
}

// ── Migrations ────────────────────────────────────────────────────────────

describe('runMigrations — normalized tables', () => {
  it('creates all 8 new tables', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const tables = db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      ).map(r => r.name);
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

  it('is still idempotent after adding new tables', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      expect(() => runMigrations(db)).not.toThrow();
    } finally {
      cleanup();
    }
  });
});

// ── ScoreRepo ─────────────────────────────────────────────────────────────

describe('ScoreRepo', () => {
  const sampleScorecard: EvaluatorScorecard = {
    overall: 82,
    verdict: 'strong_match',
    confidence: 0.9,
    atsCompatibility: 88,
    keywordCoverage: 76,
    notes: ['Good keyword density'],
    blockingIssues: [],
    documents: [],
  };

  it('creates a score and retrieves it', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ScoreRepo(db);
      const row = repo.create({ jobId: job.id, scorecard: sampleScorecard });
      expect(row.jobId).toBe(job.id);
      expect(row.overall).toBe(82);
      expect(row.verdict).toBe('strong_match');
    } finally {
      cleanup();
    }
  });

  it('stores categories as JSON', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ScoreRepo(db);
      const row = repo.create({ jobId: job.id, scorecard: sampleScorecard });
      const cats = JSON.parse(row.categoriesJson!);
      expect(cats.atsCompatibility).toBe(88);
      expect(cats.keywordCoverage).toBe(76);
    } finally {
      cleanup();
    }
  });

  it('findLatestForJob returns most recent score', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ScoreRepo(db);
      repo.create({ jobId: job.id, scorecard: { ...sampleScorecard, overall: 70 } });
      repo.create({ jobId: job.id, scorecard: { ...sampleScorecard, overall: 85 } });
      const latest = repo.findLatestForJob(job.id);
      expect(latest?.overall).toBe(85);
    } finally {
      cleanup();
    }
  });

  it('findLatestForJobs returns latest score per job in one call', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job: firstJob } = makeJob(db);
      const { job: secondJob } = makeJob(db);
      const repo = new ScoreRepo(db);
      repo.create({ jobId: firstJob.id, scorecard: { ...sampleScorecard, overall: 70 } });
      repo.create({ jobId: firstJob.id, scorecard: { ...sampleScorecard, overall: 90 } });
      repo.create({ jobId: secondJob.id, scorecard: { ...sampleScorecard, overall: 81 } });

      const latest = repo.findLatestForJobs([firstJob.id, secondJob.id]);
      expect(latest[firstJob.id]?.overall).toBe(90);
      expect(latest[secondJob.id]?.overall).toBe(81);
    } finally {
      cleanup();
    }
  });

  it('returns null for job with no scores', () => {
    const { db, cleanup } = makeTempDb();
    try {
      makeJob(db); // just to run migrations
      const { job } = makeJob(db);
      const repo = new ScoreRepo(db);
      expect(repo.findLatestForJob(job.id)).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});

// ── GapRepo ───────────────────────────────────────────────────────────────

describe('GapRepo', () => {
  const sampleGap: GapAnalysis = {
    matchedKeywords: [{ term: 'kubernetes', category: 'infrastructure' }],
    missingKeywords: [{ term: 'terraform', category: 'infrastructure' }],
    partialMatches: [{ jdTerm: 'CI/CD', resumeTerm: 'Jenkins', relationship: 'related' }],
    impliedSkills: [],
    experienceRequirements: [],
    overallFit: 'strong',
    narrative: 'Good technical alignment.',
    exactPhrases: [],
    tailoringHints: [],
  };

  it('creates a gap analysis and retrieves it', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new GapRepo(db);
      const row = repo.create({ jobId: job.id, analysis: sampleGap });
      expect(row.jobId).toBe(job.id);
      expect(row.overallFit).toBe('strong');
      expect(row.narrative).toBe('Good technical alignment.');
    } finally {
      cleanup();
    }
  });

  it('saves matched, missing, and partial keywords', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new GapRepo(db);
      const row = repo.create({ jobId: job.id, analysis: sampleGap });
      const keywords = repo.keywordsForAnalysis(row.id);
      expect(keywords).toHaveLength(3);
      const matched = keywords.filter(k => k.status === 'matched');
      const missing = keywords.filter(k => k.status === 'missing');
      const partial = keywords.filter(k => k.status === 'partial');
      expect(matched[0].term).toBe('kubernetes');
      expect(missing[0].term).toBe('terraform');
      expect(partial[0].term).toBe('CI/CD');
    } finally {
      cleanup();
    }
  });

  it('findLatestWithKeywords returns combined result', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new GapRepo(db);
      repo.create({ jobId: job.id, analysis: sampleGap });
      const result = repo.findLatestWithKeywords(job.id);
      expect(result).not.toBeNull();
      expect(result!.keywords).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it('returns null when no gap analysis exists', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new GapRepo(db);
      expect(repo.findLatestWithKeywords(job.id)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

// ── ResumeRepo ────────────────────────────────────────────────────────────

describe('ResumeRepo', () => {
  it('saves and loads a full EditorData round-trip', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ResumeRepo(db);

      repo.saveEditorData(job.id, {
        kind: 'resume',
        header: { name: 'Matt Smith', role: 'SRE', contact: 'matt@example.com', links: 'linkedin.com/in/matt' },
        sections: [
          {
            id: 'sec-summary',
            heading: 'Summary',
            type: 'text',
            content: 'Experienced engineer.',
            items: [],
            jobs: [],
            accepted: true,
          },
          {
            id: 'sec-skills',
            heading: 'Skills',
            type: 'bullets',
            content: '',
            items: [
              { id: 'b1', text: 'Kubernetes' },
              { id: 'b2', text: 'Terraform' },
            ],
            jobs: [],
            accepted: true,
          },
          {
            id: 'sec-exp',
            heading: 'Experience',
            type: 'jobs',
            content: '',
            items: [],
            jobs: [
              {
                id: 'job1',
                title: 'Staff SRE',
                company: 'Tenable',
                location: 'Remote',
                date: '2020–2024',
                bullets: [
                  { id: 'jb1', text: 'Led on-call rotation' },
                  { id: 'jb2', text: 'Reduced MTTR by 40%' },
                ],
              },
            ],
            accepted: true,
          },
        ],
      });

      const loaded = repo.loadEditorData(job.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.header?.name).toBe('Matt Smith');
      expect(loaded!.sections).toHaveLength(3);

      const summary = loaded!.sections.find(s => s.heading === 'Summary')!;
      expect(summary.type).toBe('text');
      expect(summary.content).toBe('Experienced engineer.');

      const skills = loaded!.sections.find(s => s.heading === 'Skills')!;
      expect(skills.type).toBe('bullets');
      expect(skills.items).toHaveLength(2);
      expect(skills.items[0].text).toBe('Kubernetes');

      const exp = loaded!.sections.find(s => s.heading === 'Experience')!;
      expect(exp.type).toBe('jobs');
      expect(exp.jobs).toHaveLength(1);
      expect(exp.jobs[0].title).toBe('Staff SRE');
      expect(exp.jobs[0].bullets).toHaveLength(2);
      expect(exp.jobs[0].bullets[1].text).toBe('Reduced MTTR by 40%');
    } finally {
      cleanup();
    }
  });

  it('updating EditorData removes deleted sections', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ResumeRepo(db);

      repo.saveEditorData(job.id, {
        kind: 'resume',
        sections: [
          { id: 'sec-a', heading: 'A', type: 'text', content: 'A content', items: [], jobs: [], accepted: true },
          { id: 'sec-b', heading: 'B', type: 'text', content: 'B content', items: [], jobs: [], accepted: true },
        ],
      });

      // Save again without sec-b
      repo.saveEditorData(job.id, {
        kind: 'resume',
        sections: [
          { id: 'sec-a', heading: 'A updated', type: 'text', content: 'A content', items: [], jobs: [], accepted: true },
        ],
      });

      const loaded = repo.loadEditorData(job.id);
      expect(loaded!.sections).toHaveLength(1);
      expect(loaded!.sections[0].heading).toBe('A updated');
    } finally {
      cleanup();
    }
  });

  it('loadEditorData returns null when no data exists', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ResumeRepo(db);
      expect(repo.loadEditorData(job.id)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('preserves bullet sort order', () => {
    const { db, cleanup } = makeTempDb();
    try {
      const { job } = makeJob(db);
      const repo = new ResumeRepo(db);

      repo.saveEditorData(job.id, {
        kind: 'resume',
        sections: [{
          id: 'sec-skills',
          heading: 'Skills',
          type: 'bullets',
          content: '',
          items: [
            { id: 'b3', text: 'Third' },
            { id: 'b1', text: 'First' },
            { id: 'b2', text: 'Second' },
          ],
          jobs: [],
          accepted: true,
        }],
      });

      const loaded = repo.loadEditorData(job.id)!;
      const bullets = loaded.sections[0].items;
      expect(bullets[0].text).toBe('Third');
      expect(bullets[1].text).toBe('First');
      expect(bullets[2].text).toBe('Second');
    } finally {
      cleanup();
    }
  });
});
