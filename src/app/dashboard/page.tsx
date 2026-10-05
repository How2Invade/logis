'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, Play } from 'lucide-react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { StatCard, StatusBadge, SectionHeader, WorkflowStepper, ActivityItem } from '@/components/ui-logis';
import type { Incident, ImpactResult } from '@/lib/types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [responseStats, setResponseStats] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [incRes, impRes, rspRes] = await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/incidents/INC-001/analyze', { method: 'POST' }),
          fetch('/api/incidents/INC-001/response', { method: 'POST' })
        ]);
        
        const incData = await incRes.json();
        const impData = await impRes.json();
        const rspData = await rspRes.json();
        
        setIncidents(incData.data || []);
        setImpact(impData.data);
        if (rspData.data) {
           setResponseStats(rspData.data.comparison);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  const criticalIncident = incidents.find(i => i.severity === 'critical');

  const inventoryData = impact ? [
    { name: 'Affected', value: impact.affectedUnits, color: 'var(--color-critical)' },
    { name: 'Needs Verification', value: impact.uncertainUnits, color: 'var(--color-warning)' },
    { name: 'Safe', value: impact.safeUnits, color: 'var(--color-success)' },
    { name: 'Already Sold', value: impact.soldUnits, color: 'var(--color-muted-foreground)' },
  ] : [];

  const performanceData = responseStats ? [
    { 
      name: 'Recalled', 
      'Naive': responseStats.naive.totalUnits, 
      'LOGIS': responseStats.logis.totalUnits 
    },
    { 
      name: 'Cost (k)', 
      'Naive': responseStats.naive.totalCost / 1000, 
      'LOGIS': responseStats.logis.totalCost / 1000 
    }
  ] : [];

  if (loading) return (
    <div className="p-6 h-screen flex items-center justify-center">
      <div className="skeleton w-12 h-12 rounded-full mx-auto animate-pulse" />
    </div>
  );

  return (
    <div className="px-8 lg:px-10 py-6 max-w-[1400px] mx-auto space-y-4 min-h-screen text-foreground transition-colors duration-300">
      
      {/* 1. Header (Compact) */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold text-foreground mb-0.5">LOGIS Command Center</h1>
          <p className="text-[13px] text-muted-foreground">Live view of incidents, impact and recovery</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Synthetic data</span>
          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground bg-surface-2 shadow-sm">
            Demo Environment
          </span>
        </div>
      </div>

      {/* 2. Process Stepper (Compact) */}
      <div className="flex items-center justify-between py-1 h-[40px]">
        <WorkflowStepper currentStep={2} />
        <button onClick={() => router.push('/dashboard/impact')} className="flex items-center gap-2 px-4 py-2 bg-dark-action text-dark-action-fg rounded-full shadow-sm text-[13px] font-semibold hover:opacity-90 transition-opacity">
          Next Action: Analyze Impact <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Incident Card (One horizontal row, compact) */}
      {criticalIncident && (
        <div className="h-[76px] rounded-xl border border-border border-l-[4px] border-l-critical bg-surface shadow-sm px-5 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-2.5 h-2.5 rounded-full bg-critical animate-pulse shrink-0" />
            <div className="flex items-center gap-3 min-w-0">
              <StatusBadge status="Critical" color="var(--color-critical)" />
              <h2 className="text-[14px] font-semibold truncate text-foreground">{criticalIncident.title}</h2>
              <span className="text-[13px] text-muted-foreground truncate hidden md:inline-block">
                — {criticalIncident.sourceLot} · {criticalIncident.location}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/incidents/${criticalIncident.id}`)}
            className="shrink-0 px-5 py-2 bg-dark-action text-dark-action-fg rounded-full text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-sm ml-4"
          >
            Investigate
          </button>
        </div>
      )}

      {/* 4. KPI Cards (Compact, ~120px) */}
      <div className="grid grid-cols-4 gap-4">
        <CompactStatCard 
          label="Confirmed Affected" 
          value={impact ? formatNumber(impact.affectedUnits) : '—'} 
          percent={impact ? Math.round((impact.affectedUnits / impact.totalUnits) * 100) : 0} 
          color="var(--color-critical)" 
        />
        <CompactStatCard 
          label="Needs Verification" 
          value={impact ? formatNumber(impact.uncertainUnits) : '—'} 
          percent={impact ? Math.round((impact.uncertainUnits / impact.totalUnits) * 100) : 0} 
          color="var(--color-warning)" 
        />
        <CompactStatCard 
          label="No Link / Safe" 
          value={impact ? formatNumber(impact.safeUnits) : '—'} 
          percent={impact ? Math.round((impact.safeUnits / impact.totalUnits) * 100) : 0} 
          color="var(--color-success)" 
        />
        <CompactStatCard 
          label="Already Sold" 
          value={impact ? formatNumber(impact.soldUnits) : '—'} 
          percent={impact ? Math.round((impact.soldUnits / impact.totalUnits) * 100) : 0} 
          color="var(--color-muted-foreground)" 
        />
      </div>

      {/* 5. Analytics Row (50/50, identical height ~220px) */}
      <div className="grid grid-cols-2 gap-4 h-[220px]">
        {/* Affected Inventory Donut */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col h-full transition-colors duration-300">
          <SectionHeader title="Affected Inventory" />
          <div className="flex-1 flex items-center justify-between min-h-0 mt-2">
             <div className="w-[45%] h-full relative">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={inventoryData}
                     cx="50%"
                     cy="50%"
                     innerRadius={40}
                     outerRadius={65}
                     paddingAngle={2}
                     dataKey="value"
                     stroke="none"
                   >
                     {inventoryData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip 
                     formatter={(value: any) => formatNumber(value)}
                     contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px' }}
                     itemStyle={{ color: 'var(--color-foreground)', padding: 0 }}
                   />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="w-[55%] space-y-2.5 pl-2">
                {inventoryData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground font-medium">{item.name}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(item.value)}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Response Performance Bar */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col h-full transition-colors duration-300 relative">
          <div className="flex items-center justify-between">
            <SectionHeader title="Response Performance" />
            {responseStats && (
               <div className="text-[11px] font-bold text-success flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded border border-success/20">
                 Saved {responseStats.logis.estimatedTimeHours}h
               </div>
            )}
          </div>
          <div className="flex-1 min-h-0 mt-4 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip 
                  cursor={{ fill: 'var(--color-surface-2)' }}
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-foreground)', padding: 0 }}
                  formatter={(value: any, name: any) => [name.includes('Cost') ? formatCurrency(value * 1000) : formatNumber(value), name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', color: 'var(--color-muted-foreground)', bottom: -5 }} />
                <Bar dataKey="Naive" fill="var(--color-border)" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="LOGIS" fill="var(--color-success)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. Lower Section (70/30) */}
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 h-[300px]">
        {/* Incident Backlog */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col h-full transition-colors duration-300">
          <SectionHeader title="Incident Backlog" />
          <div className="flex-1 overflow-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="pb-2 font-bold">Severity</th>
                  <th className="pb-2 font-bold">Incident</th>
                  <th className="pb-2 font-bold">Lot</th>
                  <th className="pb-2 font-bold">Type</th>
                  <th className="pb-2 font-bold">Status</th>
                  <th className="pb-2 font-bold">Detected</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {incidents.slice(0, 5).map(inc => {
                  const sColor = inc.severity === 'critical' ? 'var(--color-critical)' : inc.severity === 'high' ? 'var(--color-warning)' : 'var(--color-muted-foreground)';
                  return (
                    <tr key={inc.id} className="hover:bg-surface-2 cursor-pointer transition-colors group h-[36px]" onClick={() => router.push(`/dashboard/incidents/${inc.id}`)}>
                      <td className="py-1 pr-3"><StatusBadge status={inc.severity} color={sColor} /></td>
                      <td className="py-1 pr-3 text-[12px] font-semibold truncate max-w-[120px] text-foreground">{inc.title}</td>
                      <td className="py-1 pr-3 text-[12px] text-muted-foreground">{inc.sourceLot}</td>
                      <td className="py-1 pr-3 text-[12px] text-muted-foreground capitalize">{inc.type.replace('_', ' ')}</td>
                      <td className="py-1 pr-3"><StatusBadge status={inc.status} color="var(--color-muted-foreground)" /></td>
                      <td className="py-1 pr-3 text-[12px] text-muted-foreground tabular-nums">Just now</td>
                      <td className="py-1 pr-1 text-right"><ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground inline" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Stack: Facility Impact */}
        <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col h-full transition-colors duration-300">
          <SectionHeader title="Facility Impact" />
          <div className="flex-1 flex flex-col justify-center gap-6 mt-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Warehouses</div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">{impact ? impact.affectedWarehouses : '—'}</div>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Stores</div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">{impact ? impact.affectedStores : '—'}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Shipments</div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">{impact ? impact.affectedShipments : '—'}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function CompactStatCard({ label, value, percent, color }: { label: string; value: string | number; percent: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between h-[120px] relative overflow-hidden group hover:border-foreground/20 transition-colors">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground z-10">{label}</div>
      <div className="text-[32px] font-semibold tabular-nums text-foreground leading-none z-10">{value}</div>
      
      {/* Mini Progress Bar */}
      <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden z-10 mt-2 border border-border">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      
      <div className="absolute top-4 right-4 text-[12px] font-bold opacity-60 z-10" style={{ color }}>{percent}%</div>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5 transition-transform group-hover:scale-150 duration-500" style={{ backgroundColor: color }} />
    </div>
  );
}
