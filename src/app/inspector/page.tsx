'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, Plus,
  AlertTriangle, ArrowRight, Activity, X
} from 'lucide-react';
import { cn, formatDateTime, severityColors } from '@/lib/utils';
import { toast } from 'sonner';

interface Inspection {
  id: string;
  productId: string;
  batchId: string;
  lotId: string;
  testType: string;
  result: string;
  severity: string | null;
  incidentType: string | null;
  createdAt: string;
}

export default function InspectorPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFlagResult, setShowFlagResult] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [inspRes, incRes] = await Promise.all([
        fetch('/api/inspections'),
        fetch('/api/incidents'),
      ]);
      const inspData = await inspRes.json();
      const incData = await incRes.json();
      setInspections(inspData.data || []);
      setIncidents(incData.data || []);
      setLoading(false);
    } catch { setLoading(false); }
  }

  const todayInspections = inspections;
  const passed = inspections.filter(i => i.result === 'pass').length;
  const failed = inspections.filter(i => i.result === 'fail').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
            <Activity className="w-4 h-4 text-background" />
          </div>
          <span className="font-bold text-sm">LOGIS</span>
          <span className="text-xs text-muted-foreground">Quality Control Center</span>
        </div>
        <div className="flex-1" />
        <span className="px-2 py-1 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">SIMULATED</span>
        <button onClick={() => { document.cookie = 'logis_role=; path=/; max-age=0'; router.push('/'); }}
          className="text-xs text-muted-foreground hover:text-foreground">Switch Role</button>
      </header>

      <div className="p-6 max-w-[1100px] mx-auto space-y-6">
        {/* Counters */}
        <div className="grid grid-cols-4 gap-4">
          <CounterCard icon={ClipboardCheck} label="Today's Inspections" value={todayInspections.length} color="text-blue-400" />
          <CounterCard icon={CheckCircle2} label="Passed" value={passed} color="text-emerald-400" />
          <CounterCard icon={XCircle} label="Failed" value={failed} color="text-red-400" />
          <CounterCard icon={Clock} label="Pending" value={0} color="text-amber-400" />
        </div>

        {/* Actions */}
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
          <Plus className="w-4 h-4" /> Simulate Inspection
        </button>

        {/* Flag Result */}
        {showFlagResult && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-medium text-emerald-400">INCIDENT CREATED</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Lot {showFlagResult} has been flagged. The Operations Manager will see this incident.</p>
            <button onClick={() => { router.push('/dashboard'); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-surface text-sm hover:bg-surface-2 transition-colors">
              Open in LOGIS <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Recent Inspections */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">Recent Inspections</h3>
          </div>
          <div className="divide-y divide-border">
            {inspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-4 px-5 py-3">
                {insp.result === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{insp.testType} — {insp.lotId}</div>
                  <div className="text-xs text-muted-foreground">{insp.productId} / {insp.batchId}</div>
                </div>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase',
                  insp.result === 'pass' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                  {insp.result}
                </span>
                <span className="text-xs text-muted">{formatDateTime(insp.createdAt)}</span>
              </div>
            ))}
            {inspections.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No inspections yet</div>
            )}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-medium">Recent Incidents</h3>
          </div>
          <div className="divide-y divide-border">
            {incidents.map(inc => (
              <div key={inc.id} className="flex items-center gap-4 px-5 py-3">
                <AlertTriangle className={cn('w-4 h-4 shrink-0',
                  inc.severity === 'critical' ? 'text-red-400' : 'text-orange-400')} />
                <div className="flex-1"><div className="text-sm">{inc.title}</div></div>
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase', severityColors[inc.severity])}>
                  {inc.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inspection Modal */}
      {showModal && (
        <InspectionModal
          onClose={() => setShowModal(false)}
          onComplete={(lotId) => {
            setShowModal(false);
            fetchData();
            if (lotId) setShowFlagResult(lotId);
          }}
        />
      )}
    </div>
  );
}

function CounterCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Icon className={cn('w-4 h-4 mb-2', color)} />
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function InspectionModal({ onClose, onComplete }: { onClose: () => void; onComplete: (lotId?: string) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    productId: 'P-001', batchId: 'B51', lotId: 'MILK-204',
    testType: 'microbial_contamination', result: 'fail' as 'pass' | 'fail',
    severity: 'critical' as string, incidentType: 'contamination' as string,
    notes: '',
  });

  async function handleSubmit() {
    try {
      // Create inspection
      await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (form.result === 'fail') {
        // Flag incident
        await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: form.incidentType,
            sourceLot: form.lotId,
            severity: form.severity,
            location: 'NovaFoods Central Hub (WH-001)',
            title: `${form.testType.replace('_', ' ')} — Lot ${form.lotId}`,
            description: `Inspection failed for ${form.testType.replace('_', ' ')} on Lot ${form.lotId}`,
          }),
        });
        toast.success(`Incident flagged for Lot ${form.lotId}`);
        onComplete(form.lotId);
      } else {
        toast.success('Inspection logged — PASS');
        onComplete();
      }
    } catch (e) {
      toast.error('Failed to submit inspection');
      console.error(e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Simulate Inspection</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-2"><X className="w-4 h-4" /></button>
        </div>
        <span className="px-2 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-4 inline-block">SIMULATED</span>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Product</label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none">
              <option value="P-001">P-001 — Nova Fresh Milk 500ml</option>
              <option value="P-002">P-002 — Nova Paneer 200g</option>
              <option value="P-003">P-003 — Product C — Nova Yogurt 400g</option>
              <option value="P-004">P-004 — Product D — Nova Cheese Spread</option>
              <option value="P-005">P-005 — Nova Wheat Bread</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Batch</label>
              <input value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Lot</label>
              <input value={form.lotId} onChange={e => setForm(f => ({ ...f, lotId: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Test Type</label>
            <select value={form.testType} onChange={e => setForm(f => ({ ...f, testType: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none">
              <option value="microbial_contamination">Microbial Contamination</option>
              <option value="chemical_analysis">Chemical Analysis</option>
              <option value="ph_level">pH Level</option>
              <option value="moisture_content">Moisture Content</option>
              <option value="temperature_check">Temperature Check</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Result</label>
            <div className="flex gap-2">
              <button onClick={() => setForm(f => ({ ...f, result: 'pass' }))}
                className={cn('flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  form.result === 'pass' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-border bg-surface-2 text-muted-foreground')}>
                PASS
              </button>
              <button onClick={() => setForm(f => ({ ...f, result: 'fail' }))}
                className={cn('flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  form.result === 'fail' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-border bg-surface-2 text-muted-foreground')}>
                FAIL
              </button>
            </div>
          </div>
          {form.result === 'fail' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Incident Type</label>
                <select value={form.incidentType} onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-surface-2 text-sm outline-none">
                  <option value="contamination">Contamination</option>
                  <option value="temperature_excursion">Temperature Excursion</option>
                  <option value="component_defect">Component Defect</option>
                </select>
              </div>
            </div>
          )}
          <button onClick={handleSubmit}
            className="w-full py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
            {form.result === 'fail' ? 'Flag Incident' : 'Log Inspection'}
          </button>
        </div>
      </div>
    </div>
  );
}
