import Database from 'better-sqlite3';
import path from 'path';
import { computeCUS, type AffectedNode, type CUSResult } from '@/lib/cus';

export type RankedCutPoint = {
  nodeId: string;
  nodeType: 'productionLine' | 'warehouse' | 'shipment';
  units: number;
  confidence: 'confirmed' | 'probable' | 'unknown';
  hours: number;
  urgency: number;
  location?: string;
  description: string;
};

export type CleanReleaseCandidate = {
  nodeId: string;
  locationId: string;
  locationName: string;
  units: number; // estimated
  productId: string;
  productName: string;
  status: 'pending_qa_signoff';
  estimatedRiskAvoidanceInr: number;
};

export type IncidentCUSPayload = {
  incidentId: string;
  cus: CUSResult;
  topCutPoints: RankedCutPoint[];
  affectedNodes: AffectedNode[];
  cleanStock: {
    totalSafeUnits: number; // estimated
    releaseCandidates: CleanReleaseCandidate[];
    pendingReviewCount: number;
    notice: string;
  };
};

function getDb(): Database.Database {
  const dbPath = path.join(process.cwd(), 'logis.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function loadIncidentCUS(incidentId: string): IncidentCUSPayload {
  const db = getDb();
  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const sourceLotId = incident.source_lot;

    // 1. Fetch batch lot usages linked to source lot
    const usages = db.prepare(`
      SELECT blu.batch_id, blu.confidence, b.line_id, b.produced_at, b.quantity as batch_quantity, b.product_id
      FROM batch_lot_usage blu
      JOIN batches b ON b.id = blu.batch_id
      WHERE blu.lot_id = ?
    `).all(sourceLotId) as any[];

    const batchMap = new Map<string, { confidence: 'confirmed' | 'probable' | 'unknown'; lineId: string; productId: string; producedAt: string }>();
    for (const u of usages) {
      const conf: 'confirmed' | 'probable' | 'unknown' =
        u.confidence === 'confirmed' ? 'confirmed' : u.confidence === 'probable' ? 'probable' : 'unknown';
      batchMap.set(u.batch_id, {
        confidence: conf,
        lineId: u.line_id,
        productId: u.product_id,
        producedAt: u.produced_at,
      });
    }

    const affectedBatchIds = Array.from(batchMap.keys());

    // Compute downstream dispatched/stored quantities per batch (inventory + shipments)
    const batchInvUnits = new Map<string, number>();
    const batchShpUnits = new Map<string, number>();
    const batchDownstreamUnits = new Map<string, number>();
    if (affectedBatchIds.length > 0) {
      const placeholders = affectedBatchIds.map(() => '?').join(',');
      const invSums = db.prepare(`
        SELECT batch_id, SUM(quantity) as total_inv
        FROM inventory
        WHERE batch_id IN (${placeholders})
        GROUP BY batch_id
      `).all(...affectedBatchIds) as any[];

      for (const row of invSums) {
        batchInvUnits.set(row.batch_id, row.total_inv || 0);
        batchDownstreamUnits.set(row.batch_id, (batchDownstreamUnits.get(row.batch_id) || 0) + (row.total_inv || 0));
      }

      const shpSums = db.prepare(`
        SELECT batch_id, SUM(quantity) as total_shp
        FROM shipments
        WHERE batch_id IN (${placeholders})
        GROUP BY batch_id
      `).all(...affectedBatchIds) as any[];

      for (const row of shpSums) {
        batchShpUnits.set(row.batch_id, row.total_shp || 0);
        batchDownstreamUnits.set(row.batch_id, (batchDownstreamUnits.get(row.batch_id) || 0) + (row.total_shp || 0));
      }
    }

    // 2. Map existing data into AffectedNode[]
    const affectedNodes: AffectedNode[] = [];

    // Diagnostic accumulators for LINE-L3 logging
    let l3TotalBatchQuantity = 0;
    let l3TotalInventoryQuantity = 0;
    let l3TotalShipmentQuantity = 0;
    let l3RemainingOnLine = 0;

    // A. Production Lines (from affected batches)
    const lineBatchGroups = new Map<string, { batchIds: string[]; units: number; confidence: 'confirmed' | 'probable' | 'unknown'; producedAt: string }>();
    for (const u of usages) {
      const totalBatchQty = u.batch_quantity || 0;
      const invQty = batchInvUnits.get(u.batch_id) || 0;
      const shpQty = batchShpUnits.get(u.batch_id) || 0;
      const downstreamQty = batchDownstreamUnits.get(u.batch_id) || 0;
      const remainingOnLine = Math.max(0, totalBatchQty - downstreamQty);

      if (u.line_id === 'L3') {
        l3TotalBatchQuantity += totalBatchQty;
        l3TotalInventoryQuantity += invQty;
        l3TotalShipmentQuantity += shpQty;
        l3RemainingOnLine += remainingOnLine;
      }

      const existing = lineBatchGroups.get(u.line_id);
      if (!existing) {
        lineBatchGroups.set(u.line_id, {
          batchIds: [u.batch_id],
          units: remainingOnLine,
          confidence: batchMap.get(u.batch_id)?.confidence || 'confirmed',
          producedAt: u.produced_at,
        });
      } else {
        existing.batchIds.push(u.batch_id);
        existing.units += remainingOnLine;
      }
    }

    console.log('[cusLoader] LINE-L3 values:', {
      totalBatchQuantity: l3TotalBatchQuantity,
      totalInventoryQuantity: l3TotalInventoryQuantity,
      totalShipmentQuantity: l3TotalShipmentQuantity,
      remainingOnLine: l3RemainingOnLine,
    });

    for (const [lineId, data] of lineBatchGroups.entries()) {
      affectedNodes.push({
        nodeId: `LINE-${lineId}`,
        nodeType: 'productionLine',
        palletIds: data.batchIds.map(b => `PLT-PROD-${b}`),
        units: data.units,
        confidence: data.confidence,
        dispatchedAt: data.producedAt || undefined,
      });
    }

    // B. Warehouse Inventory
    if (affectedBatchIds.length > 0) {
      const placeholders = affectedBatchIds.map(() => '?').join(',');
      const invRows = db.prepare(`
        SELECT inv.id, inv.batch_id, inv.location_id, inv.location_type, inv.quantity, inv.product_id, w.name as warehouse_name
        FROM inventory inv
        LEFT JOIN warehouses w ON w.id = inv.location_id
        WHERE inv.batch_id IN (${placeholders}) AND inv.quantity > 0
      `).all(...affectedBatchIds) as any[];

      for (const inv of invRows) {
        const batchInfo = batchMap.get(inv.batch_id);
        affectedNodes.push({
          nodeId: `WH-${inv.location_id}-${inv.id}`,
          nodeType: 'warehouse',
          palletIds: [`PLT-INV-${inv.id}`],
          units: inv.quantity,
          confidence: batchInfo?.confidence || 'confirmed',
          dispatchedAt: undefined,
        });
      }

      // C. Shipments (in_transit, delivered, etc.)
      const shpRows = db.prepare(`
        SELECT id, batch_id, product_id, origin, destination, quantity, status, departed_at, estimated_arrival
        FROM shipments
        WHERE batch_id IN (${placeholders})
      `).all(...affectedBatchIds) as any[];

      for (const shp of shpRows) {
        const batchInfo = batchMap.get(shp.batch_id);
        const isDelivered = shp.status === 'delivered';
        affectedNodes.push({
          nodeId: `SHP-${shp.id}`,
          nodeType: isDelivered ? 'delivered' : 'shipment',
          palletIds: [`PLT-SHP-${shp.id}`],
          units: shp.quantity,
          confidence: batchInfo?.confidence || 'confirmed',
          dispatchedAt: shp.departed_at || undefined,
        });
      }
    }

    // 3. Compute CUS
    const cus = computeCUS(affectedNodes);

    // 4. Rank cut points by (units * weight) / hours (non-delivered only)
    const confidenceWeights: Record<'confirmed' | 'probable' | 'unknown', number> = {
      confirmed: 1,
      probable: 0.6,
      unknown: 0.2,
    };
    const now = Date.now();

    const cutPointCandidates: RankedCutPoint[] = [];

    for (const node of affectedNodes) {
      if (node.nodeType === 'delivered') continue;

      let hours = 4;
      if (node.nodeType === 'productionLine') {
        hours = 0.5;
      } else if (node.nodeType === 'warehouse') {
        hours = 4;
      } else if (node.nodeType === 'shipment') {
        let hoursSinceDispatched = 0;
        if (node.dispatchedAt) {
          const t = new Date(node.dispatchedAt).getTime();
          if (!isNaN(t)) {
            hoursSinceDispatched = Math.max(0, (now - t) / (1000 * 60 * 60));
          }
        }
        hours = Math.max(0.25, 24 - hoursSinceDispatched);
      }

      const weight = confidenceWeights[node.confidence] ?? 0.2;
      const urgency = (node.units * weight) / hours;

      let description = '';
      if (node.nodeType === 'productionLine') {
        description = `Halt packaging & isolate output on ${node.nodeId}`;
      } else if (node.nodeType === 'warehouse') {
        description = `Dock quarantine on hold for ${node.nodeId}`;
      } else if (node.nodeType === 'shipment') {
        description = `Transit intercept notice on ${node.nodeId}`;
      }

      cutPointCandidates.push({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        units: node.units,
        confidence: node.confidence,
        hours: Math.round(hours * 10) / 10,
        urgency: Math.round(urgency * 100) / 100,
        description,
      });
    }

    cutPointCandidates.sort((a, b) => b.urgency - a.urgency);
    const topCutPoints = cutPointCandidates.slice(0, 3);

    // 5. Clean Stock - Hold-by-default logic:
    // Only inventory batches whose product is produced, but have NO lineage to sourceLotId
    const safeInventoryRows = db.prepare(`
      SELECT inv.id, inv.location_id, inv.quantity, inv.product_id, p.name as product_name, w.name as warehouse_name
      FROM inventory inv
      JOIN products p ON p.id = inv.product_id
      LEFT JOIN warehouses w ON w.id = inv.location_id
      WHERE inv.batch_id NOT IN (
        SELECT batch_id FROM batch_lot_usage WHERE lot_id = ?
      ) AND inv.quantity > 0
    `).all(sourceLotId) as any[];

    let totalSafeUnits = 0;
    const releaseCandidates: CleanReleaseCandidate[] = [];

    // Group safe inventory by location
    const safeLocationMap = new Map<string, { locationName: string; units: number; productId: string; productName: string }>();

    for (const row of safeInventoryRows) {
      totalSafeUnits += row.quantity;
      const key = `${row.location_id}-${row.product_id}`;
      const existing = safeLocationMap.get(key);
      if (!existing) {
        safeLocationMap.set(key, {
          locationName: row.warehouse_name || row.location_id,
          units: row.quantity,
          productId: row.product_id,
          productName: row.product_name,
        });
      } else {
        existing.units += row.quantity;
      }
    }

    // Pick top candidates whose lineage is verified separate
    for (const [locKey, val] of safeLocationMap.entries()) {
      // Estimated risk avoidance: holding penalty / disposal avoidance (estimated ₹45/unit)
      const estimatedRiskAvoidanceInr = val.units * 45;
      releaseCandidates.push({
        nodeId: `CLEAN-${locKey}`,
        locationId: locKey.split('-')[0],
        locationName: val.locationName,
        units: val.units,
        productId: val.productId,
        productName: val.productName,
        status: 'pending_qa_signoff',
        estimatedRiskAvoidanceInr,
      });
    }

    // Sort by largest units to salvage
    releaseCandidates.sort((a, b) => b.units - a.units);
    const topReleaseCandidates = releaseCandidates.slice(0, 3);

    return {
      incidentId,
      cus,
      topCutPoints,
      affectedNodes,
      cleanStock: {
        totalSafeUnits,
        releaseCandidates: topReleaseCandidates,
        pendingReviewCount: releaseCandidates.length,
        notice: 'Clean stock is on hold-by-default. Release candidates shown require formal QA sign-off prior to dispatch.',
      },
    };
  } finally {
    db.close();
  }
}
