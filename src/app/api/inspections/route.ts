// GET /api/inspections - List inspections
// POST /api/inspections - Create inspection
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { z } from 'zod';

export async function GET() {
  try {
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    const rows = db.prepare('SELECT * FROM inspections ORDER BY created_at DESC').all() as any[];
    db.close();
    return NextResponse.json({
      data: rows.map(r => ({
        id: r.id, productId: r.product_id, batchId: r.batch_id, lotId: r.lot_id,
        testType: r.test_type, result: r.result, severity: r.severity,
        incidentType: r.incident_type, inspectorRole: r.inspector_role,
        notes: r.notes, createdAt: r.created_at,
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

const inspectionSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().min(1),
  lotId: z.string().min(1),
  testType: z.string().min(1),
  result: z.enum(['pass', 'fail']),
  severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  incidentType: z.enum(['contamination', 'temperature_excursion', 'component_defect']).nullable().optional(),
  notes: z.string().optional().default(''),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inspectionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    
    const now = new Date().toISOString();
    const id = `INSP-${Date.now()}`;
    
    db.prepare(`INSERT INTO inspections (id, product_id, batch_id, lot_id, test_type, result, severity, incident_type, inspector_role, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'quality_inspector', ?, ?)`).run(
      id, parsed.data.productId, parsed.data.batchId, parsed.data.lotId,
      parsed.data.testType, parsed.data.result,
      parsed.data.severity || null, parsed.data.incidentType || null,
      parsed.data.notes, now
    );

    // Add audit entry
    db.prepare(`INSERT INTO audit_log (id, action, entity, entity_id, details, timestamp, user_id)
      VALUES (?, 'inspection_created', 'inspection', ?, ?, ?, 'quality_inspector')`).run(
      `AUD-${Date.now()}`, id,
      `Inspection ${parsed.data.result.toUpperCase()}: ${parsed.data.testType} on ${parsed.data.lotId}`,
      now
    );
    
    db.close();
    
    return NextResponse.json({
      data: { id, ...parsed.data, createdAt: now, inspectorRole: 'quality_inspector' }
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'CREATE_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
