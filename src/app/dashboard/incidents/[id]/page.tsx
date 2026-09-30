'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, Play, Package, Shield, Clock,
  MapPin, ChevronRight, Loader2, CheckCircle2, Eye, SkipForward
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDateTime, severityColors, incidentStatusColors, statusColors } from '@/lib/utils';
import type { Incident, ImpactResult, ResponsePlan, RecoveryResult, TimelineEvent } from '@/lib/types';

const analysisSteps = [
  'Building product genealogy…',
  'Tracing downstream batches…',
  'Checking warehouse inventory…',
  'Checking shipment status…',
  'Analyzing store inventory…',
  'Calculating impact…',
];

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [response, setResponse] = useState<ResponsePlan | null>(null);
  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    fetchIncident();
    fetchTimeline();
  }, [id]);

  async function fetchIncident() {
    try {
      const res = await fetch(`/api/incidents/${id}`);
      const data = await res.json();
      setIncident(data.data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function fetchTimeline() {
    try {
      const res = await fetch(`/api/incidents/${id}/timeline`);
      const data = await res.json();
      setTimeline(data.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setCurrentStep(0);

    // Animate through steps
    if (!skipAnimation) {
      for (let i = 0; i < analysisSteps.length; i++) {
        setCurrentStep(i);
        await new Promise(r => setTimeout(r, 400));
      }
    }

    try {
      const res = await fetch(`/api/incidents/${id}/analyze`, { method: 'POST' });
      const data = await res.json();
      setImpact(data.data);
      setCurrentStep(analysisSteps.length);
      await fetchIncident();
      await fetchTimeline();
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  }

  async function generateResponsePlan() {
    if (!impact) return;
    try {
      const res = await fetch(`/api/incidents/${id}/response`, { method: 'POST' });
      const data = await res.json();
      setResponse(data.data);
      await fetchTimeline();
    } catch (e) {
      console.error(e);
    }
  }

  async function generateRecoveryPlan() {
    try {
      const res = await fetch(`/api/incidents/${id}/recovery`, { method: 'POST' });
      const data = await res.json();
      setRecovery(data.data);
      await fetchTimeline();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading || !incident) {
    return (
      <div className="p-6 space-y-6">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Overview
      </button>

      {/* Incident Header */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className={cn('w-6 h-6 shrink-0 mt-0.5',
            incident.severity === 'critical' ? 'text-red-400' : 'text-orange-400'
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase', severityColors[incident.severity])}>
                {incident.severity}
              </span>
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', incidentStatusColors[incident.status])}>
                {incident.status}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-surface-2 text-muted-foreground">
                {incident.type.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-lg font-semibold mb-2">{incident.title}</h1>
            <p className="text-sm text-muted-foreground mb-3">{incident.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Source Lot:</span>
                <span className="text-foreground font-medium">{incident.sourceLot}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{incident.location}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Detected: {formatDateTime(incident.detectedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-medium mb-4">Incident Timeline</h3>
        <div className="space-y-3">
          {timeline.map((event, i) => (
            <div key={event.id} className="flex items-start gap-3">
              <div className="relative">
                <div className={cn('w-2 h-2 rounded-full mt-1.5',
                  event.category === 'detection' ? 'bg-red-400' :
                  event.category === 'analysis' ? 'bg-blue-400' :
                  event.category === 'response' ? 'bg-amber-400' :
                  event.category === 'recovery' ? 'bg-emerald-400' : 'bg-muted'
                )} />
                {i < timeline.length - 1 && (
                  <div className="absolute top-3.5 left-[3px] w-[2px] h-6 bg-border" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{event.event}</span>
                  <span className="text-xs text-muted">{formatDateTime(event.timestamp)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Section */}
      {!impact && !analyzing && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <Package className="w-8 h-8 text-muted mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-2">Impact Analysis Required</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            Run impact analysis to trace affected products, batches, and inventory downstream from {incident.sourceLot}.
          </p>
          <button
            onClick={runAnalysis}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium
              hover:bg-foreground/90 transition-colors active:scale-[0.98]"
          >
            <Play className="w-4 h-4" />
            Analyze Impact
          </button>
        </div>
      )}

      {/* Analysis Loading Stepper */}
      {analyzing && (
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Running Impact Analysis…</h3>
            <button
              onClick={() => setSkipAnimation(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-3 h-3" />
              Skip animation
            </button>
          </div>
          <div className="space-y-2">
            {analysisSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {i < currentStep ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : i === currentStep ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                )}
                <span className={cn('text-sm', i <= currentStep ? 'text-foreground' : 'text-muted')}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact Results */}
      {impact && (
        <>
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="text-sm font-medium mb-4">Impact Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ImpactStat label="Affected" value={formatNumber(impact.affectedUnits)} color="text-red-400" />
              <ImpactStat label="Safe" value={formatNumber(impact.safeUnits)} color="text-emerald-400" />
              <ImpactStat label="Uncertain" value={formatNumber(impact.uncertainUnits)} color="text-amber-400" />
              <ImpactStat label="Already Sold" value={formatNumber(impact.soldUnits)} color="text-purple-400" />
              <ImpactStat label="Unaccounted" value={formatNumber(impact.unaccountedUnits)} color="text-orange-400" />
            </div>
          </div>

          {/* Impact Lines Table */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-medium">Classification Details</h3>
              <button
                onClick={() => router.push('/dashboard/impact')}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Eye className="w-3 h-3" />
                View Impact Map
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Quantity</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {impact.lines.slice(0, 30).map(line => (
                    <tr key={line.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium border', statusColors[line.status])}>
                          {line.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{line.label.split(' at ')[0]}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{line.location}</td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums font-medium">{formatNumber(line.quantity)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{line.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {impact.lines.length > 30 && (
              <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground text-center">
                Showing 30 of {impact.lines.length} lines
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {!response && (
              <button
                onClick={generateResponsePlan}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium
                  hover:bg-foreground/90 transition-colors active:scale-[0.98]"
              >
                <Shield className="w-4 h-4" />
                Generate Response Plan
              </button>
            )}
            {response && !recovery && (
              <button
                onClick={generateRecoveryPlan}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium
                  hover:bg-foreground/90 transition-colors active:scale-[0.98]"
              >
                <Play className="w-4 h-4" />
                Generate Recovery Plan
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/impact')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border bg-surface text-sm font-medium
                hover:bg-surface-2 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Open Impact Map
            </button>
          </div>
        </>
      )}

      {/* Response Plan */}
      {response && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Response Plan</h3>
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase',
                response.riskLevel === 'critical' ? severityColors.critical :
                response.riskLevel === 'high' ? severityColors.high : severityColors.medium
              )}>
                Risk: {response.riskLevel}
              </span>
            </div>
            
            {/* Naive vs LOGIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-md border border-border p-4 bg-red-500/5">
                <div className="text-xs text-muted-foreground mb-2">Naive Approach (Recall Everything)</div>
                <div className="text-lg font-semibold text-red-400 tabular-nums">{formatNumber(response.comparison.naive.totalUnits)} units</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(response.comparison.naive.totalCost)} · {response.comparison.naive.estimatedTimeHours}h</div>
                <div className="text-xs text-muted mt-1">SIMULATED</div>
              </div>
              <div className="rounded-md border border-emerald-500/30 p-4 bg-emerald-500/5">
                <div className="text-xs text-muted-foreground mb-2">LOGIS Response (Precise Targeting)</div>
                <div className="text-lg font-semibold text-emerald-400 tabular-nums">{formatNumber(response.comparison.logis.totalUnits)} units</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(response.comparison.logis.totalCost)} · {response.comparison.logis.estimatedTimeHours}h</div>
                <div className="mt-2 text-xs text-emerald-400">
                  {formatNumber(response.comparison.unnecessaryRecallAvoided)} unnecessary recalls avoided · {formatCurrency(response.comparison.costSaved)} saved
                </div>
                <div className="text-xs text-muted mt-1">SIMULATED</div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {response.actions.map(action => (
                <div key={action.id} className="rounded-md border border-border p-4 hover:bg-surface-2 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-medium shrink-0">
                      {action.priority}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{action.description}</span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[9px]',
                          action.type === 'stop_shipment' ? 'bg-red-500/15 text-red-400' :
                          action.type === 'quarantine' ? 'bg-orange-500/15 text-orange-400' :
                          action.type === 'withdraw' ? 'bg-amber-500/15 text-amber-400' :
                          action.type === 'recall' ? 'bg-purple-500/15 text-purple-400' :
                          'bg-blue-500/15 text-blue-400'
                        )}>
                          {action.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{action.reason}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted">
                        <span>{formatNumber(action.units)} units</span>
                        <span>{formatCurrency(action.estimatedCost)}</span>
                        <span>{action.estimatedTimeHours}h</span>
                        <span>{action.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recovery Plan */}
      {recovery && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="text-sm font-medium mb-4">Recovery Plan</h3>
          
          {/* Idle Resources */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ImpactStat label="Idle Machines" value={String(recovery.idleResources.filter(r => r.type === 'machine').length)} color="text-amber-400" />
            <ImpactStat label="Available Workers" value={String(recovery.idleResources.filter(r => r.type === 'worker').length)} color="text-blue-400" />
            <ImpactStat label="Free Warehouse Slots" value={formatNumber(recovery.idleResources.filter(r => r.type === 'warehouse_slot').reduce((s, r) => s + r.capacity, 0))} color="text-cyan-400" />
            <ImpactStat label="Available Trucks" value={String(recovery.idleResources.filter(r => r.type === 'truck').length)} color="text-emerald-400" />
          </div>

          {/* Demand Gaps */}
          {recovery.unmetDemand.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs text-muted-foreground mb-3">Unmet Demand</h4>
              <div className="space-y-2">
                {recovery.unmetDemand.map(d => (
                  <div key={d.productId} className="flex items-center gap-4 p-3 rounded-md border border-border">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{d.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        Gap: {formatNumber(d.gap)} units · Value: {formatCurrency(d.totalValue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted">Deadline: {d.deadline.split('T')[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Allocations */}
          {recovery.allocations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs text-muted-foreground mb-3">Proposed Allocations</h4>
              <div className="space-y-2">
                {recovery.allocations.map(a => (
                  <div key={a.id} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{a.resourceName}</span>
                      <ChevronRight className="w-3 h-3 text-muted" />
                      <span className="text-sm">{a.targetProductName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.explanation}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted">
                      <span>Capacity: {formatNumber(a.capacityUsed)} units/day</span>
                      <span>Benefit: {formatCurrency(a.expectedBenefit)}</span>
                      <span>Score: {a.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border border-border bg-surface-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Recovery Time</div>
              <div className="text-lg font-semibold tabular-nums">{recovery.estimatedRecoveryTimeHours}h</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Setup Cost</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(recovery.estimatedCost)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Potential Value</div>
              <div className="text-lg font-semibold tabular-nums text-emerald-400">{formatCurrency(recovery.potentialRecoveryValue)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Idle Reduction</div>
              <div className="text-lg font-semibold tabular-nums">{recovery.idleBefore} → {recovery.idleAfter}</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-muted flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[9px]">SIMULATED</span>
            Simulated demo comparison — values are derived from the synthetic operational network
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value}</div>
    </div>
  );
}
