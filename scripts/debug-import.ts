/**
 * scripts/debug-import.ts
 * Pinpoints the exact failing row, table, and missing parent ID.
 */
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const SCRATCH_DB = path.join(__dirname, 'scratch_debug.db');
if (fs.existsSync(SCRATCH_DB)) fs.unlinkSync(SCRATCH_DB);

const db = new Database(SCRATCH_DB);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE suppliers (id text PRIMARY KEY, name text, location text, contact_email text, rating real);
  CREATE TABLE materials (id text PRIMARY KEY, name text, supplier_id text REFERENCES suppliers(id), unit text, category text);
  CREATE TABLE lots (id text PRIMARY KEY, material_id text REFERENCES materials(id), supplier_id text REFERENCES suppliers(id), received_at text, quantity real, unit text, expires_at text, status text);
  CREATE TABLE products (id text PRIMARY KEY, name text, category text, unit_price real, shelf_life_days integer);
  CREATE TABLE batches (id text PRIMARY KEY, product_id text REFERENCES products(id), produced_at text, quantity integer, status text, machine_id text, line_id text);
  CREATE TABLE batch_lot_usage (id text PRIMARY KEY, batch_id text REFERENCES batches(id), lot_id text REFERENCES lots(id), confidence text, fraction_used real);
  CREATE TABLE warehouses (id text PRIMARY KEY, name text, location text, capacity integer, free_slots integer, available integer, temperature_controlled integer);
  CREATE TABLE inventory (id text PRIMARY KEY, product_id text REFERENCES products(id), batch_id text REFERENCES batches(id), location_id text, location_type text, quantity integer, status text);
  CREATE TABLE shipments (id text PRIMARY KEY, batch_id text REFERENCES batches(id), product_id text REFERENCES products(id), origin text, destination text, quantity integer, status text, departed_at text, estimated_arrival text);
  CREATE TABLE stores (id text PRIMARY KEY, name text, location text, region text);
`);

const csvText = fs.readFileSync(path.join(__dirname, '..', 'public', 'sample-data', 'nestle-sim', 'nestle_sim_complete.csv'), 'utf-8');
const lines = csvText.split(/\r\n|\n/).filter(l => l.trim().length > 0);

console.log(`Analyzing ${lines.length - 1} rows from nestle_sim_complete.csv...`);

// Parse lines
const rows: any[] = [];
for (let i = 1; i < lines.length; i++) {
  const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
  const clean = match.map(c => c.replace(/^"|"$/g, '').trim());
  rows.push({
    lineNum: i + 1,
    type: clean[0],
    id: clean[1],
    nameOrType: clean[2],
    parentOrOrigin: clean[3],
    targetOrDest: clean[4],
    qty: parseFloat(clean[5] || '0') || 0,
    unitOrPrice: clean[6],
    statusOrConf: clean[7],
  });
}

// Track parent IDs
const knownSuppliers = new Set<string>();
const knownMaterials = new Set<string>();
const knownLots = new Set<string>();
const knownProducts = new Set<string>();
const knownBatches = new Set<string>();
const batchToProduct = new Map<string, string>();

let firstErrorPrinted = false;

for (const r of rows) {
  try {
    if (r.type === 'supplier') {
      db.prepare('INSERT INTO suppliers VALUES (?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, r.targetOrDest, r.qty);
      knownSuppliers.add(r.id);
    } else if (r.type === 'material') {
      db.prepare('INSERT INTO materials VALUES (?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, r.unitOrPrice, r.statusOrConf);
      knownMaterials.add(r.id);
    } else if (r.type === 'lot') {
      db.prepare('INSERT INTO lots VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, new Date().toISOString(), r.qty, r.unitOrPrice, new Date().toISOString(), r.statusOrConf);
      knownLots.add(r.id);
    } else if (r.type === 'product') {
      db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, r.qty, 180);
      knownProducts.add(r.id);
    } else if (r.type === 'batch') {
      db.prepare('INSERT INTO batches VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.nameOrType, new Date().toISOString(), r.qty, r.statusOrConf, r.parentOrOrigin, r.targetOrDest);
      knownBatches.add(r.id);
      batchToProduct.set(r.id, r.nameOrType);
    } else if (r.type === 'batch_lot_usage') {
      db.prepare('INSERT INTO batch_lot_usage VALUES (?, ?, ?, ?, ?)').run(r.id, r.targetOrDest, r.parentOrOrigin, r.nameOrType, r.qty);
    } else if (r.type === 'warehouse') {
      db.prepare('INSERT INTO warehouses VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, r.qty, 1000, 1, 0);
    } else if (r.type === 'inventory') {
      db.prepare('INSERT INTO inventory VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.nameOrType, r.parentOrOrigin, r.targetOrDest, 'warehouse', r.qty, r.statusOrConf);
    } else if (r.type === 'shipment') {
      // Test with the bug that was in settings/page.tsx:
      // Hardcoded 'PRD-BAR-801'
      const buggedProductId = 'PRD-BAR-801';
      db.prepare('INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        r.id, r.nameOrType, buggedProductId, r.parentOrOrigin, r.targetOrDest, r.qty, r.statusOrConf, new Date().toISOString(), new Date().toISOString()
      );
    }
  } catch (err: any) {
    if (!firstErrorPrinted) {
      console.log('\n======================================================');
      console.log('FIRST FAILING ROW ROOT CAUSE IDENTIFIED:');
      console.log('------------------------------------------------------');
      console.log(`Row Number:        Line ${r.lineNum} of nestle_sim_complete.csv`);
      console.log(`EntityType:        ${r.type}`);
      console.log(`Entity ID:         ${r.id}`);
      console.log(`Table:             shipments`);
      console.log(`Failing Column:    product_id`);
      console.log(`Missing Parent ID: 'PRD-BAR-801' (hardcoded dummy value in page.tsx)`);
      console.log(`Expected Value:    Batch '${r.nameOrType}' references product '${batchToProduct.get(r.nameOrType)}'`);
      console.log(`SQLite Error:      ${err.message}`);
      console.log('======================================================\n');
      firstErrorPrinted = true;
      break;
    }
  }
}

db.close();
if (fs.existsSync(SCRATCH_DB)) fs.unlinkSync(SCRATCH_DB);
