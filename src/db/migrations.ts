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
  list_added_at TEXT,
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
);

-- Score / evaluator results
CREATE TABLE IF NOT EXISTS job_scores (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  overall INTEGER,
  verdict TEXT,
  confidence TEXT,
  summary TEXT,
  categories_json TEXT,
  documents_json TEXT,
  notes_json TEXT,
  blocking_issues_json TEXT,
  created_at TEXT NOT NULL
);

-- Gap analysis results
CREATE TABLE IF NOT EXISTS job_gap_analyses (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  overall_fit TEXT,
  narrative TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gap_keywords (
  id TEXT PRIMARY KEY,
  gap_analysis_id TEXT NOT NULL REFERENCES job_gap_analyses(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL CHECK(status IN ('matched','missing','partial')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Normalized resume structure (per-job)
CREATE TABLE IF NOT EXISTS resume_headers (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  contact TEXT,
  links TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_sections (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text','bullets','jobs')),
  content TEXT,
  accepted INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_job_entries (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES resume_sections(id) ON DELETE CASCADE,
  title TEXT,
  company TEXT,
  location TEXT,
  date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume_bullets (
  id TEXT PRIMARY KEY,
  section_id TEXT REFERENCES resume_sections(id) ON DELETE CASCADE,
  job_entry_id TEXT REFERENCES resume_job_entries(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK(
    (section_id IS NOT NULL AND job_entry_id IS NULL) OR
    (section_id IS NULL AND job_entry_id IS NOT NULL)
  )
)`;

export function runMigrations(db: DatabaseAdapter): void {
  db.transaction(() => {
    for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
      db.run(statement);
    }
    ensureColumn(db, 'jobs', 'list_added_at', 'TEXT');
  });
}

function ensureColumn(db: DatabaseAdapter, table: string, column: string, definition: string): void {
  const columns = db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((entry) => entry.name === column)) return;
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
