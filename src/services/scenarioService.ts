// ============================================================================
// LOGIS — Scenario Service: What-if simulation without mutating DB
// ============================================================================
import type { ScenarioResult, ScenarioModifier, ImpactResult, ResponsePlan, RecoveryResult } from '@/lib/types';
import { computeImpact } from './impactService';
import { generateResponsePlan } from './responseService';
import { computeRecovery } from './recoveryService';

interface ScenarioInput {
  // Base data (cloned, never mutated)
  sourceLotId: string;
  suppliers: any[];
  materials: any[];
  lots: any[];
  batches: any[];
  batchLotUsage: any[];
  products: any[];
  warehouses: any[];
  inventory: any[];
  shipments: any[];
  stores: any[];
  sales: any[];
  machines: any[];
  workers: any[];
  trucks: any[];
  demand: any[];
  costRates: { category: string; ratePerUnit: number }[];
  // Modifiers
  modifiers: ScenarioModifier[];
  treatUncertainAsAffected?: boolean;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getCostRatesObj(costRates: { category: string; ratePerUnit: number }[]) {
  return {
    transport: costRates.find(c => c.category === 'transport_per_unit')?.ratePerUnit || 8.5,
    disposal: costRates.find(c => c.category === 'disposal_per_unit')?.ratePerUnit || 12,
    quarantine: costRates.find(c => c.category === 'quarantine_per_unit')?.ratePerUnit || 3,
    customerRecall: costRates.find(c => c.category === 'customer_recall_per_unit')?.ratePerUnit || 45,
    withdrawal: costRates.find(c => c.category === 'withdrawal_per_unit')?.ratePerUnit || 15,
    verification: costRates.find(c => c.category === 'verification_per_unit')?.ratePerUnit || 5,
  };
}

export function simulateScenario(input: ScenarioInput): ScenarioResult {
  // Clone all data for scenario
  const scenarioData = {
    sourceLotId: input.sourceLotId,
    suppliers: deepClone(input.suppliers),
    materials: deepClone(input.materials),
    lots: deepClone(input.lots),
    batches: deepClone(input.batches),
    batchLotUsage: deepClone(input.batchLotUsage),
    products: deepClone(input.products),
    warehouses: deepClone(input.warehouses),
    inventory: deepClone(input.inventory),
    shipments: deepClone(input.shipments),
    stores: deepClone(input.stores),
    sales: deepClone(input.sales),
    machines: deepClone(input.machines),
    workers: deepClone(input.workers),
    trucks: deepClone(input.trucks),
    demand: deepClone(input.demand),
  };

  // Apply modifiers
  for (const mod of input.modifiers) {
    switch (mod.type) {
      case 'additional_batch': {
        const batchId = mod.params.batchId as string;
        const confidence = (mod.params.confidence as string) || 'confirmed';
        // Add a new batch_lot_usage linking this batch to the contaminated lot
        scenarioData.batchLotUsage.push({
          batchId,
          lotId: input.sourceLotId,
          confidence,
          fractionUsed: (mod.params.fractionUsed as number) || 1.0,
        });
        break;
      }
      case 'warehouse_unavailable': {
        const whId = mod.params.warehouseId as string;
        const wh = scenarioData.warehouses.find((w: any) => w.id === whId);
        if (wh) {
          wh.available = false;
          wh.freeSlots = 0;
        }
        break;
      }
      case 'transport_reduced': {
        const reduction = (mod.params.reduction as number) || 0.5;
        for (const t of scenarioData.trucks) {
          if (Math.random() < reduction) {
            t.available = false;
            t.status = 'maintenance';
          }
        }
        break;
      }
      case 'demand_spike': {
        const multiplier = (mod.params.multiplier as number) || 1.5;
        const targetProduct = mod.params.productId as string;
        for (const d of scenarioData.demand) {
          if (!targetProduct || d.productId === targetProduct) {
            d.units = Math.round(d.units * multiplier);
          }
        }
        break;
      }
      case 'custom': {
        // Apply custom modifiers
        if (mod.params.severity) {
          // Could modify severity-related calculations
        }
        if (mod.params.extraBatchId) {
          scenarioData.batchLotUsage.push({
            batchId: mod.params.extraBatchId as string,
            lotId: input.sourceLotId,
            confidence: 'confirmed',
            fractionUsed: 1.0,
          });
        }
        if (mod.params.warehouseUnavailable) {
          const wh = scenarioData.warehouses.find((w: any) => w.id === mod.params.warehouseUnavailable);
          if (wh) { wh.available = false; wh.freeSlots = 0; }
        }
        if (mod.params.demandMultiplier) {
          for (const d of scenarioData.demand) {
            d.units = Math.round(d.units * (mod.params.demandMultiplier as number));
          }
        }
        if (mod.params.truckCount !== undefined) {
          const targetCount = mod.params.truckCount as number;
          let availableCount = 0;
          for (const t of scenarioData.trucks) {
            if (availableCount < targetCount) {
              t.available = true;
              t.status = 'available';
              availableCount++;
            } else {
              t.available = false;
              t.status = 'maintenance';
            }
          }
        }
        break;
      }
    }
  }

  const costRatesObj = getCostRatesObj(input.costRates);

  // Compute baseline
  const baselineImpact = computeImpact({
    sourceLotId: input.sourceLotId,
    suppliers: input.suppliers,
    materials: input.materials,
    lots: input.lots,
    batches: input.batches,
    batchLotUsage: input.batchLotUsage,
    products: input.products,
    warehouses: input.warehouses,
    inventory: input.inventory,
    shipments: input.shipments,
    stores: input.stores,
    sales: input.sales,
  });

  const baselineResponse = generateResponsePlan({
    impact: baselineImpact,
    costRates: costRatesObj,
    treatUncertainAsAffected: input.treatUncertainAsAffected,
  });

  const affectedBatchIds = input.batchLotUsage
    .filter((u: any) => u.lotId === input.sourceLotId)
    .map((u: any) => u.batchId);

  const baselineRecovery = computeRecovery({
    affectedBatchIds,
    machines: input.machines,
    workers: input.workers,
    warehouses: input.warehouses,
    trucks: input.trucks,
    batches: input.batches,
    products: input.products,
    demand: input.demand,
    costRates: input.costRates,
  });

  // Compute scenario
  const scenarioImpact = computeImpact({
    sourceLotId: scenarioData.sourceLotId,
    suppliers: scenarioData.suppliers,
    materials: scenarioData.materials,
    lots: scenarioData.lots,
    batches: scenarioData.batches,
    batchLotUsage: scenarioData.batchLotUsage,
    products: scenarioData.products,
    warehouses: scenarioData.warehouses,
    inventory: scenarioData.inventory,
    shipments: scenarioData.shipments,
    stores: scenarioData.stores,
    sales: scenarioData.sales,
  });

  const scenarioResponse = generateResponsePlan({
    impact: scenarioImpact,
    costRates: costRatesObj,
    treatUncertainAsAffected: input.treatUncertainAsAffected,
  });

  const scenarioAffectedBatchIds = scenarioData.batchLotUsage
    .filter((u: any) => u.lotId === input.sourceLotId)
    .map((u: any) => u.batchId);

  const scenarioRecovery = computeRecovery({
    affectedBatchIds: scenarioAffectedBatchIds,
    machines: scenarioData.machines,
    workers: scenarioData.workers,
    warehouses: scenarioData.warehouses,
    trucks: scenarioData.trucks,
    batches: scenarioData.batches,
    products: scenarioData.products,
    demand: scenarioData.demand,
    costRates: input.costRates,
  });

  // Compute deltas
  return {
    baseline: {
      impact: baselineImpact,
      response: baselineResponse,
      recovery: baselineRecovery,
    },
    scenario: {
      impact: scenarioImpact,
      response: scenarioResponse,
      recovery: scenarioRecovery,
    },
    delta: {
      affectedUnits: scenarioImpact.affectedUnits - baselineImpact.affectedUnits,
      safeUnits: scenarioImpact.safeUnits - baselineImpact.safeUnits,
      uncertainUnits: scenarioImpact.uncertainUnits - baselineImpact.uncertainUnits,
      costDelta: scenarioResponse.comparison.logis.totalCost - baselineResponse.comparison.logis.totalCost,
      timeDelta: scenarioResponse.comparison.logis.estimatedTimeHours - baselineResponse.comparison.logis.estimatedTimeHours,
      newActions: scenarioResponse.actions.length - baselineResponse.actions.length,
      removedActions: 0,
    },
    modifiers: input.modifiers,
  };
}
