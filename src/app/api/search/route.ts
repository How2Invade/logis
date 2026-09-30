// GET /api/search?q= - Global search
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (!q) return NextResponse.json({ data: [] });

    const db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    const like = `%${q}%`;

    const results: { type: string; id: string; label: string; description: string }[] = [];

    // Search incidents
    const incidents = db.prepare('SELECT * FROM incidents WHERE id LIKE ? OR title LIKE ? OR source_lot LIKE ? LIMIT 5').all(like, like, like) as any[];
    for (const i of incidents) {
      results.push({ type: 'incident', id: i.id, label: i.title, description: `${i.severity} — ${i.status}` });
    }

    // Search lots
    const lots = db.prepare('SELECT * FROM lots WHERE id LIKE ? LIMIT 5').all(like) as any[];
    for (const l of lots) {
      results.push({ type: 'lot', id: l.id, label: l.id, description: `Material: ${l.material_id}, Status: ${l.status}` });
    }

    // Search batches
    const batches = db.prepare('SELECT * FROM batches WHERE id LIKE ? LIMIT 5').all(like) as any[];
    for (const b of batches) {
      results.push({ type: 'batch', id: b.id, label: b.id, description: `Product: ${b.product_id}, Machine: ${b.machine_id}` });
    }

    // Search products
    const products = db.prepare('SELECT * FROM products WHERE id LIKE ? OR name LIKE ? LIMIT 5').all(like, like) as any[];
    for (const p of products) {
      results.push({ type: 'product', id: p.id, label: p.name, description: `₹${p.unit_price} — ${p.category}` });
    }

    // Search warehouses
    const warehouses = db.prepare('SELECT * FROM warehouses WHERE id LIKE ? OR name LIKE ? OR location LIKE ? LIMIT 5').all(like, like, like) as any[];
    for (const w of warehouses) {
      results.push({ type: 'warehouse', id: w.id, label: w.name, description: w.location });
    }

    // Search stores
    const stores = db.prepare('SELECT * FROM stores WHERE id LIKE ? OR name LIKE ? OR location LIKE ? LIMIT 5').all(like, like, like) as any[];
    for (const s of stores) {
      results.push({ type: 'store', id: s.id, label: s.name, description: `${s.location} — ${s.region}` });
    }

    db.close();
    return NextResponse.json({ data: results });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'SEARCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
