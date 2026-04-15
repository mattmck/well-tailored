import BetterSqlite3 from 'better-sqlite3';
import type { DatabaseAdapter } from './adapter.js';

export function createSqliteAdapter(path: string): DatabaseAdapter {
  const db = new BetterSqlite3(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    run(sql, params = []) {
      db.prepare(sql).run(params);
    },
    get<T>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(params) as T | undefined;
    },
    all<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(params) as T[];
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close() {
      db.close();
    },
  };
}
