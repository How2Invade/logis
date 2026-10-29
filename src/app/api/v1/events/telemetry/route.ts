// POST /api/v1/events/telemetry - Ingest cold-chain or IoT telemetry events with auth, deduplication, and persistence
import { NextRequest, NextResponse } from 'next/server';
import { createIncident } from '@/services/incidentService';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';

const API_KEY = process.env.LOGIS_API_KEY || 'logis_secret_test_key_2024';

const telemetrySchema = z.object({
  eventId: z.string().min(1, 'eventId is required for deduplication'),
  deviceId: z.string().min(1),
  sensorType: z.enum(['temperature', 'humidity', 'vibration', 'location']),
  value: z.number(),
  threshold: z.number(),
  consecutiveExcursions: z.number().default(1),
  minConsecutiveRequired: z.number().default(2), // Avoid door-open single spikes
  unit: z.string().default('°C'),
  lotId: z.string().optional(),
  shipmentId: z.string().optional(),
  location: z.string().default('Transit Hub'),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
    const providedKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

    if (providedKey !== API_KEY) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = telemetrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { 
      eventId, deviceId, sensorType, value, threshold, 
      consecutiveExcursions, minConsecutiveRequired, 
      unit, lotId, shipmentId, location, timestamp 
    } = parsed.data;

    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');

    // Deduplication table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS processed_telemetry_events (
        event_id TEXT PRIMARY KEY,
        device_id TEXT,
        status TEXT,
        created_at TEXT
      )
    `).run();

    // 2. Event-ID Deduplication
    const existing = db.prepare('SELECT * FROM processed_telemetry_events WHERE event_id = ?').get(eventId) as any;
    if (existing) {
      db.close();
      return NextResponse.json({
        success: true,
        deduplicated: true,
        message: 'Telemetry event already processed. Idempotent return.',
        status: existing.status,
      }, { status: 200 });
    }

    const isExcursion = value > threshold;

    if (!isExcursion) {
      db.prepare(`
        INSERT INTO processed_telemetry_events (event_id, device_id, status, created_at)
        VALUES (?, ?, ?, ?)
      `).run(eventId, deviceId, 'NORMAL', new Date().toISOString());
      db.close();
      return NextResponse.json({
        success: true,
        status: 'NORMAL',
        message: 'Telemetry within normal limits. No incident triggered.',
      });
    }

    // Require sustained excursion (avoid single door-open spike)
    if (consecutiveExcursions < minConsecutiveRequired) {
      db.prepare(`
        INSERT INTO processed_telemetry_events (event_id, device_id, status, created_at)
        VALUES (?, ?, ?, ?)
      `).run(eventId, deviceId, 'TRANSIENT_SPIKE_IGNORED', new Date().toISOString());
      db.close();
      return NextResponse.json({
        success: true,
        status: 'TRANSIENT_SPIKE_IGNORED',
        message: `Excursion detected (${value}${unit} > ${threshold}${unit}) but count (${consecutiveExcursions}) < min required (${minConsecutiveRequired}). Logged without quarantine.`,
      });
    }

    // Trigger incident if threshold is breached continuously
    const targetLot = lotId || 'LOT-2024-001';
    const severity = Math.abs(value - threshold) > 5 ? 'critical' : 'high';

    const incident = createIncident({
      type: 'temperature_excursion',
      sourceLot: targetLot,
      severity,
      location,
      title: `IoT Alert: Sustained ${sensorType} excursion on ${deviceId}`,
      description: `Sensor recorded sustained ${value}${unit} (limit: ${threshold}${unit}, ${consecutiveExcursions} consecutive readings) at ${location}. Triggered automated quarantine assessment.`,
    });

    db.prepare(`
      INSERT INTO processed_telemetry_events (event_id, device_id, status, created_at)
      VALUES (?, ?, ?, ?)
    `).run(eventId, deviceId, 'EXCURSION_DETECTED', new Date().toISOString());

    // Write to audit log
    try {
      db.prepare(`
        INSERT INTO audit_log (id, action, entity, entity_id, details, timestamp, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `audit_telemetry_${Date.now()}`,
        'TELEMETRY_EXCURSION',
        'telemetry_event',
        deviceId,
        JSON.stringify({ eventId, value, threshold, unit, lotId, shipmentId, incidentId: incident.id }),
        timestamp || new Date().toISOString(),
        'iot_gateway'
      );
    } catch (e) {
      console.warn('Audit error on telemetry:', e);
    }

    db.close();

    return NextResponse.json({
      success: true,
      deduplicated: false,
      status: 'EXCURSION_DETECTED',
      incident,
      analysisUrl: `/dashboard/incidents/${incident.id}`,
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'TELEMETRY_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
