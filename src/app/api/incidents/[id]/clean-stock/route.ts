import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

function getDb(): Database.Database {
  const dbPath = path.join(process.cwd(), 'logis.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export type CleanStockItem = {
  nodeId: string;
  units: number;
  warehouseName: string;
  lotId: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  try {
    const { id } = await params;
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    if (!incident) {
      return NextResponse.json(
        { error: { code: 'INCIDENT_NOT_FOUND', message: `Incident ${id} not found` } },
        { status: 404 }
      );
    }

    const sourceLotId = incident.source_lot;

    // Batches linked to this incident's source lot
    const affectedUsages = db.prepare(`
      SELECT DISTINCT batch_id FROM batch_lot_usage WHERE lot_id = ?
    `).all(sourceLotId) as any[];

    const affectedBatchSet = new Set(affectedUsages.map(u => u.batch_id));

    // Query warehouse inventory
    const invRows = db.prepare(`
      SELECT 
        inv.id as inv_id,
        inv.batch_id,
        inv.location_id,
        inv.quantity,
        w.name as warehouse_name
      FROM inventory inv
      LEFT JOIN warehouses w ON w.id = inv.location_id
      WHERE inv.quantity > 0
    `).all() as any[];

    // Fetch batch_lot_usage for all batches to inspect their lotIds
    const allUsages = db.prepare(`
      SELECT batch_id, lot_id FROM batch_lot_usage
    `).all() as any[];

    const batchToLotsMap = new Map<string, string[]>();
    for (const u of allUsages) {
      const list = batchToLotsMap.get(u.batch_id) || [];
      list.push(u.lot_id);
      batchToLotsMap.set(u.batch_id, list);
    }

    const releaseCandidates: CleanStockItem[] = [];
    const hold: CleanStockItem[] = [];

    for (const row of invRows) {
      const isAffectedBatch = affectedBatchSet.has(row.batch_id);
      const linkedLots = batchToLotsMap.get(row.batch_id) || [];
      const primaryLotId = linkedLots.length > 0 ? linkedLots[0] : 'UNKNOWN_LOT';
      const hasSourceLotConnection = linkedLots.includes(sourceLotId);

      const item: CleanStockItem = {
        nodeId: `WH-${row.location_id}-${row.inv_id}`,
        units: row.quantity,
        warehouseName: row.warehouse_name || row.location_id,
        lotId: primaryLotId,
      };

      // A pallet goes in releaseCandidates only if:
      // 1. Not linked to an affected batch
      // 2. Its lot_id has zero usage records connected to the incident's source lot
      // 3. Lot information exists (no missing records)
      if (!isAffectedBatch && !hasSourceLotConnection && linkedLots.length > 0) {
        releaseCandidates.push(item);
      } else {
        // Everything else, including missing records, goes in hold. Never auto-release anything.
        hold.push(item);
      }
    }

    return NextResponse.json({
      data: {
        releaseCandidates,
        hold,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'CLEAN_STOCK_QUERY_ERROR', message: error.message } },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}

