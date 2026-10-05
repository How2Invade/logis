// ============================================================================
// LOGIS — Impact Service: Computes full impact analysis from graph traversal
// ============================================================================
import type { ImpactResult, ImpactLine, GraphNode, GraphEdge, ClassificationStatus } from '@/lib/types';
import { buildGraph, traverseDownstream, classifyNode, buildPathExplanation, type SupplyChainGraph } from './graphService';

interface ImpactInput {
  sourceLotId: string;
  suppliers: { id: string; name: string; location: string }[];
  materials: { id: string; name: string; supplierId: string }[];
  lots: { id: string; materialId: string; supplierId: string; quantity: number; status: string }[];
  batches: { id: string; productId: string; quantity: number; status: string; machineId: string }[];
  batchLotUsage: { batchId: string; lotId: string; confidence: string; fractionUsed: number }[];
  products: { id: string; name: string; unitPrice: number }[];
  warehouses: { id: string; name: string; location: string; capacity: number }[];
  inventory: { id: string; productId: string; batchId: string; locationId: string; locationType: string; quantity: number; status: string }[];
  shipments: { id: string; batchId: string; productId: string; origin: string; destination: string; quantity: number; status: string }[];
  stores: { id: string; name: string; location: string }[];
  sales: { storeId: string; productId: string; batchId: string; quantity: number }[];
}

export function computeImpact(input: ImpactInput): ImpactResult {
  const graph = buildGraph(input);
  const traversalResults = traverseDownstream(graph, input.sourceLotId);

  // Classify all reached nodes
  const reachedNodeIds = new Set<string>();
  const nodeClassifications = new Map<string, { status: ClassificationStatus; path: string[]; reason: string }>();

  for (const result of traversalResults) {
    const isSource = result.node.id === input.sourceLotId;
    const status = classifyNode(result.weakestConfidence, isSource);
    
    reachedNodeIds.add(result.node.id);
    graph.nodes.get(result.node.id)!.status = status;
    graph.nodes.get(result.node.id)!.path = result.path;
    
    const reason = buildPathExplanation(result.path, graph);
    graph.nodes.get(result.node.id)!.reason = reason;
    
    nodeClassifications.set(result.node.id, { status, path: result.path, reason });
  }

  // Mark unreached nodes as safe / not_relevant
  for (const [nodeId, node] of graph.nodes) {
    if (!reachedNodeIds.has(nodeId)) {
      node.status = 'safe';
      node.reason = 'Not connected to contamination source';
    }
  }

  // Compute inventory impact
  let affectedUnits = 0;
  let safeUnits = 0;
  let uncertainUnits = 0;
  let soldUnits = 0;
  let unaccountedUnits = 0;
  const affectedLocations = new Set<string>();
  let affectedShipments = 0;
  const affectedStoreSet = new Set<string>();
  const affectedWarehouseSet = new Set<string>();
  const lines: ImpactLine[] = [];
  const facilityMap = new Map<string, { id: string; name: string; affected: number; safe: number; uncertain: number }>();
  for (const w of input.warehouses) {
    facilityMap.set(w.id, { id: w.id, name: w.name, affected: 0, safe: 0, uncertain: 0 });
  }

  // Find affected batches
  const affectedBatches = new Map<string, { status: ClassificationStatus; path: string[]; reason: string; fractionUsed: number }>();
  
  for (const usage of input.batchLotUsage) {
    if (usage.lotId === input.sourceLotId) {
      const batchClassification = nodeClassifications.get(usage.batchId);
      if (batchClassification) {
        affectedBatches.set(usage.batchId, {
          ...batchClassification,
          fractionUsed: usage.fractionUsed,
        });
      }
    }
  }

  // Process inventory for each affected batch
  for (const [batchId, batchInfo] of affectedBatches) {
    const batchInventory = input.inventory.filter(inv => inv.batchId === batchId);
    const batch = input.batches.find(b => b.id === batchId);
    const product = batch ? input.products.find(p => p.id === batch.productId) : null;

    for (const inv of batchInventory) {
      const impactedQty = Math.round(inv.quantity * batchInfo.fractionUsed);
      const safeQty = inv.quantity - impactedQty;
      const locationName = inv.locationType === 'warehouse' 
        ? input.warehouses.find(w => w.id === inv.locationId)?.name || inv.locationId
        : input.stores.find(s => s.id === inv.locationId)?.name || inv.locationId;

      const fac = inv.locationType === 'warehouse' ? facilityMap.get(inv.locationId) : undefined;
      if (batchInfo.status === 'affected') {
        affectedUnits += impactedQty;
        if (safeQty > 0) safeUnits += safeQty;
        if (fac) { fac.affected += impactedQty; if (safeQty > 0) fac.safe += safeQty; }
      } else if (batchInfo.status === 'uncertain') {
        uncertainUnits += impactedQty;
        if (safeQty > 0) safeUnits += safeQty;
        if (fac) { fac.uncertain += impactedQty; if (safeQty > 0) fac.safe += safeQty; }
      }

      affectedLocations.add(inv.locationId);
      if (inv.locationType === 'warehouse') affectedWarehouseSet.add(inv.locationId);
      if (inv.locationType === 'store') affectedStoreSet.add(inv.locationId);

      lines.push({
        id: `impact-${inv.id}`,
        nodeId: inv.locationId,
        nodeType: inv.locationType === 'warehouse' ? 'warehouse' : 'store',
        label: `${product?.name || 'Unknown'} (${batchId}) at ${locationName}`,
        status: batchInfo.status,
        reason: `${product?.name || 'Unknown'} is ${batchInfo.status}: it contains ${batchId}, which used ${input.sourceLotId}. Path: ${batchInfo.reason}`,
        path: batchInfo.path,
        quantity: impactedQty,
        location: locationName,
        batchId,
        productId: batch?.productId,
        warehouseId: inv.locationType === 'warehouse' ? inv.locationId : undefined,
      });
    }

    // Process shipments for this batch
    const batchShipments = input.shipments.filter(sh => sh.batchId === batchId);
    for (const sh of batchShipments) {
      const impactedQty = Math.round(sh.quantity * batchInfo.fractionUsed);
      
      if (batchInfo.status === 'affected') {
        affectedUnits += impactedQty;
        affectedShipments++;
      } else if (batchInfo.status === 'uncertain') {
        uncertainUnits += impactedQty;
        affectedShipments++;
      }

      affectedLocations.add(sh.destination);
    }

    // Process sales for this batch (sold units)
    const batchSales = input.sales.filter(s => s.batchId === batchId);
    for (const sale of batchSales) {
      const impactedQty = Math.round(sale.quantity * batchInfo.fractionUsed);
      soldUnits += impactedQty;
    }
  }

  // Add safe inventory (batches NOT connected to the source lot)
  const safeBatchIds = new Set(input.batches.map(b => b.id));
  for (const batchId of affectedBatches.keys()) {
    safeBatchIds.delete(batchId);
  }
  
  for (const batchId of safeBatchIds) {
    const batchInventory = input.inventory.filter(inv => inv.batchId === batchId);
    for (const inv of batchInventory) {
      safeUnits += inv.quantity;
      if (inv.locationType === 'warehouse') {
        const fac = facilityMap.get(inv.locationId);
        if (fac) fac.safe += inv.quantity;
      }
    }
  }

  // Compute unaccounted: produced qty minus (on-hand + sold + in-transit)
  for (const [batchId, batchInfo] of affectedBatches) {
    const batch = input.batches.find(b => b.id === batchId);
    if (!batch) continue;
    
    const produced = Math.round(batch.quantity * batchInfo.fractionUsed);
    const onHand = input.inventory
      .filter(inv => inv.batchId === batchId)
      .reduce((sum, inv) => sum + Math.round(inv.quantity * batchInfo.fractionUsed), 0);
    const sold = input.sales
      .filter(s => s.batchId === batchId)
      .reduce((sum, s) => sum + Math.round(s.quantity * batchInfo.fractionUsed), 0);
    const inTransit = input.shipments
      .filter(sh => sh.batchId === batchId && sh.status === 'in_transit')
      .reduce((sum, sh) => sum + Math.round(sh.quantity * batchInfo.fractionUsed), 0);
    
    const accounted = onHand + sold + inTransit;
    const diff = produced - accounted;
    if (diff > 0) {
      unaccountedUnits += diff;
    }
  }

  // Compute estimated impact in INR
  let estimatedImpactINR = 0;
  for (const [batchId, batchInfo] of affectedBatches) {
    const batch = input.batches.find(b => b.id === batchId);
    if (!batch) continue;
    const product = input.products.find(p => p.id === batch.productId);
    if (!product) continue;
    
    const impactedQty = Math.round(batch.quantity * batchInfo.fractionUsed);
    estimatedImpactINR += impactedQty * product.unitPrice;
  }

  const totalUnits = affectedUnits + safeUnits + uncertainUnits;

  // Build graph nodes and edges for visualization
  const graphNodes: GraphNode[] = Array.from(graph.nodes.values());
  const graphEdges: GraphEdge[] = graph.edges;

  return {
    affectedUnits,
    safeUnits,
    uncertainUnits,
    soldUnits,
    unaccountedUnits,
    totalUnits,
    affectedLocations: Array.from(affectedLocations),
    affectedShipments,
    affectedStores: affectedStoreSet.size,
    affectedWarehouses: affectedWarehouseSet.size,
    lines,
    nodes: graphNodes,
    edges: graphEdges,
    estimatedImpactINR,
    facilityBreakdown: Array.from(facilityMap.values()),
  };
}
