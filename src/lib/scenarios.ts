import type { ScenarioModifier } from '@/lib/types';

/** Scenario presets shared by the Scenario Simulator and the report exports. */

export const ACTIVE_SCENARIO_STORAGE_KEY = 'logis_active_scenario';

export interface ScenarioPreset {
  id: 'additional_batch' | 'warehouse_unavailable' | 'transport_reduced' | 'demand_spike';
  title: string;
  description: string;
  modifiers: ScenarioModifier[];
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'additional_batch',
    title: 'Additional Batch Contamination',
    description: 'Batch B72 also used MILK-204',
    modifiers: [{ type: 'additional_batch', params: { batchId: 'B60', confidence: 'confirmed', fractionUsed: 1.0 } }],
  },
  {
    id: 'warehouse_unavailable',
    title: 'Warehouse WH-002 Unavailable',
    description: 'WH-002 becomes unavailable for operations',
    modifiers: [{ type: 'warehouse_unavailable', params: { warehouseId: 'WH-002' } }],
  },
  {
    id: 'transport_reduced',
    title: 'Transport Capacity Reduced',
    description: '50% reduction in available trucks',
    modifiers: [{ type: 'transport_reduced', params: { reduction: 0.5 } }],
  },
  {
    id: 'demand_spike',
    title: 'Demand Spike',
    description: '1.5x demand across all products',
    modifiers: [{ type: 'demand_spike', params: { multiplier: 1.5 } }],
  },
];

export function loadActiveScenarioId(): { id: ScenarioPreset['id']; selectedInSimulator: boolean } {
  try {
    const saved = localStorage.getItem(ACTIVE_SCENARIO_STORAGE_KEY);
    const found = SCENARIO_PRESETS.find(p => p.id === saved);
    if (found) return { id: found.id, selectedInSimulator: true };
  } catch {}
  return { id: SCENARIO_PRESETS[0].id, selectedInSimulator: false };
}
