// ============================================================================
// LOGIS — Recovery Service: Optimizes resource reallocation after incident
// ============================================================================
import type { RecoveryResult, IdleResource, DemandGap, Allocation } from '@/lib/types';

interface RecoveryInput {
  affectedBatchIds: string[];
  machines: {
    id: string; name: string; capacityPerDay: number;
    compatibleProducts: string; utilization: number;
    available: boolean; status: string;
  }[];
  workers: {
    id: string; name: string; skills: string;
    available: boolean; status: string; shiftHours: number;
  }[];
  warehouses: {
    id: string; name: string; location: string;
    capacity: number; freeSlots: number; available: boolean;
  }[];
  trucks: {
    id: string; name: string; capacity: number;
    available: boolean; status: string;
  }[];
  batches: {
    id: string; productId: string; quantity: number;
    status: string; machineId: string;
  }[];
  products: { id: string; name: string; unitPrice: number }[];
  demand: {
    id: string; productId: string; units: number;
    deadline: string; unitValue: number; priority: string;
  }[];
  costRates: { category: string; ratePerUnit: number }[];
}

export function computeRecovery(input: RecoveryInput): RecoveryResult {
  const {
    affectedBatchIds, machines, workers, warehouses, trucks,
    batches, products, demand, costRates,
  } = input;

  // --- Identify idle resources ---
  const idleResources: IdleResource[] = [];

  // Machines: those that were running affected batches are now idle
  const affectedMachineIds = new Set(
    batches.filter(b => affectedBatchIds.includes(b.id)).map(b => b.machineId)
  );

  for (const m of machines) {
    if (affectedMachineIds.has(m.id) || (!m.available && m.status !== 'maintenance')) {
      let compatProducts: string[] = [];
      try { compatProducts = JSON.parse(m.compatibleProducts); } catch { /* empty */ }
      idleResources.push({
        id: m.id,
        type: 'machine',
        name: m.name,
        capacity: m.capacityPerDay,
        reason: affectedMachineIds.has(m.id)
          ? `Was processing affected batch(es), now idle`
          : `Not available (${m.status})`,
        compatibleProducts: compatProducts,
      });
    }
  }

  // Workers with dairy/relevant skills that were on affected lines
  const dairySkills = ['dairy_processing', 'pasteurization', 'fermentation', 'cheese_making'];
  for (const w of workers) {
    let skills: string[] = [];
    try { skills = JSON.parse(w.skills); } catch { /* empty */ }
    const hasDairySkill = skills.some(s => dairySkills.includes(s));
    
    if (hasDairySkill && w.available) {
      idleResources.push({
        id: w.id,
        type: 'worker',
        name: w.name,
        capacity: w.shiftHours,
        reason: 'Dairy-skilled worker available due to production line stoppage',
        skills,
      });
    }
  }

  // Warehouse free slots
  for (const wh of warehouses) {
    if (wh.freeSlots > 500 && wh.available) {
      idleResources.push({
        id: wh.id,
        type: 'warehouse_slot',
        name: wh.name,
        capacity: wh.freeSlots,
        reason: `${wh.freeSlots} free slots available for reallocation`,
      });
    }
  }

  // Available trucks
  for (const t of trucks) {
    if (t.available && t.status === 'available') {
      idleResources.push({
        id: t.id,
        type: 'truck',
        name: t.name,
        capacity: t.capacity,
        reason: 'Available for reallocation to recovery operations',
      });
    }
  }

  // --- Compute unmet demand ---
  const unmetDemand: DemandGap[] = [];
  
  // Compute current production capacity per product (excluding affected batches)
  const activeBatches = batches.filter(b => !affectedBatchIds.includes(b.id) && b.status === 'active');
  const productCapacity = new Map<string, number>();
  for (const b of activeBatches) {
    productCapacity.set(b.productId, (productCapacity.get(b.productId) || 0) + b.quantity);
  }

  for (const d of demand) {
    const currentCap = productCapacity.get(d.productId) || 0;
    const gap = Math.max(0, d.units - currentCap);
    const product = products.find(p => p.id === d.productId);
    
    if (gap > 0) {
      unmetDemand.push({
        productId: d.productId,
        productName: product?.name || d.productId,
        demandUnits: d.units,
        currentCapacity: currentCap,
        gap,
        unitValue: d.unitValue,
        totalValue: gap * d.unitValue,
        deadline: d.deadline,
      });
    }
  }

  // Sort by total value descending
  unmetDemand.sort((a, b) => b.totalValue - a.totalValue);

  // --- Greedy scoring allocation ---
  const allocations: Allocation[] = [];
  const remainingGaps = new Map<string, number>();
  for (const d of unmetDemand) {
    remainingGaps.set(d.productId, d.gap);
  }

  const usedResources = new Set<string>();
  const changeoverCost = costRates.find(c => c.category === 'changeover_per_machine')?.ratePerUnit || 2500;
  const idlePenalty = costRates.find(c => c.category === 'idle_penalty_per_hour')?.ratePerUnit || 500;

  let allocId = 1;
  let improved = true;

  while (improved) {
    improved = false;
    let bestScore = 0;
    let bestAllocation: Allocation | null = null;

    for (const resource of idleResources) {
      if (usedResources.has(resource.id)) continue;
      if (resource.type !== 'machine') continue; // Primary allocation is machines

      const compatProducts = resource.compatibleProducts || [];

      for (const [productId, gap] of remainingGaps) {
        if (gap <= 0) continue;

        const isCompatible = compatProducts.includes(productId);
        if (!isCompatible) continue;

        const product = products.find(p => p.id === productId);
        const demandInfo = unmetDemand.find(d => d.productId === productId);
        if (!product || !demandInfo) continue;

        const capacityUsed = Math.min(resource.capacity, gap);
        const demandCovered = capacityUsed;
        const expectedBenefit = demandCovered * demandInfo.unitValue;
        const delayReduction = Math.min(24, (demandCovered / gap) * 48);

        const score = (demandInfo.unitValue * demandCovered) - changeoverCost - (idlePenalty * 2);

        if (score > bestScore) {
          bestScore = score;
          bestAllocation = {
            id: `ALLOC-${String(allocId).padStart(3, '0')}`,
            resourceId: resource.id,
            resourceType: resource.type,
            resourceName: resource.name,
            targetProductId: productId,
            targetProductName: product.name,
            capacityUsed,
            demandCovered,
            expectedBenefit: Math.round(expectedBenefit),
            expectedDelayReduction: Math.round(delayReduction),
            score: Math.round(score),
            compatible: true,
            explanation: `${resource.name} can produce ${capacityUsed} units/day of ${product.name}. Expected benefit: ₹${Math.round(expectedBenefit).toLocaleString()}. This covers ${Math.round((demandCovered / demandInfo.gap) * 100)}% of the demand gap.`,
          };
        }
      }
    }

    if (bestAllocation) {
      allocations.push(bestAllocation);
      usedResources.add(bestAllocation.resourceId);
      const newGap = (remainingGaps.get(bestAllocation.targetProductId) || 0) - bestAllocation.demandCovered;
      remainingGaps.set(bestAllocation.targetProductId, Math.max(0, newGap));
      allocId++;
      improved = true;
    }
  }

  // --- Compute summary ---
  const idleMachines = idleResources.filter(r => r.type === 'machine').length;
  const idleWorkers = idleResources.filter(r => r.type === 'worker').length;
  const idleTrucks = idleResources.filter(r => r.type === 'truck').length;
  const totalFreeSlots = idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + r.capacity, 0);

  const idleBefore = idleMachines + idleWorkers + idleTrucks;
  const allocatedMachines = allocations.length;
  const idleAfter = Math.max(0, idleBefore - allocatedMachines);

  const totalRecoveryCapacity = allocations.reduce((sum, a) => sum + a.demandCovered, 0);
  const estimatedRecoveryTimeHours = totalRecoveryCapacity > 0 
    ? Math.round(unmetDemand.reduce((sum, d) => sum + d.gap, 0) / totalRecoveryCapacity * 24)
    : 0;

  const estimatedCost = allocations.length * changeoverCost;
  const potentialRecoveryValue = allocations.reduce((sum, a) => sum + a.expectedBenefit, 0);

  return {
    idleResources,
    unmetDemand,
    opportunities: unmetDemand.filter(d => d.totalValue > 0),
    allocations,
    idleBefore,
    idleAfter,
    estimatedCost: Math.round(estimatedCost),
    estimatedRecoveryTimeHours,
    potentialRecoveryValue: Math.round(potentialRecoveryValue),
  };
}
