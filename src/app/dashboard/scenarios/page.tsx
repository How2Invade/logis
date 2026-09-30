'use client';

import { useState } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Layers, Play, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Warehouse, Truck, TrendingUp } from 'lucide-react';
import type { ScenarioResult } from '@/lib/types';

const presets = [
  {
    id: 'additional_batch',
    title: 'Additional Batch Contamination',
    description: 'Batch B72 also used MILK-204',
    icon: AlertTriangle,
    modifiers: [{ type: 'additional_batch' as const, params: { batchId: 'B60', confidence: 'confirmed', fractionUsed: 1.0 } }],
  },
  {
    id: 'warehouse_unavailable',
    title: 'Warehouse WH-002 Unavailable',
    description: 'WH-002 becomes unavailable for operations',
    icon: Warehouse,
    modifiers: [{ type: 'warehouse_unavailable' as const, params: { warehouseId: 'WH-002' } }],
  },
  {
    id: 'transport_reduced',
    title: 'Transport Capacity Reduced',
    description: '50% reduction in available trucks',
    icon: Truck,
    modifiers: [{ type: 'transport_reduced' as const, params: { reduction: 0.5 } }],
  },
  {
    id: 'demand_spike',
    title: 'Demand Spike',
    description: '1.5x demand across all products',
    icon: TrendingUp,
    modifiers: [{ type: 'demand_spike' as const, params: { multiplier: 1.5 } }],
  },
];

export default function ScenariosPage() {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  async function runScenario(modifiers: any[], presetId: string) {
    setLoading(true);
    setActivePreset(presetId);
    try {
      const res = await fetch('/api/scenarios/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: 'INC-001', modifiers }),
      });
      const data = await res.json();
      setResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Scenario Simulator</h1>
      <p className="text-sm text-muted-foreground">What-if analysis — simulations do not modify the database.</p>

      {/* Presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => runScenario(preset.modifiers, preset.id)}
            disabled={loading}
            className={cn(
              'text-left p-4 rounded-lg border transition-colors',
              activePreset === preset.id ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-2',
              loading && 'opacity-60 cursor-wait'
            )}
          >
            <preset.icon className="w-5 h-5 text-muted-foreground mb-2" />
            <h3 className="text-sm font-medium mb-1">{preset.title}</h3>
            <p className="text-xs text-muted-foreground">{preset.description}</p>
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <div className="skeleton w-10 h-10 rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Running simulation…</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Delta Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DeltaCard label="Affected Units" baseline={result.baseline.impact.affectedUnits} scenario={result.scenario.impact.affectedUnits} delta={result.delta.affectedUnits} />
            <DeltaCard label="Safe Units" baseline={result.baseline.impact.safeUnits} scenario={result.scenario.impact.safeUnits} delta={result.delta.safeUnits} inverted />
            <DeltaCard label="Response Cost" baseline={result.baseline.response.comparison.logis.totalCost} scenario={result.scenario.response.comparison.logis.totalCost} delta={result.delta.costDelta} isCurrency />
            <DeltaCard label="Response Time" baseline={result.baseline.response.comparison.logis.estimatedTimeHours} scenario={result.scenario.response.comparison.logis.estimatedTimeHours} delta={result.delta.timeDelta} unit="h" />
          </div>

          {/* Impact Comparison */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-medium">Impact Comparison</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Metric</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Original</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Scenario</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <CompRow label="Affected Units" b={result.baseline.impact.affectedUnits} s={result.scenario.impact.affectedUnits} />
                <CompRow label="Safe Units" b={result.baseline.impact.safeUnits} s={result.scenario.impact.safeUnits} inverted />
                <CompRow label="Uncertain Units" b={result.baseline.impact.uncertainUnits} s={result.scenario.impact.uncertainUnits} />
                <CompRow label="Sold Units" b={result.baseline.impact.soldUnits} s={result.scenario.impact.soldUnits} />
                <CompRow label="Response Actions" b={result.baseline.response.actions.length} s={result.scenario.response.actions.length} />
                <CompRow label="Response Cost (₹)" b={result.baseline.response.comparison.logis.totalCost} s={result.scenario.response.comparison.logis.totalCost} isCurrency />
                <CompRow label="Recovery Allocations" b={result.baseline.recovery.allocations.length} s={result.scenario.recovery.allocations.length} inverted />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaCard({ label, baseline, scenario, delta, isCurrency, unit, inverted }: {
  label: string; baseline: number; scenario: number; delta: number; isCurrency?: boolean; unit?: string; inverted?: boolean;
}) {
  const fmt = (n: number) => isCurrency ? formatCurrency(n) : `${formatNumber(n)}${unit || ''}`;
  const isUp = delta > 0;
  const isBad = inverted ? !isUp : isUp;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="text-xl font-bold tabular-nums">{fmt(scenario)}</div>
      <div className={cn('flex items-center gap-1 mt-1 text-xs',
        delta === 0 ? 'text-muted' : isBad ? 'text-red-400' : 'text-emerald-400'
      )}>
        {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : delta < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {delta !== 0 ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : 'No change'}
      </div>
    </div>
  );
}

function CompRow({ label, b, s, isCurrency, inverted }: {
  label: string; b: number; s: number; isCurrency?: boolean; inverted?: boolean;
}) {
  const fmt = (n: number) => isCurrency ? formatCurrency(n) : formatNumber(n);
  const delta = s - b;
  const isBad = inverted ? delta < 0 : delta > 0;
  const changed = delta !== 0;
  return (
    <tr className={cn(changed && 'bg-amber-500/5')}>
      <td className="px-4 py-2.5">{label}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(b)}</td>
      <td className={cn('px-4 py-2.5 text-right tabular-nums font-medium', changed && (isBad ? 'text-red-400' : 'text-emerald-400'))}>{fmt(s)}</td>
      <td className={cn('px-4 py-2.5 text-right tabular-nums text-xs', delta === 0 ? 'text-muted' : isBad ? 'text-red-400' : 'text-emerald-400')}>
        {delta !== 0 ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—'}
      </td>
    </tr>
  );
}
