import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';
import type { EvaluatorScorecard } from '../types/index.js';

export interface ScoreRow {
  id: string;
  jobId: string;
  taskId: string | null;
  overall: number | null;
  verdict: string | null;
  confidence: string | null;
  summary: string | null;
  categoriesJson: string | null;
  documentsJson: string | null;
  notesJson: string | null;
  blockingIssuesJson: string | null;
  createdAt: string;
}

type CreateInput = {
  jobId: string;
  taskId?: string | null;
  scorecard: EvaluatorScorecard;
};

function toRow(raw: Record<string, unknown>): ScoreRow {
  return {
    id: raw.id as string,
    jobId: raw.job_id as string,
    taskId: (raw.task_id as string) ?? null,
    overall: raw.overall != null ? (raw.overall as number) : null,
    verdict: (raw.verdict as string) ?? null,
    confidence: (raw.confidence as string) ?? null,
    summary: (raw.summary as string) ?? null,
    categoriesJson: (raw.categories_json as string) ?? null,
    documentsJson: (raw.documents_json as string) ?? null,
    notesJson: (raw.notes_json as string) ?? null,
    blockingIssuesJson: (raw.blocking_issues_json as string) ?? null,
    createdAt: raw.created_at as string,
  };
}

export class ScoreRepo {
  constructor(private db: DatabaseAdapter) {}

  create(input: CreateInput): ScoreRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    const { scorecard } = input;

    // Build a categories_json map: { [categoryName]: score } from well-known fields
    const categories: Record<string, number | undefined> = {
      atsCompatibility: scorecard.atsCompatibility,
      keywordCoverage: scorecard.keywordCoverage,
      recruiterClarity: scorecard.recruiterClarity,
      hrClarity: scorecard.hrClarity,
      hiringMgrClarity: scorecard.hiringMgrClarity,
      tailoringAlignment: scorecard.tailoringAlignment,
      completionReadiness: scorecard.completionReadiness,
      evidenceStrength: scorecard.evidenceStrength,
      aiObviousness: scorecard.aiObviousness,
      factualRisk: scorecard.factualRisk,
    };
    // Strip undefined values
    const compactCategories = Object.fromEntries(
      Object.entries(categories).filter(([, v]) => v != null),
    );

    this.db.run(
      `INSERT INTO job_scores
         (id, job_id, task_id, overall, verdict, confidence, summary,
          categories_json, documents_json, notes_json, blocking_issues_json, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.jobId,
        input.taskId ?? null,
        scorecard.overall ?? null,
        scorecard.verdict ?? null,
        scorecard.confidence != null ? String(scorecard.confidence) : null,
        null, // summary not in EvaluatorScorecard; leave for future use
        JSON.stringify(compactCategories),
        JSON.stringify(scorecard.documents ?? []),
        JSON.stringify(scorecard.notes ?? []),
        JSON.stringify(scorecard.blockingIssues ?? []),
        now,
      ],
    );
    return this.findById(id)!;
  }

  findById(id: string): ScoreRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM job_scores WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  findLatestForJob(jobId: string): ScoreRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM job_scores WHERE job_id = ? ORDER BY rowid DESC LIMIT 1',
      [jobId],
    );
    return raw ? toRow(raw) : undefined;
  }

  findLatestForJobs(jobIds: string[]): Record<string, ScoreRow> {
    if (jobIds.length === 0) return {};

    const placeholders = jobIds.map(() => '?').join(',');
    const rows = this.db
      .all<Record<string, unknown>>(
        `SELECT js.*
           FROM job_scores js
           INNER JOIN (
             SELECT job_id, MAX(rowid) AS max_rowid
             FROM job_scores
             WHERE job_id IN (${placeholders})
             GROUP BY job_id
           ) latest
             ON latest.job_id = js.job_id
             AND latest.max_rowid = js.rowid`,
        jobIds,
      )
      .map(toRow);

    const out: Record<string, ScoreRow> = {};
    for (const row of rows) {
      out[row.jobId] = row;
    }
    return out;
  }

  listForJob(jobId: string): ScoreRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM job_scores WHERE job_id = ? ORDER BY rowid DESC',
        [jobId],
      )
      .map(toRow);
  }
}
