// Read-only supply network snapshot shared by the 3D twin and the Action module
import type Database from 'better-sqlite3';
import { fetchAllData } from '@/services/incidentService';
import { computeImpact } from '@/services/impactService';
import { generateResponsePlan } from '@/services/responseService';
import type { NetworkMap, MapNode, MapShipment, NodeKind, UnitSplit, StockLine } from '@/lib/types/network';

interface IncidentRow { id: string; title: string; source_lot: string; severity: string; status: string }
interface CostRow { category: string; rate_per_unit: number }
interface InventoryRow { location_id: string; batch_id: string; product_id: string; quantity: number }
interface ShipmentRow { id: string; batch_id: string; product_id: string | null; origin: string; destination: string; quantity: number; status: string; estimated_arrival: string | null }
interface NamedRow { id: string; name: string; location: string }
interface LotRow { id: string; supplier_id: string }
interface ProductRow { id: string; name: string }
interface BatchRow { id: string; product_id: string }

type Tone = 'affected' | 'uncertain' | 'safe';
const emptySplit = (): UnitSplit => ({ affected: 0, uncertain: 0, safe: 0, naiveRecall: 0 });
const norm = (s: string) => s.trim().toLowerCase();
const toTone = (s: string | undefined): Tone => (s === 'affected' || s === 'source' ? 'affected' : s === 'uncertain' ? 'uncertain' : 'safe');

export function buildNetworkMap(db: Database.Database, wanted: string | null): NetworkMap {
  const incidents = db.prepare('SELECT id,title,source_lot,severity,status FROM incidents ORDER BY created_at DESC').all() as IncidentRow[];
  const incident =
    incidents.find((i) => i.id === wanted) ??
    incidents.find((i) => i.status !== 'resolved' && i.severity === 'critical') ??
    incidents.find((i) => i.status !== 'resolved') ??
    incidents[0] ??
    null;

  const all = fetchAllData(db);
  const impact = incident ? computeImpact({ sourceLotId: incident.source_lot, ...all }) : null;

  const rate = (rows: CostRow[], key: string, d: number) => rows.find((r) => r.category === key)?.rate_per_unit ?? d;
  const costRows = db.prepare('SELECT category, rate_per_unit FROM cost_rates').all() as CostRow[];
  const plan = impact
    ? generateResponsePlan({
        impact,
        costRates: {
          transport: rate(costRows, 'transport_per_unit', 8.5),
          disposal: rate(costRows, 'disposal_per_unit', 12),
          quarantine: rate(costRows, 'quarantine_per_unit', 3),
          customerRecall: rate(costRows, 'customer_recall_per_unit', 45),
          withdrawal: rate(costRows, 'withdrawal_per_unit', 15),
          verification: rate(costRows, 'verification_per_unit', 5),
        },
      })
    : null;

  const batchStatus = new Map<string, string>();
  for (const n of impact?.nodes ?? []) if (n.type === 'batch') batchStatus.set(n.id, n.status);

  const products = new Map((db.prepare('SELECT id,name FROM products').all() as ProductRow[]).map((p) => [p.id, p.name]));
  const batchProduct = new Map((db.prepare('SELECT id, product_id FROM batches').all() as BatchRow[]).map((b) => [b.id, b.product_id]));
  const suppliers = db.prepare('SELECT id,name,location FROM suppliers ORDER BY id').all() as NamedRow[];
  const warehouses = db.prepare('SELECT id,name,location,temperature_controlled as t FROM warehouses ORDER BY id').all() as (NamedRow & { t: number })[];
  const stores = db.prepare('SELECT id,name,location FROM stores ORDER BY id').all() as NamedRow[];

  // shipments may reference locations by id or by name (some imported datasets use names)
  const resolve = new Map<string, string>();
  for (const r of [...suppliers, ...warehouses, ...stores]) {
    resolve.set(norm(r.id), r.id);
    if (!resolve.has(norm(r.name))) resolve.set(norm(r.name), r.id);
  }
  const idOf = (ref: string | null | undefined) => (ref ? resolve.get(norm(ref)) ?? null : null);

  const units = new Map<string, UnitSplit>();
  const stock = new Map<string, Map<string, StockLine>>();
  const add = (loc: string, batch: string, productId: string | null, qty: number, received: boolean) => {
    const split = units.get(loc) ?? emptySplit();
    const tone = toTone(batchStatus.get(batch));
    split[tone] += qty;
    split.naiveRecall += qty;
    units.set(loc, split);
    const pid = productId ?? batchProduct.get(batch) ?? '';
    const product = products.get(pid) ?? (pid || 'Unknown product');
    const lines = stock.get(loc) ?? new Map<string, StockLine>();
    const key = `${pid}|${batch}`;
    const prev = lines.get(key);
    lines.set(key, { label: `${product} · ${batch}`, product, batch, units: (prev?.units ?? 0) + qty, status: tone, received });
    stock.set(loc, lines);
  };

  const inventory = db.prepare('SELECT location_id, batch_id, product_id, quantity FROM inventory WHERE quantity > 0').all() as InventoryRow[];
  const stocked = new Set<string>();
  for (const row of inventory) {
    const loc = idOf(row.location_id);
    if (!loc) continue;
    stocked.add(loc);
    add(loc, row.batch_id, row.product_id, row.quantity, false);
  }

  const shipRows = db.prepare('SELECT id,batch_id,product_id,origin,destination,quantity,status,estimated_arrival FROM shipments').all() as ShipmentRow[];
  const storeIds = new Set(stores.map((s) => s.id));
  for (const s of shipRows) {
    const to = idOf(s.destination);
    if (to && storeIds.has(to) && !stocked.has(to) && s.status === 'delivered') add(to, s.batch_id, s.product_id, s.quantity, true);
  }

  const lots = db.prepare('SELECT id, supplier_id FROM lots').all() as LotRow[];
  const sourceSupplier = incident ? lots.find((l) => l.id === incident.source_lot)?.supplier_id ?? null : null;
  const affectedBatches = [...batchStatus.values()].filter((s) => s === 'affected').length;

  const edges: Array<{ from: string; to: string }> = [];
  const edgeSet = new Set<string>();
  const addEdge = (from: string, to: string) => {
    const k = `${from}>${to}`;
    if (from !== to && !edgeSet.has(k)) {
      edgeSet.add(k);
      edges.push({ from, to });
    }
  };
  for (const s of shipRows) {
    const from = idOf(s.origin);
    const to = idOf(s.destination);
    if (from && to) addEdge(from, to);
  }
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));

  const mk = (id: string, kind: NodeKind, name: string, location: string, extra?: Partial<MapNode>): MapNode => ({
    id,
    kind,
    name,
    location,
    units: units.get(id) ?? emptySplit(),
    stock: [...(stock.get(id)?.values() ?? [])].sort((a, b) => b.units - a.units),
    isSource: false,
    ...extra,
  });

  const nodes: MapNode[] = [];
  for (const s of suppliers) nodes.push(mk(s.id, 'supplier', s.name, s.location, { isSource: s.id === sourceSupplier }));
  const plant = mk('PLANT-01', 'plant', 'Processing Plant', 'Production network');
  plant.units = { affected: affectedBatches, uncertain: 0, safe: 0, naiveRecall: affectedBatches };
  nodes.push(plant);
  for (const w of warehouses) nodes.push(mk(w.id, 'warehouse', w.name, w.location, { cold: w.t === 1 }));
  let hiddenStores = 0;
  for (const s of stores) {
    if (!linked.has(s.id) && !units.has(s.id)) {
      hiddenStores++;
      continue;
    }
    nodes.push(mk(s.id, 'store', s.name, s.location));
  }

  for (const n of nodes) if (n.kind === 'supplier') addEdge(n.id, 'PLANT-01');
  for (const n of nodes) if (n.kind === 'warehouse') addEdge('PLANT-01', n.id);

  const shipments: MapShipment[] = [];
  for (const s of shipRows) {
    if (s.status !== 'in_transit') continue;
    const origin = idOf(s.origin);
    const destination = idOf(s.destination);
    if (!origin || !destination) continue;
    const pid = s.product_id ?? batchProduct.get(s.batch_id) ?? '';
    shipments.push({
      id: s.id,
      batchId: s.batch_id,
      product: products.get(pid) ?? (pid || 'Shipment'),
      origin,
      destination,
      quantity: s.quantity,
      eta: s.estimated_arrival ?? '',
      impact: toTone(batchStatus.get(s.batch_id)),
    });
  }

  const c = plan?.comparison;
  const body: NetworkMap = {
    incident: incident
      ? { id: incident.id, title: incident.title, sourceLot: incident.source_lot, severity: incident.severity }
      : { id: '—', title: 'No active incident', sourceLot: '—', severity: 'low' },
    nodes,
    edges,
    shipments,
    totals: {
      affected: impact?.affectedUnits ?? 0,
      uncertain: impact?.uncertainUnits ?? 0,
      safe: impact?.safeUnits ?? 0,
      sold: impact?.soldUnits ?? 0,
      logisUnits: c?.logis.totalUnits ?? 0,
      naiveUnits: c?.naive.totalUnits ?? 0,
      logisCost: c?.logis.totalCost ?? 0,
      naiveCost: c?.naive.totalCost ?? 0,
      costSaved: c?.costSaved ?? 0,
      unitsSaved: c?.unnecessaryRecallAvoided ?? 0,
    },
    hiddenStores,
    isDemo: false,
  };
  return body;
}
