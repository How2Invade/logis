// ============================================================================
// LOGIS — Database Schema (Drizzle ORM, SQLite, portable to PostgreSQL)
// ============================================================================
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// --- Incidents ---
export const incidents = sqliteTable('incidents', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // contamination | temperature_excursion | component_defect
  sourceLot: text('source_lot').notNull(),
  severity: text('severity').notNull(), // critical | high | medium | low
  detectedAt: text('detected_at').notNull(),
  location: text('location').notNull(),
  status: text('status').notNull().default('pending'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// --- Suppliers ---
export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  contactEmail: text('contact_email').notNull(),
  rating: real('rating').notNull(),
});

// --- Materials ---
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  unit: text('unit').notNull(),
  category: text('category').notNull(),
});

// --- Lots ---
export const lots = sqliteTable('lots', {
  id: text('id').primaryKey(),
  materialId: text('material_id').notNull().references(() => materials.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  receivedAt: text('received_at').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  expiresAt: text('expires_at').notNull(),
  status: text('status').notNull().default('active'),
});

// --- Products ---
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unitPrice: real('unit_price').notNull(),
  shelfLifeDays: integer('shelf_life_days').notNull(),
});

// --- Batches ---
export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  producedAt: text('produced_at').notNull(),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('active'),
  machineId: text('machine_id').notNull(),
  lineId: text('line_id').notNull(),
});

// --- Batch-Lot Usage ---
export const batchLotUsage = sqliteTable('batch_lot_usage', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.id),
  lotId: text('lot_id').notNull().references(() => lots.id),
  confidence: text('confidence').notNull(), // confirmed | probable | unknown
  fractionUsed: real('fraction_used').notNull().default(1.0),
});

// --- Warehouses ---
export const warehouses = sqliteTable('warehouses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  capacity: integer('capacity').notNull(),
  freeSlots: integer('free_slots').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  temperatureControlled: integer('temperature_controlled', { mode: 'boolean' }).notNull().default(false),
});

// --- Inventory ---
export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  batchId: text('batch_id').notNull().references(() => batches.id),
  locationId: text('location_id').notNull(),
  locationType: text('location_type').notNull(), // warehouse | store
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('available'),
});

// --- Shipments ---
export const shipments = sqliteTable('shipments', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.id),
  productId: text('product_id').notNull().references(() => products.id),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull(), // in_transit | delivered | stopped | returned
  departedAt: text('departed_at').notNull(),
  estimatedArrival: text('estimated_arrival').notNull(),
});

// --- Stores ---
export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  region: text('region').notNull(),
});

// --- Sales ---
export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  productId: text('product_id').notNull().references(() => products.id),
  batchId: text('batch_id').notNull().references(() => batches.id),
  quantity: integer('quantity').notNull(),
  soldAt: text('sold_at').notNull(),
  customerId: text('customer_id').notNull().references(() => customers.id),
});

// --- Customers ---
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  region: text('region').notNull(),
});

// --- Machines ---
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  capacityPerDay: integer('capacity_per_day').notNull(),
  compatibleProducts: text('compatible_products').notNull(), // JSON array
  utilization: real('utilization').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('running'),
});

// --- Workers ---
export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  skills: text('skills').notNull(), // JSON array
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('active'),
  shiftHours: integer('shift_hours').notNull().default(8),
});

// --- Trucks ---
export const trucks = sqliteTable('trucks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('available'),
  currentRoute: text('current_route'),
});

// --- Routes ---
export const routes = sqliteTable('routes', {
  id: text('id').primaryKey(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  distanceKm: real('distance_km').notNull(),
  estimatedHours: real('estimated_hours').notNull(),
});

// --- Demand ---
export const demand = sqliteTable('demand', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  units: integer('units').notNull(),
  deadline: text('deadline').notNull(),
  unitValue: real('unit_value').notNull(),
  priority: text('priority').notNull().default('medium'),
});

// --- Cost Rates ---
export const costRates = sqliteTable('cost_rates', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  ratePerUnit: real('rate_per_unit').notNull(),
  description: text('description').notNull(),
});

// --- Inspections ---
export const inspections = sqliteTable('inspections', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  batchId: text('batch_id').notNull(),
  lotId: text('lot_id').notNull(),
  testType: text('test_type').notNull(),
  result: text('result').notNull(), // pass | fail
  severity: text('severity'),
  incidentType: text('incident_type'),
  inspectorRole: text('inspector_role').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

// --- Timeline Events ---
export const timelineEvents = sqliteTable('timeline_events', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull().references(() => incidents.id),
  event: text('event').notNull(),
  description: text('description').notNull(),
  timestamp: text('timestamp').notNull(),
  category: text('category').notNull(),
});

// --- Audit Log ---
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details').notNull(),
  timestamp: text('timestamp').notNull(),
  userId: text('user_id').notNull(),
});
