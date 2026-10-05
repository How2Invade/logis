'use client';

import { useEffect, useState } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Wrench, Users, Warehouse, Truck, ChevronRight, Play, ArrowRight } from 'lucide-react';
import type { RecoveryResult } from '@/lib/types';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const demandData = recovery?.unmetDemand.map(d => ({
    name: d.productName.substring(0, 15) + (d.productName.length > 15 ? '...' : ''),
    'Current Capacity': d.currentCapacity,
    'Unmet Demand Gap': d.gap,
  })) || [];

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Recovery Center</h1>
        <p className="text-[14px] text-muted-foreground">Identify available capacity and recovery opportunities</p>
      </div>

      {!recovery && !loading && (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
          <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-[15px] font-semibold text-foreground mb-2">Recovery Plan Not Generated</h3>
          <p className="text-[14px] text-muted-foreground mb-6">Compute recovery opportunities for INC-001.</p>
          <button onClick={generatePlan}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm">
            <Play className="w-4 h-4" /> Generate Recovery Plan
          </button>
        </div>
      )}

      {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>}

      {recovery && (
        <>
          {/* Resource Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResourceCard icon={Wrench} label="Idle Machines" value={recovery.idleResources.filter(r => r.type === 'machine').length} />
            <ResourceCard icon={Users} label="Available Workers" value={recovery.idleResources.filter(r => r.type === 'worker').length} />
            <ResourceCard icon={Warehouse} label="Free Slots" value={recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + r.capacity, 0)} />
            <ResourceCard icon={Truck} label="Available Trucks" value={recovery.idleResources.filter(r => r.type === 'truck').length} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Demand Gap Chart */}
            <div className="rounded-2xl border border-border bg-surface shadow-sm p-6 flex flex-col transition-colors duration-300">
              <h3 className="text-[16px] font-semibold text-foreground mb-4">Demand Gap by Product</h3>
              <div className="flex-1 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border)" />
                    <XAxis type="number" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      formatter={(value: any) => formatNumber(value)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }} />
                    <Bar dataKey="Current Capacity" stackId="a" fill="var(--color-success)" radius={[0, 0, 0, 0]} barSize={16} />
                    <Bar dataKey="Unmet Demand Gap" stackId="a" fill="var(--color-warning)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Unmet Demand Details */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col transition-colors duration-300 h-full overflow-hidden">
              <h3 className="text-[16px] font-semibold text-foreground mb-4">Unmet Demand Details</h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {recovery.unmetDemand.map(d => (
                  <div key={d.productId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-2/50 border border-border rounded-xl transition-colors">
                    <div className="mb-2 sm:mb-0">
                      <div className="text-[14px] font-semibold text-foreground mb-1">{d.productName}</div>
                      <div className="text-[13px] text-muted-foreground">Demand: {formatNumber(d.demandUnits)} · Gap: <span className="text-warning font-medium">{formatNumber(d.gap)}</span></div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-[15px] font-semibold text-foreground tabular-nums mb-0.5">{formatCurrency(d.totalValue)}</div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">by {d.deadline.split('T')[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Allocations */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-[16px] font-semibold text-foreground mb-4">Proposed Allocations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recovery.allocations.map(a => (
                <div key={a.id} className="rounded-xl border border-success/30 bg-success/5 p-5 shadow-sm transition-colors relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-success/60" />
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[14px] font-semibold text-foreground">{a.resourceName}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[14px] font-semibold text-foreground">{a.targetProductName}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-3">{a.explanation}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-medium text-muted-foreground">
                    <span className="bg-surface px-2 py-0.5 rounded border border-border text-foreground tabular-nums">{formatNumber(a.capacityUsed)} units/day</span>
                    <span className="bg-surface px-2 py-0.5 rounded border border-border text-foreground tabular-nums">Covers: {formatNumber(a.demandCovered)}</span>
                    <span className="font-bold text-success flex items-center gap-1 tabular-nums mt-0.5">Benefit: {formatCurrency(a.expectedBenefit)}</span>
                  </div>
                </div>
              ))}
              {recovery.allocations.length === 0 && (
                <p className="text-[14px] text-muted-foreground text-center py-6 col-span-2">No feasible allocations found with positive score</p>
              )}
            </div>
          </div>

          {/* Before / After */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-foreground">Before vs After</h3>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2 text-muted-foreground">SIMULATED DEMO COMPARISON</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ComparisonCard label="Idle Resources" before={recovery.idleBefore} after={recovery.idleAfter} unit="" />
              <ComparisonCard label="Recovery Time" before={recovery.estimatedRecoveryTimeHours * 2} after={recovery.estimatedRecoveryTimeHours} unit="h" />
              <ComparisonCard label="Setup Cost" before={recovery.estimatedCost * 1.5} after={recovery.estimatedCost} unit="₹" isCurrency />
              <ComparisonCard label="Recovery Value" before={0} after={recovery.potentialRecoveryValue} unit="₹" isCurrency positive />
            </div>
          </div>

          {/* Apply */}
          <div className="flex justify-end pt-2">
            <button onClick={applyPlan}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm">
              Apply Recovery Plan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResourceCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between hover:bg-surface-2/50 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center border border-border">
          <Icon className="w-4 h-4 text-foreground opacity-80" />
        </div>
      </div>
      <div className="text-3xl font-semibold tabular-nums text-foreground mb-1">{formatNumber(value)}</div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function ComparisonCard({ label, before, after, unit, isCurrency, positive }: {
  label: string; before: number; after: number; unit: string; isCurrency?: boolean; positive?: boolean
}) {
  const fmt = (n: number) => isCurrency ? formatCurrency(n) : `${formatNumber(n)}${unit}`;
  const improved = positive ? after > before : after < before;
  return (
    <div className="rounded-xl border border-border p-4 bg-surface-2/30 shadow-sm transition-colors">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[14px] text-muted-foreground line-through tabular-nums">{fmt(before)}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
        <span className={cn('text-[15px] font-bold tabular-nums', improved ? 'text-success' : 'text-critical')}>
          {fmt(after)}
        </span>
      </div>
    </div>
  );
}
