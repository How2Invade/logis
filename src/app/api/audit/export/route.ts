// GET /api/audit/export - Download full compliance audit log in CSV format
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  try {
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');

    const rows = db.prepare(`
      SELECT id, action, entity, entity_id, details, timestamp, user_id
      FROM audit_log
      ORDER BY timestamp DESC
    `).all() as Array<{
      id: string;
      action: string;
      entity: string;
      entity_id: string;
      details: string;
      timestamp: string;
      user_id: string;
    }>;

    db.close();

    // Generate CSV
    const headers = ['Audit ID', 'Timestamp (UTC)', 'Action', 'Entity Type', 'Entity ID', 'User / System', 'Details'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const sanitizedDetails = (r.details || '').replace(/"/g, '""');
      const line = [
        `"${r.id}"`,
        `"${r.timestamp}"`,
        `"${r.action}"`,
        `"${r.entity}"`,
        `"${r.entity_id}"`,
        `"${r.user_id}"`,
        `"${sanitizedDetails}"`,
      ].join(',');
      csvLines.push(line);
    }

    const csvContent = csvLines.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="LOGIS_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'EXPORT_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}

