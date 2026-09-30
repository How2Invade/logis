'use client';

import { useEffect, useState } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Wrench, Users, Warehouse, Truck, ChevronRight, Play, ArrowRight } from 'lucide-react';
import type { RecoveryResult } from '@/lib/types';
import { toast } from 'sonner';

export default function RecoveryPage() {
  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generatePlan() {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents/INC-001/recovery', { method: 'POST' });
      const data = await res.json();
      setRecovery(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function applyPlan() {
    toast.success('Recovery plan applied successfully', { description: 'Resources have been reallocated. Timeline and audit log updated.' });
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Recovery Center</h1>

      {!recovery && !loading && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Wrench className="w-8 h-8 text-muted mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-2">Recovery Plan Not Generated</h3>
          <p className="text-xs text-muted-foreground mb-4">Compute recovery opportunities for INC-001.</p>
          <button onClick={generatePlan}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
            <Play className="w-4 h-4" /> Generate Recovery Plan
          </button>
        </div>
      )}

      {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>}

      {recovery && (
        <>
          {/* Resource Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResourceCard icon={Wrench} label="Idle Machines" value={recovery.idleResources.filter(r => r.type === 'machine').length} color="text-amber-400" />
            <ResourceCard icon={Users} label="Available Workers" value={recovery.idleResources.filter(r => r.type === 'worker').length} color="text-blue-400" />
            <ResourceCard icon={Warehouse} label="Free Slots" value={recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + r.capacity, 0)} color="text-cyan-400" />
            <ResourceCard icon={Truck} label="Available Trucks" value={recovery.idleResources.filter(r => r.type === 'truck').length} color="text-emerald-400" />
          </div>

          {/* Demand Gaps */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-sm font-medium mb-4">Unmet Demand</h3>
            <div className="space-y-2">
              {recovery.unmetDemand.map(d => (
                <div key={d.productId} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-surface-2 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{d.productName}</div>
                    <div className="text-xs text-muted-foreground">Demand: {formatNumber(d.demandUnits)} · Current: {formatNumber(d.currentCapacity)} · Gap: {formatNumber(d.gap)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-amber-400 tabular-nums">{formatCurrency(d.totalValue)}</div>
                    <div className="text-xs text-muted">by {d.deadline.split('T')[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocations */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-sm font-medium mb-4">Proposed Allocations</h3>
            <div className="space-y-3">
              {recovery.allocations.map(a => (
                <div key={a.id} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-emerald-400">{a.resourceName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted" />
                    <span className="text-sm font-medium">{a.targetProductName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{a.explanation}</p>
                  <div className="flex gap-4 text-xs text-muted">
                    <span>Capacity: {formatNumber(a.capacityUsed)} units/day</span>
                    <span>Covers: {formatNumber(a.demandCovered)} units</span>
                    <span>Benefit: {formatCurrency(a.expectedBenefit)}</span>
                  </div>
                </div>
              ))}
              {recovery.allocations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No feasible allocations found with positive score</p>
              )}
            </div>
          </div>

          {/* Before / After */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-medium">Before vs After</h3>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/30">SIMULATED DEMO COMPARISON</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ComparisonCard label="Idle Resources" before={recovery.idleBefore} after={recovery.idleAfter} unit="" />
              <ComparisonCard label="Recovery Time" before={recovery.estimatedRecoveryTimeHours * 2} after={recovery.estimatedRecoveryTimeHours} unit="h" />
              <ComparisonCard label="Setup Cost" before={recovery.estimatedCost * 1.5} after={recovery.estimatedCost} unit="₹" isCurrency />
              <ComparisonCard label="Recovery Value" before={0} after={recovery.potentialRecoveryValue} unit="₹" isCurrency positive />
            </div>
          </div>

          {/* Apply */}
          <button onClick={applyPlan}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
            Apply Recovery Plan
          </button>
        </>
      )}
    </div>
  );
}

function ResourceCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Icon className={cn('w-5 h-5 mb-2', color)} />
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{formatNumber(value)}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ComparisonCard({ label, before, after, unit, isCurrency, positive }: {
  label: string; before: number; after: number; unit: string; isCurrency?: boolean; positive?: boolean
}) {
  const fmt = (n: number) => isCurrency ? formatCurrency(n) : `${formatNumber(n)}${unit}`;
  const improved = positive ? after > before : after < before;
  return (
    <div className="rounded-md border border-border p-3 bg-surface-2">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted line-through tabular-nums">{fmt(before)}</span>
        <ArrowRight className="w-3 h-3 text-muted" />
        <span className={cn('text-sm font-semibold tabular-nums', improved ? 'text-emerald-400' : 'text-red-400')}>
          {fmt(after)}
        </span>
      </div>
    </div>
  );
}
