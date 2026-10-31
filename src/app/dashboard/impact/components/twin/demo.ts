import type { MapNode, MapShipment, NetworkMap, StockLine, UnitSplit } from '@/lib/types/network';

const split = (affected: number, uncertain: number, safe: number): UnitSplit => ({
  affected, uncertain, safe, naiveRecall: affected + uncertain + safe,
});

const line = (product: string, batch: string, units: number, status: string): StockLine => ({
  label: `${product} · ${batch}`, product, batch, units, status, received: false,
});

function demoStock(u: UnitSplit): StockLine[] {
  const safeA = Math.round(u.safe * 0.45);
  const safeB = Math.round(u.safe * 0.35);
  return [
    line('Toned Milk 1L', 'B51', u.affected, 'affected'),
    line('Toned Milk 1L', 'B56', u.uncertain, 'uncertain'),
    line('Paneer 200g', 'B58', safeA, 'safe'),
    line('Greek Yogurt 400g', 'B61', safeB, 'safe'),
    line('Butter 100g', 'B63', u.safe - safeA - safeB, 'safe'),
  ].filter((s) => s.units > 0);
}

const node = (id: string, kind: MapNode['kind'], name: string, location: string, units: UnitSplit, extra?: Partial<MapNode>): MapNode => ({
  id, kind, name, location, units, isSource: false,
  stock: units.naiveRecall > 0 ? demoStock(units) : [],
  ...extra,
});

export function buildDemoNetwork(): NetworkMap {
  const nodes: MapNode[] = [
    node('SUP-001', 'supplier', 'Greenfield Dairy Co.', 'Anand, Gujarat', split(0, 0, 0), { isSource: true }),
    node('SUP-002', 'supplier', 'PureGrain Mills', 'Indore, MP', split(0, 0, 0)),
    node('SUP-003', 'supplier', 'FreshHarvest Farms', 'Nashik, MH', split(0, 0, 0)),
    node('PLANT-01', 'plant', 'NovaFoods Processing Plant', 'Pune, Maharashtra', split(5, 0, 0)),
    node('WH-001', 'warehouse', 'NovaFoods Central Hub', 'Mumbai', split(2400, 300, 3100), { cold: true }),
    node('WH-002', 'warehouse', 'NovaFoods North DC', 'Delhi NCR', split(1800, 0, 2600), { cold: true }),
    node('WH-003', 'warehouse', 'NovaFoods South DC', 'Bengaluru', split(900, 250, 2900)),
    node('WH-004', 'warehouse', 'NovaFoods West Cold Storage', 'Ahmedabad', split(0, 180, 2400), { cold: true }),
    node('WH-005', 'warehouse', 'NovaFoods East DC', 'Kolkata', split(0, 0, 1900)),
  ];
  const storeNames = ['Mumbai Central', 'Andheri', 'Pune', 'Thane', 'Connaught Place', 'Gurugram', 'Noida', 'Indiranagar', 'Koramangala', 'Ahmedabad', 'Surat', 'Salt Lake'];
  storeNames.forEach((name, k) => {
    const units = k < 7 ? split(40 - k * 3, 0, 20) : k < 9 ? split(0, 25, 30) : split(0, 0, 35);
    nodes.push(node(`ST-${String(k + 1).padStart(3, '0')}`, 'store', `FreshMart ${name}`, name, units));
  });

  const edges: NetworkMap['edges'] = [];
  ['SUP-001', 'SUP-002', 'SUP-003'].forEach((s) => edges.push({ from: s, to: 'PLANT-01' }));
  ['WH-001', 'WH-002', 'WH-003', 'WH-004', 'WH-005'].forEach((w) => edges.push({ from: 'PLANT-01', to: w }));
  const whFor = ['WH-001', 'WH-001', 'WH-001', 'WH-001', 'WH-002', 'WH-002', 'WH-002', 'WH-003', 'WH-003', 'WH-004', 'WH-004', 'WH-005'];
  whFor.forEach((w, k) => edges.push({ from: w, to: `ST-${String(k + 1).padStart(3, '0')}` }));

  const shipments: MapShipment[] = [0, 1, 4, 5, 7, 8, 9, 11].map((k, i) => ({
    id: `SH-D${String(i + 1).padStart(3, '0')}`,
    batchId: k < 7 ? 'B51' : k < 9 ? 'B56' : 'B58',
    product: k < 9 ? 'Toned Milk 1L' : 'Paneer 200g',
    origin: whFor[k],
    destination: `ST-${String(k + 1).padStart(3, '0')}`,
    quantity: 12 + i * 2,
    eta: new Date(Date.now() + (i + 1) * 3600_000).toISOString(),
    impact: k < 7 ? 'affected' : k < 9 ? 'uncertain' : 'safe',
  }));

  return {
    incident: { id: 'INC-001', title: 'Microbial Contamination — Lot MILK-204', sourceLot: 'MILK-204', severity: 'critical' },
    nodes,
    edges,
    shipments,
    totals: {
      affected: 7776, uncertain: 199, safe: 21456, sold: 2343,
      logisUnits: 9658, naiveUnits: 23999, logisCost: 146696, naiveCost: 425982, costSaved: 279287, unitsSaved: 14341,
    },
    hiddenStores: 0,
    isDemo: true,
  };
}
