// ============================================================================
// LOGIS — Graph Service: Builds supply-chain graph and performs BFS traversal
// ============================================================================
import type { GraphNode, GraphEdge, Confidence, ClassificationStatus, NodeType } from '@/lib/types';

export interface SupplyChainGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, string[]>; // nodeId → downstream nodeIds
}

interface TraversalResult {
  node: GraphNode;
  path: string[];
  weakestConfidence: Confidence;
}

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  confirmed: 3,
  probable: 2,
  unknown: 1,
};

function weakerConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER[a] <= CONFIDENCE_ORDER[b] ? a : b;
}

export function buildGraph(data: {
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
}): SupplyChainGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, string[]>();

  function addNode(id: string, type: NodeType, label: string, nodeData: Record<string, unknown>) {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        type,
        label,
        data: nodeData,
        status: 'not_relevant',
        reason: '',
        path: [],
      });
    }
  }

  function addEdge(source: string, target: string, label: string, confidence: Confidence = 'confirmed', fractionUsed?: number) {
    const id = `${source}->${target}`;
    if (!edges.find(e => e.id === id)) {
      edges.push({
        id,
        source,
        target,
        label,
        confidence,
        fractionUsed,
      });
      const adj = adjacency.get(source) || [];
      if (!adj.includes(target)) {
        adj.push(target);
        adjacency.set(source, adj);
      }
    }
  }

  // Build nodes
  for (const s of data.suppliers) {
    addNode(s.id, 'supplier', s.name, { location: s.location });
  }
  for (const m of data.materials) {
    addNode(m.id, 'material', m.name, { supplierId: m.supplierId });
  }
  for (const l of data.lots) {
    addNode(l.id, 'lot', l.id, { materialId: l.materialId, quantity: l.quantity, status: l.status });
  }
  for (const b of data.batches) {
    addNode(b.id, 'batch', b.id, { productId: b.productId, quantity: b.quantity, status: b.status, machineId: b.machineId });
  }
  for (const p of data.products) {
    addNode(p.id, 'product', p.name, { unitPrice: p.unitPrice });
  }
  for (const w of data.warehouses) {
    addNode(w.id, 'warehouse', w.name, { location: w.location, capacity: w.capacity });
  }
  for (const sh of data.shipments) {
    addNode(sh.id, 'shipment', `${sh.origin}→${sh.destination}`, {
      batchId: sh.batchId,
      productId: sh.productId,
      quantity: sh.quantity,
      status: sh.status,
      origin: sh.origin,
      destination: sh.destination,
    });
  }
  for (const st of data.stores) {
    addNode(st.id, 'store', st.name, { location: st.location });
  }

  // Build edges: Supplier → Material
  for (const m of data.materials) {
    addEdge(m.supplierId, m.id, 'SUPPLIED');
  }

  // Material → Lot
  for (const l of data.lots) {
    addEdge(l.materialId, l.id, 'PRODUCED_AS');
  }

  // Lot → Batch (via batch_lot_usage)
  for (const u of data.batchLotUsage) {
    addEdge(u.lotId, u.batchId, 'USED_IN', u.confidence as Confidence, u.fractionUsed);
  }

  // Batch → Product
  for (const b of data.batches) {
    addEdge(b.id, b.productId, 'PRODUCED_AS');
  }

  // Inventory creates: Product/Batch → Warehouse/Store
  // Group by batch to create batch→warehouse edges
  const batchLocations = new Map<string, Set<string>>();
  for (const inv of data.inventory) {
    const key = inv.batchId;
    if (!batchLocations.has(key)) batchLocations.set(key, new Set());
    batchLocations.get(key)!.add(inv.locationId);
  }
  for (const [batchId, locations] of batchLocations) {
    const batch = data.batches.find(b => b.id === batchId);
    if (batch) {
      for (const locId of locations) {
        const inv = data.inventory.find(i => i.batchId === batchId && i.locationId === locId);
        if (inv && inv.locationType === 'warehouse') {
          addEdge(batch.productId, locId, 'STORED_AT');
        }
      }
    }
  }

  // Shipment edges: Warehouse → Shipment → Store
  for (const sh of data.shipments) {
    addEdge(sh.origin, sh.id, 'SHIPPED_TO');
    addEdge(sh.id, sh.destination, 'SHIPPED_TO');
  }

  return { nodes, edges, adjacency };
}

export function traverseDownstream(
  graph: SupplyChainGraph,
  sourceNodeId: string,
): TraversalResult[] {
  const results: TraversalResult[] = [];
  const visited = new Set<string>();
  
  // BFS queue: [nodeId, path[], weakestConfidence]
  const queue: [string, string[], Confidence][] = [[sourceNodeId, [sourceNodeId], 'confirmed']];

  while (queue.length > 0) {
    const [currentId, path, confidence] = queue.shift()!;
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = graph.nodes.get(currentId);
    if (!node) continue;

    results.push({
      node: { ...node, path: [...path] },
      path: [...path],
      weakestConfidence: confidence,
    });

    const downstream = graph.adjacency.get(currentId) || [];
    for (const nextId of downstream) {
      if (!visited.has(nextId)) {
        // Find the edge to determine confidence
        const edge = graph.edges.find(e => e.source === currentId && e.target === nextId);
        const edgeConfidence = (edge?.confidence || 'confirmed') as Confidence;
        const newConfidence = weakerConfidence(confidence, edgeConfidence);
        
        queue.push([nextId, [...path, nextId], newConfidence]);
      }
    }
  }

  return results;
}

export function classifyNode(
  weakestConfidence: Confidence,
  isSource: boolean,
): ClassificationStatus {
  if (isSource) return 'source';
  if (weakestConfidence === 'confirmed') return 'affected';
  if (weakestConfidence === 'probable' || weakestConfidence === 'unknown') return 'uncertain';
  return 'safe';
}

export function buildPathExplanation(path: string[], graph: SupplyChainGraph): string {
  if (path.length === 0) return '';
  
  const parts: string[] = [];
  for (const nodeId of path) {
    const node = graph.nodes.get(nodeId);
    if (node) {
      const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1);
      parts.push(`${typeLabel} ${node.label}`);
    }
  }
  
  return parts.join(' → ');
}
