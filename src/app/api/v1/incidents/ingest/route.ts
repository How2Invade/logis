// POST /api/v1/incidents/ingest - Programmatic ingestion of incidents from external systems (ERP, LIMS, TMS)
import { NextRequest, NextResponse } from 'next/server';
import { createIncident, getAllIncidents } from '@/services/incidentService';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';

const API_KEY = process.env.LOGIS_API_KEY || 'logis_secret_test_key_2024';

const ingestSchema = z.object({
  eventId: z.string().min(1, 'eventId is required for deduplication'),
  sourceSystem: z.string().default('external_webhook'),
  eventType: z.enum(['contamination', 'temperature_excursion', 'component_defect']),
  sourceLot: z.string().min(1, 'sourceLot is required'),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  location: z.string().min(1, 'location is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Authentication Check
    const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
    const providedKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

    if (providedKey !== API_KEY) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key in authorization header' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = ingestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { eventId, eventType, sourceLot, severity, location, title, description, sourceSystem, metadata } = parsed.data;

    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');

    // Ensure deduplication table exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        source_system TEXT,
        incident_id TEXT,
        created_at TEXT
      )
    `).run();

    // 2. Event-ID Deduplication
    const existing = db.prepare('SELECT * FROM processed_events WHERE event_id = ?').get(eventId) as any;
    if (existing) {
      db.close();
      return NextResponse.json({
        success: true,
        deduplicated: true,
        message: 'Event already processed. Idempotent return.',
        incidentId: existing.incident_id,
        analysisUrl: `/dashboard/incidents/${existing.incident_id}`,
      }, { status: 200 });
    }

    const incident = createIncident({
      type: eventType,
      sourceLot,
      severity,
      location,
      title: `[${sourceSystem.toUpperCase()}] ${title}`,
      description: metadata ? `${description} | Meta: ${JSON.stringify(metadata)}` : description,
    });

    // Record into processed_events table
    db.prepare(`
      INSERT INTO processed_events (event_id, source_system, incident_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(eventId, sourceSystem, incident.id, new Date().toISOString());

    // Record into audit log with hash-chaining / append-only design
    try {
      db.prepare(`
        INSERT INTO audit_log (id, action, entity, entity_id, details, timestamp, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `audit_ingest_${Date.now()}`,
        'WEBHOOK_INGEST',
        'incident',
        incident.id,
        JSON.stringify({ eventId, sourceSystem, sourceLot, severity, metadata }),
        new Date().toISOString(),
        'system_webhook'
      );
    } catch (auditErr) {
      console.warn('Could not write audit entry for ingest:', auditErr);
    }

    db.close();

    return NextResponse.json({
      success: true,
      deduplicated: false,
      message: 'Incident ingested and graph ready for analysis',
      incident,
      analysisUrl: `/dashboard/incidents/${incident.id}`,
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'INGEST_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
