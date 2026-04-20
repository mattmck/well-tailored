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
  listAddedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateInput = { workspaceId: string; company: string; title?: string; jd?: string; stage?: string; source?: string; huntrId?: string; listAddedAt?: string | null };
type UpdateInput = Partial<Pick<JobRow, 'title' | 'jd' | 'stage' | 'source' | 'huntrId' | 'company' | 'listAddedAt'>>;

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
    listAddedAt: (raw.list_added_at as string) ?? null,
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
      `INSERT INTO jobs (id,workspace_id,company,title,jd,stage,source,huntr_id,list_added_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, input.workspaceId, input.company, input.title ?? null, input.jd ?? null,
       input.stage ?? 'wishlist', input.source ?? 'manual', input.huntrId ?? null, input.listAddedAt ?? null, now, now],
    );
    return this.findById(id)!;
  }

  findById(id: string): JobRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM jobs WHERE id = ?', [id]);
    return raw ? toRow(raw) : undefined;
  }

  findByHuntrId(workspaceId: string, huntrId: string): JobRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM jobs WHERE workspace_id = ? AND huntr_id = ? ORDER BY rowid ASC LIMIT 1',
      [workspaceId, huntrId],
    );
    return raw ? toRow(raw) : undefined;
  }

  createOrUpdate(input: CreateInput): JobRow {
    const existing = input.huntrId
      ? this.findByHuntrId(input.workspaceId, input.huntrId)
      : undefined;
    if (!existing) return this.create(input);

    return this.update(existing.id, {
      company: input.company,
      title: input.title,
      jd: input.jd,
      stage: input.stage,
      source: input.source,
      huntrId: input.huntrId,
      listAddedAt: input.listAddedAt,
    })!;
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
    if (input.listAddedAt !== undefined) map.list_added_at = input.listAddedAt;
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
