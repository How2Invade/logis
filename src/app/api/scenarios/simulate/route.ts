// POST /api/scenarios/simulate - Run what-if scenario
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { simulateScenario } from '@/services/scenarioService';
import { fetchAllData } from '@/services/incidentService';
import Database from 'better-sqlite3';
import path from 'path';

const modifierSchema = z.object({
  type: z.enum(['additional_batch', 'warehouse_unavailable', 'transport_reduced', 'demand_spike', 'custom']),
  params: z.record(z.string(), z.unknown()),
});

const scenarioSchema = z.object({
  incidentId: z.string().min(1),
  modifiers: z.array(modifierSchema).min(1),
  treatUncertainAsAffected: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scenarioSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(parsed.data.incidentId) as any;
    if (!incident) {
      db.close();
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Incident ${parsed.data.incidentId} not found` } },
        { status: 404 }
      );
    }

    const allData = fetchAllData(db);
    const machines = (db.prepare('SELECT * FROM machines').all() as any[]).map(m => ({
      id: m.id, name: m.name, capacityPerDay: m.capacity_per_day,
      compatibleProducts: m.compatible_products, utilization: m.utilization,
      available: Boolean(m.available), status: m.status,
    }));
    const workers = (db.prepare('SELECT * FROM workers').all() as any[]).map(w => ({
      id: w.id, name: w.name, skills: w.skills,
      available: Boolean(w.available), status: w.status, shiftHours: w.shift_hours,
    }));
    const warehouses = (db.prepare('SELECT * FROM warehouses').all() as any[]).map(w => ({
      id: w.id, name: w.name, location: w.location,
      capacity: w.capacity, freeSlots: w.free_slots, available: Boolean(w.available),
    }));
    const trucks = (db.prepare('SELECT * FROM trucks').all() as any[]).map(t => ({
      id: t.id, name: t.name, capacity: t.capacity,
      available: Boolean(t.available), status: t.status,
    }));
    const demandRows = (db.prepare('SELECT * FROM demand').all() as any[]).map(d => ({
      id: d.id, productId: d.product_id, units: d.units,
      deadline: d.deadline, unitValue: d.unit_value, priority: d.priority,
    }));
    const costRatesRows = (db.prepare('SELECT * FROM cost_rates').all() as any[]).map(c => ({
      category: c.category, ratePerUnit: c.rate_per_unit,
    }));
    
    db.close();

    const result = simulateScenario({
      sourceLotId: incident.source_lot,
      ...allData,
      machines,
      workers,
      warehouses,
      trucks,
      demand: demandRows,
      costRates: costRatesRows,
      modifiers: parsed.data.modifiers,
      treatUncertainAsAffected: parsed.data.treatUncertainAsAffected,
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'SIMULATION_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
