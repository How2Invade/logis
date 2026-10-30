'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Clock, FileCheck, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export type CleanStockItem = {
  nodeId: string;
  units: number;
  warehouseName: string;
  lotId: string;
};

interface CleanStockCardProps {
  incidentId: string;
}

export default function CleanStockCard({ incidentId }: CleanStockCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [releaseCandidates, setReleaseCandidates] = useState<CleanStockItem[]>([]);
  const [holdList, setHoldList] = useState<CleanStockItem[]>([]);
  const [pendingQASet, setPendingQASet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    fetch(`/api/incidents/${incidentId}/clean-stock`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch clean stock data');
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        if (!json.data) throw new Error('Invalid response');
        setReleaseCandidates(json.data.releaseCandidates || []);
        setHoldList(json.data.hold || []);
        setPendingQASet(new Set());
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

  const handleRequestQA = (nodeId: string) => {
    setPendingQASet((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  };

  if (loading || error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex items-center justify-center gap-3 text-muted-foreground">
        <Clock className="w-5 h-5 animate-pulse text-primary" />
        <span className="text-[14px] font-medium">Clean stock evaluation loading...</span>
      </div>
    );
  }

  const totalCandidateUnits = releaseCandidates.reduce((sum, item) => sum + item.units, 0);
  const totalHoldUnits = holdList.reduce((sum, item) => sum + item.units, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
      {/* Header exactly matching CUSPanel style */}
      <div className="px-6 py-5 border-b border-border bg-surface-2/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-success" />
          <h3 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            CLEAN STOCK VELOCITY & HOLD EVALUATION
          </h3>
        </div>
        <span className="text-[12px] text-muted-foreground hidden sm:inline">
          Hold-by-default isolation · Zero auto-release
        </span>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Metric Badges Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-border bg-surface-2/40 flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
                Release Candidates (Lineage Cleared)
              </div>
              <div className="text-[32px] md:text-[38px] font-bold text-success tabular-nums leading-none tracking-tight my-2">
                {formatNumber(totalCandidateUnits)} <span className="text-[14px] font-normal text-muted-foreground">units</span>
              </div>
              <div className="text-[12px] text-muted-foreground font-medium">
                Verified zero connection to source lot
              </div>
            </div>
            <span className="text-[11px] px-3 py-1 rounded-full bg-success/10 text-success font-semibold border border-success/20">
              {releaseCandidates.length} Pallets
            </span>
          </div>

          <div className="p-6 rounded-xl border border-border bg-surface-2/40 flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
                Active Hold (Affected / Ambiguous)
              </div>
              <div className="text-[32px] md:text-[38px] font-bold text-critical tabular-nums leading-none tracking-tight my-2">
                {formatNumber(totalHoldUnits)} <span className="text-[14px] font-normal text-muted-foreground">units</span>
              </div>
              <div className="text-[12px] text-muted-foreground font-medium">
                Quarantined pending lab clearance
              </div>
            </div>
            <span className="text-[11px] px-3 py-1 rounded-full bg-critical/10 text-critical font-semibold border border-critical/20">
              {holdList.length} Pallets
            </span>
          </div>
        </div>

        {/* Two Equal-Width Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Column 1: Release Candidates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-[12px] font-bold text-success uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Release Candidates ({releaseCandidates.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">Requires manual QA sign-off</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {releaseCandidates.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-muted-foreground border border-dashed border-border rounded-xl">
                  No pallets cleared for release
                </div>
              ) : (
                releaseCandidates.map((item) => {
                  const isPending = pendingQASet.has(item.nodeId);
                  return (
                    <div
                      key={item.nodeId}
                      className="p-4 rounded-xl border border-border bg-surface-2/70 hover:border-foreground/20 hover:bg-surface-2 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-foreground truncate">
                          {item.warehouseName}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span
                            title={item.nodeId}
                            className="font-mono text-foreground max-w-[130px] truncate block"
                          >
                            {item.nodeId}
                          </span>
                          <span>•</span>
                          <span className="truncate">Lot: <span className="font-mono text-foreground">{item.lotId}</span></span>
                          <span>•</span>
                          <span className="font-medium text-foreground whitespace-nowrap">{formatNumber(item.units)} units</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isPending ? (
                          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-[11px] font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Pending QA
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestQA(item.nodeId)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-foreground/30 text-foreground text-[11px] font-semibold transition-all shadow-2xs hover:bg-surface-2 cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-primary" /> Request QA sign-off
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Active Hold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-[12px] font-bold text-critical uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> Locked / On Hold ({holdList.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">Direct lineage or unmapped records</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {holdList.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-muted-foreground border border-dashed border-border rounded-xl">
                  No pallets on active hold
                </div>
              ) : (
                holdList.map((item) => (
                  <div
                    key={item.nodeId}
                    className="p-4 rounded-xl border border-border bg-surface-2/40 opacity-80 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {item.warehouseName}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span
                          title={item.nodeId}
                          className="font-mono text-foreground max-w-[130px] truncate block"
                        >
                          {item.nodeId}
                        </span>
                        <span>•</span>
                        <span className="truncate">Lot: <span className="font-mono text-foreground">{item.lotId}</span></span>
                        <span>•</span>
                        <span className="font-medium text-foreground whitespace-nowrap">{formatNumber(item.units)} units</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-critical/10 text-critical text-[11px] font-semibold border border-critical/30">
                        <Lock className="w-3.5 h-3.5" /> Mandatory Hold
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
