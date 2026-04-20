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
