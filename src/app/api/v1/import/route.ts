// POST /api/v1/import - Robust transaction-safe operational importer with validation, dry-run, and dependency-order execution
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

interface EntityPayload {
  suppliers?: Array<{ id: string; name: string; location: string; contactEmail?: string; rating?: number }>;
  materials?: Array<{ id: string; name: string; supplierId: string; unit?: string; category?: string }>;
  lots?: Array<{ id: string; materialId: string; supplierId: string; quantity: number; unit?: string; expiresAt?: string; receivedAt?: string; status?: string }>;
  products?: Array<{ id: string; name: string; category?: string; unitPrice?: number; shelfLifeDays?: number }>;
  batches?: Array<{ id: string; productId: string; quantity: number; machineId?: string; lineId?: string; producedAt?: string; status?: string }>;
  batchLotUsage?: Array<{ id?: string; batchId: string; lotId: string; confidence?: 'confirmed' | 'probable' | 'unknown'; fractionUsed?: number }>;
  warehouses?: Array<{ id: string; name: string; location: string; capacity?: number; freeSlots?: number; available?: boolean; temperatureControlled?: boolean }>;
  inventory?: Array<{ id: string; productId: string; batchId: string; locationId: string; locationType: string; quantity: number; status?: string }>;
  shipments?: Array<{ id: string; batchId: string; productId?: string; origin: string; destination: string; quantity: number; status?: string; departedAt?: string; estimatedArrival?: string }>;
  stores?: Array<{ id: string; name: string; location: string; region?: string }>;
}

export async function POST(request: NextRequest) {
  let db: Database.Database | null = null;
  try {
    const body = await request.json();
    const validateOnly = Boolean(body.validateOnly);
    const mode = (body.mode === 'replace' ? 'replace' : 'append') as 'replace' | 'append';
    const sourceFile = body.sourceFile || 'imported_file.csv';
    const isSimulation = body.isSimulation !== undefined ? (body.isSimulation ? 1 : 0) : (sourceFile.toLowerCase().includes('sim') || body.datasetName?.toLowerCase().includes('sim') ? 1 : 0);
    const datasetName = body.datasetName || (mode === 'replace' ? (isSimulation ? 'Nestlé India (Maggi 2015 Simulation)' : 'Imported Operational Dataset') : 'Imported Dataset');
    const entities: EntityPayload = body.entities || {};

    db = new Database(path.join(process.cwd(), 'logis.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ensure dataset_meta table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS dataset_meta (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_file TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        mode TEXT NOT NULL,
        is_simulation INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 1. In 'replace' mode, parent lookups must come STRICTLY from the payload (since DB will be wiped)
    // In 'append' mode, parent lookups combine existing DB + payload
    const existingSuppliers = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM suppliers').all() as any[]).map(r => r.id));
    const existingMaterials = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM materials').all() as any[]).map(r => r.id));
    const existingLots = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM lots').all() as any[]).map(r => r.id));
    const existingProducts = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM products').all() as any[]).map(r => r.id));
    const existingBatches = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM batches').all() as any[]).map(r => r.id));
    const existingWarehouses = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM warehouses').all() as any[]).map(r => r.id));
    const existingStores = mode === 'replace' ? new Set<string>() : new Set((db.prepare('SELECT id FROM stores').all() as any[]).map(r => r.id));

    // Also build batch->productId lookup
    const batchToProduct = new Map<string, string>();
    if (mode === 'append') {
      (db.prepare('SELECT id, product_id FROM batches').all() as any[]).forEach(r => batchToProduct.set(r.id, r.product_id));
    }
    (entities.batches || []).forEach(b => batchToProduct.set(b.id, b.productId));

    // Sets of IDs to be inserted in this run
    const payloadSuppliers = new Set((entities.suppliers || []).map(s => s.id));
    const payloadMaterials = new Set((entities.materials || []).map(m => m.id));
    const payloadLots = new Set((entities.lots || []).map(l => l.id));
    const payloadProducts = new Set((entities.products || []).map(p => p.id));
    const payloadBatches = new Set((entities.batches || []).map(b => b.id));
    const payloadWarehouses = new Set((entities.warehouses || []).map(w => w.id));

    const errors: Array<{ entity: string; id: string; field: string; message: string }> = [];
    const skipped: Array<{ entity: string; id: string; reason: string }> = [];

    // --- Validation Phase (Collect all errors & skips before touching data) ---
    // Validate Materials
    const validMaterials: typeof entities.materials = [];
    for (const m of entities.materials || []) {
      if (!existingSuppliers.has(m.supplierId) && !payloadSuppliers.has(m.supplierId)) {
        errors.push({ entity: 'material', id: m.id, field: 'supplierId', message: `Referenced supplier '${m.supplierId}' not found.` });
      } else {
        validMaterials.push(m);
      }
    }

    // Validate Lots
    const validLots: typeof entities.lots = [];
    for (const l of entities.lots || []) {
      const hasMat = existingMaterials.has(l.materialId) || payloadMaterials.has(l.materialId);
      const hasSup = existingSuppliers.has(l.supplierId) || payloadSuppliers.has(l.supplierId);
      if (!hasMat) errors.push({ entity: 'lot', id: l.id, field: 'materialId', message: `Material '${l.materialId}' not found.` });
      if (!hasSup) errors.push({ entity: 'lot', id: l.id, field: 'supplierId', message: `Supplier '${l.supplierId}' not found.` });
      if (hasMat && hasSup) validLots.push(l);
    }

    // Validate Batches
    const validBatches: typeof entities.batches = [];
    for (const b of entities.batches || []) {
      const hasPrd = existingProducts.has(b.productId) || payloadProducts.has(b.productId);
      if (!hasPrd) {
        errors.push({ entity: 'batch', id: b.id, field: 'productId', message: `Product '${b.productId}' not found.` });
      } else {
        validBatches.push(b);
      }
    }

    // Validate BatchLotUsage (Skip dangling references with explanation, per policy)
    const validBatchLotUsage: typeof entities.batchLotUsage = [];
    for (const u of entities.batchLotUsage || []) {
      const hasBatch = existingBatches.has(u.batchId) || payloadBatches.has(u.batchId);
      const hasLot = existingLots.has(u.lotId) || payloadLots.has(u.lotId);
      if (!hasBatch || !hasLot) {
        skipped.push({
          entity: 'batchLotUsage',
          id: u.id || `blu_${u.batchId}_${u.lotId}`,
          reason: `Skipped dangling link: ${!hasBatch ? `Batch '${u.batchId}' missing` : ''} ${!hasLot ? `Lot '${u.lotId}' missing` : ''}`.trim()
        });
      } else {
        validBatchLotUsage.push(u);
      }
    }

    // Validate Inventory/Pallets (Skip if batch missing, per policy)
    const validInventory: typeof entities.inventory = [];
    for (const inv of entities.inventory || []) {
      const hasPrd = existingProducts.has(inv.productId) || payloadProducts.has(inv.productId);
      const hasBatch = existingBatches.has(inv.batchId) || payloadBatches.has(inv.batchId);
      if (!hasBatch || !hasPrd) {
        skipped.push({
          entity: 'inventory',
          id: inv.id,
          reason: `Skipped pallet: ${!hasBatch ? `Batch ID '${inv.batchId}' missing or unregistered` : ''} ${!hasPrd ? `Product '${inv.productId}' missing` : ''}`.trim()
        });
      } else {
        validInventory.push(inv);
      }
    }

    // Validate Shipments
    const validShipments: typeof entities.shipments = [];
    for (const sh of entities.shipments || []) {
      const hasBatch = existingBatches.has(sh.batchId) || payloadBatches.has(sh.batchId);
      // Auto-resolve productId from batch if missing or mismatched
      const resolvedProduct = sh.productId || batchToProduct.get(sh.batchId);
      const hasPrd = resolvedProduct && (existingProducts.has(resolvedProduct) || payloadProducts.has(resolvedProduct));

      if (!hasBatch || !hasPrd) {
        skipped.push({
          entity: 'shipment',
          id: sh.id,
          reason: `Skipped shipment: ${!hasBatch ? `Batch '${sh.batchId}' missing` : ''} ${!hasPrd ? `Product '${resolvedProduct || 'unknown'}' missing` : ''}`.trim()
        });
      } else {
        validShipments.push({ ...sh, productId: resolvedProduct });
      }
    }

    // Hard errors check: If fundamental entities have FK failures, fail early before writing
    if (errors.length > 0) {
      db.close();
      return NextResponse.json({
        status: 'failed',
        message: `Validation failed with ${errors.length} fatal error(s). Zero rows written.`,
        inserted: { suppliers: 0, materials: 0, lots: 0, products: 0, warehouses: 0, stores: 0, batches: 0, batchLotUsage: 0, inventory: 0, shipments: 0 },
        skipped,
        errors,
      }, { status: 400 });
    }

    // Dry Run mode: Return validation findings without writing to database
    if (validateOnly) {
      db.close();
      const wouldInsert = {
        suppliers: (entities.suppliers || []).length,
        materials: validMaterials.length,
        lots: validLots.length,
        products: (entities.products || []).length,
        warehouses: (entities.warehouses || []).length,
        stores: (entities.stores || []).length,
        batches: validBatches.length,
        batchLotUsage: validBatchLotUsage.length,
        inventory: validInventory.length,
        shipments: validShipments.length,
      };
      const allBlu = entities.batchLotUsage || [];
      const confidenceStats = {
        confirmed: allBlu.filter(u => (u.confidence || 'confirmed') === 'confirmed').length,
        probable: allBlu.filter(u => u.confidence === 'probable').length,
        unknown: allBlu.filter(u => u.confidence === 'unknown').length,
      };
      return NextResponse.json({
        status: skipped.length > 0 ? 'partial' : 'success',
        validateOnly: true,
        message: skipped.length > 0 ? `Dry run completed: ${skipped.length} row(s) will be skipped as dangling references.` : 'Dry run successful: 0 errors, 100% rows verified.',
        inserted: wouldInsert,
        skipped,
        confidenceStats,
        errors: [],
      });
    }

    // 2. Execution Phase: Strict Dependency Order inside ONE Transaction
    const inserted = {
      suppliers: 0,
      materials: 0,
      lots: 0,
      products: 0,
      warehouses: 0,
      stores: 0,
      batches: 0,
      batchLotUsage: 0,
      inventory: 0,
      shipments: 0,
    };

    const runTransaction = db.transaction(() => {
      // If REPLACE mode, perform guaranteed atomic wipeout:
      // Turn foreign_keys OFF during bulk table wipeout to guarantee zero FK conflicts, then turn back ON.
      if (mode === 'replace') {
        db!.pragma('foreign_keys = OFF');

        const tablesToDeleteInOrder = [
          'timeline_events',
          'inspections',
          'processed_events',
          'demand',
          'machines',
          'workers',
          'trucks',
          'routes',
          'cost_rates',
          'shipments',
          'inventory',
          'batch_lot_usage',
          'batches',
          'lots',
          'materials',
          'products',
          'warehouses',
          'stores',
          'suppliers',
          'incidents',
        ];

        // Delete audit log entries except previous 'dataset replaced' audit records
        try {
          db!.prepare("DELETE FROM audit_log WHERE action != 'dataset replaced'").run();
        } catch {}

        for (const tbl of tablesToDeleteInOrder) {
          try {
            db!.prepare(`DELETE FROM ${tbl}`).run();
          } catch (delErr: any) {
            // Ignore if optional table doesn't exist yet
          }
        }

        db!.pragma('foreign_keys = ON');
      }

      // 1. Suppliers
      if (entities.suppliers?.length) {
        const stmt = db!.prepare(`
          INSERT INTO suppliers (id, name, location, contact_email, rating)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, location=excluded.location
        `);
        for (const s of entities.suppliers) {
          stmt.run(s.id, s.name, s.location, s.contactEmail || 'supplier@logis.internal', s.rating || 4.5);
          inserted.suppliers++;
        }
      }

      // 2. Materials
      if (validMaterials.length) {
        const stmt = db!.prepare(`
          INSERT INTO materials (id, name, supplier_id, unit, category)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name
        `);
        for (const m of validMaterials) {
          stmt.run(m.id, m.name, m.supplierId, m.unit || 'kg', m.category || 'Raw Material');
          inserted.materials++;
        }
      }

      // 3. Lots
      if (validLots.length) {
        const stmt = db!.prepare(`
          INSERT INTO lots (id, material_id, supplier_id, received_at, quantity, unit, expires_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity, status=excluded.status
        `);
        for (const l of validLots) {
          stmt.run(
            l.id, l.materialId, l.supplierId,
            l.receivedAt || new Date().toISOString(),
            l.quantity, l.unit || 'kg',
            l.expiresAt || new Date(Date.now() + 86400000 * 180).toISOString(),
            l.status || 'active'
          );
          inserted.lots++;
        }
      }

      // 4. Products
      if (entities.products?.length) {
        const stmt = db!.prepare(`
          INSERT INTO products (id, name, category, unit_price, shelf_life_days)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit_price=excluded.unit_price
        `);
        for (const p of entities.products) {
          stmt.run(p.id, p.name, p.category || 'Finished Goods', p.unitPrice || 10, p.shelfLifeDays || 180);
          inserted.products++;
        }
      }

      // 5. Warehouses
      if (entities.warehouses?.length) {
        const stmt = db!.prepare(`
          INSERT INTO warehouses (id, name, location, capacity, free_slots, available, temperature_controlled)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, capacity=excluded.capacity
        `);
        for (const w of entities.warehouses) {
          const cap = w.capacity || 100000;
          stmt.run(w.id, w.name, w.location, cap, Math.floor(cap * 0.4), 1, 1);
          inserted.warehouses++;
        }
      }

      // 6. Stores
      if (entities.stores?.length) {
        const stmt = db!.prepare(`
          INSERT INTO stores (id, name, location, region)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, location=excluded.location
        `);
        for (const st of entities.stores) {
          stmt.run(st.id, st.name, st.location, (st as any).region || 'North');
          inserted.stores++;
        }
      }

      // 7. Batches
      if (validBatches.length) {
        const stmt = db!.prepare(`
          INSERT INTO batches (id, product_id, produced_at, quantity, status, machine_id, line_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity, status=excluded.status
        `);
        for (const b of validBatches) {
          stmt.run(b.id, b.productId, b.producedAt || new Date().toISOString(), b.quantity, b.status || 'active', b.machineId || 'LINE-1', b.lineId || 'L1');
          inserted.batches++;
        }
      }

      // 8. BatchLotUsage
      if (validBatchLotUsage.length) {
        const stmt = db!.prepare(`
          INSERT INTO batch_lot_usage (id, batch_id, lot_id, confidence, fraction_used)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET confidence=excluded.confidence, fraction_used=excluded.fraction_used
        `);
        for (const u of validBatchLotUsage) {
          const id = u.id || `blu_${u.batchId}_${u.lotId}`;
          stmt.run(id, u.batchId, u.lotId, u.confidence || 'confirmed', u.fractionUsed ?? 1.0);
          inserted.batchLotUsage++;
        }
      }

      // 9. Inventory (Pallets)
      if (validInventory.length) {
        const stmt = db!.prepare(`
          INSERT INTO inventory (id, product_id, batch_id, location_id, location_type, quantity, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity, status=excluded.status
        `);
        for (const inv of validInventory) {
          stmt.run(inv.id, inv.productId, inv.batchId, inv.locationId, inv.locationType, inv.quantity, inv.status || 'available');
          inserted.inventory++;
        }
      }

      // 10. Shipments
      if (validShipments.length) {
        const stmt = db!.prepare(`
          INSERT INTO shipments (id, batch_id, product_id, origin, destination, quantity, status, departed_at, estimated_arrival)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET status=excluded.status
        `);
        for (const sh of validShipments) {
          const now = new Date();
          const departed = sh.departedAt || new Date(now.getTime() - 86400000 * 2).toISOString();
          const eta = sh.estimatedArrival || new Date(now.getTime() + 86400000).toISOString();
          stmt.run(sh.id, sh.batchId, sh.productId!, sh.origin, sh.destination, sh.quantity, sh.status || 'in_transit', departed, eta);
          inserted.shipments++;
        }
      }

      // --- FIX 1: Generate placeholder resource rows in Replace mode if empty ---
      if (mode === 'replace') {
        // (a) cost_rates: realistic FMCG India estimates
        const costCount = (db!.prepare('SELECT COUNT(*) as c FROM cost_rates').get() as any).c;
        if (costCount === 0) {
          const insCost = db!.prepare('INSERT INTO cost_rates (id, category, rate_per_unit, description) VALUES (?, ?, ?, ?)');
          insCost.run('CR-001', 'transport_per_unit', 12.0, 'Standard freight per km / unit (₹12/km) [source: assumed]');
          insCost.run('CR-002', 'disposal_per_unit', 45.0, 'Disposal / destruction per unit (₹45/unit) [source: assumed]');
          insCost.run('CR-003', 'quarantine_per_unit', 8.0, 'Holding warehouse cost per pallet/day (₹8/pallet/day) [source: assumed]');
          insCost.run('CR-004', 'customer_recall_per_unit', 45.0, 'Customer return / recall handling per unit (₹45) [source: assumed]');
          insCost.run('CR-005', 'withdrawal_per_unit', 15.0, 'Store withdrawal handling per unit (₹15) [source: assumed]');
          insCost.run('CR-006', 'verification_per_unit', 8000.0, 'NABL / ISO accredited re-test flat rate (₹8,000 flat) [source: assumed]');
          insCost.run('CR-007', 'changeover_per_machine', 2500.0, 'Machine setup / changeover cost (₹) [source: assumed]');
          insCost.run('CR-008', 'idle_penalty_per_hour', 500.0, 'Machine idle downtime penalty per hour (₹) [source: assumed]');
          insCost.run('CR-009', 'freight_expedited_per_km', 28.0, 'Expedited air/dedicated freight (₹28/km) [source: assumed]');
          insCost.run('CR-010', 'otif_penalty_key_account', 50000.0, 'Key account SLA delivery penalty (₹50,000 flat) [source: assumed]');
          insCost.run('CR-011', 'otif_penalty_distributor', 25000.0, 'Distributor delivery penalty (₹25,000) [source: assumed]');
          insCost.run('CR-012', 'otif_penalty_retail', 0.0, 'General retail delay penalty (₹0) [source: assumed]');
        }

        // (b) demand: generate one demand row per store/distributor in shipments
        const demandCount = (db!.prepare('SELECT COUNT(*) as c FROM demand').get() as any).c;
        if (demandCount === 0 && validShipments.length > 0) {
          const insDemand = db!.prepare('INSERT INTO demand (id, product_id, units, deadline, unit_value, priority) VALUES (?, ?, ?, ?, ?, ?)');
          // Map latest departure date across shipments
          let maxDepartedMs = 0;
          for (const s of validShipments) {
            const ms = new Date(s.departedAt || Date.now()).getTime();
            if (ms > maxDepartedMs) maxDepartedMs = ms;
          }
          if (maxDepartedMs === 0) maxDepartedMs = Date.now();
          const deadlineIso = new Date(maxDepartedMs + 14 * 86400000).toISOString().split('T')[0];

          // Group shipped quantity per (destination store, product)
          const storeDemandMap = new Map<string, { productId: string; qty: number }>();
          for (const sh of validShipments) {
            const key = `${sh.destination}__${sh.productId}`;
            const existing = storeDemandMap.get(key) || { productId: sh.productId!, qty: 0 };
            existing.qty += sh.quantity;
            storeDemandMap.set(key, existing);
          }

          let demIdx = 1;
          for (const [key, d] of storeDemandMap.entries()) {
            const prd = entities.products?.find(p => p.id === d.productId);
            const unitVal = prd?.unitPrice || 70;
            const priority = demIdx % 3 === 0 ? 'critical' : demIdx % 2 === 0 ? 'high' : 'medium';
            insDemand.run(`DEM-IMP-${String(demIdx++).padStart(3, '0')}`, d.productId, d.qty, deadlineIso, unitVal, priority);
          }
        }

        // (c) machines: generate one machine row per unique production line in batches
        const machineCount = (db!.prepare('SELECT COUNT(*) as c FROM machines').get() as any).c;
        if (machineCount === 0 && validBatches.length > 0) {
          const insMachine = db!.prepare('INSERT INTO machines (id, name, capacity_per_day, compatible_products, utilization, available, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
          const lineMap = new Map<string, { maxQty: number; productIds: Set<string> }>();
          for (const b of validBatches) {
            const line = b.lineId || b.machineId || 'LINE-1';
            const cur = lineMap.get(line) || { maxQty: 0, productIds: new Set<string>() };
            if (b.quantity > cur.maxQty) cur.maxQty = b.quantity;
            if (b.productId) cur.productIds.add(b.productId);
            lineMap.set(line, cur);
          }

          let mIdx = 1;
          for (const [line, data] of lineMap.entries()) {
            const mId = `M-${String(mIdx++).padStart(2, '0')}`;
            const compPrds = JSON.stringify(Array.from(data.productIds));
            insMachine.run(mId, `Production Line ${line}`, Math.max(1000, data.maxQty), compPrds, 0.80, 1, 'running');
          }
        }

        // (d) workers: 2 shifts per plant/warehouse (day shift, night shift), headcount=12 each
        const workerCount = (db!.prepare('SELECT COUNT(*) as c FROM workers').get() as any).c;
        if (workerCount === 0) {
          const insWorker = db!.prepare('INSERT INTO workers (id, name, skills, available, status, shift_hours) VALUES (?, ?, ?, ?, ?, ?)');
          const locations = entities.warehouses?.length ? entities.warehouses : [{ id: 'PLANT-01', name: 'Main Manufacturing Plant' }];
          let wIdx = 1;
          for (const loc of locations) {
            insWorker.run(
              `W-${String(wIdx++).padStart(2, '0')}`,
              `${loc.name} — Day Shift Crew (12 Ops)`,
              JSON.stringify(['dairy_processing', 'food_manufacturing', 'packaging', 'quality_control', 'pasteurization']),
              1,
              'active',
              8
            );
            insWorker.run(
              `W-${String(wIdx++).padStart(2, '0')}`,
              `${loc.name} — Night Shift Crew (12 Ops)`,
              JSON.stringify(['dairy_processing', 'food_manufacturing', 'packaging', 'cold_storage', 'sanitation']),
              1,
              'active',
              8
            );
          }
        }

        // (e) trucks: generate 10 generic trucks with capacity 800 units each, status = available
        const truckCount = (db!.prepare('SELECT COUNT(*) as c FROM trucks').get() as any).c;
        if (truckCount === 0) {
          const insTruck = db!.prepare('INSERT INTO trucks (id, name, capacity, available, status, current_route) VALUES (?, ?, ?, ?, ?, ?)');
          for (let i = 1; i <= 10; i++) {
            insTruck.run(
              `TRK-${String(i).padStart(3, '0')}`,
              `Dedicated Freight Reefer Unit #${i}`,
              800,
              1,
              'available',
              null
            );
          }
        }

        // (f) routes: between every warehouse pair using straight-line distance estimates
        const routeCount = (db!.prepare('SELECT COUNT(*) as c FROM routes').get() as any).c;
        if (routeCount === 0 && entities.warehouses && entities.warehouses.length > 1) {
          const insRoute = db!.prepare('INSERT INTO routes (id, origin, destination, distance_km, estimated_hours) VALUES (?, ?, ?, ?, ?)');
          const whs = entities.warehouses;
          const distanceTable: Record<string, number> = {
            'delhi-lucknow': 500,
            'delhi-mumbai': 1400,
            'delhi-kolkata': 1500,
            'delhi-bengaluru': 2100,
            'delhi-hyderabad': 1600,
            'lucknow-kolkata': 1000,
            'lucknow-mumbai': 1400,
            'mumbai-bengaluru': 980,
            'mumbai-hyderabad': 710,
            'kolkata-hyderabad': 1500,
            'bengaluru-hyderabad': 570,
          };

          let rIdx = 1;
          for (let i = 0; i < whs.length; i++) {
            for (let j = i + 1; j < whs.length; j++) {
              const w1 = whs[i];
              const w2 = whs[j];
              const nameKey1 = (w1.id + ' ' + w1.name + ' ' + w1.location).toLowerCase();
              const nameKey2 = (w2.id + ' ' + w2.name + ' ' + w2.location).toLowerCase();

              let dist = 1000;
              for (const [pair, d] of Object.entries(distanceTable)) {
                const [c1, c2] = pair.split('-');
                if ((nameKey1.includes(c1) && nameKey2.includes(c2)) || (nameKey1.includes(c2) && nameKey2.includes(c1))) {
                  dist = d;
                  break;
                }
              }

              const transitHours = Math.round(dist / 50);
              insRoute.run(`RT-${String(rIdx++).padStart(3, '0')}`, w1.id, w2.id, dist, transitHours);
              insRoute.run(`RT-${String(rIdx++).padStart(3, '0')}`, w2.id, w1.id, dist, transitHours);
            }
          }
        }
      }

      // 11. Seed Incident for imported simulation network (if replace mode and lots exist)
      if (mode === 'replace') {
        const nowIso = new Date().toISOString();
        const hasNestleHeroLot = validLots.some(l => l.id === 'LOT-NESTLE-001');

        if (hasNestleHeroLot) {
          const incStmt = db!.prepare(`
            INSERT INTO incidents (id, type, source_lot, severity, detected_at, location, status, title, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          incStmt.run(
            'INC-2015-UP-001',
            'contamination',
            'LOT-NESTLE-001',
            'critical',
            '2015-04-30T10:00:00Z',
            'Barabanki, Uttar Pradesh',
            'pending',
            'Barabanki UP State Lab Finding — Maggi Masala 70g (Contested Protocol)',
            'Contested state food laboratory report citing parameters above limits. Recommended action: HOLD + NABL ACCREDITED RE-TEST within 5 days rather than nationwide destruction.',
            nowIso,
            nowIso
          );

          incStmt.run(
            'INC-2015-SPICE-002',
            'component_defect',
            'LOT-NESTLE-005',
            'high',
            '2015-05-12T14:30:00Z',
            'Malabar Spices & Oleoresins (Kochi, Kerala)',
            'pending',
            'Supplier COA Retest Failure — Spice Blend Silo-02',
            'Quality control re-test detected volatile oil variance on spice blend lot LOT-NESTLE-005. Silo-02 quarantined across Nanjangud and Bicholim plants.',
            nowIso,
            nowIso
          );
        } else if (validLots.length > 0) {
          // Generic first lot incident for any other custom dataset
          const firstLot = validLots[0];
          db!.prepare(`
            INSERT INTO incidents (id, type, source_lot, severity, detected_at, location, status, title, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'INC-IMP-001',
            'contamination',
            firstLot.id,
            'critical',
            nowIso,
            'Regional Distribution Hub',
            'pending',
            `Quality Disruption Alert — Lot ${firstLot.id}`,
            `Automated incident initialized on imported lot ${firstLot.id} for graph blast-radius analysis.`,
            nowIso,
            nowIso
          );
        }
      }

      // Record dataset_meta row
      const nowIso = new Date().toISOString();
      db!.prepare(`
        INSERT INTO dataset_meta (id, name, source_file, imported_at, mode, is_simulation)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`ds_${Date.now()}`, datasetName, sourceFile, nowIso, mode, isSimulation);

      // Add audit event: "dataset replaced" or "dataset appended"
      try {
        db!.prepare(`
          INSERT INTO audit_log (id, action, entity, entity_id, details, timestamp, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `audit_${Date.now()}`,
          mode === 'replace' ? 'dataset replaced' : 'dataset appended',
          'dataset_meta',
          datasetName,
          JSON.stringify({ mode, sourceFile, inserted }),
          nowIso,
          'operations_manager'
        );
      } catch (auditErr) {
        console.warn('Could not write audit log for dataset import:', auditErr);
      }
    });

    runTransaction();
    db.close();

    const status = skipped.length > 0 ? 'partial' : 'success';

    // Compute confidence breakdown from batchLotUsage
    const allBlu = entities.batchLotUsage || [];
    const confidenceStats = {
      confirmed: allBlu.filter(u => (u.confidence || 'confirmed') === 'confirmed').length,
      probable: allBlu.filter(u => u.confidence === 'probable').length,
      unknown: allBlu.filter(u => u.confidence === 'unknown').length,
    };

    return NextResponse.json({
      status,
      message: status === 'success' 
        ? 'All entities successfully verified and imported into operational graph.'
        : `Import completed with ${skipped.length} dangling row(s) safely skipped.`,
      inserted,
      skipped,
      confidenceStats,
      errors: [],
    });

  } catch (error: any) {
    if (db) {
      try { db.close(); } catch {}
    }
    return NextResponse.json({
      status: 'failed',
      message: error.message,
      inserted: { suppliers: 0, materials: 0, lots: 0, products: 0, warehouses: 0, stores: 0, batches: 0, batchLotUsage: 0, inventory: 0, shipments: 0 },
      skipped: [],
      errors: [{ entity: 'system', id: 'transaction', field: 'all', message: error.message }],
    }, { status: 500 });
  }
}
