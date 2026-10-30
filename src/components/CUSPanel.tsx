'use client';

import React, { useEffect, useState } from 'react';
import { computeCUS, type AffectedNode, type CUSResult } from '@/lib/cus';
import { AlertTriangle, Clock, Factory, Truck, Warehouse, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface CutPoint {
  nodeId: string;
  nodeType: 'productionLine' | 'warehouse' | 'shipment';
  units: number;
  confidence: 'confirmed' | 'probable' | 'unknown';
  hours: number;
  urgency: number;
  description: string;
}

interface CUSPanelProps {
  incidentId: string;
}

export default function CUSPanel({ incidentId }: CUSPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nodes, setNodes] = useState<AffectedNode[]>([]);
  const [cutPoints, setCutPoints] = useState<CutPoint[]>([]);
  const [checkedCutPoints, setCheckedCutPoints] = useState<Set<string>>(new Set());
  const [cusResult, setCusResult] = useState<CUSResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    fetch(`/api/incidents/${incidentId}/cus`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch CUS');
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        if (!json.data) throw new Error('Invalid payload');

        const initialNodes: AffectedNode[] = json.data.affectedNodes || [];
        setNodes(initialNodes);
        setCutPoints(json.data.topCutPoints || []);
        setCusResult(json.data.cus || computeCUS(initialNodes));
        setCheckedCutPoints(new Set());
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [incidentId]);

  const handleToggleCheck = (cutPoint: CutPoint) => {
    const nextChecked = new Set(checkedCutPoints);
    const isNowChecked = !nextChecked.has(cutPoint.nodeId);

    if (isNowChecked) {
      nextChecked.add(cutPoint.nodeId);
    } else {
      nextChecked.delete(cutPoint.nodeId);
    }
    setCheckedCutPoints(nextChecked);

    // Filter out all checked cut point nodes and recalculate client-side live
    const remainingNodes = nodes.filter((n) => !nextChecked.has(n.nodeId));
    const updatedCUS = computeCUS(remainingNodes);
    setCusResult(updatedCUS);
  };

  if (loading || error || !cusResult) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex items-center justify-center gap-3 text-muted-foreground">
        <Clock className="w-5 h-5 animate-pulse text-primary" />
        <span className="text-[14px] font-medium">Urgency data loading...</span>
      </div>
    );
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'productionLine':
        return <Factory className="w-4 h-4 text-warning" />;
      case 'shipment':
        return <Truck className="w-4 h-4 text-critical" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-primary" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
      {/* Section Header */}
      <div className="px-6 py-5 border-b border-border bg-surface-2/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            CONTAMINATION URGENCY (CUS)
          </h3>
        </div>
        <span className="text-[12px] text-muted-foreground hidden sm:inline">
          Real-time contagion spread & surgical intercept priority
        </span>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Metric Cards Row matching LOGIS styling */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Urgency Score */}
          <div className="p-6 rounded-xl border border-border bg-surface-2/40 flex flex-col justify-between">
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
              Urgency Score
            </div>
            <div className="flex items-baseline gap-2 my-2">
              <span
                className={`text-[36px] md:text-[42px] font-bold tabular-nums leading-none tracking-tight ${
                  cusResult.score > 70
                    ? 'text-critical'
                    : cusResult.score > 35
                    ? 'text-warning'
                    : 'text-success'
                }`}
              >
                {cusResult.score}
              </span>
              <span className="text-[15px] font-semibold text-muted-foreground">/ 100</span>
            </div>
            <div className="text-[12px] text-muted-foreground font-medium">
              {cusResult.score > 70
                ? 'High velocity spread — immediate cut required'
                : 'Manageable spread window'}
            </div>
          </div>

          {/* Escaped Units */}
          <div className="p-6 rounded-xl border border-border bg-surface-2/40 flex flex-col justify-between">
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
              Escaped Units
            </div>
            <div className="my-2">
              <span className="text-[32px] md:text-[38px] font-bold tabular-nums leading-none tracking-tight text-critical">
                {formatNumber(cusResult.escapedUnits)}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground font-medium">
              Delivered to retail / consumer hands
            </div>
          </div>

          {/* Interceptable Units */}
          <div className="p-6 rounded-xl border border-border bg-surface-2/40 flex flex-col justify-between">
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
              Interceptable Units
            </div>
            <div className="my-2">
              <span className="text-[32px] md:text-[38px] font-bold tabular-nums leading-none tracking-tight text-success">
                {formatNumber(Math.round(cusResult.interceptableUnits))}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground font-medium">
              Surgically actionable across lines & hubs
            </div>
          </div>
        </div>

        {/* Intercept Actions Section */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
              Top Surgical Intercept Actions (Priority Containment)
            </h4>
            <span className="text-[12px] text-muted-foreground">
              Check to simulate containment & recalculate score live
            </span>
          </div>

          <div className="space-y-2.5">
            {cutPoints.length === 0 ? (
              <div className="text-center py-6 text-[13px] text-muted-foreground border border-dashed border-border rounded-xl">
                No active intercept actions required
              </div>
            ) : (
              cutPoints.map((point) => {
                const isChecked = checkedCutPoints.has(point.nodeId);
                return (
                  <div
                    key={point.nodeId}
                    onClick={() => handleToggleCheck(point)}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-surface-2/30 border-border opacity-50'
                        : 'bg-surface-2/70 border-border hover:border-foreground/20 hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by row onClick
                        className="w-4 h-4 rounded border-border text-primary focus:ring-0 cursor-pointer"
                      />
                      <div className="p-2 rounded-lg bg-surface border border-border">
                        {getNodeIcon(point.nodeType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[14px] font-semibold ${
                              isChecked ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {point.description}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                            {point.nodeId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[12px] text-muted-foreground">
                          <span className="font-medium text-foreground">{formatNumber(point.units)} units</span>
                          <span>•</span>
                          <span>Window: {point.hours}h</span>
                          <span>•</span>
                          <span className="capitalize">{point.confidence} confidence</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[13px] font-mono font-bold text-foreground">
                        Urgency: {formatNumber(Math.round(point.urgency))}
                      </div>
                      {isChecked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Intercepted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
