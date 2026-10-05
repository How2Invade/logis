'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Search, Filter } from 'lucide-react';
import { cn, severityColors, incidentStatusColors, formatDateTime } from '@/lib/utils';
import type { Incident } from '@/lib/types';

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/incidents')
      .then(r => r.json())
      .then(d => { setIncidents(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = incidents.filter(i => {
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.id.toLowerCase().includes(search.toLowerCase()) && !i.sourceLot.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-6"><div className="skeleton h-64 rounded-lg" /></div>;

  return (
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Incidents</h1>
        <p className="text-[14px] text-muted-foreground">Manage and track active supply chain disruptions</p>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface flex-1 max-w-sm shadow-sm transition-colors">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents…"
            className="flex-1 bg-transparent text-[14px] font-medium text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-sm">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn('px-4 py-1.5 rounded-full text-[13px] font-semibold capitalize transition-all duration-300',
                severityFilter === s ? 'bg-dark-action text-dark-action-fg' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Detected</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(inc => {
              const sColor = inc.severity === 'critical' ? 'var(--color-critical)' : inc.severity === 'high' ? 'var(--color-warning)' : 'var(--color-muted-foreground)';
              return (
              <tr key={inc.id} className="hover:bg-surface-2 cursor-pointer transition-colors border-b border-border/50 last:border-0"
                onClick={() => router.push(`/dashboard/incidents/${inc.id}`)}>
                <td className="px-6 py-4 text-[13px] font-mono text-muted-foreground">{inc.id}</td>
                <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{inc.title}</td>
                <td className="px-6 py-4 text-[13px] text-muted-foreground capitalize">{inc.type.replace('_', ' ')}</td>
                <td className="px-6 py-4 font-mono text-[13px] text-foreground">{inc.sourceLot}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2" style={{ color: sColor }}>{inc.severity}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border bg-surface-2 text-muted-foreground">{inc.status}</span>
                </td>
                <td className="px-6 py-4 text-[13px] text-muted-foreground">{formatDateTime(inc.detectedAt)}</td>
                <td className="px-6 py-4 text-right"><ArrowRight className="w-4 h-4 text-muted-foreground inline" /></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
