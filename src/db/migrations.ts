import type { DatabaseAdapter } from './adapter.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  source_resume TEXT,
  source_bio TEXT,
  source_cover_letter TEXT,
  source_supplemental TEXT,
  prompt_resume_system TEXT,
  prompt_cover_letter_system TEXT,
  prompt_scoring_system TEXT,
  theme_json TEXT,
  agent_config_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT,
  jd TEXT,
  stage TEXT NOT NULL DEFAULT 'wishlist',
  source TEXT NOT NULL DEFAULT 'manual',
  huntr_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_documents (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  markdown TEXT NOT NULL,
  editor_data_json TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export function runMigrations(db: DatabaseAdapter): void {
  db.transaction(() => {
    for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
      db.run(statement);
    }
  });
}
