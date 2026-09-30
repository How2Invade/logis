// ============================================================================
// LOGIS — Response Service: Generates response plans (Naive vs LOGIS)
// ============================================================================
import type { ResponsePlan, ResponseAction, ResponseComparison, ImpactResult, ActionType } from '@/lib/types';

interface CostRates {
  transport: number;
  disposal: number;
  quarantine: number;
  customerRecall: number;
  withdrawal: number;
  verification: number;
}

interface ResponseInput {
  impact: ImpactResult;
  costRates: CostRates;
  treatUncertainAsAffected?: boolean;
}

export function generateResponsePlan(input: ResponseInput): ResponsePlan {
  const { impact, costRates, treatUncertainAsAffected = false } = input;
  const actions: ResponseAction[] = [];
  let actionId = 1;

  // Group impact lines by type and status for action generation
  const affectedLines = impact.lines.filter(l => l.status === 'affected');
  const uncertainLines = impact.lines.filter(l => l.status === 'uncertain');
  const effectiveAffectedLines = treatUncertainAsAffected 
    ? [...affectedLines, ...uncertainLines]
    : affectedLines;

  // --- LOGIS Response: Precisely targeted ---

  // Priority 1: Stop in-transit shipments containing affected batches
  const affectedBatchIds = new Set(effectiveAffectedLines.map(l => l.batchId).filter(Boolean));
  const shipmentNodes = impact.nodes.filter(n => 
    n.type === 'shipment' && 
    (n.status === 'affected' || (treatUncertainAsAffected && n.status === 'uncertain'))
  );
  
  for (const shipment of shipmentNodes) {
    const shipData = shipment.data as { quantity?: number; origin?: string; destination?: string; status?: string; batchId?: string };
    if (shipData.status === 'in_transit') {
      actions.push({
        id: `ACT-${String(actionId++).padStart(3, '0')}`,
        priority: 1,
        type: 'stop_shipment' as ActionType,
        description: `Stop shipment ${shipment.id} (${shipData.origin} → ${shipData.destination})`,
        reason: `Shipment contains affected batch, currently in transit`,
        units: (shipData.quantity as number) || 0,
        location: `${shipData.origin} → ${shipData.destination}`,
        estimatedCost: ((shipData.quantity as number) || 0) * costRates.transport,
        estimatedTimeHours: 2,
        whyTrace: shipment.path,
        status: 'pending',
        shipmentId: shipment.id,
        batchId: shipData.batchId as string,
      });
    }
  }

  // Priority 2: Quarantine warehouse stock (highest risk first)
  const warehouseLines = effectiveAffectedLines.filter(l => l.nodeType === 'warehouse');
  // Sort by quantity descending (highest risk first)
  warehouseLines.sort((a, b) => b.quantity - a.quantity);
  
  for (const line of warehouseLines) {
    actions.push({
      id: `ACT-${String(actionId++).padStart(3, '0')}`,
      priority: 2,
      type: 'quarantine' as ActionType,
      description: `Quarantine ${line.quantity} units of ${line.label.split(' (')[0]} at ${line.location}`,
      reason: line.reason,
      units: line.quantity,
      location: line.location,
      estimatedCost: line.quantity * costRates.quarantine,
      estimatedTimeHours: 4,
      whyTrace: line.path,
      status: 'pending',
      batchId: line.batchId,
      productId: line.productId,
    });
  }

  // Priority 3: Withdraw from stores
  const storeLines = effectiveAffectedLines.filter(l => l.nodeType === 'store');
  storeLines.sort((a, b) => b.quantity - a.quantity);
  
  for (const line of storeLines) {
    actions.push({
      id: `ACT-${String(actionId++).padStart(3, '0')}`,
      priority: 3,
      type: 'withdraw' as ActionType,
      description: `Withdraw ${line.quantity} units of ${line.label.split(' (')[0]} from ${line.location}`,
      reason: line.reason,
      units: line.quantity,
      location: line.location,
      estimatedCost: line.quantity * costRates.withdrawal,
      estimatedTimeHours: 8,
      whyTrace: line.path,
      status: 'pending',
      batchId: line.batchId,
      productId: line.productId,
    });
  }

  // Priority 4: Customer recall for sold units
  if (impact.soldUnits > 0) {
    actions.push({
      id: `ACT-${String(actionId++).padStart(3, '0')}`,
      priority: 4,
      type: 'recall' as ActionType,
      description: `Issue customer recall for ${impact.soldUnits} sold units across affected batches`,
      reason: `${impact.soldUnits} units from affected batches have been sold to customers and need to be recalled`,
      units: impact.soldUnits,
      location: 'All affected retail locations',
      estimatedCost: impact.soldUnits * costRates.customerRecall,
      estimatedTimeHours: 48,
      whyTrace: ['Customer recall required for sold contaminated units'],
      status: 'pending',
    });
  }

  // Priority 5: Verify uncertain inventory
  if (!treatUncertainAsAffected && uncertainLines.length > 0) {
    const totalUncertain = uncertainLines.reduce((sum, l) => sum + l.quantity, 0);
    actions.push({
      id: `ACT-${String(actionId++).padStart(3, '0')}`,
      priority: 5,
      type: 'verify' as ActionType,
      description: `Verify ${totalUncertain} uncertain units across ${uncertainLines.length} inventory locations`,
      reason: `These units have probable or unknown links to the contaminated lot and require lab verification`,
      units: totalUncertain,
      location: 'Multiple locations',
      estimatedCost: totalUncertain * costRates.verification,
      estimatedTimeHours: 24,
      whyTrace: ['Verification needed for probable/unknown confidence paths'],
      status: 'pending',
    });
  }

  // Priority 6: Reconcile unaccounted inventory
  if (impact.unaccountedUnits > 0) {
    actions.push({
      id: `ACT-${String(actionId++).padStart(3, '0')}`,
      priority: 6,
      type: 'reconcile' as ActionType,
      description: `Reconcile ${impact.unaccountedUnits} unaccounted units from affected batches`,
      reason: `Produced quantity minus tracked inventory shows ${impact.unaccountedUnits} units unaccounted for`,
      units: impact.unaccountedUnits,
      location: 'All facilities',
      estimatedCost: impact.unaccountedUnits * costRates.verification,
      estimatedTimeHours: 12,
      whyTrace: ['Inventory reconciliation required to account for all affected units'],
      status: 'pending',
    });
  }

  // Sort actions by priority
  actions.sort((a, b) => a.priority - b.priority);

  // --- Compute LOGIS vs Naive comparison ---
  const logisUnits = actions.reduce((sum, a) => sum + a.units, 0);
  const logisCost = actions.reduce((sum, a) => sum + a.estimatedCost, 0);
  const logisTime = Math.max(...actions.map(a => a.estimatedTimeHours), 0);

  // Naive: recall EVERYTHING from all products touched
  const allProductIds = new Set(impact.lines.map(l => l.productId).filter(Boolean));
  const naiveUnits = impact.totalUnits + impact.soldUnits;
  const naiveCost = naiveUnits * ((costRates.withdrawal + costRates.disposal + costRates.transport) / 2);
  const naiveTime = 72; // Fixed 72 hours for full recall

  const unnecessaryRecallAvoided = Math.max(0, naiveUnits - logisUnits);

  const comparison: ResponseComparison = {
    naive: {
      totalUnits: naiveUnits,
      totalCost: Math.round(naiveCost),
      estimatedTimeHours: naiveTime,
      disruptionScore: Math.min(100, Math.round((naiveUnits / Math.max(impact.totalUnits, 1)) * 100)),
    },
    logis: {
      totalUnits: logisUnits,
      totalCost: Math.round(logisCost),
      estimatedTimeHours: logisTime,
      disruptionScore: Math.min(100, Math.round((logisUnits / Math.max(impact.totalUnits, 1)) * 100)),
    },
    unnecessaryRecallAvoided,
    costSaved: Math.round(naiveCost - logisCost),
  };

  // Risk scoring
  const severityWeight = 10;
  const containment = 0; // Before any action
  const soldWeight = 5;
  const uncertaintyPenalty = impact.uncertainUnits * 2;
  
  const riskScore = (severityWeight * impact.affectedUnits * (1 - containment)) + 
                    (impact.soldUnits * soldWeight) + 
                    uncertaintyPenalty;
  
  const normalizedRisk = Math.min(100, Math.round(riskScore / 1000));
  const riskLevel = normalizedRisk >= 80 ? 'critical' : normalizedRisk >= 60 ? 'high' : normalizedRisk >= 30 ? 'medium' : 'low';

  return {
    actions,
    comparison,
    riskScore: normalizedRisk,
    riskLevel,
  };
}
