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
          <div className="w-6 h-6 rounded bg-dark-action flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-dark-action-fg" />
          </div>
          <span className="font-bold text-[14px] tracking-widest">LOGIS</span>
          <span className="text-xs text-muted-foreground">Quality Control Center</span>
        </div>
        <div className="flex-1" />
        <span className="px-2 py-1 rounded text-[10px] bg-warning/10 text-warning border border-warning/20 font-bold uppercase tracking-widest">SIMULATED</span>
        <button onClick={() => { document.cookie = 'logis_role=; path=/; max-age=0'; router.push('/'); }}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Switch Role</button>
      </header>

      <div className="p-8 max-w-[1200px] mx-auto space-y-8">
        {/* Counters */}
        <div className="grid grid-cols-4 gap-6">
          <CounterCard icon={ClipboardCheck} label="Today's Inspections" value={todayInspections.length} color="text-foreground" />
          <CounterCard icon={CheckCircle2} label="Passed" value={passed} color="text-success" />
          <CounterCard icon={XCircle} label="Failed" value={failed} color="text-critical" />
          <CounterCard icon={Clock} label="Pending" value={0} color="text-warning" />
        </div>

        {/* Actions */}
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Simulate Inspection
        </button>

        {/* Flag Result */}
        {showFlagResult && (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-[14px] font-bold text-foreground uppercase tracking-widest">INCIDENT CREATED</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Lot {showFlagResult} has been flagged. The Operations Manager will see this incident.</p>
            <button onClick={() => { router.push('/dashboard'); }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border bg-surface text-[14px] font-semibold hover:bg-surface-2 transition-all shadow-sm">
              Open in LOGIS <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Recent Inspections */}
        <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-2/30">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recent Inspections</h3>
          </div>
          <div className="divide-y divide-border">
            {inspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-4 px-6 py-4">
                {insp.result === 'pass' ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-critical shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium">{insp.testType} — {insp.lotId}</div>
                  <div className="text-[13px] text-muted-foreground">{insp.productId} / {insp.batchId}</div>
                </div>
                <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                  insp.result === 'pass' ? 'bg-success/10 text-success' : 'bg-critical/10 text-critical')}>
                  {insp.result}
                </span>
                <span className="text-[12px] text-muted-foreground tabular-nums">{formatDateTime(insp.createdAt)}</span>
              </div>
            ))}
            {inspections.length === 0 && (
              <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">No inspections yet</div>
            )}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-2/30">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recent Incidents</h3>
          </div>
          <div className="divide-y divide-border">
            {incidents.map(inc => (
              <div key={inc.id} className="flex items-center gap-4 px-6 py-4">
                <AlertTriangle className={cn('w-5 h-5 shrink-0',
                  inc.severity === 'critical' ? 'text-critical' : 'text-warning')} />
                <div className="flex-1"><div className="text-[14px] font-medium">{inc.title}</div></div>
                <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest', 
                  inc.severity === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning')}>
                  {inc.severity}
                </span>
              </div>
            ))}
            {incidents.length === 0 && (
              <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">No recent incidents</div>
            )}
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
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-foreground">Simulate Inspection</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-2 transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <span className="px-2 py-1 rounded text-[10px] bg-warning/10 text-warning border border-warning/20 mb-6 inline-block font-bold uppercase tracking-widest">SIMULATED</span>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-2">Product</label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all">
              <option value="P-001">P-001 — Nova Fresh Milk 500ml</option>
              <option value="P-002">P-002 — Nova Paneer 200g</option>
              <option value="P-003">P-003 — Product C — Nova Yogurt 400g</option>
              <option value="P-004">P-004 — Product D — Nova Cheese Spread</option>
              <option value="P-005">P-005 — Nova Wheat Bread</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">Batch</label>
              <input value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">Lot</label>
              <input value={form.lotId} onChange={e => setForm(f => ({ ...f, lotId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-2">Test Type</label>
            <select value={form.testType} onChange={e => setForm(f => ({ ...f, testType: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all">
              <option value="microbial_contamination">Microbial Contamination</option>
              <option value="chemical_analysis">Chemical Analysis</option>
              <option value="ph_level">pH Level</option>
              <option value="moisture_content">Moisture Content</option>
              <option value="temperature_check">Temperature Check</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-2">Result</label>
            <div className="flex gap-2">
              <button onClick={() => setForm(f => ({ ...f, result: 'pass' }))}
                className={cn('flex-1 py-2.5 rounded-lg border text-[13px] font-bold uppercase tracking-widest transition-colors',
                  form.result === 'pass' ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-surface-2 text-muted-foreground')}>
                PASS
              </button>
              <button onClick={() => setForm(f => ({ ...f, result: 'fail' }))}
                className={cn('flex-1 py-2.5 rounded-lg border text-[13px] font-bold uppercase tracking-widest transition-colors',
                  form.result === 'fail' ? 'border-critical/30 bg-critical/10 text-critical' : 'border-border bg-surface-2 text-muted-foreground')}>
                FAIL
              </button>
            </div>
          </div>
          {form.result === 'fail' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-foreground block mb-2">Severity</label>
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground block mb-2">Incident Type</label>
                <select value={form.incidentType} onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                  <option value="contamination">Contamination</option>
                  <option value="temperature_excursion">Temperature Excursion</option>
                  <option value="component_defect">Component Defect</option>
                </select>
              </div>
            </div>
          )}
          <div className="pt-4">
            <button onClick={handleSubmit}
              className="w-full py-3 rounded-full bg-dark-action text-dark-action-fg text-[14px] font-semibold hover:opacity-90 transition-all shadow-sm">
              {form.result === 'fail' ? 'Flag Incident' : 'Log Inspection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
