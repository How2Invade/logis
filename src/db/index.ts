// ============================================================================
// LOGIS — Database Connection (SQLite + Drizzle ORM)
// ============================================================================
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'logis.db');

let sqliteInstance: Database.Database | null = null;

function getSqlite() {
  if (!sqliteInstance) {
    sqliteInstance = new Database(DB_PATH);
    sqliteInstance.pragma('journal_mode = WAL');
    sqliteInstance.pragma('foreign_keys = ON');
  }
  return sqliteInstance;
}

export const db = drizzle(getSqlite(), { schema });
export { getSqlite };
export type DB = typeof db;
