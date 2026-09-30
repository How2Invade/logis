'use client';

import { useEffect, useState } from 'react';
import { cn, formatNumber, formatCurrency, severityColors } from '@/lib/utils';
import { Shield, Package, ChevronRight, ArrowRight, Info } from 'lucide-react';
import type { ResponsePlan } from '@/lib/types';

export default function ResponsePage() {
  const [plan, setPlan] = useState<ResponsePlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function generatePlan() {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents/INC-001/response', { method: 'POST' });
      const data = await res.json();
      setPlan(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Response Plan</h1>

      {!plan && !loading && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Shield className="w-8 h-8 text-muted mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-2">No Response Plan Generated</h3>
          <p className="text-xs text-muted-foreground mb-4">Generate a response plan for the primary incident (INC-001 — MILK-204).</p>
          <button onClick={generatePlan}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
            <Shield className="w-4 h-4" />
            Generate Response Plan
          </button>
        </div>
      )}

      {loading && (
        <div className="p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-lg" />)}
        </div>
      )}

      {plan && (
        <>
          {/* Risk Level */}
          <div className="flex items-center gap-3">
            <span className={cn('px-3 py-1 rounded text-xs font-medium uppercase', severityColors[plan.riskLevel])}>
              Risk Level: {plan.riskLevel}
            </span>
            <span className="text-sm text-muted-foreground">Score: {plan.riskScore}/100</span>
            <button className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Info className="w-3 h-3" />
              How is this calculated?
            </button>
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
              <h3 className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Naive Approach</h3>
              <div className="text-2xl font-bold text-red-400 tabular-nums mb-1">{formatNumber(plan.comparison.naive.totalUnits)} units</div>
              <div className="text-sm text-muted-foreground">{formatCurrency(plan.comparison.naive.totalCost)} estimated cost</div>
              <div className="text-sm text-muted-foreground">{plan.comparison.naive.estimatedTimeHours} hours</div>
              <div className="text-xs text-muted mt-2">Recall every product touched by the source</div>
              <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[9px] bg-purple-500/15 text-purple-400">SIMULATED</span>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">LOGIS Response</h3>
              <div className="text-2xl font-bold text-emerald-400 tabular-nums mb-1">{formatNumber(plan.comparison.logis.totalUnits)} units</div>
              <div className="text-sm text-muted-foreground">{formatCurrency(plan.comparison.logis.totalCost)} estimated cost</div>
              <div className="text-sm text-muted-foreground">{plan.comparison.logis.estimatedTimeHours} hours</div>
              <div className="mt-3 p-2 rounded bg-emerald-500/10 text-xs text-emerald-400">
                <strong>{formatNumber(plan.comparison.unnecessaryRecallAvoided)}</strong> unnecessary recalls avoided · <strong>{formatCurrency(plan.comparison.costSaved)}</strong> saved
              </div>
              <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[9px] bg-purple-500/15 text-purple-400">SIMULATED</span>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-medium">{plan.actions.length} Response Actions</h3>
            </div>
            <div className="divide-y divide-border">
              {plan.actions.map(action => (
                <div key={action.id} className="p-4 hover:bg-surface-2 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-bold shrink-0 tabular-nums">
                      {action.priority}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{action.description}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{action.reason}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        <span className="tabular-nums">{formatNumber(action.units)} units</span>
                        <span className="tabular-nums">{formatCurrency(action.estimatedCost)}</span>
                        <span>{action.estimatedTimeHours}h</span>
                        <span>{action.location}</span>
                      </div>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium shrink-0',
                      action.type === 'stop_shipment' ? 'bg-red-500/15 text-red-400' :
                      action.type === 'quarantine' ? 'bg-orange-500/15 text-orange-400' :
                      action.type === 'withdraw' ? 'bg-amber-500/15 text-amber-400' :
                      action.type === 'recall' ? 'bg-purple-500/15 text-purple-400' :
                      action.type === 'verify' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-cyan-500/15 text-cyan-400'
                    )}>
                      {action.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
