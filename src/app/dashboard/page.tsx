'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Package, Shield, Warehouse, Store, Truck,
  Activity, Users, BoxSelect, Wrench, ArrowRight, Clock, TrendingDown, ChevronRight
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
      <div className="p-10 space-y-10">
        <div className="skeleton h-12 w-64 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
        <div className="skeleton h-[500px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 space-y-12 max-w-[1800px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">Command Center</h1>
          <p className="text-lg text-muted-foreground mt-3 font-medium">
            Operational overview across all facilities
          </p>
        </div>
      </div>

      {/* Critical Incident Card */}
      {criticalIncident && (
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/10 p-8 lg:p-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 shadow-xl shadow-red-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="flex items-start gap-6 relative z-10">
            <div className="p-4 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 shrink-0 mt-1">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-red-600 text-white uppercase tracking-widest shadow-sm">
                  Critical
                </span>
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Lot {criticalIncident.sourceLot} · {criticalIncident.location}
                </span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">{criticalIncident.title}</h2>
              <p className="text-lg text-foreground/80 max-w-4xl leading-relaxed">{criticalIncident.description}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/incidents/${criticalIncident.id}`)}
            className="shrink-0 relative z-10 inline-flex items-center justify-center gap-3 px-8 py-5 rounded-xl bg-red-600 text-white text-lg font-bold hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-red-600/30 w-full xl:w-auto"
          >
            Investigate Now
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      {impact ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <StatCard label="Affected Units" value={formatNumber(impact.affectedUnits)} icon={Package} trend="critical" />
          <StatCard label="Safe Units" value={formatNumber(impact.safeUnits)} icon={Shield} trend="good" />
          <StatCard label="Uncertain Units" value={formatNumber(impact.uncertainUnits)} icon={AlertTriangle} trend="warning" />
          <StatCard label="Already Sold" value={formatNumber(impact.soldUnits)} icon={Store} trend="info" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <StatCard label="Active Incidents" value={String(incidents.filter(i => i.status !== 'resolved').length)} icon={AlertTriangle} trend="critical" />
          <StatCard label="Pending Analysis" value={String(incidents.filter(i => i.status === 'pending').length)} icon={Clock} trend="warning" />
          <StatCard label="Total Incidents" value={String(incidents.length)} icon={Activity} />
          <StatCard label="System Status" value="Online" icon={Shield} trend="good" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* Left Column: List & Details */}
        <div className="xl:col-span-2 space-y-10">
          
          {/* Estimated Business Impact */}
          {impact && (
            <div className="rounded-2xl border border-border/50 bg-surface p-8 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-wider">Estimated Financial Impact</h3>
                <span className="px-3 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-600 dark:text-purple-400 uppercase tracking-widest">Simulated</span>
              </div>
              <p className="text-6xl font-black tabular-nums text-foreground mt-2 tracking-tight">{formatCurrency(impact.estimatedImpactINR)}</p>
              <p className="text-lg text-muted-foreground mt-4 font-medium">Calculated product value at risk based on real-time unit pricing</p>
            </div>
          )}

          {/* All Incidents */}
          <div className="rounded-2xl border border-border/50 bg-surface shadow-md overflow-hidden">
            <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-surface-2/30">
              <h3 className="text-xl font-bold">Incident Backlog</h3>
              <span className="px-4 py-1.5 rounded-full bg-surface-3 text-sm font-bold text-muted-foreground">
                {incidents.length} Records
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {incidents.map(incident => (
                <button
                  key={incident.id}
                  onClick={() => router.push(`/dashboard/incidents/${incident.id}`)}
                  className="w-full flex flex-col sm:flex-row sm:items-center gap-6 px-8 py-6 text-left hover:bg-surface-2/50 transition-all group"
                >
                  <div className={cn('p-4 rounded-xl shrink-0 transition-transform group-hover:scale-110',
                    incident.severity === 'critical' ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 
                    incident.severity === 'high' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  )}>
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-xl font-bold text-foreground truncate group-hover:text-primary transition-colors">{incident.title}</div>
                    <div className="text-base text-muted-foreground truncate font-medium">
                      {incident.id} · Lot: {incident.sourceLot} · {incident.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4 sm:mt-0 shrink-0">
                    <span className={cn('px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest shrink-0 border-2', 
                      incident.severity === 'critical' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                      incident.severity === 'high' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    )}>
                      {incident.severity}
                    </span>
                    <span className="px-4 py-2 rounded-lg text-sm font-bold bg-surface-3 text-muted-foreground shrink-0 border-2 border-border/50">
                      {incident.status}
                    </span>
                    <ChevronRight className="w-6 h-6 text-muted-foreground/50 group-hover:text-primary transition-colors hidden sm:block ml-2" />
                  </div>
                </button>
              ))}
              {incidents.length === 0 && (
                <div className="px-8 py-16 text-center text-lg text-muted-foreground font-medium">
                  No incidents currently active.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Feeds & Small widgets */}
        <div className="space-y-10">
          
          {/* Facilities Summary */}
          <div className="rounded-2xl border border-border/50 bg-surface p-8 shadow-md">
            <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-wider mb-8">Facility Impact</h3>
            <div className="space-y-6">
              <FacilityRow icon={Warehouse} label="Warehouses" value={impact?.affectedWarehouses ?? '—'} />
              <FacilityRow icon={Store} label="Retail Stores" value={impact?.affectedStores ?? '—'} />
              <FacilityRow icon={Truck} label="Active Shipments" value={impact?.affectedShipments ?? '—'} />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-2xl border border-border/50 bg-surface p-8 shadow-md">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-wider">Activity Feed</h3>
            </div>
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {[
                { time: '2m ago', text: 'New inspection result received — INSP-001 FAIL', type: 'alert' },
                { time: '15m ago', text: 'Temperature monitoring alert — WH-004 exceeded threshold', type: 'warning' },
                { time: '1h ago', text: 'Shipment SH-0089 departed WH-001 to ST-022', type: 'info' },
                { time: '2h ago', text: 'Quality inspection INSP-002 completed — PASS', type: 'success' },
              ].map((event, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={cn('flex items-center justify-center w-6 h-6 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10',
                    event.type === 'alert' ? 'bg-red-500' :
                    event.type === 'warning' ? 'bg-amber-500' :
                    event.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                  )} />
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-surface-2/50 p-4 rounded-xl border border-border/50 shadow-sm">
                    <p className="text-base font-semibold text-foreground mb-1">{event.text}</p>
                    <p className="text-sm font-medium text-muted-foreground">{event.time}</p>
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
    good: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    critical: 'text-red-600 dark:text-red-400 bg-red-500/15 border-red-500/20',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/20',
    info: 'text-blue-600 dark:text-blue-400 bg-blue-500/15 border-blue-500/20',
    default: 'text-muted-foreground bg-surface-3 border-border/50'
  };

  return (
    <div className="rounded-2xl border-2 border-border/40 bg-surface p-8 shadow-md flex flex-col justify-between hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <span className="text-base font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn('p-3 rounded-xl border', trend ? trendColors[trend] : trendColors.default)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-5xl font-black tabular-nums text-foreground tracking-tight">
        {value}
      </p>
    </div>
  );
}

function FacilityRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-2/50 hover:bg-surface-2 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-background border border-border/50 text-muted-foreground shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-base font-bold text-foreground">{label}</span>
      </div>
      <span className="text-xl font-black tabular-nums text-foreground">{value}</span>
    </div>
  );
}

