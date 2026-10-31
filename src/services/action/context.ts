// Builds the recall picture for an incident from real LOGIS records: affected batches and affected sites.
import type Database from 'better-sqlite3';
import { buildNetworkMap } from '@/services/networkMapService';
import { fetchAllData } from '@/services/incidentService';
import { computeImpact } from '@/services/impactService';
import { placeLocation, type LngLat } from '@/lib/geo/indiaPlaces';
import type { RecallContext } from './ai';

export interface ActionLocation {
  id: string;
  kind: 'warehouse' | 'store';
  name: string;
  location: string;
  lngLat: LngLat | null;
  precision: 'city' | 'state' | null;
  affected: number;
  uncertain: number;
  safe: number;
  inTransitShipments: number;
  batchIds: string[];
}

export interface RecallPicture {
  context: RecallContext;
  incidentType: string;
  locations: ActionLocation[];
  incidents: Array<{ id: string; title: string; severity: string; status: string }>;
}

interface IncidentRow { id: string; title: string; description: string; type: string; severity: string; status: string; source_lot: string; detected_at: string }
interface BatchRow { id: string; product_id: string; produced_at: string | null; quantity: number }

export function buildRecallPicture(db: Database.Database, incidentId: string | null): RecallPicture | null {
  const incidents = db.prepare('SELECT id,title,description,type,severity,status,source_lot,detected_at FROM incidents ORDER BY created_at DESC').all() as IncidentRow[];
  const incident =
    incidents.find((i) => i.id === incidentId) ??
    incidents.find((i) => i.status !== 'resolved' && i.severity === 'critical') ??
    incidents.find((i) => i.status !== 'resolved') ??
    incidents[0];
  if (!incident) return null;

  const map = buildNetworkMap(db, incident.id);
  const impact = computeImpact({ sourceLotId: incident.source_lot, ...fetchAllData(db) });
  const affectedBatchIds = impact.nodes.filter((n) => n.type === 'batch' && (n.status === 'affected' || n.status === 'source')).map((n) => n.id);
  const products = new Map((db.prepare('SELECT id, name FROM products').all() as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
  const batchRows = affectedBatchIds.length
    ? (db.prepare(`SELECT id, product_id, produced_at, quantity FROM batches WHERE id IN (${affectedBatchIds.map(() => '?').join(',')})`).all(...affectedBatchIds) as BatchRow[])
    : [];

  const locations: ActionLocation[] = map.nodes
    .filter((n): n is typeof n & { kind: 'warehouse' | 'store' } => (n.kind === 'warehouse' || n.kind === 'store') && n.units.affected + n.units.uncertain > 0)
    .map((n) => {
      const placed = placeLocation(n.location) ?? placeLocation(n.name);
      return {
        id: n.id,
        kind: n.kind,
        name: n.name,
        location: n.location,
        lngLat: placed?.lngLat ?? null,
        precision: placed?.precision ?? null,
        affected: n.units.affected,
        uncertain: n.units.uncertain,
        safe: n.units.safe,
        inTransitShipments: map.shipments.filter((s) => (s.origin === n.id || s.destination === n.id) && s.impact !== 'safe').length,
        batchIds: [...new Set(n.stock.filter((l) => l.status === 'affected' || l.status === 'uncertain').map((l) => l.batch))],
      };
    })
    .sort((a, b) => b.affected - a.affected);

  return {
    incidentType: incident.type,
    incidents: incidents.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status })),
    locations,
    context: {
      incidentId: incident.id,
      title: incident.title,
      description: incident.description,
      defectType: incident.type,
      severity: incident.severity,
      sourceLot: incident.source_lot,
      detectedAt: incident.detected_at,
      affectedUnits: map.totals.affected,
      batches: batchRows
        .map((b) => ({ batchId: b.id, product: products.get(b.product_id) ?? b.product_id, producedAt: b.produced_at, quantity: b.quantity }))
        .sort((a, b) => b.quantity - a.quantity),
    },
  };
}

export function contextFor(picture: RecallPicture, locationId: string | null): RecallContext {
  const loc = picture.locations.find((l) => l.id === locationId);
  if (!loc) return picture.context;
  const here = new Set(loc.batchIds);
  const batches = picture.context.batches.filter((b) => here.has(b.batchId));
  return {
    ...picture.context,
    batches: batches.length ? batches : picture.context.batches,
    location: { id: loc.id, name: loc.name, affectedUnits: loc.affected, uncertainUnits: loc.uncertain },
  };
}
