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
    <div className="px-8 lg:px-10 py-7 max-w-[1400px] mx-auto space-y-6 min-h-screen text-foreground transition-colors duration-300">
      <div>
        <h1 className="text-[32px] font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-[14px] text-muted-foreground">Manage environment and preferences</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-muted-foreground" /> Demo Controls
        </h3>
        <p className="text-[13px] text-muted-foreground mb-6">Reset the database to the original seeded demo scenario.</p>
        <button onClick={handleReset} disabled={resetting}
          className="px-6 py-2.5 rounded-full bg-surface-2 border border-border text-critical text-[14px] font-semibold hover:bg-surface transition-colors disabled:opacity-50 shadow-sm">
          {resetting ? 'Resetting…' : 'Reset Demo'}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" /> Accessibility
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-foreground font-medium">Reduced motion</span>
            <span className="text-[13px] text-muted-foreground">Uses prefers-reduced-motion</span>
          </div>
        </div>
      </div>
      
      <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground text-center space-y-1 mt-10 pt-8 border-t border-border/50">
        <p>LOGIS — Product Incident Intelligence & Operational Recovery</p>
        <p>DEMO ENVIRONMENT · Synthetic operational network · All data is simulated</p>
      </div>
    </div>
  );
}
