'use client';

import { useState } from 'react';
import { Settings, RotateCcw, Gauge } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!confirm('Reset the database to the initial seed state? This will undo all changes.')) return;
    setResetting(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
      toast.success('Database reset to initial seed state');
    } catch (e) {
      toast.error('Failed to reset database');
    }
    setResetting(false);
  }

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Demo Controls
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Reset the database to the original seeded demo scenario.</p>
        <button onClick={handleReset} disabled={resetting}
          className="px-5 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
          {resetting ? 'Resetting…' : 'Reset Demo'}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Accessibility
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Reduced motion</span>
            <span className="text-xs text-muted">Uses prefers-reduced-motion</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted text-center space-y-1">
        <p>LOGIS — Product Incident Intelligence & Operational Recovery</p>
        <p>DEMO ENVIRONMENT · Synthetic operational network · All data is simulated</p>
      </div>
    </div>
  );
}
