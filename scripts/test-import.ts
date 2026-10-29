/**
 * scripts/test-import.ts
 * Rigorous automated tests for the importer:
 * Test A: Clean CSV -> Expect 0 errors, status "success"
 * Test B: Noisy CSV -> Expect status "partial" with skipped rows reported
 * Test C: Deliberately broken file -> Expect status "failed" with 0 rows written
 */

import * as fs from 'fs';
import * as path from 'path';
import { POST } from '../src/app/api/v1/import/route';

const CLEAN_CSV = path.join(__dirname, '..', 'public', 'sample-data', 'nestle-sim', 'nestle_sim_complete.csv');
const NOISY_CSV = path.join(__dirname, '..', 'public', 'sample-data', 'nestle-sim', 'nestle_sim_noisy.csv');

// Helper to convert CSV into payload
function csvToPayload(csvPath: string) {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
  const entities: any = {
    suppliers: [],
    materials: [],
    lots: [],
    products: [],
    batches: [],
    batchLotUsage: [],
    warehouses: [],
    inventory: [],
    shipments: [],
    stores: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const clean = match.map(c => c.replace(/^"|"$/g, '').trim());
    const [type, id, nameOrType, parentOrOrigin, targetOrDest, qtyStr, unitOrPrice, statusOrConf] = clean;
    const qty = parseFloat(qtyStr || '0') || 0;

    if (type === 'supplier') {
      entities.suppliers.push({ id, name: nameOrType, location: parentOrOrigin, contactEmail: targetOrDest, rating: qty || 4.5 });
    } else if (type === 'material') {
      entities.materials.push({ id, name: nameOrType, supplierId: parentOrOrigin, unit: unitOrPrice, category: statusOrConf });
    } else if (type === 'lot') {
      entities.lots.push({ id, materialId: nameOrType, supplierId: parentOrOrigin, quantity: qty, unit: unitOrPrice, status: statusOrConf });
    } else if (type === 'product') {
      entities.products.push({ id, name: nameOrType, category: parentOrOrigin, unitPrice: qty, shelfLifeDays: 270 });
    } else if (type === 'batch') {
      entities.batches.push({ id, productId: nameOrType, machineId: parentOrOrigin, lineId: targetOrDest, quantity: Math.round(qty), status: statusOrConf });
    } else if (type === 'batch_lot_usage') {
      entities.batchLotUsage.push({ id, confidence: nameOrType, lotId: parentOrOrigin, batchId: targetOrDest, fractionUsed: qty || 1.0 });
    } else if (type === 'warehouse') {
      entities.warehouses.push({ id, name: nameOrType, location: parentOrOrigin, capacity: qty || 50000 });
    } else if (type === 'inventory') {
      entities.inventory.push({ id, productId: nameOrType, batchId: parentOrOrigin, locationId: targetOrDest, locationType: 'warehouse', quantity: Math.round(qty), status: statusOrConf });
    } else if (type === 'shipment') {
      entities.shipments.push({ id, batchId: nameOrType, origin: parentOrOrigin, destination: targetOrDest, quantity: Math.round(qty), status: statusOrConf });
    } else if (type === 'store') {
      entities.stores.push({ id, name: nameOrType, location: parentOrOrigin });
    }
  }

  return entities;
}

async function run() {
  console.log('\n================================================================================');
  console.log('                          LOGIS IMPORTER TEST SUITE                             ');
  console.log('================================================================================');

  let passed = 0;
  let total = 3;

  // --- TEST A: Clean CSV ---
  try {
    const cleanEntities = csvToPayload(CLEAN_CSV);
    const reqA = { json: async () => ({ validateOnly: false, entities: cleanEntities }) } as any;
    const resA = await POST(reqA);
    const dataA = await resA.json();

    if (dataA.status === 'success' && dataA.skipped.length === 0 && dataA.errors.length === 0) {
      console.log('✓ PASS: Test A (Clean CSV) -> status="success", 0 errors, 0 skipped rows.');
      passed++;
    } else {
      console.error('✗ FAIL: Test A (Clean CSV) ->', dataA);
    }
  } catch (err: any) {
    console.error('✗ FAIL: Test A threw exception:', err.message);
  }

  // --- TEST B: Noisy CSV ---
  try {
    const noisyEntities = csvToPayload(NOISY_CSV);
    const reqB = { json: async () => ({ validateOnly: false, entities: noisyEntities }) } as any;
    const resB = await POST(reqB);
    const dataB = await resB.json();

    if (dataB.status === 'partial' && dataB.skipped.length > 0 && dataB.errors.length === 0) {
      console.log(`✓ PASS: Test B (Noisy CSV) -> status="partial", ${dataB.skipped.length} dangling rows safely skipped with reasons.`);
      passed++;
    } else {
      console.error('✗ FAIL: Test B (Noisy CSV) ->', dataB);
    }
  } catch (err: any) {
    console.error('✗ FAIL: Test B threw exception:', err.message);
  }

  // --- TEST C: Deliberately Broken CSV ---
  try {
    const brokenEntities = {
      materials: [
        { id: 'MAT-BROKEN-99', name: 'Phantom Herb', supplierId: 'SUP-DOES-NOT-EXIST', unit: 'kg', category: 'Herbs' }
      ]
    };
    const reqC = { json: async () => ({ validateOnly: false, entities: brokenEntities }) } as any;
    const resC = await POST(reqC);
    const dataC = await resC.json();

    if (resC.status === 400 && dataC.status === 'failed' && dataC.errors.length > 0 && dataC.inserted.materials === 0) {
      console.log(`✓ PASS: Test C (Deliberately Broken) -> status="failed", 0 rows written, fatal error caught: "${dataC.errors[0].message}"`);
      passed++;
    } else {
      console.error('✗ FAIL: Test C (Deliberately Broken) ->', dataC);
    }
  } catch (err: any) {
    console.error('✗ FAIL: Test C threw exception:', err.message);
  }

  console.log('================================================================================');
  console.log(`TEST SUITE RESULT: ${passed} / ${total} tests passed.`);
  console.log('================================================================================\n');

  // Clean reset afterward to ensure demo seed data is pristine
  const { POST: resetDemo } = require('../src/app/api/demo/reset/route');
  await resetDemo();
  console.log('✓ Restored pristine NovaFoods seed database via Reset Demo.\n');
}

run();

