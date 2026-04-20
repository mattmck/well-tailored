import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createSqliteAdapter } from '../src/db/sqlite.js';
import { runMigrations } from '../src/db/migrations.js';
import { backfillResumeStructures } from '../src/services/backfill-resume-structures.js';
import { DocumentRepo } from '../src/repositories/documents.js';
import { JobRepo } from '../src/repositories/jobs.js';
import { ResumeRepo } from '../src/repositories/resume.js';
import { WorkspaceRepo } from '../src/repositories/workspaces.js';

const sampleResume = `# Jane Doe

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

2020 - Present

- Led migration of monolithic application to microservices architecture
- Reduced deployment time from 2 hours to 15 minutes via CI/CD automation
- Mentored team of 5 junior engineers

### Senior Engineer | BigCo | Remote

2016 - 2020

- Built real-time data pipeline processing 1M events/second
- Implemented observability stack reducing MTTR by 60%

## Education

### B.S. Computer Science | MIT

2012 - 2016
`;

function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-backfill-test-'));
  const path = join(dir, 'test.db');
  const db = createSqliteAdapter(path);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true });
    },
  };
}

describe('backfillResumeStructures', () => {
  it('parses latest resume markdown into normalized resume tables and is idempotent', () => {
    const { db, cleanup } = makeTempDb();
    try {
      runMigrations(db);
      const workspace = new WorkspaceRepo(db).create({ name: 'Backfill Test' });
      const job = new JobRepo(db).create({
        workspaceId: workspace.id,
        company: 'Acme',
        title: 'Staff Engineer',
      });
      new DocumentRepo(db).save({
        jobId: job.id,
        docType: 'resume',
        markdown: '# Old Resume\n\n## Old Role\n\n## Summary\n\nOlder text.',
      });
      new DocumentRepo(db).save({
        jobId: job.id,
        docType: 'resume',
        markdown: sampleResume,
      });

      expect(backfillResumeStructures(db)).toBe(1);

      const headerCount = db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM resume_headers WHERE job_id = ?',
        [job.id],
      )?.count;
      const sectionCount = db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM resume_sections WHERE job_id = ?',
        [job.id],
      )?.count;
      const bulletCount = db.get<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM resume_bullets b
         LEFT JOIN resume_sections s ON b.section_id = s.id
         LEFT JOIN resume_job_entries e ON b.job_entry_id = e.id
         LEFT JOIN resume_sections es ON e.section_id = es.id
         WHERE s.job_id = ? OR es.job_id = ?`,
        [job.id, job.id],
      )?.count;
      const jobEntryCount = db.get<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM resume_job_entries e
         INNER JOIN resume_sections s ON e.section_id = s.id
         WHERE s.job_id = ?`,
        [job.id],
      )?.count;

      expect(headerCount).toBe(1);
      expect(sectionCount).toBe(4);
      expect(bulletCount).toBe(8);
      expect(jobEntryCount).toBe(3);

      const loaded = new ResumeRepo(db).loadEditorData(job.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.header).toEqual({
        name: 'Jane Doe',
        role: 'Senior Software Engineer',
        contact: 'jane@example.com | (555) 123-4567',
        links: 'linkedin.com/in/janedoe | github.com/janedoe',
      });

      const summary = loaded!.sections.find(section => section.heading === 'Summary');
      expect(summary?.type).toBe('text');
      expect(summary?.content).toContain('Experienced engineer');
      expect(summary?.accepted).toBe(true);

      const skills = loaded!.sections.find(section => section.heading === 'Technical Skills');
      expect(skills?.type).toBe('bullets');
      expect(skills?.items).toHaveLength(3);

      const experience = loaded!.sections.find(section => section.heading === 'Experience');
      expect(experience?.type).toBe('jobs');
      expect(experience?.jobs).toHaveLength(2);
      expect(experience?.jobs[0]).toMatchObject({
        title: 'Staff Engineer',
        company: 'Acme Corp',
        location: 'San Francisco, CA',
        date: '2020 - Present',
      });
      expect(experience?.jobs[0].bullets).toHaveLength(3);
      expect(experience?.jobs[1]).toMatchObject({
        title: 'Senior Engineer',
        company: 'BigCo',
        location: 'Remote',
        date: '2016 - 2020',
      });
      expect(experience?.jobs[1].bullets).toHaveLength(2);

      const education = loaded!.sections.find(section => section.heading === 'Education');
      expect(education?.type).toBe('jobs');
      expect(education?.jobs).toHaveLength(1);
      expect(education?.jobs[0]).toMatchObject({
        title: 'B.S. Computer Science',
        company: 'MIT',
        date: '2012 - 2016',
      });

      expect(backfillResumeStructures(db)).toBe(0);
      expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM resume_sections WHERE job_id = ?', [job.id])?.count).toBe(4);
    } finally {
      cleanup();
    }
  });
});
