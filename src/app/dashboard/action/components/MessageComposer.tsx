'use client';

import { useState } from 'react';
import { Copy, Sparkles, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ActionLocation, ContactRole, DraftMessage, Language } from './types';

export const ROLE_OPTIONS: Array<{ value: ContactRole; label: string }> = [
  { value: 'warehouse_manager', label: 'Warehouse manager' },
  { value: 'store_owner', label: 'Retail store owner' },
  { value: 'store_staff', label: 'Store staff' },
  { value: 'warehouse_worker', label: 'Warehouse staff' },
  { value: 'distributor', label: 'Distributor' },
];
export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी Hindi' }, { value: 'mr', label: 'मराठी Marathi' },
  { value: 'gu', label: 'ગુજરાતી Gujarati' }, { value: 'ta', label: 'தமிழ் Tamil' }, { value: 'te', label: 'తెలుగు Telugu' },
  { value: 'kn', label: 'ಕನ್ನಡ Kannada' }, { value: 'bn', label: 'বাংলা Bengali' },
];

const select = 'h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary/30';

interface Props {
  incidentId: string;
  locations: ActionLocation[];
  aiConfigured: boolean;
  draft: { subject: string; body: string; language: Language } | null;
  onDraft: (d: { subject: string; body: string; language: Language }) => void;
  approved: boolean;
  onApprove: (v: boolean) => void;
}

export function MessageComposer({ incidentId, locations, aiConfigured, draft, onDraft, approved, onApprove }: Props) {
  const [role, setRole] = useState<ContactRole>('warehouse_manager');
  const [language, setLanguage] = useState<Language>('en');
  const [locationId, setLocationId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ source: DraftMessage['source']; note?: string } | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch('/api/action/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, locationId: locationId || null, role, language }),
      });
      const json: { data?: DraftMessage; error?: { message: string } } = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? 'Could not draft the message');
      onDraft({ subject: json.data.subject, body: json.data.body, language });
      setMeta({ source: json.data.source, note: json.data.note });
      onApprove(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not draft the message');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Recall notification</h3>
          <p className="text-[12px] text-muted-foreground">Drafted from the incident&apos;s real batches, dates and quantities.</p>
        </div>
        {draft && (
          <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', approved ? 'border-success/30 bg-success/12 text-success' : 'border-warning/30 bg-warning/12 text-warning')}>
            {approved ? 'Approved' : 'Needs approval'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select className={select} value={role} onChange={(e) => setRole(e.target.value as ContactRole)} aria-label="Audience">
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select className={select} value={language} onChange={(e) => setLanguage(e.target.value as Language)} aria-label="Language">
          {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select className={select} value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Site">
          <option value="">All affected sites</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <button onClick={generate} disabled={busy} className="mt-3 flex h-9 items-center justify-center gap-2 rounded-full bg-dark-action px-4 text-[13px] font-semibold text-dark-action-fg shadow-sm hover:opacity-90 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : aiConfigured ? <Sparkles className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        {draft ? 'Regenerate' : 'Generate message'} {aiConfigured ? 'with Claude' : 'from template'}
      </button>

      {draft ? (
        <div className="mt-4 flex flex-1 flex-col gap-2">
          <input
            value={draft.subject}
            onChange={(e) => {
              onDraft({ ...draft, subject: e.target.value });
              onApprove(false);
            }}
            className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Subject"
          />
          <textarea
            value={draft.body}
            onChange={(e) => {
              onDraft({ ...draft, body: e.target.value });
              onApprove(false);
            }}
            rows={12}
            className="min-h-[220px] flex-1 resize-y rounded-lg border border-border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Message body"
          />
          {meta && (
            <p className="text-[11px] text-muted-foreground">
              <b className="text-foreground">{meta.source === 'ai' ? 'Written by Claude' : 'Built-in template'}.</b> {meta.note ?? 'Review every fact before approving.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
                toast.success('Message copied');
              }}
              className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-foreground hover:bg-surface-2"
            >
              <Copy className="h-3.5 w-3.5" /> Copy message
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px] font-medium text-foreground">
              <input type="checkbox" checked={approved} onChange={(e) => onApprove(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
              <CheckCircle2 className={cn('h-4 w-4', approved ? 'text-success' : 'text-muted-foreground')} />
              I&apos;ve reviewed this notice
            </label>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">
          Generate a notice, review it, then approve it. Voice agents read from the approved notice.
        </div>
      )}
    </div>
  );
}
