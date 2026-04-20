import type { DatabaseAdapter } from '../db/adapter.js';
import { parseResumeMarkdown } from '../lib/resume-markdown-parser.js';
import { ResumeRepo } from '../repositories/resume.js';

interface ResumeDocumentForBackfill {
  job_id: string;
  markdown: string;
}

export function backfillResumeStructures(db: DatabaseAdapter): number {
  const resumeRepo = new ResumeRepo(db);
  const jobsToBackfill = db.all<ResumeDocumentForBackfill>(
    `SELECT d.job_id, d.markdown
     FROM job_documents d
     INNER JOIN (
       SELECT job_id, MAX(version) AS max_version
       FROM job_documents
       WHERE doc_type = 'resume'
       GROUP BY job_id
     ) latest ON d.job_id = latest.job_id AND d.version = latest.max_version
     LEFT JOIN resume_sections s ON s.job_id = d.job_id
     WHERE d.doc_type = 'resume'
       AND s.id IS NULL`,
  );

  let count = 0;
  for (const row of jobsToBackfill) {
    try {
      const editorData = parseResumeMarkdown(row.markdown);
      if (editorData.sections.length === 0) continue;
      resumeRepo.saveEditorData(row.job_id, editorData);
      count++;
    } catch (err) {
      console.warn(`[backfill] Failed to parse resume for job ${row.job_id}: ${(err as Error).message}`);
    }
  }

  if (count > 0) {
    console.log(`[backfill] Parsed ${count} resume(s) into normalized tables`);
  }

  return count;
}
