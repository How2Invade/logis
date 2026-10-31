// GET /api/network/map?incidentId= — read-only supply network snapshot for the 3D twin
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { fetchAllData } from '@/services/incidentService';
import { computeImpact } from '@/services/impactService';
import { generateResponsePlan } from '@/services/responseService';
import type { NetworkMap, MapNode, MapShipment, NodeKind, UnitSplit } from '@/lib/types/network';

interface IncidentRow { id: string; title: string; source_lot: string; severity: string; status: string }
interface CostRow { category: string; rate_per_unit: number }
interface InventoryRow { location_id: string; location_type: string; batch_id: string; product_id: string; quantity: number }
interface ShipmentRow { id: string; batch_id: string; product_id: string; origin: string; destination: string; quantity: number; status: string; estimated_arrival: string }
interface NamedRow { id: string; name: string; location: string }
interface LotRow { id: string; supplier_id: string }
interface ProductRow { id: string; name: string }

const emptySplit = (): UnitSplit => ({ affected: 0, uncertain: 0, safe: 0, naiveRecall: 0 });

export async function GET(request: NextRequest) {
  const db = new Database(path.join(process.cwd(), 'logis.db'), { readonly: true });
  try {
    const wanted = request.nextUrl.searchParams.get('incidentId');
    const incidents = db.prepare('SELECT id,title,source_lot,severity,status FROM incidents ORDER BY created_at DESC').all() as IncidentRow[];
    if (incidents.length === 0) throw new Error('no incidents');
    const incident =
      incidents.find((i) => i.id === wanted) ??
      incidents.find((i) => i.status !== 'resolved' && i.severity === 'critical') ??
      incidents.find((i) => i.status !== 'resolved') ??
      incidents[0];

    const all = fetchAllData(db);
    const impact = computeImpact({ sourceLotId: incident.source_lot, ...all });

    const rate = (rows: CostRow[], key: string, d: number) => rows.find((r) => r.category === key)?.rate_per_unit ?? d;
    const costRows = db.prepare('SELECT category, rate_per_unit FROM cost_rates').all() as CostRow[];
    const plan = generateResponsePlan({
      impact,
      costRates: {
        transport: rate(costRows, 'transport_per_unit', 8.5),
        disposal: rate(costRows, 'disposal_per_unit', 12),
        quarantine: rate(costRows, 'quarantine_per_unit', 3),
        customerRecall: rate(costRows, 'customer_recall_per_unit', 45),
        withdrawal: rate(costRows, 'withdrawal_per_unit', 15),
        verification: rate(costRows, 'verification_per_unit', 5),
      },
    });

    const batchStatus = new Map<string, string>();
    for (const n of impact.nodes) if (n.type === 'batch') batchStatus.set(n.id, n.status);

    const products = new Map((db.prepare('SELECT id,name FROM products').all() as ProductRow[]).map((p) => [p.id, p.name]));
    const inventory = db.prepare(
      'SELECT i.location_id, i.location_type, i.batch_id, i.product_id, i.quantity FROM inventory i'
    ).all() as InventoryRow[];

    const units = new Map<string, UnitSplit>();
    const stock = new Map<string, Map<string, { units: number; status: string }>>();
    for (const row of inventory) {
      const split = units.get(row.location_id) ?? emptySplit();
      const s = batchStatus.get(row.batch_id) ?? 'safe';
      if (s === 'affected' || s === 'source') split.affected += row.quantity;
      else if (s === 'uncertain') split.uncertain += row.quantity;
      else split.safe += row.quantity;
      split.naiveRecall += row.quantity;
      units.set(row.location_id, split);

      const lines = stock.get(row.location_id) ?? new Map<string, { units: number; status: string }>();
      const name = products.get(row.product_id) ?? row.product_id;
      const key = `${name} · ${row.batch_id}`;
      const prev = lines.get(key);
      lines.set(key, { units: (prev?.units ?? 0) + row.quantity, status: s === 'source' ? 'affected' : s });
      stock.set(row.location_id, lines);
    }

    const lots = db.prepare('SELECT id, supplier_id FROM lots').all() as LotRow[];
    const sourceSupplier = lots.find((l) => l.id === incident.source_lot)?.supplier_id ?? null;
    const affectedBatches = [...batchStatus.entries()].filter(([, s]) => s === 'affected').length;

    const mk = (id: string, kind: NodeKind, name: string, location: string, extra?: Partial<MapNode>): MapNode => ({
      id, kind, name, location,
      units: units.get(id) ?? emptySplit(),
      stock: [...(stock.get(id)?.entries() ?? [])]
        .map(([label, v]) => ({ label, units: v.units, status: v.status }))
        .sort((a, b) => b.units - a.units),
      isSource: false,
      ...extra,
    });

    const nodes: MapNode[] = [];
    for (const s of db.prepare('SELECT id,name,location FROM suppliers ORDER BY id').all() as NamedRow[]) {
      nodes.push(mk(s.id, 'supplier', s.name, s.location, { isSource: s.id === sourceSupplier }));
    }
    const plant = mk('PLANT-01', 'plant', 'NovaFoods Processing Plant', 'Pune, Maharashtra');
    plant.units = { affected: affectedBatches, uncertain: 0, safe: 0, naiveRecall: affectedBatches };
    nodes.push(plant);
    for (const w of db.prepare('SELECT id,name,location,temperature_controlled as t FROM warehouses ORDER BY id').all() as (NamedRow & { t: number })[]) {
      nodes.push(mk(w.id, 'warehouse', w.name, w.location, { cold: w.t === 1 }));
    }
    for (const s of db.prepare('SELECT id,name,location FROM stores ORDER BY id').all() as NamedRow[]) {
      nodes.push(mk(s.id, 'store', s.name, s.location));
    }

    const shipRows = db.prepare('SELECT id,batch_id,product_id,origin,destination,quantity,status,estimated_arrival FROM shipments').all() as ShipmentRow[];
    const edgeSet = new Set<string>();
    const edges: Array<{ from: string; to: string }> = [];
    const addEdge = (from: string, to: string) => {
      const k = `${from}>${to}`;
      if (!edgeSet.has(k)) { edgeSet.add(k); edges.push({ from, to }); }
    };
    for (const n of nodes) if (n.kind === 'supplier') addEdge(n.id, 'PLANT-01');
    for (const n of nodes) if (n.kind === 'warehouse') addEdge('PLANT-01', n.id);
    for (const s of shipRows) addEdge(s.origin, s.destination);

    const shipments: MapShipment[] = shipRows
      .filter((s) => s.status === 'in_transit')
      .map((s) => {
        const st = batchStatus.get(s.batch_id) ?? 'safe';
        return {
          id: s.id,
          batchId: s.batch_id,
          product: products.get(s.product_id) ?? s.product_id,
          origin: s.origin,
          destination: s.destination,
          quantity: s.quantity,
          eta: s.estimated_arrival,
          impact: st === 'affected' || st === 'source' ? 'affected' : st === 'uncertain' ? 'uncertain' : 'safe',
        };
      });

    const c = plan.comparison;
    const body: NetworkMap = {
      incident: { id: incident.id, title: incident.title, sourceLot: incident.source_lot, severity: incident.severity },
      nodes,
      edges,
      shipments,
      totals: {
        affected: impact.affectedUnits,
        uncertain: impact.uncertainUnits,
        safe: impact.safeUnits,
        sold: impact.soldUnits,
        logisUnits: c.logis.totalUnits,
        naiveUnits: c.naive.totalUnits,
        logisCost: c.logis.totalCost,
        naiveCost: c.naive.totalCost,
        costSaved: c.costSaved,
        unitsSaved: c.unnecessaryRecallAvoided,
      },
      isDemo: false,
    };
    return NextResponse.json({ data: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: { code: 'NETWORK_MAP_ERROR', message } }, { status: 500 });
  } finally {
    db.close();
  }
}
