// GET /api/resources - Get all resources (machines, workers, warehouses, trucks)
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  try {
    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    
    const machines = (db.prepare('SELECT * FROM machines').all() as any[]).map(m => ({
      id: m.id, name: m.name, capacityPerDay: m.capacity_per_day,
      compatibleProducts: JSON.parse(m.compatible_products),
      utilization: m.utilization, available: Boolean(m.available), status: m.status,
    }));
    
    const workers = (db.prepare('SELECT * FROM workers').all() as any[]).map(w => ({
      id: w.id, name: w.name, skills: JSON.parse(w.skills),
      available: Boolean(w.available), status: w.status, shiftHours: w.shift_hours,
    }));
    
    const warehouses = (db.prepare('SELECT * FROM warehouses').all() as any[]).map(w => ({
      id: w.id, name: w.name, location: w.location,
      capacity: w.capacity, freeSlots: w.free_slots,
      available: Boolean(w.available), temperatureControlled: Boolean(w.temperature_controlled),
    }));
    
    const trucks = (db.prepare('SELECT * FROM trucks').all() as any[]).map(t => ({
      id: t.id, name: t.name, capacity: t.capacity,
      available: Boolean(t.available), status: t.status, currentRoute: t.current_route,
    }));
    
    db.close();
    
    return NextResponse.json({
      data: { machines, workers, warehouses, trucks }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
