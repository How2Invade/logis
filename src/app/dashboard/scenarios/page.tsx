'use client';

import { useState } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Layers, Play, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Warehouse, Truck, TrendingUp, Info } from 'lucide-react';
import type { ScenarioResult } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

import { SCENARIO_PRESETS, ACTIVE_SCENARIO_STORAGE_KEY } from '@/lib/scenarios';

const PRESET_ICONS = {
  additional_batch: AlertTriangle,
  warehouse_unavailable: Warehouse,
  transport_reduced: Truck,
  demand_spike: TrendingUp,
} as const;

const presets = SCENARIO_PRESETS.map(p => ({ ...p, icon: PRESET_ICONS[p.id] }));

export default function ScenariosPage() {
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  async function runScenario(modifiers: any[], presetId: string) {
    setLoading(true);
    setActivePreset(presetId);
    try { localStorage.setItem(ACTIVE_SCENARIO_STORAGE_KEY, presetId); } catch {}
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

  const chartData = (() => {
    if (!result) return [];
    switch (activePreset) {
      case 'additional_batch':
        return [
          { name: 'Affected Units', Baseline: result.baseline.impact.affectedUnits, Scenario: result.scenario.impact.affectedUnits },
          { name: 'Response Cost (k)', Baseline: result.baseline.response.comparison.logis.totalCost / 1000, Scenario: result.scenario.response.comparison.logis.totalCost / 1000 }
        ];
      case 'warehouse_unavailable':
        return [
          { name: 'Recovery Value (k)', Baseline: result.baseline.recovery.potentialRecoveryValue / 1000, Scenario: result.scenario.recovery.potentialRecoveryValue / 1000 },
          { name: 'Allocations', Baseline: result.baseline.recovery.allocations.length, Scenario: result.scenario.recovery.allocations.length }
        ];
      case 'transport_reduced':
        return [
          { name: 'Available Trucks', Baseline: result.baseline.recovery.idleResources.filter(r => r.type === 'truck').length, Scenario: result.scenario.recovery.idleResources.filter(r => r.type === 'truck').length },
          { name: 'Recovery Time (h)', Baseline: result.baseline.recovery.estimatedRecoveryTimeHours, Scenario: result.scenario.recovery.estimatedRecoveryTimeHours }
        ];
      case 'demand_spike': {
        const baseDemandGap = result.baseline.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0);
        const scenDemandGap = result.scenario.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0);
        return [
          { name: 'Unmet Demand', Baseline: baseDemandGap, Scenario: scenDemandGap },
          { name: 'Recovery Value (k)', Baseline: result.baseline.recovery.potentialRecoveryValue / 1000, Scenario: result.scenario.recovery.potentialRecoveryValue / 1000 }
        ];
      }
      default:
        return [];
    }
  })();

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto min-h-screen bg-background text-foreground transition-colors duration-300 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Scenario Simulator</h1>
        <p className="text-[14px] text-muted-foreground">Test how operational changes affect impact and recovery.</p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => runScenario(preset.modifiers, preset.id)}
            disabled={loading}
            className={cn(
              'text-left p-6 rounded-2xl border transition-all shadow-sm',
              activePreset === preset.id 
                ? 'border-transparent bg-dark-action text-dark-action-fg scale-[1.02]' 
                : 'border-border bg-surface hover:bg-surface-2 text-foreground',
              loading && 'opacity-60 cursor-wait'
            )}
          >
            <preset.icon className={cn("w-6 h-6 mb-4", activePreset === preset.id ? "text-dark-action-fg" : "text-muted-foreground")} />
            <h3 className="text-[15px] font-semibold mb-1">{preset.title}</h3>
            <p className={cn("text-[13px]", activePreset === preset.id ? "text-dark-action-fg/80" : "text-muted-foreground")}>{preset.description}</p>
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[14px] font-semibold text-muted-foreground">Running simulation…</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Delta Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activePreset === 'additional_batch' && (
              <>
                <DeltaCard label="Affected Units" baseline={result.baseline.impact.affectedUnits} scenario={result.scenario.impact.affectedUnits} delta={result.scenario.impact.affectedUnits - result.baseline.impact.affectedUnits} />
                <DeltaCard label="Safe Units" baseline={result.baseline.impact.safeUnits} scenario={result.scenario.impact.safeUnits} delta={result.scenario.impact.safeUnits - result.baseline.impact.safeUnits} inverted />
                <DeltaCard label="Response Cost" baseline={result.baseline.response.comparison.logis.totalCost} scenario={result.scenario.response.comparison.logis.totalCost} delta={result.scenario.response.comparison.logis.totalCost - result.baseline.response.comparison.logis.totalCost} isCurrency />
                <DeltaCard label="Response Time" baseline={result.baseline.response.comparison.logis.estimatedTimeHours} scenario={result.scenario.response.comparison.logis.estimatedTimeHours} delta={result.scenario.response.comparison.logis.estimatedTimeHours - result.baseline.response.comparison.logis.estimatedTimeHours} unit="h" />
              </>
            )}
            
            {activePreset === 'warehouse_unavailable' && (
              <>
                <DeltaCard label="Free Slots" 
                  baseline={result.baseline.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0)} 
                  scenario={result.scenario.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0)} 
                  delta={result.scenario.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0) - result.baseline.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0)} />
                <DeltaCard label="Allocations" baseline={result.baseline.recovery.allocations.length} scenario={result.scenario.recovery.allocations.length} delta={result.scenario.recovery.allocations.length - result.baseline.recovery.allocations.length} inverted />
                <DeltaCard label="Recovery Value" baseline={result.baseline.recovery.potentialRecoveryValue} scenario={result.scenario.recovery.potentialRecoveryValue} delta={result.scenario.recovery.potentialRecoveryValue - result.baseline.recovery.potentialRecoveryValue} isCurrency inverted />
                <DeltaCard label="Recovery Time" baseline={result.baseline.recovery.estimatedRecoveryTimeHours} scenario={result.scenario.recovery.estimatedRecoveryTimeHours} delta={result.scenario.recovery.estimatedRecoveryTimeHours - result.baseline.recovery.estimatedRecoveryTimeHours} unit="h" />
              </>
            )}

            {activePreset === 'transport_reduced' && (
              <>
                <DeltaCard label="Available Trucks" 
                  baseline={result.baseline.recovery.idleResources.filter(r => r.type === 'truck').length} 
                  scenario={result.scenario.recovery.idleResources.filter(r => r.type === 'truck').length} 
                  delta={result.scenario.recovery.idleResources.filter(r => r.type === 'truck').length - result.baseline.recovery.idleResources.filter(r => r.type === 'truck').length} />
                <DeltaCard label="Recovery Time" baseline={result.baseline.recovery.estimatedRecoveryTimeHours} scenario={result.scenario.recovery.estimatedRecoveryTimeHours} delta={result.scenario.recovery.estimatedRecoveryTimeHours - result.baseline.recovery.estimatedRecoveryTimeHours} unit="h" />
                <DeltaCard label="Allocations" baseline={result.baseline.recovery.allocations.length} scenario={result.scenario.recovery.allocations.length} delta={result.scenario.recovery.allocations.length - result.baseline.recovery.allocations.length} inverted />
                <DeltaCard label="Recovery Value" baseline={result.baseline.recovery.potentialRecoveryValue} scenario={result.scenario.recovery.potentialRecoveryValue} delta={result.scenario.recovery.potentialRecoveryValue - result.baseline.recovery.potentialRecoveryValue} isCurrency inverted />
              </>
            )}

            {activePreset === 'demand_spike' && (
              <>
                <DeltaCard label="Unmet Demand" 
                  baseline={result.baseline.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0)} 
                  scenario={result.scenario.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0)} 
                  delta={result.scenario.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0) - result.baseline.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0)} />
                <DeltaCard label="Allocations" baseline={result.baseline.recovery.allocations.length} scenario={result.scenario.recovery.allocations.length} delta={result.scenario.recovery.allocations.length - result.baseline.recovery.allocations.length} inverted />
                <DeltaCard label="Recovery Value" baseline={result.baseline.recovery.potentialRecoveryValue} scenario={result.scenario.recovery.potentialRecoveryValue} delta={result.scenario.recovery.potentialRecoveryValue - result.baseline.recovery.potentialRecoveryValue} isCurrency inverted />
                <DeltaCard label="Recovery Cost" baseline={result.baseline.recovery.estimatedCost} scenario={result.scenario.recovery.estimatedCost} delta={result.scenario.recovery.estimatedCost - result.baseline.recovery.estimatedCost} isCurrency />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-start">
            {/* Chart */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col h-full">
              <h3 className="text-[16px] font-semibold text-foreground mb-6">Key Metric Shift</h3>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--color-foreground)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }} />
                    <Bar dataKey="Baseline" fill="var(--color-border)" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="Scenario" fill="var(--color-warning)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Impact Comparison Table */}
            <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-5 border-b border-border bg-surface-2/50 flex justify-between items-center">
                <h3 className="text-[16px] font-semibold text-foreground">Detailed Comparison</h3>
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border bg-background text-muted-foreground">SIMULATED</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-border bg-surface text-left">
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Metric</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Baseline</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Scenario</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    <CompRow label="Affected Units" b={result.baseline.impact.affectedUnits} s={result.scenario.impact.affectedUnits} />
                    <CompRow label="Safe Units" b={result.baseline.impact.safeUnits} s={result.scenario.impact.safeUnits} inverted />
                    <CompRow label="Response Cost" b={result.baseline.response.comparison.logis.totalCost} s={result.scenario.response.comparison.logis.totalCost} isCurrency />
                    <CompRow label="Available Trucks" b={result.baseline.recovery.idleResources.filter(r => r.type === 'truck').length} s={result.scenario.recovery.idleResources.filter(r => r.type === 'truck').length} inverted />
                    <CompRow label="Free WH Slots" b={result.baseline.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0)} s={result.scenario.recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + (r.capacity || 0), 0)} inverted />
                    <CompRow label="Unmet Demand Gap" b={result.baseline.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0)} s={result.scenario.recovery.unmetDemand.reduce((s, d) => s + d.gap, 0)} />
                    <CompRow label="Recovery Allocations" b={result.baseline.recovery.allocations.length} s={result.scenario.recovery.allocations.length} inverted />
                    <CompRow label="Recovery Value" b={result.baseline.recovery.potentialRecoveryValue} s={result.scenario.recovery.potentialRecoveryValue} isCurrency inverted />
                  </tbody>
                </table>
              </div>
            </div>
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
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{label}</div>
      <div className="text-3xl font-semibold tabular-nums text-foreground">{fmt(scenario)}</div>
      <div className={cn('flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-flex border',
        delta === 0 ? 'text-muted-foreground bg-surface-2 border-transparent' : isBad ? 'text-critical bg-critical/10 border-critical/20' : 'text-success bg-success/10 border-success/20'
      )}>
        {delta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : delta < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
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
    <tr className={cn(changed ? 'bg-surface-2/40' : 'bg-surface hover:bg-surface-2/20', 'transition-colors')}>
      <td className="px-6 py-4 font-semibold text-foreground">{label}</td>
      <td className="px-6 py-4 text-right tabular-nums text-muted-foreground">{fmt(b)}</td>
      <td className={cn('px-6 py-4 text-right tabular-nums font-semibold', changed && (isBad ? 'text-critical' : 'text-success'))}>
        {fmt(s)}
      </td>
      <td className={cn('px-6 py-4 text-right tabular-nums text-[11px] font-bold uppercase tracking-widest', delta === 0 ? 'text-muted-foreground' : isBad ? 'text-critical' : 'text-success')}>
        {delta !== 0 ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—'}
      </td>
    </tr>
  );
}
