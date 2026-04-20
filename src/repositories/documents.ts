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

  findLatestForJobs(jobIds: string[]): Record<string, { resume?: string; cover?: string; resumeEditorDataJson?: string | null; coverEditorDataJson?: string | null }> {
    if (jobIds.length === 0) return {};
    const placeholders = jobIds.map(() => '?').join(',');
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT d.job_id, d.doc_type, d.markdown, d.editor_data_json FROM job_documents d
       INNER JOIN (
         SELECT job_id, doc_type, MAX(version) AS max_version
         FROM job_documents WHERE job_id IN (${placeholders})
         GROUP BY job_id, doc_type
       ) m ON d.job_id = m.job_id AND d.doc_type = m.doc_type AND d.version = m.max_version`,
      jobIds,
    );
    const result: Record<string, { resume?: string; cover?: string; resumeEditorDataJson?: string | null; coverEditorDataJson?: string | null }> = {};
    for (const row of rows) {
      const jobId = row.job_id as string;
      if (!result[jobId]) result[jobId] = {};
      if (row.doc_type === 'resume') {
        result[jobId].resume = row.markdown as string;
        result[jobId].resumeEditorDataJson = (row.editor_data_json as string) ?? null;
      } else if (row.doc_type === 'cover') {
        result[jobId].cover = row.markdown as string;
        result[jobId].coverEditorDataJson = (row.editor_data_json as string) ?? null;
      }
    }
    return result;
  }
}
