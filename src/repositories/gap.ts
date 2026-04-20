import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';
import type { GapAnalysis } from '../types/index.js';

export interface GapAnalysisRow {
  id: string;
  jobId: string;
  taskId: string | null;
  overallFit: string | null;
  narrative: string | null;
  createdAt: string;
}

export interface GapKeywordRow {
  id: string;
  gapAnalysisId: string;
  term: string;
  category: string | null;
  status: 'matched' | 'missing' | 'partial';
  sortOrder: number;
}

type CreateInput = {
  jobId: string;
  taskId?: string | null;
  analysis: GapAnalysis;
};

function toAnalysisRow(raw: Record<string, unknown>): GapAnalysisRow {
  return {
    id: raw.id as string,
    jobId: raw.job_id as string,
    taskId: (raw.task_id as string) ?? null,
    overallFit: (raw.overall_fit as string) ?? null,
    narrative: (raw.narrative as string) ?? null,
    createdAt: raw.created_at as string,
  };
}

function toKeywordRow(raw: Record<string, unknown>): GapKeywordRow {
  return {
    id: raw.id as string,
    gapAnalysisId: raw.gap_analysis_id as string,
    term: raw.term as string,
    category: (raw.category as string) ?? null,
    status: raw.status as GapKeywordRow['status'],
    sortOrder: raw.sort_order as number,
  };
}

export class GapRepo {
  constructor(private db: DatabaseAdapter) {}

  create(input: CreateInput): GapAnalysisRow {
    const now = new Date().toISOString();
    const id = randomUUID();
    const { analysis } = input;

    this.db.run(
      `INSERT INTO job_gap_analyses (id, job_id, task_id, overall_fit, narrative, created_at)
       VALUES (?,?,?,?,?,?)`,
      [id, input.jobId, input.taskId ?? null, analysis.overallFit, analysis.narrative, now],
    );

    // Insert keyword rows: matched, missing, partial
    let order = 0;
    for (const kw of analysis.matchedKeywords) {
      this.db.run(
        `INSERT INTO gap_keywords (id, gap_analysis_id, term, category, status, sort_order)
         VALUES (?,?,?,?,?,?)`,
        [randomUUID(), id, kw.term, kw.category ?? null, 'matched', order++],
      );
    }
    for (const kw of analysis.missingKeywords) {
      this.db.run(
        `INSERT INTO gap_keywords (id, gap_analysis_id, term, category, status, sort_order)
         VALUES (?,?,?,?,?,?)`,
        [randomUUID(), id, kw.term, kw.category ?? null, 'missing', order++],
      );
    }
    for (const pm of analysis.partialMatches) {
      // Store the JD term as the primary term; resumeTerm recorded in category field for now
      this.db.run(
        `INSERT INTO gap_keywords (id, gap_analysis_id, term, category, status, sort_order)
         VALUES (?,?,?,?,?,?)`,
        [randomUUID(), id, pm.jdTerm, pm.resumeTerm ?? null, 'partial', order++],
      );
    }

    return this.findById(id)!;
  }

  findById(id: string): GapAnalysisRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM job_gap_analyses WHERE id = ?',
      [id],
    );
    return raw ? toAnalysisRow(raw) : undefined;
  }

  findLatestForJob(jobId: string): GapAnalysisRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM job_gap_analyses WHERE job_id = ? ORDER BY rowid DESC LIMIT 1',
      [jobId],
    );
    return raw ? toAnalysisRow(raw) : undefined;
  }

  listForJob(jobId: string): GapAnalysisRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM job_gap_analyses WHERE job_id = ? ORDER BY rowid DESC',
        [jobId],
      )
      .map(toAnalysisRow);
  }

  keywordsForAnalysis(gapAnalysisId: string): GapKeywordRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM gap_keywords WHERE gap_analysis_id = ? ORDER BY sort_order',
        [gapAnalysisId],
      )
      .map(toKeywordRow);
  }

  /** Convenience: get latest analysis + its keywords for a job in one call. */
  findLatestWithKeywords(jobId: string): { analysis: GapAnalysisRow; keywords: GapKeywordRow[] } | null {
    const analysis = this.findLatestForJob(jobId);
    if (!analysis) return null;
    return { analysis, keywords: this.keywordsForAnalysis(analysis.id) };
  }

  findLatestWithKeywordsForJobs(
    jobIds: string[],
  ): Record<string, { analysis: GapAnalysisRow; keywords: GapKeywordRow[] }> {
    const out: Record<string, { analysis: GapAnalysisRow; keywords: GapKeywordRow[] }> = {};
    for (const jobId of jobIds) {
      const entry = this.findLatestWithKeywords(jobId);
      if (entry) out[jobId] = entry;
    }
    return out;
  }
}
