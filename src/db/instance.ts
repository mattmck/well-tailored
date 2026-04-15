import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { createSqliteAdapter } from './sqlite.js';
import { runMigrations } from './migrations.js';
import { migrateJsonWorkspaces } from '../services/migrate-workspaces.js';
import type { DatabaseAdapter } from './adapter.js';

let _db: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (!_db) {
    const dir = join(homedir(), '.well-tailored');
    mkdirSync(dir, { recursive: true });
    _db = createSqliteAdapter(join(dir, 'well-tailored.db'));
    runMigrations(_db);
    migrateJsonWorkspaces(_db);
  }
  return _db;
}
