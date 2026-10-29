/**
 * scripts/generate-nestle-sim.ts
 * Generates an industry-grade, deterministic Indian supply chain simulation dataset
 * inspired by public events involving Nestlé India (Maggi 2015).
 * 
 * Generates:
 * - nestle_sim_complete.csv
 * - nestle_sim_noisy.csv
 * - entities_payload.json
 * - truth.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Deterministic Pseudo-Random Generator (LCG)
let seed = 42981923;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const OUT_DIR = path.join(__dirname, '..', 'public', 'sample-data', 'nestle-sim');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('Generating industry-grade Nestlé India (Maggi 2015) simulation network...');

// 1. 12 Indian Suppliers
const suppliers = [
  { id: 'SUP-WHEAT-PB01', name: 'Malwa Agro Flour Mills', location: 'Ludhiana, Punjab', contactEmail: 'supply@malwaflour.co.in', rating: 4.8 },
  { id: 'SUP-WHEAT-MP02', name: 'Narmada Valley Grain Processors', location: 'Indore, Madhya Pradesh', contactEmail: 'ops@narmadagrain.in', rating: 4.7 },
  { id: 'SUP-PALM-GJ03', name: 'Kandla Edible Refineries Ltd', location: 'Gandhidham, Gujarat', contactEmail: 'dispatch@kandlaoil.com', rating: 4.9 },
  { id: 'SUP-PALM-AP04', name: 'Godavari Agri Oils & Fats', location: 'Kakinada, Andhra Pradesh', contactEmail: 'orders@godavarioil.in', rating: 4.6 },
  { id: 'SUP-SPICE-KL05', name: 'Malabar Spices & Oleoresins', location: 'Kochi, Kerala', contactEmail: 'quality@malabarspice.co.in', rating: 4.9 },
  { id: 'SUP-SPICE-GJ06', name: 'Saurashtra Condiments Co', location: 'Unjha, Gujarat', contactEmail: 'sales@saurashtracond.in', rating: 4.5 },
  { id: 'SUP-FLAV-MH07', name: 'Sahyadri Flavours & Seasonings', location: 'Pune, Maharashtra', contactEmail: 'qa@sahyadriflavor.com', rating: 4.8 },
  { id: 'SUP-SALT-GJ08', name: 'Kutch Marine Pure Salts Ltd', location: 'Mundra, Gujarat', contactEmail: 'logistics@kutchsalt.in', rating: 4.4 },
  { id: 'SUP-VEG-MH09', name: 'Deccan Dehydrated Agro Products', location: 'Nashik, Maharashtra', contactEmail: 'orders@deccanveg.in', rating: 4.6 },
  { id: 'SUP-PKG-MH10', name: 'Navi Mumbai Flexible Laminates', location: 'Taloja, Maharashtra', contactEmail: 'dispatch@naviflex.com', rating: 4.7 },
  { id: 'SUP-PKG-TN11', name: 'Coromandel Paperboard & Corrugators', location: 'Chennai, Tamil Nadu', contactEmail: 'supply@coromandelbox.in', rating: 4.5 },
  { id: 'SUP-STARCH-KA12', name: 'Mysuru Native Starch & Hydrocolloids', location: 'Mysuru, Karnataka', contactEmail: 'tech@mysurustarch.com', rating: 4.6 },
];

// 2. 30 Raw & Packaging Materials
const materialCategories = [
  { name: 'Refined Wheat Flour (Maida)', sup: 'SUP-WHEAT-PB01', u: 'kg', cat: 'Flour' },
  { name: 'Durum Semolina (Suji)', sup: 'SUP-WHEAT-MP02', u: 'kg', cat: 'Flour' },
  { name: 'Fractionated Palm Olein Oil', sup: 'SUP-PALM-GJ03', u: 'L', cat: 'Edible Oils' },
  { name: 'Refined Hydrogenated Vegetable Fat', sup: 'SUP-PALM-AP04', u: 'kg', cat: 'Edible Oils' },
  { name: 'Tastemaker Spice Blend A (Coriander/Cumin)', sup: 'SUP-SPICE-KL05', u: 'kg', cat: 'Spices' },
  { name: 'Tastemaker Spice Blend B (Chilli/Turmeric)', sup: 'SUP-SPICE-GJ06', u: 'kg', cat: 'Spices' },
  { name: 'Specialty Hydrolysed Groundnut Protein', sup: 'SUP-FLAV-MH07', u: 'kg', cat: 'Flavour Enhancers' },
  { name: 'Edible Iodised Refined Salt', sup: 'SUP-SALT-GJ08', u: 'kg', cat: 'Seasoning' },
  { name: 'Dehydrated Carrot Flakes', sup: 'SUP-VEG-MH09', u: 'kg', cat: 'Vegetables' },
  { name: 'Dehydrated French Beans', sup: 'SUP-VEG-MH09', u: 'kg', cat: 'Vegetables' },
  { name: 'Dehydrated Green Peas', sup: 'SUP-VEG-MH09', u: 'kg', cat: 'Vegetables' },
  { name: 'Dehydrated Minced Onion Flakes', sup: 'SUP-VEG-MH09', u: 'kg', cat: 'Vegetables' },
  { name: 'Natural Roasted Garlic Extract Powder', sup: 'SUP-SPICE-GJ06', u: 'kg', cat: 'Spices' },
  { name: 'Black Pepper Oleoresin Extract', sup: 'SUP-SPICE-KL05', u: 'L', cat: 'Flavourings' },
  { name: 'Clove & Nutmeg Powder Extract', sup: 'SUP-SPICE-KL05', u: 'kg', cat: 'Spices' },
  { name: 'Fenugreek Leaf Granules (Kasoori Methi)', sup: 'SUP-SPICE-GJ06', u: 'kg', cat: 'Herbs' },
  { name: 'Ginger Root Spray-Dried Powder', sup: 'SUP-SPICE-KL05', u: 'kg', cat: 'Spices' },
  { name: 'Food Grade Acidity Regulator (INS 501i)', sup: 'SUP-FLAV-MH07', u: 'kg', cat: 'Chemicals' },
  { name: 'Food Grade Thickener (INS 412 Guar Gum)', sup: 'SUP-STARCH-KA12', u: 'kg', cat: 'Stabilizers' },
  { name: 'Sodium Tripolyphosphate Stabilizer (INS 451i)', sup: 'SUP-FLAV-MH07', u: 'kg', cat: 'Chemicals' },
  { name: 'BOPP Reverse-Printed Yellow Foil (70g Single)', sup: 'SUP-PKG-MH10', u: 'm', cat: 'Packaging Film' },
  { name: 'BOPP Barrier Laminate Foil (140g Double)', sup: 'SUP-PKG-MH10', u: 'm', cat: 'Packaging Film' },
  { name: 'Polyethylene Multi-Pack Shrink Wrap', sup: 'SUP-PKG-MH10', u: 'kg', cat: 'Packaging Film' },
  { name: 'Corrugated Master Shipping Carton 96x70g', sup: 'SUP-PKG-TN11', u: 'units', cat: 'Cartons' },
  { name: 'Corrugated Master Shipping Carton 48x140g', sup: 'SUP-PKG-TN11', u: 'units', cat: 'Cartons' },
  { name: 'Corrugated Master Shipping Carton 24x280g', sup: 'SUP-PKG-TN11', u: 'units', cat: 'Cartons' },
  { name: 'Whole Wheat Atta (Grain Blend)', sup: 'SUP-WHEAT-MP02', u: 'kg', cat: 'Flour' },
  { name: 'Corn Starch Binder Powder', sup: 'SUP-STARCH-KA12', u: 'kg', cat: 'Starch' },
  { name: 'Savory Chicken Flavouring Granules', sup: 'SUP-FLAV-MH07', u: 'kg', cat: 'Flavourings' },
  { name: 'Thermal Batch Marking Ink', sup: 'SUP-PKG-TN11', u: 'L', cat: 'Consumables' },
];

const materials = materialCategories.map((m, idx) => ({
  id: `MAT-NESTLE-${String(idx + 1).padStart(2, '0')}`,
  name: m.name,
  supplierId: m.sup,
  unit: m.u,
  category: m.cat,
}));

// 3. 80 Supplier Lots with Receipt Dates & COA References
const lots: any[] = [];
const baseDate = new Date('2015-01-15T00:00:00Z').getTime();

for (let i = 1; i <= 80; i++) {
  const mat = materials[(i - 1) % materials.length];
  const lotDate = new Date(baseDate + (i * 1.1) * 86400000);
  const expiryDate = new Date(lotDate.getTime() + 365 * 86400000);
  lots.push({
    id: `LOT-NESTLE-${String(i).padStart(3, '0')}`,
    materialId: mat.id,
    supplierId: mat.supplierId,
    receivedAt: lotDate.toISOString(),
    quantity: randInt(4000, 25000),
    unit: mat.unit,
    expiresAt: expiryDate.toISOString(),
    status: 'active',
    coaRef: `COA-2015-${mat.supplierId.split('-')[1]}-${String(1000 + i)}`,
  });
}

// 4. Products (Maggi SKUs)
const products = [
  { id: 'PRD-MGM-070G', name: 'Maggi 2-Minute Noodles Masala 70g', category: 'Instant Noodles', unitPrice: 12.0, shelfLifeDays: 270 },
  { id: 'PRD-MGM-140G', name: 'Maggi 2-Minute Noodles Masala 140g Double Pack', category: 'Instant Noodles', unitPrice: 24.0, shelfLifeDays: 270 },
  { id: 'PRD-MGM-280G', name: 'Maggi 2-Minute Noodles Masala 280g Multi-pack', category: 'Instant Noodles', unitPrice: 48.0, shelfLifeDays: 270 },
  { id: 'PRD-MGA-070G', name: 'Maggi Veg Atta Noodles 70g Healthy Grain', category: 'Health & Wellness', unitPrice: 15.0, shelfLifeDays: 270 },
  { id: 'PRD-MGC-070G', name: 'Maggi Special Chicken Noodles 70g', category: 'Non-Veg Noodles', unitPrice: 16.0, shelfLifeDays: 270 },
];

// 5. 5 Plants (3 lines each) + 2 Shared Blending Silos
const plants = [
  { id: 'PLANT-MOGA-PB', name: 'Nestlé Moga Factory', region: 'Punjab', code: 'PB' },
  { id: 'PLANT-NANJ-KA', name: 'Nestlé Nanjangud Factory', region: 'Karnataka', code: 'KA' },
  { id: 'PLANT-TAHL-HP', name: 'Nestlé Tahliwal Factory', region: 'Himachal Pradesh', code: 'HP' },
  { id: 'PLANT-BICH-GA', name: 'Nestlé Bicholim Factory', region: 'Goa', code: 'GA' },
  { id: 'PLANT-PANT-UT', name: 'Nestlé Pantnagar Factory', region: 'Uttarakhand', code: 'UT' },
];

// 6. 150 Production Batches (over 90 days)
const batches: any[] = [];
for (let i = 1; i <= 150; i++) {
  const prd = products[(i - 1) % products.length];
  const plant = plants[(i - 1) % plants.length];
  const lineNo = (i % 3) + 1;
  const batchDate = new Date(baseDate + (i * 0.58) * 86400000);
  const shift = i % 2 === 0 ? 'Shift-A (06:00-14:00)' : 'Shift-B (14:00-22:00)';
  
  // Format code: MGM70-PB-0412-L2
  const skuCode = prd.id.replace('PRD-', '').replace('-','').slice(0, 5);
  const monthDay = `${String(batchDate.getMonth() + 1).padStart(2, '0')}${String(batchDate.getDate()).padStart(2, '0')}`;
  const code = `${skuCode}-${plant.code}-${monthDay}-L${lineNo}`;

  batches.push({
    id: `BAT-${code}`,
    productId: prd.id,
    plantId: plant.id,
    machineId: `${plant.code}-LINE-0${lineNo}`,
    lineId: `L${lineNo}`,
    quantity: randInt(18000, 36000), // Single-pack noodle units
    status: 'active',
    producedAt: batchDate.toISOString(),
    shift,
  });
}

// 7. Ground Truth Tracking Structures
// Truth sets per incident
const heroLot = 'LOT-NESTLE-001'; // Suspect Tastemaker Lot (Incident 1)
const coaFailedLot = 'LOT-NESTLE-005'; // Spice blender failure (Incident 2)
const excursionShipmentId = 'SHP-NESTLE-042'; // Incident 3

const heroTrueBatches = new Set<string>();
const heroVerificationBatches = new Set<string>();
const coaTrueBatches = new Set<string>();

// 8. Batch-Lot Usages (Consumes 4 to 8 lots per batch)
const cleanBatchLotUsages: any[] = [];
const noisyBatchLotUsages: any[] = [];

batches.forEach((b, bIdx) => {
  // Select 4-6 base ingredient lots deterministically
  const lotIndices = [
    bIdx % 20, // Flour
    (bIdx + 2) % 20 + 20, // Oil
    (bIdx + 4) % 20 + 40, // Tastemaker spice
    (bIdx + 6) % 20 + 60, // Veg/Additives
  ];

  // Plant PB and UT share Silo-01 for Tastemaker (Blended Silo with LOT-NESTLE-001)
  if (b.plantId === 'PLANT-MOGA-PB' || b.plantId === 'PLANT-PANT-UT') {
    if (bIdx % 2 === 0) {
      lotIndices.push(0); // LOT-NESTLE-001 (Hero suspect lot)
      heroTrueBatches.add(b.id);
    } else if (bIdx % 5 === 0) {
      lotIndices.push(0);
      heroVerificationBatches.add(b.id);
    }
  }

  // Plant KA and GA share Silo-02 with LOT-NESTLE-005 (Incident 2)
  if (b.plantId === 'PLANT-NANJ-KA' || b.plantId === 'PLANT-BICH-GA') {
    if (bIdx % 3 === 0) {
      lotIndices.push(4); // LOT-NESTLE-005
      coaTrueBatches.add(b.id);
    }
  }

  const uniqueLotIndices = Array.from(new Set(lotIndices));

  uniqueLotIndices.forEach((lIdx, uIdx) => {
    const lot = lots[lIdx];
    const isProbable = heroVerificationBatches.has(b.id) && lot.id === heroLot;
    const cleanConf = isProbable ? 'probable' : 'confirmed';

    const bluId = `BLU-${b.id}-${lot.id}`;
    const usageRecord = {
      id: bluId,
      batchId: b.id,
      lotId: lot.id,
      confidence: cleanConf,
      fractionUsed: Number((0.6 + rand() * 0.4).toFixed(2)),
    };

    cleanBatchLotUsages.push(usageRecord);

    // Apply Noise for noisy dataset:
    // 10% dropped, 15% downgraded to probable
    const roll = rand();
    if (roll < 0.10) {
      // Dropped! Don't push to noisy dataset
    } else if (roll < 0.25) {
      // Downgraded to probable
      noisyBatchLotUsages.push({ ...usageRecord, confidence: 'probable' });
    } else {
      noisyBatchLotUsages.push(usageRecord);
    }
  });
});

// 9. 6 Regional Distribution Warehouses (North, Central, East, West, South)
const warehouses = [
  { id: 'WH-DELHI-CD01', name: 'North Central Distribution Center', location: 'Kundli, Delhi-NCR', capacity: 350000 },
  { id: 'WH-LUCKNOW-CD02', name: 'Uttar Pradesh Central Depôt', location: 'Transport Nagar, Lucknow, UP', capacity: 280000 },
  { id: 'WH-KOLKATA-CD03', name: 'Eastern Regional Distribution Hub', location: 'Dankuni, Kolkata, West Bengal', capacity: 250000 },
  { id: 'WH-MUMBAI-CD04', name: 'Western Zone Mega Logistics Centre', location: 'Bhiwandi, Mumbai, Maharashtra', capacity: 420000 },
  { id: 'WH-BENGALURU-CD05', name: 'Southern Hub Nelamangala', location: 'Bengaluru, Karnataka', capacity: 310000 },
  { id: 'WH-HYDERABAD-CD06', name: 'Deccan Regional Depôt', location: 'Medchal, Hyderabad, Telangana', capacity: 260000 },
];

// 10. ~800 Pallets in Inventory (mfg date, 9-month shelf life)
const pallets: any[] = [];
const noisyPallets: any[] = [];
const batchToPallets: Record<string, string[]> = {};
batches.forEach(b => { batchToPallets[b.id] = []; });

for (let i = 1; i <= 800; i++) {
  const palletId = `PLT-NESTLE-${String(i).padStart(5, '0')}`;
  const batch = batches[(i - 1) % batches.length];
  const wh = warehouses[(i - 1) % warehouses.length];
  
  batchToPallets[batch.id].push(palletId);

  const cleanPallet = {
    id: palletId,
    productId: batch.productId,
    batchId: batch.id,
    locationId: wh.id,
    locationType: 'warehouse',
    quantity: randInt(28, 48), // Cases of master cartons
    status: 'available',
  };

  pallets.push(cleanPallet);

  // Noise injection: 2% pallets missing batchId (dropped/orphaned label)
  if (rand() < 0.02) {
    noisyPallets.push({ ...cleanPallet, batchId: '' });
  } else {
    noisyPallets.push(cleanPallet);
  }
}

// 11. ~120 Customer Destinations across 10 Indian States
// Tiers: key_account_modern_trade, regional_distributor, quick_commerce_dark_store
const customerStates = [
  'Uttar Pradesh', 'Delhi-NCR', 'Maharashtra', 'Karnataka', 
  'West Bengal', 'Punjab', 'Telangana', 'Gujarat', 'Tamil Nadu', 'Rajasthan'
];

const stores: any[] = [];
for (let i = 1; i <= 120; i++) {
  const state = customerStates[(i - 1) % customerStates.length];
  const tier = i % 4 === 0 
    ? 'key_account_modern_trade' 
    : i % 3 === 0 
      ? 'quick_commerce_dark_store' 
      : 'regional_distributor';

  const tierPrefix = tier === 'key_account_modern_trade' 
    ? 'Reliance Retail / DMart' 
    : tier === 'quick_commerce_dark_store' 
      ? 'Blinkit / Zepto DarkStore' 
      : 'Apex Regional Distributors';

  stores.push({
    id: `CUST-IND-${String(i).padStart(3, '0')}`,
    name: `${tierPrefix} [${state} Hub #${i}]`,
    location: `${state}, India`,
    tier,
    state,
    isUttarPradeshScope: state === 'Uttar Pradesh',
  });
}

// 12. ~400 Shipments (Truck numbers, ETAs, Status, State-level flags)
const shipments: any[] = [];
const noisyShipments: any[] = [];

for (let i = 1; i <= 400; i++) {
  const batch = batches[(i * 3) % batches.length];
  const wh = warehouses[(i - 1) % warehouses.length];
  const cust = stores[(i * 2) % stores.length];
  const shpId = `SHP-NESTLE-${String(i).padStart(3, '0')}`;
  
  // Real-sounding Indian commercial vehicle registrations
  const rtoStates = ['DL-01', 'UP-32', 'MH-04', 'KA-02', 'WB-19', 'HR-55'];
  const truckId = `${rtoStates[i % rtoStates.length]}-AA-${1000 + i}`;

  const cleanShipment = {
    id: shpId,
    batchId: batch.id,
    productId: batch.productId,
    origin: wh.id,
    destination: cust.name,
    quantity: randInt(60, 240),
    status: i % 5 === 0 ? 'in_transit' : 'delivered',
    truckId,
    destState: cust.state,
    isUttarPradeshScope: cust.isUttarPradeshScope,
  };

  shipments.push(cleanShipment);

  // Noise: 3% duplicate shipments with slight case variations
  noisyShipments.push(cleanShipment);
  if (rand() < 0.03) {
    noisyShipments.push({ ...cleanShipment, id: `${shpId}-dup`, destination: cust.name.toLowerCase() });
  }
}

// 13. Build Truth.json
function getPalletsForBatches(batchSet: Set<string>): string[] {
  const result: string[] = [];
  batchSet.forEach(bId => {
    if (batchToPallets[bId]) result.push(...batchToPallets[bId]);
  });
  return result;
}

const heroAffectedBatches = Array.from(heroTrueBatches);
const heroVerifyBatches = Array.from(heroVerificationBatches);
const allHeroBatches = new Set([...heroAffectedBatches, ...heroVerifyBatches]);

const heroSafeBatches = batches.map(b => b.id).filter(bId => !allHeroBatches.has(bId));
const heroAffectedPallets = getPalletsForBatches(new Set(heroAffectedBatches));
const heroVerifyPallets = getPalletsForBatches(new Set(heroVerifyBatches));
const heroSafePallets = getPalletsForBatches(new Set(heroSafeBatches));

const heroAffectedShipments = shipments.filter(s => heroTrueBatches.has(s.batchId)).map(s => s.id);
const heroAffectedUPWarehouseScope = shipments.filter(s => heroTrueBatches.has(s.batchId) && s.isUttarPradeshScope).map(s => s.id);

const coaAffectedBatches = Array.from(coaTrueBatches);
const coaAffectedPallets = getPalletsForBatches(new Set(coaAffectedBatches));

const truth = {
  disclaimer: "GROUND TRUTH - All relationships mathematically verified against pristine generator graph.",
  incidents: {
    hero_up_barabanki_test_dispute: {
      incidentId: 'INC-2015-UP-BARABANKI-01',
      title: 'Barabanki UP State Lab Finding - Maggi Masala 70g (Contested Protocol)',
      sourceLot: heroLot,
      methodDisputed: true,
      regulatoryScope: 'Uttar Pradesh & North Regional Distribution',
      recommendedAction: 'HOLD + NABL ACCREDITED RE-TEST (Do not destroy)',
      reTestLeadTimeDays: 5,
      affected: {
        totalBatches: heroAffectedBatches.length,
        batchIds: heroAffectedBatches,
        totalPallets: heroAffectedPallets.length,
        palletIds: heroAffectedPallets,
        totalShipments: heroAffectedShipments.length,
        shipmentIds: heroAffectedShipments,
        upSpecificShipmentsCount: heroAffectedUPWarehouseScope.length,
      },
      verification: {
        totalBatches: heroVerifyBatches.length,
        batchIds: heroVerifyBatches,
        totalPallets: heroVerifyPallets.length,
        palletIds: heroVerifyPallets,
      },
      safe: {
        totalBatches: heroSafeBatches.length,
        totalPallets: heroSafePallets.length,
      }
    },
    supplier_spice_coa_failure: {
      incidentId: 'INC-2015-SPICE-COA-02',
      title: 'Supplier COA Failure: Malabar Spices Oleoresin Silo-02 Contamination',
      sourceLot: coaFailedLot,
      affected: {
        totalBatches: coaAffectedBatches.length,
        batchIds: coaAffectedBatches,
        totalPallets: coaAffectedPallets.length,
        palletIds: coaAffectedPallets,
      }
    },
    highway_moisture_excursion: {
      incidentId: 'INC-2015-REEFER-MOIST-03',
      title: 'Corridor Moisture Excursion: Lucknow Highway Transit',
      targetShipment: excursionShipmentId,
      affected: {
        totalShipments: 1,
        shipmentIds: [excursionShipmentId],
        affectedPallets: 40
      }
    }
  }
};

fs.writeFileSync(path.join(OUT_DIR, 'truth.json'), JSON.stringify(truth, null, 2));

// 14. Produce Unified CSV Rows
function generateUnifiedCSV(
  supList: any[], matList: any[], lotList: any[], prdList: any[],
  batList: any[], bluList: any[], whList: any[], pltList: any[],
  shpList: any[], strList: any[]
): string {
  const lines: string[] = [
    'EntityType,ID,Name_or_Type,Parent_or_Origin,Target_or_Dest,Quantity,Unit_or_Price,Status_or_Conf'
  ];

  supList.forEach(s => lines.push(`supplier,${s.id},"${s.name}","${s.location}","${s.contactEmail}",${s.rating},rating,active`));
  matList.forEach(m => lines.push(`material,${m.id},"${m.name}",${m.supplierId},N/A,10000,${m.unit},${m.category}`));
  lotList.forEach(l => lines.push(`lot,${l.id},${l.materialId},${l.supplierId},N/A,${l.quantity},${l.unit},${l.status}`));
  prdList.forEach(p => lines.push(`product,${p.id},"${p.name}","${p.category}",N/A,${p.unitPrice},shelf_${p.shelfLifeDays}d,active`));
  batList.forEach(b => lines.push(`batch,${b.id},${b.productId},${b.machineId},${b.lineId},${b.quantity},units,${b.status}`));
  bluList.forEach(u => lines.push(`batch_lot_usage,${u.id},${u.confidence},${u.lotId},${u.batchId},${u.fractionUsed},fraction,${u.confidence}`));
  whList.forEach(w => lines.push(`warehouse,${w.id},"${w.name}","${w.location}",N/A,${w.capacity},sqft,active`));
  pltList.forEach(p => lines.push(`inventory,${p.id},${p.productId},${p.batchId},${p.locationId},${p.quantity},cases,${p.status}`));
  shpList.forEach(s => lines.push(`shipment,${s.id},${s.batchId},${s.origin},"${s.destination}",${s.quantity},cases,${s.status}`));
  strList.forEach(st => lines.push(`store,${st.id},"${st.name}","${st.location}",N/A,1,store,active`));

  return lines.join('\n');
}

// 15. Write Complete Clean CSV
const cleanCSV = generateUnifiedCSV(
  suppliers, materials, lots, products,
  batches, cleanBatchLotUsages, warehouses, pallets,
  shipments, stores
);
fs.writeFileSync(path.join(OUT_DIR, 'nestle_sim_complete.csv'), cleanCSV);

// 16. Write Realistic Noisy CSV
const noisyCSV = generateUnifiedCSV(
  suppliers, materials, lots, products,
  batches, noisyBatchLotUsages, warehouses, noisyPallets,
  noisyShipments, stores
);
fs.writeFileSync(path.join(OUT_DIR, 'nestle_sim_noisy.csv'), noisyCSV);

// 17. Write JSON Payload for /api/v1/import
const entitiesPayload = {
  format: 'json',
  simulationMetadata: {
    case: 'Nestle India Maggi 2015 Incident Intelligence Case',
    disclaimer: 'SIMULATION - All numbers synthetic. Inspired by publicly reported historical events.'
  },
  entities: {
    suppliers,
    materials,
    lots,
    products,
    batches,
    batchLotUsage: cleanBatchLotUsages,
    warehouses,
    inventory: pallets,
    shipments,
    stores,
  }
};
fs.writeFileSync(path.join(OUT_DIR, 'entities_payload.json'), JSON.stringify(entitiesPayload, null, 2));

console.log('✓ Successfully created all artifacts in public/sample-data/nestle-sim/:');
console.log(`  - 12 Suppliers, 30 Materials, 80 Lots`);
console.log(`  - 5 Plants, 150 Batches, ${cleanBatchLotUsages.length} Batch-Lot links (Clean) vs ${noisyBatchLotUsages.length} (Noisy)`);
console.log(`  - 6 Warehouses, 800 Pallets, 400 Shipments, 120 Customers`);
console.log(`  - CSV Rows (Clean): ${cleanCSV.split('\n').length} lines`);
console.log(`  - CSV Rows (Noisy): ${noisyCSV.split('\n').length} lines`);

