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
    return this.db.all<Record<string, unknown>>('SELECT * FROM workspaces ORDER BY updated_at DESC, rowid ASC').map(toRow);
  }

  findByName(name: string): WorkspaceRow | undefined {
    const raw = this.db.get<Record<string, unknown>>('SELECT * FROM workspaces WHERE name = ? ORDER BY rowid ASC LIMIT 1', [name]);
    return raw ? toRow(raw) : undefined;
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
