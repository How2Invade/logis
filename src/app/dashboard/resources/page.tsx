'use client';

import { useEffect, useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Wrench, Users, Warehouse, Truck, Search } from 'lucide-react';

export default function ResourcesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'machines' | 'workers' | 'warehouses' | 'trucks'>('machines');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/resources').then(r => r.json()).then(d => { setData(d.data); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-lg" /></div>;
  if (!data) return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto min-h-screen">
      <div className="rounded-2xl border border-border bg-surface p-16 text-center shadow-sm">
        <h3 className="text-[16px] font-semibold text-foreground mb-2">RESOURCE MANAGEMENT</h3>
        <p className="text-[14px] text-muted-foreground">No resource constraints detected.</p>
      </div>
    </div>
  );

  const tabs = [
    { id: 'machines' as const, label: 'Machines', icon: Wrench, count: data.machines.length },
    { id: 'workers' as const, label: 'Workers', icon: Users, count: data.workers.length },
    { id: 'warehouses' as const, label: 'Warehouses', icon: Warehouse, count: data.warehouses.length },
    { id: 'trucks' as const, label: 'Trucks', icon: Truck, count: data.trucks.length },
  ];

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Resources</h1>
        <p className="text-[14px] text-muted-foreground">Manage machines, workers, warehouses, and trucks</p>
      </div>
      
      <div className="flex gap-2 border-b border-border pb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-semibold transition-colors',
              tab === t.id ? 'bg-dark-action text-dark-action-fg shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-2')}>
            <t.icon className="w-4 h-4" />
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-surface max-w-xs shadow-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-muted-foreground" />
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
        {tab === 'machines' && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4 text-right">Capacity/Day</th>
                <th className="px-6 py-4">Compatible</th>
                <th className="px-6 py-4 text-right">Utilization</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.machines.filter((m: any) => !search || m.name.toLowerCase().includes(search.toLowerCase())).map((m: any) => (
                <tr key={m.id} className="hover:bg-surface-2 border-b border-border/50 last:border-0 transition-colors h-[52px]">
                  <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">{m.id}</td>
                  <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{m.name}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{formatNumber(m.capacityPerDay)}</td>
                  <td className="px-6 py-4 text-[13px] text-muted-foreground">{m.compatibleProducts.join(', ')}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{Math.round(m.utilization * 100)}%</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2',
                      m.status === 'running' ? 'text-success' :
                      m.status === 'idle' ? 'text-warning' : 'text-critical')}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'workers' && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Skills</th>
                <th className="px-6 py-4 text-right">Shift</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.workers.filter((w: any) => !search || w.name.toLowerCase().includes(search.toLowerCase())).map((w: any) => (
                <tr key={w.id} className="hover:bg-surface-2 border-b border-border/50 last:border-0 transition-colors h-[52px]">
                  <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">{w.id}</td>
                  <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{w.name}</td>
                  <td className="px-6 py-4 text-[13px] text-muted-foreground">{w.skills.join(', ')}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{w.shiftHours}h</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2',
                      w.available ? 'text-success' : 'text-critical')}>{w.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'warehouses' && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-right">Capacity</th>
                <th className="px-6 py-4 text-right">Free Slots</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.warehouses.map((w: any) => (
                <tr key={w.id} className="hover:bg-surface-2 border-b border-border/50 last:border-0 transition-colors h-[52px]">
                  <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">{w.id}</td>
                  <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{w.name}</td>
                  <td className="px-6 py-4 text-[13px] text-muted-foreground">{w.location}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{formatNumber(w.capacity)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{formatNumber(w.freeSlots)}</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2',
                      w.available ? 'text-success' : 'text-critical')}>{w.available ? 'Available' : 'Unavailable'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'trucks' && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4 text-right">Capacity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.trucks.map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-2 border-b border-border/50 last:border-0 transition-colors h-[52px]">
                  <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">{t.id}</td>
                  <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{t.name}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-[13px] text-foreground">{formatNumber(t.capacity)}</td>
                  <td className="px-6 py-4">
                    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2',
                      t.status === 'available' ? 'text-success' :
                      t.status === 'in_use' ? 'text-primary' : 'text-critical')}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-muted-foreground">{t.currentRoute || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
