'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Package, Shield, Warehouse, Store, Truck,
  Activity, Users, BoxSelect, Wrench, ArrowRight, Clock, TrendingDown
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, severityColors, incidentStatusColors } from '@/lib/utils';
import type { Incident, ImpactResult, RecoveryResult } from '@/lib/types';

export default function DashboardOverview() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      setIncidents(data.data || []);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch incidents', e);
      setLoading(false);
    }
  }

  const criticalIncident = incidents.find(i => i.severity === 'critical' && i.status !== 'resolved');

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div className="skeleton h-8 w-48 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-base text-muted-foreground mt-1">
            Operational overview across all facilities
          </p>
        </div>
      </div>

      {/* Critical Incident Card */}
      {criticalIncident && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Critical
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Lot {criticalIncident.sourceLot} · {criticalIncident.location}
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">{criticalIncident.title}</h2>
              <p className="text-sm text-foreground/80 max-w-3xl">{criticalIncident.description}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/incidents/${criticalIncident.id}`)}
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors shadow-sm"
          >
            Investigate Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      {impact ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Affected Units" value={formatNumber(impact.affectedUnits)} icon={Package} trend="critical" />
          <StatCard label="Safe Units" value={formatNumber(impact.safeUnits)} icon={Shield} trend="good" />
          <StatCard label="Uncertain Units" value={formatNumber(impact.uncertainUnits)} icon={AlertTriangle} trend="warning" />
          <StatCard label="Already Sold" value={formatNumber(impact.soldUnits)} icon={Store} trend="info" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Active Incidents" value={String(incidents.filter(i => i.status !== 'resolved').length)} icon={AlertTriangle} trend="critical" />
          <StatCard label="Pending Analysis" value={String(incidents.filter(i => i.status === 'pending').length)} icon={Clock} trend="warning" />
          <StatCard label="Total Incidents" value={String(incidents.length)} icon={Activity} />
          <StatCard label="System Status" value="Online" icon={Shield} trend="good" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: List & Details */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Estimated Business Impact */}
          {impact && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Estimated Financial Impact</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 uppercase tracking-widest">Simulated</span>
              </div>
              <p className="text-4xl font-extrabold tabular-nums text-foreground mt-2">{formatCurrency(impact.estimatedImpactINR)}</p>
              <p className="text-sm text-muted-foreground mt-2">Calculated product value at risk based on real-time unit pricing</p>
            </div>
          )}

          {/* All Incidents */}
          <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface-2/50">
              <h3 className="text-base font-semibold">Incident Backlog</h3>
              <span className="px-2.5 py-1 rounded-full bg-surface-3 text-xs font-medium text-muted-foreground">
                {incidents.length} Records
              </span>
            </div>
            <div className="divide-y divide-border">
              {incidents.map(incident => (
                <button
                  key={incident.id}
                  onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                  className="w-full flex items-center gap-5 px-6 py-4 text-left hover:bg-surface-2 transition-colors group"
                >
                  <div className={cn('p-2 rounded-lg shrink-0',
                    incident.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 
                    incident.severity === 'high' ? 'bg-orange-500/10 text-orange-500' : 'bg-amber-500/10 text-amber-500'
                  )}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate mb-1 group-hover:text-primary transition-colors">{incident.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {incident.id} · Lot: {incident.sourceLot} · {incident.type}
                    </div>
                  </div>
                  <span className={cn('px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider shrink-0 border', 
                    incident.severity === 'critical' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                    incident.severity === 'high' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 
                    'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  )}>
                    {incident.severity}
                  </span>
                  <span className="px-3 py-1 rounded-md text-xs font-medium bg-surface-3 text-muted-foreground shrink-0 border border-border">
                    {incident.status}
                  </span>
                </button>
              ))}
              {incidents.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No incidents currently active.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Feeds & Small widgets */}
        <div className="space-y-8">
          
          {/* Facilities Summary */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Facility Impact</h3>
            <div className="space-y-5">
              <FacilityRow icon={Warehouse} label="Warehouses" value={impact?.affectedWarehouses ?? '—'} />
              <FacilityRow icon={Store} label="Retail Stores" value={impact?.affectedStores ?? '—'} />
              <FacilityRow icon={Truck} label="Active Shipments" value={impact?.affectedShipments ?? '—'} />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Activity Feed</h3>
            </div>
            <div className="space-y-6">
              {[
                { time: '2m ago', text: 'New inspection result received — INSP-001 FAIL', type: 'alert' },
                { time: '15m ago', text: 'Temperature monitoring alert — WH-004 exceeded threshold', type: 'warning' },
                { time: '1h ago', text: 'Shipment SH-0089 departed WH-001 to ST-022', type: 'info' },
                { time: '2h ago', text: 'Quality inspection INSP-002 completed — PASS', type: 'success' },
              ].map((event, i) => (
                <div key={i} className="flex gap-4">
                  <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm border border-white dark:border-surface',
                    event.type === 'alert' ? 'bg-red-500' :
                    event.type === 'warning' ? 'bg-amber-500' :
                    event.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend }: {
  label: string; value: string; icon: any; trend?: 'good' | 'critical' | 'warning' | 'info';
}) {
  const trendColors = {
    good: 'text-emerald-500 bg-emerald-500/10',
    critical: 'text-red-500 bg-red-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    info: 'text-blue-500 bg-blue-500/10',
    default: 'text-muted-foreground bg-surface-2'
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between hover:border-muted transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <div className={cn('p-2 rounded-lg', trend ? trendColors[trend] : trendColors.default)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
    </div>
  );
}

function FacilityRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-surface-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
