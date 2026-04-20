import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { createSqliteAdapter } from './sqlite.js';
import { runMigrations } from './migrations.js';
import { migrateJsonWorkspaces } from '../services/migrate-workspaces.js';
import { backfillResumeStructures } from '../services/backfill-resume-structures.js';
import type { DatabaseAdapter } from './adapter.js';

let _db: DatabaseAdapter | null = null;
const dbPath = join(homedir(), '.well-tailored', 'well-tailored.db');

export function getDbPath(): string {
  return dbPath;
}

export function getDb(): DatabaseAdapter {
  if (!_db) {
    const dir = join(homedir(), '.well-tailored');
    mkdirSync(dir, { recursive: true });
    _db = createSqliteAdapter(dbPath);
    runMigrations(_db);
    migrateJsonWorkspaces(_db);
    backfillResumeStructures(_db);
  }
  return _db;
}
