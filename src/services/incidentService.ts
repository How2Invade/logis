// ============================================================================
// LOGIS — Incident Service: Data access for incidents + orchestrates analysis
// ============================================================================
import Database from 'better-sqlite3';
import path from 'path';
import { computeImpact } from './impactService';
import { generateResponsePlan } from './responseService';
import { computeRecovery } from './recoveryService';
import type { Incident, ImpactResult, ResponsePlan, RecoveryResult } from '@/lib/types';

function getDb() {
  const dbPath = path.join(process.cwd(), 'logis.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function getAllIncidents(): Incident[] {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all() as any[];
    return rows.map(mapIncident);
  } finally {
    db.close();
  }
}

export function getIncidentById(id: string): Incident | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    return row ? mapIncident(row) : null;
  } finally {
    db.close();
  }
}

export function createIncident(data: {
  type: string;
  sourceLot: string;
  severity: string;
  location: string;
  title: string;
  description: string;
}): Incident {
  const db = getDb();
  try {
    const now = new Date().toISOString();
    
    // Check for duplicate
    const existing = db.prepare('SELECT id FROM incidents WHERE source_lot = ? AND type = ? AND status != ?')
      .get(data.sourceLot, data.type, 'resolved') as any;
    
    if (existing) {
      // Return existing incident (merged)
      const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(existing.id) as any;
      return mapIncident(row);
    }

    // Generate ID
    const count = db.prepare('SELECT COUNT(*) as c FROM incidents').get() as any;
    const id = `INC-${String(count.c + 1).padStart(3, '0')}`;

    db.prepare(`INSERT INTO incidents (id, type, source_lot, severity, detected_at, location, status, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`).run(
      id, data.type, data.sourceLot, data.severity, now, data.location,
      data.title, data.description, now, now
    );

    // Add timeline event
    const tlId = `TL-${Date.now()}`;
    db.prepare(`INSERT INTO timeline_events (id, incident_id, event, description, timestamp, category)
      VALUES (?, ?, 'Incident Created', ?, ?, 'detection')`).run(
      tlId, id, `${data.title} — flagged from quality inspection`, now
    );

    // Add audit entry
    const audId = `AUD-${Date.now()}`;
    db.prepare(`INSERT INTO audit_log (id, action, entity, entity_id, details, timestamp, user_id)
      VALUES (?, 'incident_created', 'incident', ?, ?, ?, 'quality_inspector')`).run(
      audId, id, `Incident ${id} created: ${data.title}`, now
    );

    return getIncidentById(id)!;
  } finally {
    db.close();
  }
}

export function analyzeIncident(incidentId: string): ImpactResult {
  const db = getDb();
  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    // Update status
    const now = new Date().toISOString();
    db.prepare('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?')
      .run('analyzing', now, incidentId);

    // Fetch all data for impact computation
    const allData = fetchAllData(db);

    const impact = computeImpact({
      sourceLotId: incident.source_lot,
      ...allData,
    });

    // Update status to analyzed
    db.prepare('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?')
      .run('analyzed', new Date().toISOString(), incidentId);

    // Add timeline events
    addTimelineEvent(db, incidentId, 'Analysis Started', 'Impact analysis initiated for incident');
    addTimelineEvent(db, incidentId, 'Warehouses Identified', `${impact.affectedWarehouses} warehouses contain affected inventory`);
    addTimelineEvent(db, incidentId, 'Impact Computed', `${impact.affectedUnits} affected, ${impact.safeUnits} safe, ${impact.uncertainUnits} uncertain, ${impact.soldUnits} sold`);

    return impact;
  } finally {
    db.close();
  }
}

export function generateResponse(incidentId: string, impact: ImpactResult, treatUncertainAsAffected = false): ResponsePlan {
  const db = getDb();
  try {
    const costRatesRows = db.prepare('SELECT * FROM cost_rates').all() as any[];
    const costRates = {
      transport: costRatesRows.find((c: any) => c.category === 'transport_per_unit')?.rate_per_unit || 8.5,
      disposal: costRatesRows.find((c: any) => c.category === 'disposal_per_unit')?.rate_per_unit || 12,
      quarantine: costRatesRows.find((c: any) => c.category === 'quarantine_per_unit')?.rate_per_unit || 3,
      customerRecall: costRatesRows.find((c: any) => c.category === 'customer_recall_per_unit')?.rate_per_unit || 45,
      withdrawal: costRatesRows.find((c: any) => c.category === 'withdrawal_per_unit')?.rate_per_unit || 15,
      verification: costRatesRows.find((c: any) => c.category === 'verification_per_unit')?.rate_per_unit || 5,
    };

    const plan = generateResponsePlan({ impact, costRates, treatUncertainAsAffected });

    db.prepare('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?')
      .run('responding', new Date().toISOString(), incidentId);

    addTimelineEvent(db, incidentId, 'Response Plan Generated', `${plan.actions.length} actions generated. Risk level: ${plan.riskLevel}`);

    return plan;
  } finally {
    db.close();
  }
}

export function computeRecoveryPlan(incidentId: string): RecoveryResult {
  const db = getDb();
  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const batchLotUsage = db.prepare('SELECT * FROM batch_lot_usage WHERE lot_id = ?').all(incident.source_lot) as any[];
    const affectedBatchIds = batchLotUsage.map((u: any) => u.batch_id);

    const machines = db.prepare('SELECT * FROM machines').all() as any[];
    const workers = db.prepare('SELECT * FROM workers').all() as any[];
    const warehouses = db.prepare('SELECT * FROM warehouses').all() as any[];
    const trucks = db.prepare('SELECT * FROM trucks').all() as any[];
    const batches = db.prepare('SELECT * FROM batches').all() as any[];
    const products = db.prepare('SELECT * FROM products').all() as any[];
    const demandRows = db.prepare('SELECT * FROM demand').all() as any[];
    const costRatesRows = db.prepare('SELECT * FROM cost_rates').all() as any[];

    const recovery = computeRecovery({
      affectedBatchIds,
      machines: machines.map((m: any) => ({
        id: m.id, name: m.name, capacityPerDay: m.capacity_per_day,
        compatibleProducts: m.compatible_products, utilization: m.utilization,
        available: Boolean(m.available), status: m.status,
      })),
      workers: workers.map((w: any) => ({
        id: w.id, name: w.name, skills: w.skills,
        available: Boolean(w.available), status: w.status, shiftHours: w.shift_hours,
      })),
      warehouses: warehouses.map((wh: any) => ({
        id: wh.id, name: wh.name, location: wh.location,
        capacity: wh.capacity, freeSlots: wh.free_slots, available: Boolean(wh.available),
      })),
      trucks: trucks.map((t: any) => ({
        id: t.id, name: t.name, capacity: t.capacity,
        available: Boolean(t.available), status: t.status,
      })),
      batches: batches.map((b: any) => ({
        id: b.id, productId: b.product_id, quantity: b.quantity,
        status: b.status, machineId: b.machine_id,
      })),
      products: products.map((p: any) => ({
        id: p.id, name: p.name, unitPrice: p.unit_price,
      })),
      demand: demandRows.map((d: any) => ({
        id: d.id, productId: d.product_id, units: d.units,
        deadline: d.deadline, unitValue: d.unit_value, priority: d.priority,
      })),
      costRates: costRatesRows.map((c: any) => ({
        category: c.category, ratePerUnit: c.rate_per_unit,
      })),
    });

    db.prepare('UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?')
      .run('recovering', new Date().toISOString(), incidentId);

    addTimelineEvent(db, incidentId, 'Recovery Plan Generated', `${recovery.allocations.length} allocations proposed. Potential recovery: ₹${recovery.potentialRecoveryValue.toLocaleString()}`);

    return recovery;
  } finally {
    db.close();
  }
}

export function fetchAllData(db: Database.Database) {
  return {
    suppliers: (db.prepare('SELECT * FROM suppliers').all() as any[]).map(s => ({ id: s.id, name: s.name, location: s.location })),
    materials: (db.prepare('SELECT * FROM materials').all() as any[]).map(m => ({ id: m.id, name: m.name, supplierId: m.supplier_id })),
    lots: (db.prepare('SELECT * FROM lots').all() as any[]).map(l => ({ id: l.id, materialId: l.material_id, supplierId: l.supplier_id, quantity: l.quantity, status: l.status })),
    batches: (db.prepare('SELECT * FROM batches').all() as any[]).map(b => ({ id: b.id, productId: b.product_id, quantity: b.quantity, status: b.status, machineId: b.machine_id })),
    batchLotUsage: (db.prepare('SELECT * FROM batch_lot_usage').all() as any[]).map(u => ({ batchId: u.batch_id, lotId: u.lot_id, confidence: u.confidence, fractionUsed: u.fraction_used })),
    products: (db.prepare('SELECT * FROM products').all() as any[]).map(p => ({ id: p.id, name: p.name, unitPrice: p.unit_price })),
    warehouses: (db.prepare('SELECT * FROM warehouses').all() as any[]).map(w => ({ id: w.id, name: w.name, location: w.location, capacity: w.capacity })),
    inventory: (db.prepare('SELECT * FROM inventory').all() as any[]).map(i => ({ id: i.id, productId: i.product_id, batchId: i.batch_id, locationId: i.location_id, locationType: i.location_type, quantity: i.quantity, status: i.status })),
    shipments: (db.prepare('SELECT * FROM shipments').all() as any[]).map(s => ({ id: s.id, batchId: s.batch_id, productId: s.product_id, origin: s.origin, destination: s.destination, quantity: s.quantity, status: s.status })),
    stores: (db.prepare('SELECT * FROM stores').all() as any[]).map(s => ({ id: s.id, name: s.name, location: s.location })),
    sales: (db.prepare('SELECT * FROM sales').all() as any[]).map(s => ({ storeId: s.store_id, productId: s.product_id, batchId: s.batch_id, quantity: s.quantity })),
  };
}

function addTimelineEvent(db: Database.Database, incidentId: string, event: string, description: string) {
  const id = `TL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const category = event.toLowerCase().includes('detect') ? 'detection' 
    : event.toLowerCase().includes('analy') ? 'analysis'
    : event.toLowerCase().includes('response') || event.toLowerCase().includes('plan') ? 'response'
    : event.toLowerCase().includes('recover') ? 'recovery'
    : 'system';
  
  db.prepare(`INSERT INTO timeline_events (id, incident_id, event, description, timestamp, category)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, incidentId, event, description, now, category);
}

function mapIncident(row: any): Incident {
  return {
    id: row.id,
    type: row.type,
    sourceLot: row.source_lot,
    severity: row.severity,
    detectedAt: row.detected_at,
    location: row.location,
    status: row.status,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
