// GET /api/audit - Get audit log entries
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  try {
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100').all() as any[];
    db.close();
    return NextResponse.json({
      data: rows.map(r => ({
        id: r.id, action: r.action, entity: r.entity, entityId: r.entity_id,
        details: r.details, timestamp: r.timestamp, userId: r.user_id,
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
