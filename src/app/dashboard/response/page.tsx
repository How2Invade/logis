'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Shield, Info, Check, Clock, User, AlertTriangle } from 'lucide-react';
import type { ResponsePlan, ResponseAction } from '@/lib/types';
import { ACTION_TRACKER_STORAGE_KEY, ACTION_OWNERS as OWNERS, priorityLevelFor, type TrackedAction } from '@/lib/actionTracker';

// Extend the Action type for UI state
type ActionUIState = TrackedAction;

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical': return 'bg-critical/10 text-critical border-critical/50';
    case 'high': return 'bg-warning/10 text-warning border-warning/50';
    case 'low': return 'bg-surface-2 text-muted-foreground border-border';
    default: return 'bg-surface-2 text-foreground border-border';
  }
}

export default function ResponsePage() {
  const [plan, setPlan] = useState<ResponsePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionUIState[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Attempt to load actions from localStorage first if we already have them saved
    try {
      const saved = localStorage.getItem(ACTION_TRACKER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setActions(parsed);
          // Still need the plan object for comparison stats. We'll generate it silently if missing.
          fetch('/api/incidents/INC-001/response', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              if (data?.data) setPlan(data.data);
            })
            .catch(console.error);
        }
      }
    } catch (e) {
      console.error('Failed to load local storage actions', e);
    }
  }, []);

  useEffect(() => {
    if (actions.length > 0 && mounted) {
      try {
        localStorage.setItem(ACTION_TRACKER_STORAGE_KEY, JSON.stringify(actions));
      } catch (e) {}
    }
  }, [actions, mounted]);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/incidents/INC-001/response', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate response plan');
      const data = await res.json();
      
      if (!data || !data.data) throw new Error('Invalid response format');
      
      const newPlan = data.data;
      setPlan(newPlan);

      if (newPlan.actions && Array.isArray(newPlan.actions)) {
        // Enhance actions with UI state
        const enhancedActions = newPlan.actions.map((a: ResponseAction, i: number) => {
          const now = new Date();
          // avoid math random to prevent any mismatch between renders if done carelessly, though this is in a handler so it's safe.
          const dueTime = new Date(now.getTime() + (Math.random() * 8 - 2) * 60 * 60 * 1000); 
          
          return {
            ...a,
            completed: false,
            owner: OWNERS[i % OWNERS.length],
            priorityLevel: priorityLevelFor(a.priority),
            dueTime: dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOverdue: dueTime < now,
          };
        });
        setActions(enhancedActions);
      }
    } catch (e: any) { 
      console.error(e);
      setError(e.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }

  const toggleAction = (id: string) => {
    setActions(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          completed: !a.completed,
          completedAt: !a.completed ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
        };
      }
      return a;
    }));
  };

  const completedCount = actions.filter(a => a.completed).length;
  const totalCount = actions.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  
  const remainingCritical = actions.filter(a => a.priorityLevel === 'critical' && !a.completed).length;
  const remainingHigh = actions.filter(a => a.priorityLevel === 'high' && !a.completed).length;

  if (!mounted) {
    return <div className="px-8 lg:px-10 py-7 min-h-screen"></div>; // Wait for hydration
  }

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-8 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Response Plan</h1>
        <p className="text-[14px] text-muted-foreground">Actionable execution plan to mitigate the incident impact</p>
      </div>

      {error && (
        <div className="p-4 bg-critical/10 border border-critical/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-critical" />
            <span className="text-[14px] font-medium text-critical">{error}</span>
          </div>
          <button onClick={generatePlan} className="text-[13px] font-bold uppercase tracking-widest text-foreground hover:underline">Retry</button>
        </div>
      )}

      {!plan && !loading && actions.length === 0 && !error && (
        <div className="rounded-2xl border border-border bg-surface p-16 text-center shadow-sm">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-[16px] font-semibold text-foreground mb-2">No Active Response Plan</h3>
          <p className="text-[14px] text-muted-foreground mb-6 max-w-md mx-auto">Generate a data-driven response plan for INC-001 to calculate optimal recall boundaries, quarantine zones, and estimated recovery costs.</p>
          <button onClick={generatePlan}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm">
            <Shield className="w-4 h-4" />
            Generate Response Plan
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
          <div className="skeleton h-96 rounded-2xl w-full mt-4" />
        </div>
      )}

      {(plan || actions.length > 0) && !loading && (
        <>
          {/* Action Tracker Progress */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold text-foreground uppercase tracking-widest">Response Progress</h3>
                <span className="text-[14px] font-semibold text-foreground">{completedCount} / {totalCount} completed ({progressPercent}%)</span>
              </div>
              <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                <div 
                  className={cn("h-full transition-all duration-500", progressPercent === 100 ? "bg-success" : "bg-dark-action")} 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
              {progressPercent === 100 && totalCount > 0 && (
                <div className="mt-3 flex items-center gap-2 text-success text-[13px] font-semibold">
                  <Check className="w-4 h-4" /> All response actions completed
                </div>
              )}
            </div>
            
            {progressPercent < 100 && (
              <div className="flex gap-6 md:border-l border-border md:pl-6">
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-widest">Critical</div>
                  <div className="text-[16px] font-semibold text-critical">{remainingCritical} remaining</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-widest">High</div>
                  <div className="text-[16px] font-semibold text-warning">{remainingHigh} remaining</div>
                </div>
              </div>
            )}
          </div>

          {/* Comparison */}
          {plan?.comparison && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-[11px] font-bold text-muted-foreground mb-3 uppercase tracking-widest flex items-center justify-between">
                    <span>Naive Approach</span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 text-[9px]">SIMULATED</span>
                  </h3>
                  <div className="text-3xl font-semibold text-critical tabular-nums mb-2">
                    {formatNumber(plan.comparison.naive?.totalUnits || 0)} units
                  </div>
                  <div className="text-[14px] text-muted-foreground mb-1">
                    {formatCurrency(plan.comparison.naive?.totalCost || 0)} est. cost
                  </div>
                  <div className="text-[14px] text-muted-foreground">
                    {plan.comparison.naive?.estimatedTimeHours || 0} hours
                  </div>
                </div>
              </div>
              
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-[11px] font-bold text-muted-foreground mb-3 uppercase tracking-widest flex items-center justify-between">
                    <span>LOGIS Response</span>
                    <span className="px-2 py-0.5 rounded bg-surface-2 text-[9px]">RECOMMENDED</span>
                  </h3>
                  <div className="text-3xl font-semibold text-success tabular-nums mb-2">
                    {formatNumber(plan.comparison.logis?.totalUnits || 0)} units
                  </div>
                  <div className="text-[14px] text-muted-foreground mb-1">
                    {formatCurrency(plan.comparison.logis?.totalCost || 0)} est. cost
                  </div>
                  <div className="text-[14px] text-muted-foreground">
                    {plan.comparison.logis?.estimatedTimeHours || 0} hours
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Tracker List */}
          {actions.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-border bg-surface-2/30 flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-foreground">Action Tracker</h3>
                <span className="text-[13px] font-medium text-muted-foreground">{completedCount} of {totalCount} Actions Complete</span>
              </div>
              
              <div className="divide-y divide-border">
                {actions.map((action, i) => (
                  <div 
                    key={action.id || i} 
                    className={cn(
                      "p-5 transition-all duration-300", 
                      action.completed ? "bg-surface-2/50 opacity-75" : "hover:bg-surface-2/50"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <label className="flex items-center justify-center cursor-pointer shrink-0 mt-0.5">
                        <input 
                          type="checkbox" 
                          className="peer sr-only" 
                          checked={!!action.completed} 
                          onChange={() => toggleAction(action.id)}
                        />
                        <div className="w-5 h-5 rounded border-[1.5px] border-muted-foreground bg-surface peer-checked:bg-success peer-checked:border-success flex items-center justify-center transition-colors shadow-sm hover:border-foreground">
                          <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100" />
                        </div>
                      </label>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1.5">
                          <span className={cn("text-[15px] font-semibold transition-all", action.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                            {action.description || 'Unknown Action'}
                          </span>
                          
                          {/* Priority Badge */}
                          {!action.completed && action.priorityLevel && (
                            <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border', getPriorityColor(action.priorityLevel))}>
                              {action.priorityLevel} Priority
                            </span>
                          )}

                          {/* Completion / Overdue Status */}
                          {action.completed ? (
                            <span className="text-[12px] font-medium text-success flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Completed {action.completedAt && `· ${action.completedAt}`}
                            </span>
                          ) : action.isOverdue ? (
                            <span className="text-[12px] font-bold text-critical flex items-center gap-1 uppercase tracking-wider bg-critical/10 px-2 py-0.5 rounded border border-critical/30">
                              <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                            </span>
                          ) : null}
                        </div>
                        
                        <p className={cn("text-[13px] mb-4 max-w-3xl", action.completed ? "text-muted-foreground" : "text-muted-foreground")}>
                          {action.reason || 'No specific reason provided.'}
                        </p>
                        
                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-medium text-muted-foreground">
                          {action.owner && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4 opacity-70" />
                              <span>{action.owner}</span>
                            </div>
                          )}
                          
                          {!action.completed && action.dueTime && (
                            <div className={cn("flex items-center gap-1.5", action.isOverdue && "text-critical font-bold")}>
                              <Clock className="w-4 h-4 opacity-70" />
                              <span>Due {action.dueTime}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                            <span className="tabular-nums font-semibold text-foreground">{formatNumber(action.units || 0)} units</span>
                            <span className="w-[1px] h-3 bg-border" />
                            <span className="tabular-nums">{formatCurrency(action.estimatedCost || 0)}</span>
                            <span className="w-[1px] h-3 bg-border" />
                            <span>{action.location || 'Unknown'}</span>
                          </div>
                          
                          {action.type && (
                            <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2">
                              {action.type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
