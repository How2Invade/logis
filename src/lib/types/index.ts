// ============================================================================
// LOGIS — Core Type Definitions
// ============================================================================

// --- Enums ---
export type IncidentStatus = 'pending' | 'analyzing' | 'analyzed' | 'responding' | 'recovering' | 'resolved';
export type IncidentType = 'contamination' | 'temperature_excursion' | 'component_defect';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Confidence = 'confirmed' | 'probable' | 'unknown';
export type InventoryStatus = 'available' | 'quarantined' | 'recalled' | 'disposed' | 'in_transit' | 'delivered' | 'sold';
export type ShipmentStatus = 'in_transit' | 'delivered' | 'stopped' | 'returned';
export type MachineStatus = 'running' | 'idle' | 'maintenance' | 'stopped';
export type WorkerStatus = 'active' | 'available' | 'unavailable';
export type TruckStatus = 'in_use' | 'available' | 'maintenance';
export type ActionStatus = 'pending' | 'in_progress' | 'done' | 'skipped';
export type ActionType = 'stop_shipment' | 'quarantine' | 'withdraw' | 'recall' | 'verify' | 'reconcile';
export type NodeType = 'supplier' | 'material' | 'lot' | 'batch' | 'product' | 'warehouse' | 'shipment' | 'store' | 'customer';
export type ClassificationStatus = 'source' | 'affected' | 'uncertain' | 'safe' | 'sold' | 'unaccounted' | 'not_relevant';
export type UserRole = 'operations_manager' | 'quality_inspector';

// --- Core Entities ---
export interface Incident {
  id: string;
  type: IncidentType;
  sourceLot: string;
  severity: Severity;
  detectedAt: string;
  location: string;
  status: IncidentStatus;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  location: string;
  contactEmail: string;
  rating: number;
}

export interface Material {
  id: string;
  name: string;
  supplierId: string;
  unit: string;
  category: string;
}

export interface Lot {
  id: string;
  materialId: string;
  supplierId: string;
  receivedAt: string;
  quantity: number;
  unit: string;
  expiresAt: string;
  status: string;
}

export interface Batch {
  id: string;
  productId: string;
  producedAt: string;
  quantity: number;
  status: string;
  machineId: string;
  lineId: string;
}

export interface BatchLotUsage {
  id: string;
  batchId: string;
  lotId: string;
  confidence: Confidence;
  fractionUsed: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  shelfLifeDays: number;
}

export interface Inventory {
  id: string;
  productId: string;
  batchId: string;
  locationId: string;
  locationType: 'warehouse' | 'store';
  quantity: number;
  status: InventoryStatus;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacity: number;
  freeSlots: number;
  available: boolean;
  temperatureControlled: boolean;
}

export interface Shipment {
  id: string;
  batchId: string;
  productId: string;
  origin: string;
  destination: string;
  quantity: number;
  status: ShipmentStatus;
  departedAt: string;
  estimatedArrival: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  region: string;
}

export interface Sale {
  id: string;
  storeId: string;
  productId: string;
  batchId: string;
  quantity: number;
  soldAt: string;
  customerId: string;
}

export interface Customer {
  id: string;
  name: string;
  region: string;
}

export interface Machine {
  id: string;
  name: string;
  capacityPerDay: number;
  compatibleProducts: string[];
  utilization: number;
  available: boolean;
  status: MachineStatus;
}

export interface Worker {
  id: string;
  name: string;
  skills: string[];
  available: boolean;
  status: WorkerStatus;
  shiftHours: number;
}

export interface Truck {
  id: string;
  name: string;
  capacity: number;
  available: boolean;
  status: TruckStatus;
  currentRoute: string | null;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  distanceKm: number;
  estimatedHours: number;
}

export interface Demand {
  id: string;
  productId: string;
  units: number;
  deadline: string;
  unitValue: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface CostRate {
  id: string;
  category: string;
  ratePerUnit: number;
  description: string;
}

export interface Inspection {
  id: string;
  productId: string;
  batchId: string;
  lotId: string;
  testType: string;
  result: 'pass' | 'fail';
  severity: Severity | null;
  incidentType: IncidentType | null;
  inspectorRole: string;
  notes: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  incidentId: string;
  event: string;
  description: string;
  timestamp: string;
  category: 'detection' | 'analysis' | 'response' | 'recovery' | 'system';
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  userId: string;
}

// --- Engine Output Types ---
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
  status: ClassificationStatus;
  reason: string;
  path: string[];
  quantity?: number;
  location?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: Confidence;
  fractionUsed?: number;
}

export interface ImpactLine {
  id: string;
  nodeId: string;
  nodeType: NodeType;
  label: string;
  status: ClassificationStatus;
  reason: string;
  path: string[];
  quantity: number;
  location: string;
  batchId?: string;
  productId?: string;
  warehouseId?: string;
}

export interface ImpactResult {
  affectedUnits: number;
  safeUnits: number;
  uncertainUnits: number;
  soldUnits: number;
  unaccountedUnits: number;
  totalUnits: number;
  affectedLocations: string[];
  affectedShipments: number;
  affectedStores: number;
  affectedWarehouses: number;
  lines: ImpactLine[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  estimatedImpactINR: number;
  facilityBreakdown?: FacilityImpact[];
}

export interface FacilityImpact {
  id: string;
  name: string;
  affected: number;
  safe: number;
  uncertain: number;
}

export interface ResponseAction {
  id: string;
  priority: number;
  type: ActionType;
  description: string;
  reason: string;
  units: number;
  location: string;
  estimatedCost: number;
  estimatedTimeHours: number;
  whyTrace: string[];
  status: ActionStatus;
  batchId?: string;
  productId?: string;
  shipmentId?: string;
}

export interface ResponseComparison {
  naive: {
    totalUnits: number;
    totalCost: number;
    estimatedTimeHours: number;
    disruptionScore: number;
  };
  logis: {
    totalUnits: number;
    totalCost: number;
    estimatedTimeHours: number;
    disruptionScore: number;
  };
  unnecessaryRecallAvoided: number;
  costSaved: number;
}

export interface ResponsePlan {
  actions: ResponseAction[];
  comparison: ResponseComparison;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface IdleResource {
  id: string;
  type: 'machine' | 'worker' | 'warehouse_slot' | 'truck';
  name: string;
  capacity: number;
  reason: string;
  compatibleProducts?: string[];
  skills?: string[];
}

export interface DemandGap {
  productId: string;
  productName: string;
  demandUnits: number;
  currentCapacity: number;
  gap: number;
  unitValue: number;
  totalValue: number;
  deadline: string;
}

export interface Allocation {
  id: string;
  resourceId: string;
  resourceType: 'machine' | 'worker' | 'warehouse_slot' | 'truck';
  resourceName: string;
  targetProductId: string;
  targetProductName: string;
  capacityUsed: number;
  demandCovered: number;
  expectedBenefit: number;
  expectedDelayReduction: number;
  score: number;
  compatible: boolean;
  explanation: string;
}

export interface RecoveryResult {
  idleResources: IdleResource[];
  unmetDemand: DemandGap[];
  opportunities: DemandGap[];
  allocations: Allocation[];
  idleBefore: number;
  idleAfter: number;
  estimatedCost: number;
  estimatedRecoveryTimeHours: number;
  potentialRecoveryValue: number;
}

export interface ScenarioModifier {
  type: 'additional_batch' | 'warehouse_unavailable' | 'transport_reduced' | 'demand_spike' | 'custom';
  params: Record<string, unknown>;
}

export interface ScenarioResult {
  baseline: {
    impact: ImpactResult;
    response: ResponsePlan;
    recovery: RecoveryResult;
  };
  scenario: {
    impact: ImpactResult;
    response: ResponsePlan;
    recovery: RecoveryResult;
  };
  delta: {
    affectedUnits: number;
    safeUnits: number;
    uncertainUnits: number;
    costDelta: number;
    timeDelta: number;
    newActions: number;
    removedActions: number;
  };
  modifiers: ScenarioModifier[];
}

// --- API Types ---
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
