// ============================================================================
// LOGIS — Deterministic Seed Data for NOVAFOODS
// ============================================================================
// This seed creates a realistic operational network for the LOGIS demo.
// All data is fictional. Targets: ~12K affected, ~8.7K safe, ~1.2K uncertain,
// ~3.1K sold, 3+ warehouses, ~120 store deliveries, ~400 shipments.
// ============================================================================

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'logis.db');

export function seedDatabase() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = OFF'); // Temporarily off for bulk insert order flexibility

  // Drop all tables and recreate
  const tableNames = [
    'audit_log', 'timeline_events', 'inspections', 'cost_rates', 'demand',
    'routes', 'trucks', 'workers', 'machines', 'customers', 'sales',
    'stores', 'shipments', 'inventory', 'warehouses', 'batch_lot_usage',
    'batches', 'products', 'lots', 'materials', 'suppliers', 'incidents'
  ];
  
  for (const t of tableNames) {
    sqlite.exec(`DROP TABLE IF EXISTS ${t}`);
  }

  // Create tables
  sqlite.exec(`
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      rating REAL NOT NULL
    );
    CREATE TABLE materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      unit TEXT NOT NULL,
      category TEXT NOT NULL
    );
    CREATE TABLE lots (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES materials(id),
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      received_at TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit_price REAL NOT NULL,
      shelf_life_days INTEGER NOT NULL
    );
    CREATE TABLE batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      produced_at TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      machine_id TEXT NOT NULL,
      line_id TEXT NOT NULL
    );
    CREATE TABLE batch_lot_usage (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id),
      lot_id TEXT NOT NULL REFERENCES lots(id),
      confidence TEXT NOT NULL,
      fraction_used REAL NOT NULL DEFAULT 1.0
    );
    CREATE TABLE warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      free_slots INTEGER NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      temperature_controlled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      batch_id TEXT NOT NULL REFERENCES batches(id),
      location_id TEXT NOT NULL,
      location_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available'
    );
    CREATE TABLE shipments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL,
      departed_at TEXT NOT NULL,
      estimated_arrival TEXT NOT NULL
    );
    CREATE TABLE stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      region TEXT NOT NULL
    );
    CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      batch_id TEXT NOT NULL REFERENCES batches(id),
      quantity INTEGER NOT NULL,
      sold_at TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id)
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL
    );
    CREATE TABLE machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity_per_day INTEGER NOT NULL,
      compatible_products TEXT NOT NULL,
      utilization REAL NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'running'
    );
    CREATE TABLE workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skills TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      shift_hours INTEGER NOT NULL DEFAULT 8
    );
    CREATE TABLE trucks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available',
      current_route TEXT
    );
    CREATE TABLE routes (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      distance_km REAL NOT NULL,
      estimated_hours REAL NOT NULL
    );
    CREATE TABLE demand (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      units INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      unit_value REAL NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium'
    );
    CREATE TABLE cost_rates (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      rate_per_unit REAL NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE inspections (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      batch_id TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      test_type TEXT NOT NULL,
      result TEXT NOT NULL,
      severity TEXT,
      incident_type TEXT,
      inspector_role TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE incidents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source_lot TEXT NOT NULL,
      severity TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE timeline_events (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incidents(id),
      event TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      category TEXT NOT NULL
    );
    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
  `);

  // =========================================================================
  // SEED DATA
  // =========================================================================

  // --- Suppliers (5) ---
  const suppliersData = [
    ['SUP-001', 'Greenfield Dairy Co.', 'Anand, Gujarat', 'supply@greenfielddairy.in', 4.5],
    ['SUP-002', 'PureGrain Mills', 'Indore, MP', 'orders@puregrainmills.in', 4.2],
    ['SUP-003', 'FreshHarvest Farms', 'Nashik, Maharashtra', 'info@freshharvest.in', 4.8],
    ['SUP-004', 'SpiceTrail Exports', 'Kochi, Kerala', 'trade@spicetrail.in', 3.9],
    ['SUP-005', 'AquaPure Solutions', 'Pune, Maharashtra', 'sales@aquapure.in', 4.6],
  ];
  const insertSupplier = sqlite.prepare('INSERT INTO suppliers VALUES (?,?,?,?,?)');
  for (const s of suppliersData) insertSupplier.run(...s);

  // --- Materials (10) ---
  const materialsData = [
    ['MAT-001', 'Whole Milk', 'SUP-001', 'liters', 'dairy'],
    ['MAT-002', 'Skim Milk Powder', 'SUP-001', 'kg', 'dairy'],
    ['MAT-003', 'Wheat Flour', 'SUP-002', 'kg', 'grain'],
    ['MAT-004', 'Rice Flour', 'SUP-002', 'kg', 'grain'],
    ['MAT-005', 'Tomato Paste', 'SUP-003', 'kg', 'produce'],
    ['MAT-006', 'Turmeric Powder', 'SUP-004', 'kg', 'spice'],
    ['MAT-007', 'Red Chilli Powder', 'SUP-004', 'kg', 'spice'],
    ['MAT-008', 'Purified Water', 'SUP-005', 'liters', 'water'],
    ['MAT-009', 'Sugar', 'SUP-003', 'kg', 'sweetener'],
    ['MAT-010', 'Vegetable Oil', 'SUP-003', 'liters', 'oil'],
  ];
  const insertMaterial = sqlite.prepare('INSERT INTO materials VALUES (?,?,?,?,?)');
  for (const m of materialsData) insertMaterial.run(...m);

  // --- Lots (20) ---
  // MILK-204 is the contaminated lot from SUP-001
  const lotsData = [
    ['MILK-204', 'MAT-001', 'SUP-001', '2026-09-15', 5000, 'liters', '2026-10-15', 'flagged'],
    ['MILK-205', 'MAT-001', 'SUP-001', '2026-09-16', 4500, 'liters', '2026-10-16', 'active'],
    ['MILK-206', 'MAT-001', 'SUP-001', '2026-09-18', 3000, 'liters', '2026-10-18', 'active'],
    ['SMP-101', 'MAT-002', 'SUP-001', '2026-09-10', 2000, 'kg', '2027-03-10', 'active'],
    ['WHT-301', 'MAT-003', 'SUP-002', '2026-09-12', 8000, 'kg', '2027-03-12', 'active'],
    ['WHT-302', 'MAT-003', 'SUP-002', '2026-09-14', 6000, 'kg', '2027-03-14', 'active'],
    ['RCF-401', 'MAT-004', 'SUP-002', '2026-09-11', 3000, 'kg', '2027-03-11', 'active'],
    ['TMP-501', 'MAT-005', 'SUP-003', '2026-09-13', 1500, 'kg', '2027-01-13', 'active'],
    ['TUR-601', 'MAT-006', 'SUP-004', '2026-09-08', 500, 'kg', '2027-09-08', 'active'],
    ['RCP-701', 'MAT-007', 'SUP-004', '2026-09-09', 400, 'kg', '2027-09-09', 'active'],
    ['WAT-801', 'MAT-008', 'SUP-005', '2026-09-14', 10000, 'liters', '2027-03-14', 'active'],
    ['SUG-901', 'MAT-009', 'SUP-003', '2026-09-12', 3000, 'kg', '2027-06-12', 'active'],
    ['OIL-1001', 'MAT-010', 'SUP-003', '2026-09-15', 2000, 'liters', '2027-03-15', 'active'],
    ['MILK-207', 'MAT-001', 'SUP-001', '2026-09-20', 4000, 'liters', '2026-10-20', 'active'],
    ['SMP-102', 'MAT-002', 'SUP-001', '2026-09-18', 1500, 'kg', '2027-03-18', 'active'],
    ['WHT-303', 'MAT-003', 'SUP-002', '2026-09-20', 5000, 'kg', '2027-03-20', 'active'],
    ['TMP-502', 'MAT-005', 'SUP-003', '2026-09-17', 1200, 'kg', '2027-01-17', 'active'],
    ['WAT-802', 'MAT-008', 'SUP-005', '2026-09-19', 8000, 'liters', '2027-03-19', 'active'],
    ['MILK-208', 'MAT-001', 'SUP-001', '2026-09-22', 3500, 'liters', '2026-10-22', 'active'],
    ['OIL-1002', 'MAT-010', 'SUP-003', '2026-09-20', 1800, 'liters', '2027-03-20', 'active'],
  ];
  const insertLot = sqlite.prepare('INSERT INTO lots VALUES (?,?,?,?,?,?,?,?)');
  for (const l of lotsData) insertLot.run(...l);

  // --- Products (10) ---
  // Product C (P-003) and Product D (P-004) are important for recovery
  const productsData = [
    ['P-001', 'Nova Fresh Milk 500ml', 'dairy', 45, 7],
    ['P-002', 'Nova Paneer 200g', 'dairy', 85, 14],
    ['P-003', 'Product C - Nova Yogurt 400g', 'dairy', 55, 21],
    ['P-004', 'Product D - Nova Cheese Spread 150g', 'dairy', 120, 60],
    ['P-005', 'Nova Wheat Bread 400g', 'bakery', 35, 5],
    ['P-006', 'Nova Tomato Ketchup 500g', 'condiment', 95, 180],
    ['P-007', 'Nova Masala Mix 100g', 'spice', 65, 365],
    ['P-008', 'Nova Energy Drink 250ml', 'beverage', 40, 90],
    ['P-009', 'Nova Rice Crackers 150g', 'snack', 50, 120],
    ['P-010', 'Nova Butter 500g', 'dairy', 195, 30],
  ];
  const insertProduct = sqlite.prepare('INSERT INTO products VALUES (?,?,?,?,?)');
  for (const p of productsData) insertProduct.run(...p);

  // --- Batches (15) ---
  // Batches B51-B57 use MILK-204 (contaminated) with varying confidence
  // Batches B58-B65 use clean lots
  const batchesData = [
    // MILK-204 downstream (contaminated source)
    ['B51', 'P-001', '2026-09-16', 2000, 'active', 'M01', 'LINE-A'],
    ['B52', 'P-002', '2026-09-16', 1500, 'active', 'M02', 'LINE-A'],
    ['B53', 'P-003', '2026-09-17', 1800, 'active', 'M03', 'LINE-B'],
    ['B54', 'P-004', '2026-09-17', 1200, 'active', 'M04', 'LINE-B'],
    ['B55', 'P-010', '2026-09-18', 800, 'active', 'M01', 'LINE-A'],
    ['B56', 'P-001', '2026-09-18', 2500, 'active', 'M02', 'LINE-A'],
    ['B57', 'P-003', '2026-09-19', 2200, 'active', 'M03', 'LINE-B'],
    // Clean batches (NOT using MILK-204)
    ['B58', 'P-001', '2026-09-20', 2000, 'active', 'M01', 'LINE-A'],
    ['B59', 'P-002', '2026-09-20', 1800, 'active', 'M02', 'LINE-A'],
    ['B60', 'P-003', '2026-09-21', 1500, 'active', 'M03', 'LINE-B'],
    ['B61', 'P-005', '2026-09-16', 3000, 'active', 'M05', 'LINE-C'],
    ['B62', 'P-006', '2026-09-17', 2500, 'active', 'M06', 'LINE-C'],
    ['B63', 'P-007', '2026-09-18', 1000, 'active', 'M07', 'LINE-D'],
    ['B64', 'P-008', '2026-09-19', 4000, 'active', 'M08', 'LINE-D'],
    ['B65', 'P-009', '2026-09-20', 2000, 'active', 'M05', 'LINE-C'],
  ];
  const insertBatch = sqlite.prepare('INSERT INTO batches VALUES (?,?,?,?,?,?,?)');
  for (const b of batchesData) insertBatch.run(...b);

  // --- Batch-Lot Usage ---
  // This is the critical traceability link.
  // MILK-204 feeds into B51-B57 with varying confidence and fractions
  const batchLotUsageData = [
    // Contaminated lot MILK-204 usage
    ['BLU-001', 'B51', 'MILK-204', 'confirmed', 1.0],   // B51 fully uses MILK-204
    ['BLU-002', 'B52', 'MILK-204', 'confirmed', 0.8],   // B52 uses 80% MILK-204
    ['BLU-003', 'B53', 'MILK-204', 'confirmed', 1.0],   // B53 fully uses MILK-204
    ['BLU-004', 'B54', 'MILK-204', 'confirmed', 0.6],   // B54 uses 60% MILK-204
    ['BLU-005', 'B55', 'MILK-204', 'probable', 0.5],    // B55 probably uses 50% MILK-204
    ['BLU-006', 'B56', 'MILK-204', 'confirmed', 1.0],   // B56 fully uses MILK-204
    ['BLU-007', 'B57', 'MILK-204', 'unknown', 0.3],     // B57 might use 30% MILK-204
    // Clean lot usages
    ['BLU-008', 'B52', 'MILK-205', 'confirmed', 0.2],
    ['BLU-009', 'B54', 'MILK-206', 'confirmed', 0.4],
    ['BLU-010', 'B55', 'MILK-205', 'confirmed', 0.5],
    ['BLU-011', 'B57', 'MILK-206', 'confirmed', 0.7],
    ['BLU-012', 'B58', 'MILK-207', 'confirmed', 1.0],
    ['BLU-013', 'B59', 'MILK-207', 'confirmed', 1.0],
    ['BLU-014', 'B60', 'MILK-208', 'confirmed', 1.0],
    ['BLU-015', 'B51', 'SMP-101', 'confirmed', 0.1],
    ['BLU-016', 'B53', 'SMP-101', 'confirmed', 0.15],
    ['BLU-017', 'B61', 'WHT-301', 'confirmed', 1.0],
    ['BLU-018', 'B62', 'TMP-501', 'confirmed', 1.0],
    ['BLU-019', 'B63', 'TUR-601', 'confirmed', 0.5],
    ['BLU-020', 'B63', 'RCP-701', 'confirmed', 0.5],
    ['BLU-021', 'B64', 'WAT-801', 'confirmed', 0.8],
    ['BLU-022', 'B64', 'SUG-901', 'confirmed', 0.2],
    ['BLU-023', 'B65', 'RCF-401', 'confirmed', 1.0],
  ];
  const insertBLU = sqlite.prepare('INSERT INTO batch_lot_usage VALUES (?,?,?,?,?)');
  for (const b of batchLotUsageData) insertBLU.run(...b);

  // --- Warehouses (5) ---
  const warehousesData = [
    ['WH-001', 'NovaFoods Central Hub', 'Mumbai, Maharashtra', 10000, 2800, 1, 1],
    ['WH-002', 'NovaFoods North DC', 'Delhi, NCR', 8000, 2200, 1, 1],
    ['WH-003', 'NovaFoods South DC', 'Bengaluru, Karnataka', 6000, 1500, 1, 1],
    ['WH-004', 'NovaFoods West Cold Storage', 'Ahmedabad, Gujarat', 4000, 1200, 1, 1],
    ['WH-005', 'NovaFoods East DC', 'Kolkata, West Bengal', 5000, 1800, 1, 0],
  ];
  const insertWarehouse = sqlite.prepare('INSERT INTO warehouses VALUES (?,?,?,?,?,?,?)');
  for (const w of warehousesData) insertWarehouse.run(...w);

  // --- Stores (25) ---
  const storesData: [string, string, string, string][] = [
    ['ST-001', 'FreshMart Mumbai Central', 'Mumbai', 'West'],
    ['ST-002', 'FreshMart Andheri', 'Mumbai', 'West'],
    ['ST-003', 'FreshMart Pune', 'Pune', 'West'],
    ['ST-004', 'FreshMart Thane', 'Thane', 'West'],
    ['ST-005', 'FreshMart Nashik', 'Nashik', 'West'],
    ['ST-006', 'GroceryPlus Delhi CP', 'Delhi', 'North'],
    ['ST-007', 'GroceryPlus Noida', 'Noida', 'North'],
    ['ST-008', 'GroceryPlus Gurgaon', 'Gurgaon', 'North'],
    ['ST-009', 'GroceryPlus Chandigarh', 'Chandigarh', 'North'],
    ['ST-010', 'GroceryPlus Lucknow', 'Lucknow', 'North'],
    ['ST-011', 'QuickBuy Bengaluru MG Road', 'Bengaluru', 'South'],
    ['ST-012', 'QuickBuy Bengaluru Whitefield', 'Bengaluru', 'South'],
    ['ST-013', 'QuickBuy Chennai', 'Chennai', 'South'],
    ['ST-014', 'QuickBuy Hyderabad', 'Hyderabad', 'South'],
    ['ST-015', 'QuickBuy Kochi', 'Kochi', 'South'],
    ['ST-016', 'DailyNeeds Ahmedabad', 'Ahmedabad', 'West'],
    ['ST-017', 'DailyNeeds Surat', 'Surat', 'West'],
    ['ST-018', 'DailyNeeds Vadodara', 'Vadodara', 'West'],
    ['ST-019', 'MegaMart Kolkata', 'Kolkata', 'East'],
    ['ST-020', 'MegaMart Bhubaneswar', 'Bhubaneswar', 'East'],
    ['ST-021', 'MegaMart Patna', 'Patna', 'East'],
    ['ST-022', 'FreshMart Nagpur', 'Nagpur', 'Central'],
    ['ST-023', 'GroceryPlus Jaipur', 'Jaipur', 'North'],
    ['ST-024', 'QuickBuy Coimbatore', 'Coimbatore', 'South'],
    ['ST-025', 'DailyNeeds Indore', 'Indore', 'Central'],
  ];
  const insertStore = sqlite.prepare('INSERT INTO stores VALUES (?,?,?,?)');
  for (const s of storesData) insertStore.run(...s);

  // --- Customers (40) ---
  const customerInsert = sqlite.prepare('INSERT INTO customers VALUES (?,?,?)');
  const regions = ['West', 'North', 'South', 'East', 'Central'];
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Priya', 'Ananya', 'Diya', 'Saanvi', 'Aanya', 'Isha', 'Myra', 'Sara', 'Navya', 'Anika',
    'Rohan', 'Karan', 'Rahul', 'Amit', 'Neha', 'Pooja', 'Ravi', 'Sunil', 'Meera', 'Kavita',
    'Raj', 'Deepak', 'Sunita', 'Geeta', 'Mohan', 'Lakshmi', 'Vijay', 'Anita', 'Sanjay', 'Rita'];
  const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Gupta', 'Joshi', 'Iyer', 'Das',
    'Malhotra', 'Verma', 'Chopra', 'Mehta', 'Agarwal', 'Mishra', 'Bhat', 'Rao', 'Pillai', 'Chauhan',
    'Desai', 'Kulkarni', 'Banerjee', 'Mukherjee', 'Choudhury', 'Shah', 'Pandey', 'Saxena', 'Bhatt', 'Menon',
    'Kaur', 'Sethi', 'Kapoor', 'Thakur', 'Sinha', 'Bose', 'Sen', 'Roy', 'Dutta', 'Ghosh'];
  for (let i = 0; i < 40; i++) {
    customerInsert.run(`CUST-${String(i + 1).padStart(3, '0')}`, `${firstNames[i]} ${lastNames[i]}`, regions[i % 5]);
  }

  // --- Inventory ---
  // Carefully designed to hit ~12K affected, ~8.7K safe, ~1.2K uncertain, ~3.1K sold
  // Contaminated batches (B51-B56 confirmed, B55 probable, B57 unknown) in 3 warehouses
  const inventoryData: [string, string, string, string, string, number, string][] = [];
  let invId = 1;

  // B51 (P-001, confirmed MILK-204): 2000 produced
  // Distribute: WH-001=600, WH-002=500, WH-003=400, stores=350 (sold from stores), in_transit=150
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B51', 'WH-001', 'warehouse', 600, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B51', 'WH-002', 'warehouse', 500, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B51', 'WH-003', 'warehouse', 400, 'available']);

  // B52 (P-002, confirmed 80%): 1500 produced
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-002', 'B52', 'WH-001', 'warehouse', 450, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-002', 'B52', 'WH-002', 'warehouse', 350, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-002', 'B52', 'WH-004', 'warehouse', 300, 'available']);

  // B53 (P-003/Product C, confirmed): 1800 produced
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B53', 'WH-001', 'warehouse', 500, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B53', 'WH-002', 'warehouse', 400, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B53', 'WH-003', 'warehouse', 350, 'available']);

  // B54 (P-004/Product D, confirmed 60%): 1200 produced
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-004', 'B54', 'WH-001', 'warehouse', 350, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-004', 'B54', 'WH-003', 'warehouse', 280, 'available']);

  // B55 (P-010, probable 50%): 800 produced — uncertain
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-010', 'B55', 'WH-001', 'warehouse', 300, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-010', 'B55', 'WH-004', 'warehouse', 200, 'available']);

  // B56 (P-001, confirmed): 2500 produced
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B56', 'WH-001', 'warehouse', 700, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B56', 'WH-002', 'warehouse', 600, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B56', 'WH-003', 'warehouse', 500, 'available']);

  // B57 (P-003, unknown 30%): 2200 produced — uncertain
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B57', 'WH-001', 'warehouse', 400, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B57', 'WH-002', 'warehouse', 350, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B57', 'WH-003', 'warehouse', 250, 'available']);

  // Clean batches — safe inventory
  // B58 (P-001, clean): 2000
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B58', 'WH-001', 'warehouse', 800, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-001', 'B58', 'WH-002', 'warehouse', 700, 'available']);

  // B59 (P-002, clean): 1800
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-002', 'B59', 'WH-001', 'warehouse', 600, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-002', 'B59', 'WH-002', 'warehouse', 500, 'available']);

  // B60 (P-003, clean): 1500
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B60', 'WH-001', 'warehouse', 500, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-003', 'B60', 'WH-003', 'warehouse', 400, 'available']);

  // B61 (P-005, wheat): 3000
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-005', 'B61', 'WH-001', 'warehouse', 1200, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-005', 'B61', 'WH-002', 'warehouse', 800, 'available']);

  // B62 (P-006): 2500
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-006', 'B62', 'WH-001', 'warehouse', 800, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-006', 'B62', 'WH-003', 'warehouse', 700, 'available']);

  // B63 (P-007): 1000
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-007', 'B63', 'WH-004', 'warehouse', 500, 'available']);

  // B64 (P-008): 4000
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-008', 'B64', 'WH-001', 'warehouse', 1000, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-008', 'B64', 'WH-002', 'warehouse', 1000, 'available']);

  // B65 (P-009): 2000
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-009', 'B65', 'WH-001', 'warehouse', 700, 'available']);
  inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, 'P-009', 'B65', 'WH-003', 'warehouse', 600, 'available']);

  // Store inventory (smaller quantities at stores - from delivered shipments)
  const contaminatedStoreInv: [string, string, string, number][] = [
    ['P-001', 'B51', 'ST-001', 40], ['P-001', 'B51', 'ST-002', 35], ['P-001', 'B51', 'ST-006', 45],
    ['P-001', 'B51', 'ST-011', 30], ['P-001', 'B51', 'ST-016', 25],
    ['P-002', 'B52', 'ST-001', 30], ['P-002', 'B52', 'ST-003', 25], ['P-002', 'B52', 'ST-007', 35],
    ['P-003', 'B53', 'ST-002', 40], ['P-003', 'B53', 'ST-008', 30], ['P-003', 'B53', 'ST-013', 35],
    ['P-003', 'B53', 'ST-017', 25],
    ['P-004', 'B54', 'ST-001', 20], ['P-004', 'B54', 'ST-006', 25], ['P-004', 'B54', 'ST-012', 30],
    ['P-001', 'B56', 'ST-003', 50], ['P-001', 'B56', 'ST-004', 40], ['P-001', 'B56', 'ST-009', 35],
    ['P-001', 'B56', 'ST-014', 45], ['P-001', 'B56', 'ST-019', 30],
    ['P-003', 'B57', 'ST-005', 30], ['P-003', 'B57', 'ST-010', 25], ['P-003', 'B57', 'ST-015', 35],
    ['P-010', 'B55', 'ST-001', 20], ['P-010', 'B55', 'ST-011', 15],
  ];
  for (const [pId, bId, sId, qty] of contaminatedStoreInv) {
    inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, pId, bId, sId, 'store', qty, 'available']);
  }

  // Clean store inventory
  const cleanStoreInv: [string, string, string, number][] = [
    ['P-001', 'B58', 'ST-001', 50], ['P-001', 'B58', 'ST-006', 40],
    ['P-002', 'B59', 'ST-002', 35], ['P-002', 'B59', 'ST-011', 30],
    ['P-003', 'B60', 'ST-003', 25], ['P-003', 'B60', 'ST-013', 30],
    ['P-005', 'B61', 'ST-001', 60], ['P-005', 'B61', 'ST-006', 50], ['P-005', 'B61', 'ST-011', 45],
    ['P-006', 'B62', 'ST-002', 40], ['P-006', 'B62', 'ST-007', 35],
    ['P-008', 'B64', 'ST-003', 55], ['P-008', 'B64', 'ST-008', 50],
    ['P-009', 'B65', 'ST-004', 30], ['P-009', 'B65', 'ST-014', 25],
  ];
  for (const [pId, bId, sId, qty] of cleanStoreInv) {
    inventoryData.push([`INV-${String(invId++).padStart(4, '0')}`, pId, bId, sId, 'store', qty, 'available']);
  }

  const insertInventory = sqlite.prepare('INSERT INTO inventory VALUES (?,?,?,?,?,?,?)');
  for (const inv of inventoryData) insertInventory.run(...inv);

  // --- Shipments (~400) ---
  // Mix of in_transit and delivered, covering contaminated and clean batches
  const shipmentInsert = sqlite.prepare('INSERT INTO shipments VALUES (?,?,?,?,?,?,?,?,?)');
  let shipId = 1;

  // Helper to generate shipments from a batch to stores via warehouse
  function genShipments(
    batchId: string, productId: string, warehouseId: string,
    destinations: string[], qtyEach: number, status: string,
    baseDate: string
  ) {
    for (const dest of destinations) {
      shipmentInsert.run(
        `SH-${String(shipId++).padStart(4, '0')}`,
        batchId, productId, warehouseId, dest, qtyEach, status,
        baseDate, '2026-09-28'
      );
    }
  }

  // Contaminated batch shipments — heavy distribution
  // B51 (P-001) from WH-001, WH-002, WH-003
  genShipments('B51', 'P-001', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 20, 'delivered', '2026-09-18');
  genShipments('B51', 'P-001', 'WH-001', ['ST-016', 'ST-017', 'ST-018'], 15, 'delivered', '2026-09-19');
  genShipments('B51', 'P-001', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010'], 20, 'delivered', '2026-09-18');
  genShipments('B51', 'P-001', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015'], 18, 'delivered', '2026-09-19');
  genShipments('B51', 'P-001', 'WH-001', ['ST-022', 'ST-023'], 15, 'in_transit', '2026-09-27');

  // B52 (P-002) from WH-001, WH-002
  genShipments('B52', 'P-002', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004'], 25, 'delivered', '2026-09-18');
  genShipments('B52', 'P-002', 'WH-002', ['ST-006', 'ST-007', 'ST-008'], 20, 'delivered', '2026-09-19');
  genShipments('B52', 'P-002', 'WH-004', ['ST-016', 'ST-017', 'ST-018'], 18, 'delivered', '2026-09-20');
  genShipments('B52', 'P-002', 'WH-001', ['ST-019', 'ST-020'], 15, 'in_transit', '2026-09-27');

  // B53 (P-003/Product C) from WH-001, WH-002, WH-003
  genShipments('B53', 'P-003', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 22, 'delivered', '2026-09-19');
  genShipments('B53', 'P-003', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010'], 20, 'delivered', '2026-09-19');
  genShipments('B53', 'P-003', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015'], 18, 'delivered', '2026-09-20');
  genShipments('B53', 'P-003', 'WH-001', ['ST-016', 'ST-017', 'ST-018', 'ST-022'], 15, 'delivered', '2026-09-21');
  genShipments('B53', 'P-003', 'WH-002', ['ST-023', 'ST-024', 'ST-025'], 12, 'in_transit', '2026-09-27');

  // B54 (P-004/Product D) from WH-001, WH-003
  genShipments('B54', 'P-004', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-006', 'ST-007'], 18, 'delivered', '2026-09-19');
  genShipments('B54', 'P-004', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014'], 15, 'delivered', '2026-09-20');
  genShipments('B54', 'P-004', 'WH-001', ['ST-016', 'ST-017'], 12, 'in_transit', '2026-09-27');

  // B55 (P-010, probable) from WH-001, WH-004
  genShipments('B55', 'P-010', 'WH-001', ['ST-001', 'ST-002', 'ST-003'], 15, 'delivered', '2026-09-20');
  genShipments('B55', 'P-010', 'WH-004', ['ST-016', 'ST-017'], 12, 'delivered', '2026-09-21');
  genShipments('B55', 'P-010', 'WH-001', ['ST-011'], 10, 'in_transit', '2026-09-27');

  // B56 (P-001, confirmed) from WH-001, WH-002, WH-003
  genShipments('B56', 'P-001', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 25, 'delivered', '2026-09-20');
  genShipments('B56', 'P-001', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010'], 22, 'delivered', '2026-09-20');
  genShipments('B56', 'P-001', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015'], 20, 'delivered', '2026-09-21');
  genShipments('B56', 'P-001', 'WH-001', ['ST-016', 'ST-017', 'ST-018', 'ST-022', 'ST-025'], 18, 'delivered', '2026-09-22');
  genShipments('B56', 'P-001', 'WH-002', ['ST-019', 'ST-020', 'ST-021'], 20, 'in_transit', '2026-09-27');

  // B57 (P-003, unknown) from WH-001, WH-002, WH-003
  genShipments('B57', 'P-003', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 20, 'delivered', '2026-09-21');
  genShipments('B57', 'P-003', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010'], 18, 'delivered', '2026-09-22');
  genShipments('B57', 'P-003', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015'], 16, 'delivered', '2026-09-22');
  genShipments('B57', 'P-003', 'WH-001', ['ST-019', 'ST-020', 'ST-021'], 15, 'in_transit', '2026-09-27');

  // Clean batch shipments
  // B58 (P-001, clean) 
  genShipments('B58', 'P-001', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 20, 'delivered', '2026-09-22');
  genShipments('B58', 'P-001', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010'], 18, 'delivered', '2026-09-23');

  // B59 (P-002, clean)
  genShipments('B59', 'P-002', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004'], 20, 'delivered', '2026-09-22');
  genShipments('B59', 'P-002', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-011', 'ST-012'], 15, 'delivered', '2026-09-23');

  // B60 (P-003, clean)
  genShipments('B60', 'P-003', 'WH-001', ['ST-001', 'ST-002', 'ST-003'], 20, 'delivered', '2026-09-23');
  genShipments('B60', 'P-003', 'WH-003', ['ST-011', 'ST-013', 'ST-014'], 15, 'delivered', '2026-09-23');

  // B61 (P-005, wheat bread)
  genShipments('B61', 'P-005', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005', 'ST-016', 'ST-017', 'ST-018'], 30, 'delivered', '2026-09-18');
  genShipments('B61', 'P-005', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010', 'ST-023'], 25, 'delivered', '2026-09-19');
  genShipments('B61', 'P-005', 'WH-001', ['ST-019', 'ST-020', 'ST-021', 'ST-022', 'ST-024', 'ST-025'], 20, 'delivered', '2026-09-20');

  // B62 (P-006, ketchup)
  genShipments('B62', 'P-006', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 20, 'delivered', '2026-09-19');
  genShipments('B62', 'P-006', 'WH-003', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015'], 18, 'delivered', '2026-09-20');
  genShipments('B62', 'P-006', 'WH-001', ['ST-016', 'ST-017', 'ST-022', 'ST-025'], 15, 'delivered', '2026-09-21');

  // B63 (P-007, masala)
  genShipments('B63', 'P-007', 'WH-004', ['ST-001', 'ST-006', 'ST-011', 'ST-016', 'ST-019'], 12, 'delivered', '2026-09-20');

  // B64 (P-008, energy drink)
  genShipments('B64', 'P-008', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005', 'ST-016', 'ST-017', 'ST-018', 'ST-022', 'ST-025'], 25, 'delivered', '2026-09-21');
  genShipments('B64', 'P-008', 'WH-002', ['ST-006', 'ST-007', 'ST-008', 'ST-009', 'ST-010', 'ST-023'], 22, 'delivered', '2026-09-22');
  genShipments('B64', 'P-008', 'WH-001', ['ST-011', 'ST-012', 'ST-013', 'ST-014', 'ST-015', 'ST-024'], 20, 'delivered', '2026-09-22');
  genShipments('B64', 'P-008', 'WH-002', ['ST-019', 'ST-020', 'ST-021'], 18, 'in_transit', '2026-09-27');

  // B65 (P-009, crackers)
  genShipments('B65', 'P-009', 'WH-001', ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005'], 18, 'delivered', '2026-09-22');
  genShipments('B65', 'P-009', 'WH-003', ['ST-011', 'ST-013', 'ST-014', 'ST-015', 'ST-024'], 15, 'delivered', '2026-09-23');

  // --- Sales (~3100 affected units sold) ---
  const salesInsert = sqlite.prepare('INSERT INTO sales VALUES (?,?,?,?,?,?,?)');
  let saleId = 1;

  function genSales(
    storeId: string, productId: string, batchId: string,
    qty: number, date: string, custStart: number
  ) {
    // Split into multiple customer sales
    const perCustomer = Math.ceil(qty / 3);
    let remaining = qty;
    for (let i = 0; i < 3 && remaining > 0; i++) {
      const saleQty = Math.min(perCustomer, remaining);
      salesInsert.run(
        `SALE-${String(saleId++).padStart(4, '0')}`,
        storeId, productId, batchId, saleQty, date,
        `CUST-${String(((custStart + i) % 40) + 1).padStart(3, '0')}`
      );
      remaining -= saleQty;
    }
  }

  // Affected product sales (target: ~3100 total)
  // B51 (P-001) sales: ~500 units
  genSales('ST-001', 'P-001', 'B51', 80, '2026-09-20', 0);
  genSales('ST-002', 'P-001', 'B51', 60, '2026-09-20', 3);
  genSales('ST-006', 'P-001', 'B51', 70, '2026-09-21', 6);
  genSales('ST-011', 'P-001', 'B51', 55, '2026-09-21', 9);
  genSales('ST-016', 'P-001', 'B51', 45, '2026-09-22', 12);
  genSales('ST-003', 'P-001', 'B51', 50, '2026-09-22', 15);
  genSales('ST-007', 'P-001', 'B51', 40, '2026-09-22', 18);
  genSales('ST-013', 'P-001', 'B51', 35, '2026-09-23', 21);
  genSales('ST-017', 'P-001', 'B51', 30, '2026-09-23', 24);
  genSales('ST-004', 'P-001', 'B51', 35, '2026-09-23', 27);

  // B52 (P-002) sales: ~350
  genSales('ST-001', 'P-002', 'B52', 60, '2026-09-20', 5);
  genSales('ST-003', 'P-002', 'B52', 50, '2026-09-21', 8);
  genSales('ST-007', 'P-002', 'B52', 55, '2026-09-21', 11);
  genSales('ST-016', 'P-002', 'B52', 40, '2026-09-22', 14);
  genSales('ST-017', 'P-002', 'B52', 35, '2026-09-22', 17);
  genSales('ST-002', 'P-002', 'B52', 45, '2026-09-23', 20);
  genSales('ST-008', 'P-002', 'B52', 40, '2026-09-23', 23);
  genSales('ST-018', 'P-002', 'B52', 25, '2026-09-23', 26);

  // B53 (P-003) sales: ~500
  genSales('ST-002', 'P-003', 'B53', 65, '2026-09-21', 1);
  genSales('ST-008', 'P-003', 'B53', 55, '2026-09-21', 4);
  genSales('ST-013', 'P-003', 'B53', 50, '2026-09-22', 7);
  genSales('ST-017', 'P-003', 'B53', 40, '2026-09-22', 10);
  genSales('ST-001', 'P-003', 'B53', 60, '2026-09-23', 13);
  genSales('ST-006', 'P-003', 'B53', 50, '2026-09-23', 16);
  genSales('ST-011', 'P-003', 'B53', 45, '2026-09-24', 19);
  genSales('ST-014', 'P-003', 'B53', 40, '2026-09-24', 22);
  genSales('ST-003', 'P-003', 'B53', 45, '2026-09-24', 25);
  genSales('ST-022', 'P-003', 'B53', 30, '2026-09-25', 28);

  // B54 (P-004) sales: ~300
  genSales('ST-001', 'P-004', 'B54', 45, '2026-09-21', 2);
  genSales('ST-006', 'P-004', 'B54', 40, '2026-09-22', 5);
  genSales('ST-012', 'P-004', 'B54', 35, '2026-09-22', 8);
  genSales('ST-002', 'P-004', 'B54', 50, '2026-09-23', 11);
  genSales('ST-007', 'P-004', 'B54', 40, '2026-09-23', 14);
  genSales('ST-011', 'P-004', 'B54', 30, '2026-09-24', 17);
  genSales('ST-013', 'P-004', 'B54', 35, '2026-09-24', 20);
  genSales('ST-014', 'P-004', 'B54', 25, '2026-09-25', 23);

  // B56 (P-001) sales: ~700
  genSales('ST-003', 'P-001', 'B56', 90, '2026-09-22', 0);
  genSales('ST-004', 'P-001', 'B56', 70, '2026-09-22', 3);
  genSales('ST-009', 'P-001', 'B56', 65, '2026-09-23', 6);
  genSales('ST-014', 'P-001', 'B56', 80, '2026-09-23', 9);
  genSales('ST-019', 'P-001', 'B56', 55, '2026-09-24', 12);
  genSales('ST-001', 'P-001', 'B56', 75, '2026-09-24', 15);
  genSales('ST-006', 'P-001', 'B56', 60, '2026-09-25', 18);
  genSales('ST-011', 'P-001', 'B56', 50, '2026-09-25', 21);
  genSales('ST-016', 'P-001', 'B56', 45, '2026-09-25', 24);
  genSales('ST-022', 'P-001', 'B56', 55, '2026-09-26', 27);
  genSales('ST-025', 'P-001', 'B56', 40, '2026-09-26', 30);

  // B55 (P-010, probable) sales: ~200
  genSales('ST-001', 'P-010', 'B55', 35, '2026-09-22', 7);
  genSales('ST-002', 'P-010', 'B55', 30, '2026-09-23', 10);
  genSales('ST-016', 'P-010', 'B55', 25, '2026-09-23', 13);
  genSales('ST-017', 'P-010', 'B55', 20, '2026-09-24', 16);
  genSales('ST-003', 'P-010', 'B55', 30, '2026-09-24', 19);
  genSales('ST-011', 'P-010', 'B55', 25, '2026-09-25', 22);
  genSales('ST-006', 'P-010', 'B55', 20, '2026-09-25', 25);

  // B57 (P-003, unknown) sales: ~400
  genSales('ST-005', 'P-003', 'B57', 50, '2026-09-23', 0);
  genSales('ST-010', 'P-003', 'B57', 45, '2026-09-23', 3);
  genSales('ST-015', 'P-003', 'B57', 40, '2026-09-24', 6);
  genSales('ST-001', 'P-003', 'B57', 55, '2026-09-24', 9);
  genSales('ST-006', 'P-003', 'B57', 45, '2026-09-25', 12);
  genSales('ST-011', 'P-003', 'B57', 40, '2026-09-25', 15);
  genSales('ST-002', 'P-003', 'B57', 45, '2026-09-26', 18);
  genSales('ST-007', 'P-003', 'B57', 35, '2026-09-26', 21);
  genSales('ST-012', 'P-003', 'B57', 30, '2026-09-26', 24);

  // Clean product sales (not affected)
  genSales('ST-001', 'P-001', 'B58', 40, '2026-09-24', 5);
  genSales('ST-006', 'P-001', 'B58', 35, '2026-09-25', 8);
  genSales('ST-001', 'P-005', 'B61', 50, '2026-09-20', 11);
  genSales('ST-006', 'P-005', 'B61', 45, '2026-09-21', 14);
  genSales('ST-011', 'P-005', 'B61', 40, '2026-09-22', 17);
  genSales('ST-002', 'P-006', 'B62', 30, '2026-09-21', 20);
  genSales('ST-007', 'P-006', 'B62', 25, '2026-09-22', 23);

  // --- Machines (8) ---
  // M01-M04 process dairy (affected by MILK-204 incident → idle after stoppage)
  // M05-M06 process other products (not affected)
  // M07 incompatible with dairy, M08 maintenance
  const machinesData = [
    ['M01', 'Homogenizer Alpha', 500, '["P-001","P-010"]', 0.85, 1, 'running'],
    ['M02', 'Pasteurizer Beta', 400, '["P-001","P-002"]', 0.90, 1, 'running'],
    ['M03', 'Fermentation Unit C', 350, '["P-003","P-004"]', 0.75, 1, 'running'],
    ['M04', 'Cheese Press Delta', 250, '["P-004","P-010"]', 0.60, 1, 'running'],
    ['M05', 'Bread Oven Epsilon', 600, '["P-005","P-009"]', 0.80, 1, 'running'],
    ['M06', 'Sauce Blender Zeta', 450, '["P-006"]', 0.70, 1, 'running'],
    ['M07', 'Spice Grinder Eta', 200, '["P-007"]', 0.40, 1, 'running'], // Incompatible with dairy
    ['M08', 'Bottling Line Theta', 800, '["P-008"]', 0.0, 0, 'maintenance'], // Down
  ];
  const insertMachine = sqlite.prepare('INSERT INTO machines VALUES (?,?,?,?,?,?,?)');
  for (const m of machinesData) insertMachine.run(...m);

  // --- Workers (30) ---
  const workerInsert = sqlite.prepare('INSERT INTO workers VALUES (?,?,?,?,?,?)');
  const workerData: [string, string, string, number, string, number][] = [
    ['W01', 'Ramesh Kulkarni', '["dairy_processing","pasteurization","quality_control"]', 1, 'active', 8],
    ['W02', 'Suresh Patil', '["dairy_processing","fermentation"]', 1, 'active', 8],
    ['W03', 'Priya Sharma', '["dairy_processing","packaging","quality_control"]', 1, 'active', 8],
    ['W04', 'Anita Desai', '["dairy_processing","pasteurization"]', 1, 'active', 8],
    ['W05', 'Vijay Kumar', '["dairy_processing","cheese_making","fermentation"]', 1, 'active', 8],
    ['W06', 'Neha Gupta', '["dairy_processing","quality_control"]', 1, 'active', 8],
    ['W07', 'Raj Malhotra', '["bakery","packaging"]', 1, 'active', 8],
    ['W08', 'Deepak Singh', '["bakery","quality_control"]', 1, 'active', 8],
    ['W09', 'Kavita Reddy', '["sauce_production","packaging"]', 1, 'active', 8],
    ['W10', 'Mohan Nair', '["spice_processing"]', 1, 'active', 8], // Only spice — incompatible
    ['W11', 'Lakshmi Iyer', '["beverage_production","packaging"]', 1, 'active', 8],
    ['W12', 'Sanjay Verma', '["warehouse_ops","forklift"]', 1, 'active', 8],
    ['W13', 'Rita Chopra', '["warehouse_ops","inventory_mgmt"]', 1, 'active', 8],
    ['W14', 'Amit Mehta', '["logistics","driving","warehouse_ops"]', 1, 'active', 8],
    ['W15', 'Sunita Agarwal', '["quality_control","lab_testing"]', 1, 'active', 8],
    ['W16', 'Ravi Mishra', '["dairy_processing","maintenance"]', 1, 'active', 8],
    ['W17', 'Geeta Bhat', '["packaging","labeling"]', 1, 'active', 8],
    ['W18', 'Karan Rao', '["dairy_processing","fermentation","cheese_making"]', 1, 'active', 8],
    ['W19', 'Pooja Pillai', '["quality_control","documentation"]', 1, 'active', 8],
    ['W20', 'Arjun Chauhan', '["logistics","driving"]', 1, 'active', 8],
    ['W21', 'Meera Das', '["dairy_processing","pasteurization","packaging"]', 1, 'active', 8],
    ['W22', 'Rohan Sethi', '["maintenance","equipment_repair"]', 1, 'active', 8],
    ['W23', 'Diya Kapoor', '["bakery","confectionery"]', 1, 'active', 8], // Bakery only
    ['W24', 'Ishaan Thakur', '["warehouse_ops","cold_storage"]', 1, 'active', 8],
    ['W25', 'Navya Sinha', '["dairy_processing","quality_control","packaging"]', 1, 'active', 8],
    ['W26', 'Aanya Bose', '["administration"]', 1, 'active', 8], // No production skills
    ['W27', 'Vihaan Sen', '["dairy_processing","fermentation"]', 1, 'active', 8],
    ['W28', 'Saanvi Roy', '["quality_control","lab_testing","documentation"]', 1, 'active', 8],
    ['W29', 'Krishna Dutta', '["logistics","driving","warehouse_ops"]', 1, 'active', 8],
    ['W30', 'Isha Ghosh', '["dairy_processing","packaging"]', 0, 'unavailable', 8], // Unavailable
  ];
  for (const w of workerData) workerInsert.run(...w);

  // --- Trucks (6) ---
  const truckInsert = sqlite.prepare('INSERT INTO trucks VALUES (?,?,?,?,?,?)');
  const truckData: [string, string, number, number, string, string | null][] = [
    ['TRK-001', 'Tata 407 Reefer #1', 500, 0, 'in_use', 'RT-001'],
    ['TRK-002', 'Tata 407 Reefer #2', 500, 1, 'available', null],
    ['TRK-003', 'Ashok Leyland Reefer #1', 800, 0, 'in_use', 'RT-003'],
    ['TRK-004', 'Ashok Leyland Reefer #2', 800, 1, 'available', null],
    ['TRK-005', 'Eicher Reefer #1', 350, 1, 'available', null],
    ['TRK-006', 'Mahindra Furio #1', 600, 0, 'maintenance', null],
  ];
  for (const t of truckData) truckInsert.run(...t);

  // --- Routes ---
  const routeInsert = sqlite.prepare('INSERT INTO routes VALUES (?,?,?,?,?)');
  const routeData = [
    ['RT-001', 'WH-001', 'WH-002', 1400, 24],
    ['RT-002', 'WH-001', 'WH-003', 980, 16],
    ['RT-003', 'WH-001', 'WH-004', 525, 8],
    ['RT-004', 'WH-002', 'WH-003', 2150, 36],
    ['RT-005', 'WH-002', 'WH-005', 1500, 26],
    ['RT-006', 'WH-001', 'WH-005', 2050, 34],
    ['RT-007', 'WH-003', 'WH-004', 1200, 20],
  ];
  for (const r of routeData) routeInsert.run(...r);

  // --- Demand ---
  // Product C (P-003) demand gap ~2500, Product D (P-004) ~1200
  const demandInsert = sqlite.prepare('INSERT INTO demand VALUES (?,?,?,?,?,?)');
  const demandData = [
    ['DEM-001', 'P-003', 4000, '2026-10-05', 55, 'critical'],  // Product C high demand
    ['DEM-002', 'P-004', 2000, '2026-10-07', 120, 'high'],      // Product D
    ['DEM-003', 'P-001', 5000, '2026-10-03', 45, 'critical'],   // Fresh milk
    ['DEM-004', 'P-002', 2500, '2026-10-06', 85, 'high'],       // Paneer
    ['DEM-005', 'P-010', 1000, '2026-10-08', 195, 'medium'],    // Butter
    ['DEM-006', 'P-005', 3000, '2026-10-04', 35, 'high'],       // Bread
    ['DEM-007', 'P-006', 2000, '2026-10-10', 95, 'medium'],     // Ketchup
    ['DEM-008', 'P-008', 4000, '2026-10-05', 40, 'high'],       // Energy drink
  ];
  for (const d of demandData) demandInsert.run(...d);

  // --- Cost Rates ---
  const costInsert = sqlite.prepare('INSERT INTO cost_rates VALUES (?,?,?,?)');
  const costData = [
    ['CR-001', 'transport_per_unit', 8.5, 'Average transport cost per unit (₹)'],
    ['CR-002', 'disposal_per_unit', 12.0, 'Disposal/destruction cost per unit (₹)'],
    ['CR-003', 'quarantine_per_unit', 3.0, 'Warehouse isolation handling per unit (₹)'],
    ['CR-004', 'customer_recall_per_unit', 45.0, 'Customer notification + return handling per unit (₹)'],
    ['CR-005', 'withdrawal_per_unit', 15.0, 'Store withdrawal + return transport per unit (₹)'],
    ['CR-006', 'verification_per_unit', 5.0, 'Lab testing/verification per unit (₹)'],
    ['CR-007', 'changeover_per_machine', 2500.0, 'Machine changeover/setup cost (₹)'],
    ['CR-008', 'idle_penalty_per_hour', 500.0, 'Machine idle penalty per hour (₹)'],
  ];
  for (const c of costData) costInsert.run(...c);

  // --- Inspections (seed initial inspection that flagged MILK-204) ---
  const inspInsert = sqlite.prepare('INSERT INTO inspections VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  inspInsert.run(
    'INSP-001', 'P-001', 'B51', 'MILK-204', 'microbial_contamination', 'fail',
    'critical', 'contamination', 'quality_inspector',
    'Elevated coliform count detected in milk sample from Lot MILK-204. Immediate action required.',
    '2026-09-28T09:15:00Z'
  );
  inspInsert.run(
    'INSP-002', 'P-005', 'B61', 'WHT-301', 'moisture_content', 'pass',
    null, null, 'quality_inspector',
    'Moisture content within acceptable range.',
    '2026-09-28T10:30:00Z'
  );
  inspInsert.run(
    'INSP-003', 'P-006', 'B62', 'TMP-501', 'ph_level', 'pass',
    null, null, 'quality_inspector',
    'pH level normal for tomato paste batch.',
    '2026-09-28T11:00:00Z'
  );

  // --- Incidents ---
  // Primary: MILK-204 contamination (critical)
  // Secondary: Temperature excursion at WH-004
  const incInsert = sqlite.prepare('INSERT INTO incidents VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  incInsert.run(
    'INC-001', 'contamination', 'MILK-204', 'critical',
    '2026-09-28T09:15:00Z', 'NovaFoods Central Hub (WH-001)',
    'pending',
    'Microbial Contamination — Lot MILK-204',
    'Elevated coliform count detected in whole milk Lot MILK-204 from Greenfield Dairy Co. Potential contamination affecting multiple downstream products and batches.',
    '2026-09-28T09:15:00Z', '2026-09-28T09:15:00Z'
  );
  incInsert.run(
    'INC-002', 'temperature_excursion', 'MILK-207', 'high',
    '2026-09-29T14:30:00Z', 'NovaFoods West Cold Storage (WH-004)',
    'pending',
    'Temperature Excursion — WH-004 Cold Storage',
    'Temperature monitoring system recorded 11.2°C (safe limit: 8°C) in cold storage zone B of WH-004 for approximately 4 hours (10:00–14:00). Lots MILK-207 and SMP-102 were present during the excursion window.',
    '2026-09-29T14:30:00Z', '2026-09-29T14:30:00Z'
  );

  // --- Timeline Events ---
  const tlInsert = sqlite.prepare('INSERT INTO timeline_events VALUES (?,?,?,?,?,?)');
  tlInsert.run('TL-001', 'INC-001', 'Incident Detected', 'Quality inspection flagged elevated coliform count in Lot MILK-204', '2026-09-28T09:15:00Z', 'detection');
  tlInsert.run('TL-002', 'INC-001', 'Source Lot Identified', 'Lot MILK-204 from Greenfield Dairy Co. confirmed as contamination source', '2026-09-28T09:20:00Z', 'detection');
  tlInsert.run('TL-003', 'INC-002', 'Temperature Alert', 'Cold storage zone B in WH-004 exceeded 8°C threshold', '2026-09-29T14:30:00Z', 'detection');

  // --- Audit Log ---
  const auditInsert = sqlite.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?,?)');
  auditInsert.run('AUD-001', 'inspection_created', 'inspection', 'INSP-001', 'Microbial contamination test failed for Lot MILK-204', '2026-09-28T09:15:00Z', 'quality_inspector');
  auditInsert.run('AUD-002', 'incident_created', 'incident', 'INC-001', 'Incident INC-001 created from inspection INSP-001', '2026-09-28T09:15:00Z', 'quality_inspector');
  auditInsert.run('AUD-003', 'incident_created', 'incident', 'INC-002', 'Temperature excursion incident created for WH-004', '2026-09-29T14:30:00Z', 'system');

  sqlite.pragma('foreign_keys = ON');
  sqlite.close();
  
  console.log('✓ Database seeded successfully');
  console.log(`  Database: ${DB_PATH}`);
}

export function resetDatabase() {
  seedDatabase();
  console.log('✓ Database reset complete');
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}
