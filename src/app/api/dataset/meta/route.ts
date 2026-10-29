// GET /api/dataset/meta - Returns the currently active dataset metadata
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  try {
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS dataset_meta (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_file TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        mode TEXT NOT NULL,
        is_simulation INTEGER NOT NULL DEFAULT 1
      );
    `);

    const row = db.prepare('SELECT * FROM dataset_meta ORDER BY imported_at DESC LIMIT 1').get() as any;
    db.close();

    if (!row) {
      return NextResponse.json({
        data: {
          id: 'default',
          name: 'NovaFoods Dairy Network',
          sourceFile: 'seed.ts',
          importedAt: new Date().toISOString(),
          mode: 'seed',
          isSimulation: false,
        }
      });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        sourceFile: row.source_file,
        importedAt: row.imported_at,
        mode: row.mode,
        isSimulation: Boolean(row.is_simulation),
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      data: {
        id: 'default',
        name: 'NovaFoods Dairy Network',
        sourceFile: 'seed.ts',
        importedAt: new Date().toISOString(),
        mode: 'seed',
        isSimulation: true,
      }
    });
  }
}

