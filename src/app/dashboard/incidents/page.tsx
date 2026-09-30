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
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Incidents</h1>

      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-1">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn('px-3 py-1 rounded text-xs capitalize transition-colors',
                severityFilter === s ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Detected</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(inc => (
              <tr key={inc.id} className="hover:bg-surface-2 cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/incidents/${inc.id}`)}>
                <td className="px-4 py-3 text-xs font-mono">{inc.id}</td>
                <td className="px-4 py-3 font-medium">{inc.title}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{inc.type.replace('_', ' ')}</td>
                <td className="px-4 py-3 font-mono text-xs">{inc.sourceLot}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase', severityColors[inc.severity])}>{inc.severity}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', incidentStatusColors[inc.status])}>{inc.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(inc.detectedAt)}</td>
                <td className="px-4 py-3"><ArrowRight className="w-3.5 h-3.5 text-muted" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
