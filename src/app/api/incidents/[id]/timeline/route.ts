// GET /api/incidents/[id]/timeline - Get incident timeline events
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    
    const events = db.prepare('SELECT * FROM timeline_events WHERE incident_id = ? ORDER BY timestamp ASC').all(id) as any[];
    db.close();
    
    return NextResponse.json({
      data: events.map(e => ({
        id: e.id,
        incidentId: e.incident_id,
        event: e.event,
        description: e.description,
        timestamp: e.timestamp,
        category: e.category,
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
