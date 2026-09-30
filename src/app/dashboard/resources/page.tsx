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
  if (!data) return null;

  const tabs = [
    { id: 'machines' as const, label: 'Machines', icon: Wrench, count: data.machines.length },
    { id: 'workers' as const, label: 'Workers', icon: Users, count: data.workers.length },
    { id: 'warehouses' as const, label: 'Warehouses', icon: Warehouse, count: data.warehouses.length },
    { id: 'trucks' as const, label: 'Trucks', icon: Truck, count: data.trucks.length },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Resources</h1>
      
      <div className="flex gap-2 border-b border-border pb-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors',
              tab === t.id ? 'bg-surface-2 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-4 h-4" />
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface max-w-xs">
        <Search className="w-3.5 h-3.5 text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {tab === 'machines' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Capacity/Day</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Compatible</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Utilization</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.machines.filter((m: any) => !search || m.name.toLowerCase().includes(search.toLowerCase())).map((m: any) => (
                <tr key={m.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5 font-mono text-xs">{m.id}</td>
                  <td className="px-4 py-2.5 font-medium">{m.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(m.capacityPerDay)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.compatibleProducts.join(', ')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(m.utilization * 100)}%</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium',
                      m.status === 'running' ? 'bg-emerald-500/15 text-emerald-400' :
                      m.status === 'idle' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400')}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'workers' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Skills</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Shift</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.workers.filter((w: any) => !search || w.name.toLowerCase().includes(search.toLowerCase())).map((w: any) => (
                <tr key={w.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5 font-mono text-xs">{w.id}</td>
                  <td className="px-4 py-2.5 font-medium">{w.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{w.skills.join(', ')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{w.shiftHours}h</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium',
                      w.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{w.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'warehouses' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Capacity</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Free Slots</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.warehouses.map((w: any) => (
                <tr key={w.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5 font-mono text-xs">{w.id}</td>
                  <td className="px-4 py-2.5 font-medium">{w.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{w.location}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(w.capacity)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(w.freeSlots)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium',
                      w.available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{w.available ? 'Available' : 'Unavailable'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'trucks' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Capacity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Route</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {data.trucks.map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5 font-mono text-xs">{t.id}</td>
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(t.capacity)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium',
                      t.status === 'available' ? 'bg-emerald-500/15 text-emerald-400' :
                      t.status === 'in_use' ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400')}>{t.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.currentRoute || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
