/**
 * scripts/generate-noisy-dataset.ts
 * Builds a deterministic, realistic supply chain graph with real-world noise:
 * - 5 suppliers, 50 lots, 300 batches, 2000 pallets, 500 shipments
 * - Injects noise:
 *   1. 10% dropped consumption links (missing ERP records)
 *   2. Blended silos (2 lots combined into shared batches)
 *   3. Ambiguous confidence links (probable / unknown)
 *   4. Overlapping batch production timestamps
 * - Outputs:
 *   - scripts/data/noisy_data.json
 *   - scripts/data/truth.json (ground truth of truly affected pallets per contaminated lot)
 */

import * as fs from 'fs';
import * as path from 'path';

// Seeded pseudorandom generator for deterministic repeatability
let seed = 123456789;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const OUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('Generating deterministic noisy supply chain network...');

// 1. Suppliers
const suppliers = [
  { id: 'SUP-001', name: 'Valley Grain Co-op', location: 'Salinas, CA', rating: 4.8 },
  { id: 'SUP-002', name: 'Cascadia Dairy Farms', location: 'Yakima, WA', rating: 4.6 },
  { id: 'SUP-003', name: 'Highland Sugar Mills', location: 'Baton Rouge, LA', rating: 4.2 },
  { id: 'SUP-004', name: 'Midwest Flavor Extracts', location: 'Cedar Rapids, IA', rating: 4.9 },
  { id: 'SUP-005', name: 'Atlantic Cocoa Imports', location: 'Newark, NJ', rating: 4.4 },
];

// 2. Materials
const materials = [
  { id: 'MAT-01', name: 'Raw Flour', supplierId: 'SUP-001', unit: 'kg', category: 'Grain' },
  { id: 'MAT-02', name: 'Whole Milk Powder', supplierId: 'SUP-002', unit: 'kg', category: 'Dairy' },
  { id: 'MAT-03', name: 'Refined Cane Sugar', supplierId: 'SUP-003', unit: 'kg', category: 'Sweetener' },
  { id: 'MAT-04', name: 'Vanilla Extract', supplierId: 'SUP-004', unit: 'L', category: 'Flavoring' },
  { id: 'MAT-05', name: 'Cocoa Butter', supplierId: 'SUP-005', unit: 'kg', category: 'Fats' },
];

// 3. Products
const products = [
  { id: 'PRD-01', name: 'Vanilla Cream Cookie 12pk', category: 'Bakery', unitPrice: 3.5, shelfLifeDays: 90 },
  { id: 'PRD-02', name: 'Dark Chocolate Biscuit', category: 'Bakery', unitPrice: 4.2, shelfLifeDays: 120 },
  { id: 'PRD-03', name: 'Frosted Sweet Roll', category: 'Pastry', unitPrice: 2.8, shelfLifeDays: 30 },
];

// 4. Lots (50 lots)
const lots: any[] = [];
for (let i = 1; i <= 50; i++) {
  const mat = materials[(i - 1) % materials.length];
  lots.push({
    id: `LOT-NOISY-${String(i).padStart(3, '0')}`,
    materialId: mat.id,
    supplierId: mat.supplierId,
    quantity: randInt(5000, 25000),
    unit: mat.unit,
    status: 'active',
    receivedAt: new Date(Date.now() - (60 - i) * 86400000).toISOString(),
  });
}

// 5. Batches (300 batches)
const batches: any[] = [];
for (let i = 1; i <= 300; i++) {
  const prd = products[(i - 1) % products.length];
  batches.push({
    id: `BAT-NOISY-${String(i).padStart(4, '0')}`,
    productId: prd.id,
    quantity: randInt(400, 2500),
    machineId: `LINE-${randInt(1, 4)}`,
    lineId: `L${randInt(1, 4)}`,
    status: 'active',
    producedAt: new Date(Date.now() - randInt(5, 45) * 86400000).toISOString(),
  });
}

// 6. Ground-Truth Tracking Graph (Logical pure truth)
// lotId -> Set of truly affected batch IDs
const truthLotToBatches: Record<string, Set<string>> = {};
lots.forEach(l => { truthLotToBatches[l.id] = new Set(); });

// 7. Batch-Lot Usages (with Blending and 10% Dropped Rows)
const batchLotUsage: any[] = [];
let droppedCount = 0;

batches.forEach((b, idx) => {
  // Each batch uses 2-3 lots
  const primaryLotIndex = (idx * 2) % lots.length;
  const secondaryLotIndex = (idx * 2 + 1) % lots.length;
  
  const usedLots = [lots[primaryLotIndex], lots[secondaryLotIndex]];
  
  // 15% of batches are "blended silos" that mix in a third shared lot
  if (rand() < 0.15) {
    usedLots.push(lots[0]); // Shared silo lot LOT-NOISY-001
  }

  usedLots.forEach((l) => {
    // Ground truth records this connection unconditionally!
    truthLotToBatches[l.id].add(b.id);

    // Now decide if ERP dropped this link (10% drop rate noise)
    const isDropped = rand() < 0.10;
    if (isDropped) {
      droppedCount++;
      return; // Omit from LOGIS database table!
    }

    // Determine confidence: 80% confirmed, 15% probable, 5% unknown
    const roll = rand();
    const conf = roll > 0.20 ? 'confirmed' : roll > 0.05 ? 'probable' : 'unknown';

    const bluId = `blu_${b.id}_${l.id}_${batchLotUsage.length}`;
    batchLotUsage.push({
      id: bluId,
      batchId: b.id,
      lotId: l.id,
      confidence: conf,
      fractionUsed: Number((rand() * 0.5 + 0.5).toFixed(2)),
    });
  });
});

// 8. Warehouses & Pallet Inventory (2000 pallets)
const warehouses = [
  { id: 'WH-CENTRAL', name: 'Central Cold Storage', location: 'Chicago, IL', capacity: 100000 },
  { id: 'WH-EAST', name: 'Northeast Logistics Hub', location: 'Allentown, PA', capacity: 80000 },
  { id: 'WH-WEST', name: 'Pacific Distribution Center', location: 'Stockton, CA', capacity: 90000 },
];

const inventory: any[] = [];
const batchToPallets: Record<string, string[]> = {};
batches.forEach(b => { batchToPallets[b.id] = []; });

for (let i = 1; i <= 2000; i++) {
  const palletId = `PLT-NOISY-${String(i).padStart(5, '0')}`;
  const batch = batches[(i - 1) % batches.length];
  const wh = warehouses[(i - 1) % warehouses.length];
  
  batchToPallets[batch.id].push(palletId);

  inventory.push({
    id: palletId,
    productId: batch.productId,
    batchId: batch.id,
    locationId: wh.id,
    locationType: 'warehouse',
    quantity: randInt(20, 60),
    status: 'available',
  });
}

// 9. Shipments (500 shipments)
const shipments: any[] = [];
for (let i = 1; i <= 500; i++) {
  const batch = batches[randInt(0, batches.length - 1)];
  const wh = warehouses[randInt(0, warehouses.length - 1)];
  shipments.push({
    id: `SHP-NOISY-${String(i).padStart(4, '0')}`,
    batchId: batch.id,
    productId: batch.productId,
    origin: wh.id,
    destination: `Store #${randInt(100, 350)}`,
    quantity: randInt(50, 300),
    status: rand() > 0.3 ? 'delivered' : 'in_transit',
  });
}

// 10. Stores
const stores = [
  { id: 'STORE-101', name: 'FreshMarket Downtown', location: 'Chicago, IL' },
  { id: 'STORE-102', name: 'SuperGrocer Metro', location: 'Philadelphia, PA' },
  { id: 'STORE-103', name: 'Pacific Food Hall', location: 'San Francisco, CA' },
];

// 11. Compute Truth JSON (Pallets truly contaminated per lot)
// We designate 3 seeded test incidents
const seededIncidents = ['LOT-NOISY-001', 'LOT-NOISY-007', 'LOT-NOISY-015'];
const truth: Record<string, {
  lotId: string;
  totalTrueBatches: number;
  totalTruePallets: number;
  truePalletIds: string[];
}> = {};

seededIncidents.forEach(lotId => {
  const trueBatches = Array.from(truthLotToBatches[lotId]);
  const truePallets: string[] = [];
  trueBatches.forEach(bId => {
    truePallets.push(...(batchToPallets[bId] || []));
  });

  truth[lotId] = {
    lotId,
    totalTrueBatches: trueBatches.length,
    totalTruePallets: truePallets.length,
    truePalletIds: truePallets,
  };
});

// Output files
const datasetPayload = {
  format: 'json',
  entities: {
    suppliers,
    materials,
    lots,
    products,
    batches,
    batchLotUsage,
    warehouses,
    inventory,
    shipments,
    stores,
  },
};

fs.writeFileSync(path.join(OUT_DIR, 'noisy_data.json'), JSON.stringify(datasetPayload, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'truth.json'), JSON.stringify(truth, null, 2));

console.log(`✓ Generated Noisy Dataset:`);
console.log(`  - 5 Suppliers, 50 Lots, 300 Batches`);
console.log(`  - 2,000 Pallets in Inventory, 500 Shipments`);
console.log(`  - Dropped batch-lot usage links (Noise): ${droppedCount} rows omitted`);
console.log(`  - Seeded incidents tracked in truth.json: ${seededIncidents.join(', ')}`);
console.log(`  - Output: ${path.join(OUT_DIR, 'noisy_data.json')} & truth.json`);
