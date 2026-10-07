'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Shield, Info, Check, Clock, User, AlertTriangle, X, Bot, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);

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
            agentStatus: 'pending',
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

  const updateActionStatus = (id: string, status: 'approved' | 'rejected') => {
    setActions(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          agentStatus: status,
          completed: status === 'approved',
          completedAt: status === 'approved' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
        };
      }
      return a;
    }));
  };

  const approveAll = () => {
    const pendingActions = actions.filter(a => (!a.agentStatus || a.agentStatus === 'pending'));
    if (pendingActions.length === 0) return;
    
    pendingActions.forEach((a, index) => {
      setTimeout(() => {
        setActions(prev => prev.map(action => {
          if (action.id === a.id) {
            return { ...action, agentStatus: 'approved', completed: true, completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
          }
          return action;
        }));
      }, index * 200);
    });

    toast.success(`✓ AI Agent: ${pendingActions.length} hold orders approved and dispatched to WMS`);
  };

  const completedCount = actions.filter(a => a.agentStatus === 'approved').length;
  const totalCount = actions.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  
  const remainingCritical = actions.filter(a => a.priorityLevel === 'critical' && (!a.agentStatus || a.agentStatus === 'pending')).length;
  const remainingHigh = actions.filter(a => a.priorityLevel === 'high' && (!a.agentStatus || a.agentStatus === 'pending')).length;

  const criticalCount = actions.filter(a => a.priorityLevel === 'critical').length;
  const highCount = actions.filter(a => a.priorityLevel === 'high').length;
  const mediumCount = actions.filter(a => a.priorityLevel === 'medium').length;

  const topActions = actions.filter(a => !a.agentStatus || a.agentStatus === 'pending').slice(0, 4);

  if (!mounted) {
    return <div className="px-8 lg:px-10 py-7 "></div>; // Wait for hydration
  }

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-8  text-foreground transition-colors duration-300">
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
          {/* Section 4: Action Tracker Progress */}
          {actions.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Execution Progress</h3>
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
          )}

          {/* Section 1: Decision Impact */}
          {plan?.comparison && (() => {
            const naiveUnits = plan.comparison.naive?.totalUnits || 0;
            const logisUnits = plan.comparison.logis?.totalUnits || 0;
            const unitsSaved = naiveUnits - logisUnits;
            const pctUnits = naiveUnits > 0 ? Math.round((unitsSaved / naiveUnits) * 100) : 0;

            const naiveCost = plan.comparison.naive?.totalCost || 0;
            const logisCost = plan.comparison.logis?.totalCost || 0;
            const costSaved = plan.comparison.costSaved || (naiveCost - logisCost);
            const pctCost = naiveCost > 0 ? Math.round((costSaved / naiveCost) * 100) : 0;

            const naiveTime = plan.comparison.naive?.estimatedTimeHours || 0;
            const logisTime = plan.comparison.logis?.estimatedTimeHours || 0;
            const timeSaved = naiveTime - logisTime;
            const pctTime = naiveTime > 0 ? Math.round((timeSaved / naiveTime) * 100) : 0;

            return (
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-border bg-surface-2/30">
                  <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> LOGIS DECISION IMPACT
                  </h3>
                </div>
                
                <div className="p-8 space-y-8">
                  {/* Hero Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-success/5 border border-success/20 p-6 rounded-xl text-center md:text-left">
                      <div className="text-[32px] md:text-[40px] font-bold text-success tabular-nums leading-none tracking-tight mb-2">
                        {formatNumber(unitsSaved)}
                      </div>
                      <div className="text-[14px] font-medium text-success/80 uppercase tracking-widest">
                        unnecessary recalls avoided
                      </div>
                    </div>
                    <div className="bg-success/5 border border-success/20 p-6 rounded-xl text-center md:text-left">
                      <div className="text-[32px] md:text-[40px] font-bold text-success tabular-nums leading-none tracking-tight mb-2">
                        {formatCurrency(costSaved)}
                      </div>
                      <div className="text-[14px] font-medium text-success/80 uppercase tracking-widest">
                        estimated savings
                      </div>
                    </div>
                  </div>

                  {/* Percentage Improvements */}
                  <div className="grid grid-cols-3 divide-x divide-border bg-surface-2 border border-border rounded-xl">
                    <div className="p-4 text-center">
                      <div className="text-[20px] font-bold text-foreground mb-1">{pctUnits}%</div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Less Disruption</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[20px] font-bold text-foreground mb-1">{pctCost}%</div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Lower Cost</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[20px] font-bold text-foreground mb-1">{pctTime}%</div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Faster Response</div>
                    </div>
                  </div>

                  {/* Before / After Evidence */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
                    <div className="flex-1 space-y-3">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Broad / Naive Response</div>
                      <div className="text-[18px] font-semibold text-foreground tabular-nums">{formatNumber(naiveUnits)} <span className="text-[14px] text-muted-foreground font-normal">units</span></div>
                      <div className="text-[18px] font-semibold text-foreground tabular-nums">{formatCurrency(naiveCost)} <span className="text-[14px] text-muted-foreground font-normal">exposure</span></div>
                      <div className="text-[18px] font-semibold text-foreground tabular-nums">{naiveTime} <span className="text-[14px] text-muted-foreground font-normal">hrs</span></div>
                    </div>

                    <div className="text-muted-foreground">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>

                    <div className="flex-1 space-y-3 text-right md:text-left">
                      <div className="text-[11px] font-bold text-success uppercase tracking-widest flex items-center justify-end md:justify-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> LOGIS Targeted Response
                      </div>
                      <div className="text-[18px] font-semibold text-success tabular-nums">{formatNumber(logisUnits)} <span className="text-[14px] text-success/70 font-normal">units</span></div>
                      <div className="text-[18px] font-semibold text-success tabular-nums">{formatCurrency(logisCost)} <span className="text-[14px] text-success/70 font-normal">exposure</span></div>
                      <div className="text-[18px] font-semibold text-success tabular-nums">{logisTime} <span className="text-[14px] text-success/70 font-normal">hrs</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section 2: AI Response Plan */}
          {actions.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm mt-8">
              <div className="px-6 py-5 border-b border-border bg-surface-2/30">
                <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5">
                  <Bot className="w-4 h-4" /> LOGIS AI RESPONSE PLAN
                </h3>
                <p className="text-[14px] text-foreground font-medium">AI-generated operational actions based on incident impact analysis</p>
              </div>
              
              <div className="px-6 py-4 bg-surface-2 border-b border-border flex flex-wrap items-center gap-6">
                <div className="text-[14px] font-semibold text-foreground">{totalCount} ACTIONS GENERATED</div>
                <div className="flex gap-4">
                  <span className="text-[12px] font-semibold text-critical bg-critical/10 px-2.5 py-1 rounded-full border border-critical/20">{criticalCount} Critical</span>
                  <span className="text-[12px] font-semibold text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">{highCount} High</span>
                  <span className="text-[12px] font-semibold text-muted-foreground bg-surface px-2.5 py-1 rounded-full border border-border">{mediumCount} Medium</span>
                </div>
                <div className="ml-auto">
                  <button onClick={approveAll} className="px-4 py-2 rounded-lg bg-dark-action text-dark-action-fg text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm">
                    <Check className="w-4 h-4" /> Approve All
                  </button>
                </div>
              </div>

              {!showAllActions && (
                <div className="px-6 py-3 bg-surface-2/50 border-b border-border">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Top Priority Decisions</h4>
                </div>
              )}

              <div className="divide-y divide-border">
                <AnimatePresence>
                {(showAllActions ? actions : topActions).map((action, i) => (
                  <motion.div 
                    key={action.id || i}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-5 transition-all duration-300 relative overflow-hidden", 
                      action.agentStatus === 'approved' ? "bg-surface-2/50 opacity-75 border-l-4 border-l-success" : 
                      action.agentStatus === 'rejected' ? "bg-surface-2/30 opacity-60 border-l-4 border-l-critical" :
                      "hover:bg-surface-2/50 border-l-4 border-l-transparent"
                    )}
                  >
                    <div className="flex items-start gap-4 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1.5">
                          <span className={cn(
                            "text-[15px] font-semibold transition-all", 
                            action.agentStatus === 'approved' ? "text-muted-foreground" : 
                            action.agentStatus === 'rejected' ? "text-muted-foreground line-through" :
                            "text-foreground"
                          )}>
                            {action.description || 'Unknown Action'}
                          </span>
                          
                          {/* Priority Badge */}
                          {(!action.agentStatus || action.agentStatus === 'pending') && action.priorityLevel && (
                            <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border', getPriorityColor(action.priorityLevel))}>
                              {action.priorityLevel} Priority
                            </span>
                          )}

                          {/* Completion / Overdue Status */}
                          {action.agentStatus === 'approved' ? (
                            <span className="text-[12px] font-medium text-success flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Approved by {action.owner} at {action.completedAt}
                            </span>
                          ) : action.agentStatus === 'rejected' ? (
                            <span className="text-[12px] font-medium text-critical flex items-center gap-1">
                              <X className="w-3.5 h-3.5" /> Rejected
                            </span>
                          ) : action.isOverdue ? (
                            <span className="text-[12px] font-bold text-critical flex items-center gap-1 uppercase tracking-wider bg-critical/10 px-2 py-0.5 rounded border border-critical/30">
                              <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                            </span>
                          ) : null}
                        </div>
                        
                        <p className={cn("text-[13px] mb-4 max-w-3xl text-muted-foreground")}>
                          {action.reason || 'No specific reason provided.'}
                        </p>
                        
                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-medium text-muted-foreground">
                          {action.owner && (!action.agentStatus || action.agentStatus === 'pending' || action.agentStatus === 'rejected') && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4 opacity-70" />
                              <span>{action.owner}</span>
                            </div>
                          )}
                          
                          {(!action.agentStatus || action.agentStatus === 'pending') && action.dueTime && (
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

                        {/* Feature 1: AI Explainability Trigger */}
                        <button 
                          onClick={() => setExpandedActionId(prev => prev === action.id ? null : action.id)}
                          className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="w-4 h-4" /> Why this action?
                        </button>
                        
                        {/* Feature 1: AI Explainability Panel */}
                        <AnimatePresence>
                          {expandedActionId === action.id && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden mt-3"
                            >
                              <div className="p-4 bg-surface-2 rounded-xl border border-border">
                                <div>
                                  <h4 className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Bot className="w-3.5 h-3.5" /> AI Recommendation Reasoning
                                  </h4>
                                  <p className="text-[13px] text-muted-foreground leading-relaxed italic border-l-2 border-border pl-3 mt-2">
                                    "{action.reason || 'Automatically drafted based on impact boundaries.'}"
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>
                      
                      {/* Action Buttons */}
                      {(!action.agentStatus || action.agentStatus === 'pending') && (
                        <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => updateActionStatus(action.id, 'approved')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition-colors text-[13px] font-semibold"
                          >
                            <Check className="w-4 h-4" /> Approve
                          </button>
                          <button 
                            onClick={() => updateActionStatus(action.id, 'rejected')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-critical/10 text-critical border border-critical/20 hover:bg-critical hover:text-white transition-colors text-[13px] font-semibold"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>

              {/* View all toggle */}
              {!showAllActions && actions.length > topActions.length && (
                <div className="p-4 border-t border-border bg-surface-2/30 text-center">
                  <button onClick={() => setShowAllActions(true)} className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    Review all {totalCount} actions ↓
                  </button>
                </div>
              )}
              {showAllActions && (
                <div className="p-4 border-t border-border bg-surface-2/30 text-center">
                  <button onClick={() => setShowAllActions(false)} className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    Show top priorities ↑
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Intelligent Alert Routing */}
          <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm mt-8">
            <div className="px-6 py-5 border-b border-border bg-surface-2/30 flex flex-col gap-1">
              <h3 className="text-[16px] font-semibold text-foreground">Intelligent Alert Routing</h3>
              <p className="text-[13px] text-muted-foreground">AI analyzed the impact graph and routed alerts only to stakeholders with active exposure — 12 others were NOT paged.</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { severity: 'critical', role: 'Warehouse MGR — East Hub', reason: 'Batch WH-2291 in active storage', status: 'PAGED 2m ago', color: 'bg-critical' },
                { severity: 'warning', role: 'Quality Lead — AlphaCorp Site', reason: 'Source supplier flagged', status: 'NOTIFIED', color: 'bg-warning' },
                { severity: 'success', role: 'Logistics Coordinator', reason: 'Downstream shipment SHP-441 in transit', status: 'MONITORING', color: 'bg-success' },
                { severity: 'info', role: 'Store Operations — 3 locations', reason: 'Retail inventory at risk', status: 'ALERTED', color: 'bg-[#4B8BBE]' }
              ].map((route, i) => (
                <div key={i} className="p-5 hover:bg-surface-2/50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-3 h-3 rounded-full shrink-0 shadow-sm", route.color)} />
                    <div>
                      <div className="text-[14px] font-semibold text-foreground">{route.role}</div>
                      <div className="text-[13px] text-muted-foreground mt-0.5">Reason: {route.reason}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2 text-foreground">
                      {route.status}
                    </span>
                    <button className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                      View Details
                    </button>
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
