'use client';

import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="text-sm text-muted-foreground">Generate reports for incidents. Available after impact analysis.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Incident Report', 'Impact Report', 'Recovery Report'].map(type => (
          <button key={type} onClick={() => window.open(`/dashboard/reports/${type.toLowerCase().replace(' ', '-')}/INC-001`, '_blank')}
            className="text-left p-5 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors">
            <BarChart3 className="w-5 h-5 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium mb-1">{type}</h3>
            <p className="text-xs text-muted-foreground">View and print {type.toLowerCase()} for INC-001</p>
          </button>
        ))}
      </div>
    </div>
  );
}
