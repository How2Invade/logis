'use client';

import { useMemo, useState } from 'react';
import { Search, PhoneCall, UserPlus, Upload, Trash2, Square, RotateCcw, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, ROLE_OPTIONS } from './MessageComposer';
import type { ActionLocation, CallRecord, Contact, ContactRole, Language } from './types';

const input = 'h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-primary/30';

export type ContactStatus = 'not-called' | 'queued' | 'calling' | 'acknowledged' | 'escalated' | 'unanswered' | 'failed';

export function contactStatus(call: CallRecord | undefined): ContactStatus {
  if (!call) return 'not-called';
  if (call.status === 'queued') return 'queued';
  if (call.status === 'dialing' || call.status === 'ringing' || call.status === 'in-progress') return 'calling';
  if (call.status === 'failed' || call.status === 'canceled') return 'failed';
  if (call.feedback && !call.feedback.answered) return 'unanswered';
  if (call.feedback?.escalationRequired) return 'escalated';
  if (call.feedback?.acknowledged) return 'acknowledged';
  return call.status === 'ended' ? 'escalated' : 'calling';
}

const STATUS_STYLE: Record<ContactStatus, string> = {
  'not-called': 'text-muted-foreground bg-surface-2 border-border',
  queued: 'text-primary bg-primary/10 border-primary/30',
  calling: 'text-primary bg-primary/10 border-primary/30',
  acknowledged: 'text-success bg-success/12 border-success/30',
  escalated: 'text-critical bg-critical/12 border-critical/30',
  unanswered: 'text-warning bg-warning/12 border-warning/30',
  failed: 'text-critical bg-critical/12 border-critical/30',
};
const STATUS_LABEL: Record<ContactStatus, string> = {
  'not-called': 'Not called', queued: 'Queued', calling: 'On call', acknowledged: 'Acknowledged', escalated: 'Needs follow-up', unanswered: 'No answer', failed: 'Not placed',
};

const mask = (p: string) => (p.length > 6 ? `${p.slice(0, 3)} ${'•'.repeat(Math.max(0, p.length - 8))}${p.slice(-5)}` : p);

interface Props {
  locations: ActionLocation[];
  contacts: Contact[];
  calls: CallRecord[];
  selectedSite: string | null;
  voiceReady: boolean;
  messageReady: boolean;
  campaignRunning: boolean;
  hasCampaign: boolean;
  concurrency: number;
  onChanged: () => void;
  onCall: (contactIds: string[]) => Promise<void>;
  onStop: () => void;
  onRetry: () => void;
}

export function ContactsPanel(props: Props) {
  const { locations, contacts, calls, selectedSite, voiceReady, messageReady, campaignRunning, concurrency } = props;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [calling, setCalling] = useState(false);

  const site = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const lastCall = useMemo(() => {
    const m = new Map<string, CallRecord>();
    for (const c of calls) m.set(c.contactId, c);
    return m;
  }, [calls]);

  const visible = contacts.filter((c) => {
    const loc = site.get(c.locationId);
    const q = query.trim().toLowerCase();
    const hay = `${c.name} ${loc?.name ?? ''} ${loc?.location ?? ''} ${c.role}`.toLowerCase();
    return (!selectedSite || c.locationId === selectedSite) && (!q || hay.includes(q)) && (filter === 'all' || contactStatus(lastCall.get(c.id)) === filter);
  });
  const callable = (c: Contact) => c.consent && !c.optedOut;
  const selectable = visible.filter(callable);
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id));
  const pickedIds = [...picked].filter((id) => contacts.some((c) => c.id === id && callable(c)));

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  async function remove(id: string) {
    const res = await fetch(`/api/action/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setPicked((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      props.onChanged();
    }
  }

  async function setConsent(c: Contact, consent: boolean) {
    await fetch(`/api/action/contacts/${encodeURIComponent(c.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent }) });
    props.onChanged();
  }

  const blocked = !voiceReady ? 'Voice provider not configured' : !messageReady ? 'Approve the recall notice first' : pickedIds.length === 0 ? 'Select at least one contact' : null;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Recall campaign</h3>
          <p className="text-[12px] text-muted-foreground">
            {pickedIds.length} / {contacts.length} contacts selected · {concurrency} concurrent voice agents
            {selectedSite && <> · showing <b className="text-foreground">{site.get(selectedSite)?.name}</b></>}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Site, owner or region" className="w-40 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as ContactStatus | 'all')} className={input} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABEL) as ContactStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button onClick={() => { setAdding((v) => !v); setImporting(false); }} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12px] font-semibold hover:bg-surface-2">
            <UserPlus className="h-3.5 w-3.5" /> Add contact
          </button>
          <button onClick={() => { setImporting((v) => !v); setAdding(false); }} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12px] font-semibold hover:bg-surface-2">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
        </div>
      </div>

      {adding && <AddContact locations={locations} defaultSite={selectedSite} onDone={() => { setAdding(false); props.onChanged(); }} />}
      {importing && <ImportContacts onDone={() => { setImporting(false); props.onChanged(); }} />}

      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-[1] bg-surface">
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allPicked}
                  disabled={selectable.length === 0}
                  onChange={() => setPicked((s) => {
                    const n = new Set(s);
                    if (allPicked) selectable.forEach((c) => n.delete(c.id));
                    else selectable.forEach((c) => n.add(c.id));
                    return n;
                  })}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
              </th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Site</th>
              <th className="py-2 pr-3">Phone</th>
              <th className="py-2 pr-3">Call consent</th>
              <th className="py-2 pr-3">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((c) => {
              const loc = site.get(c.locationId);
              const st = contactStatus(lastCall.get(c.id));
              return (
                <tr key={c.id} className={cn('hover:bg-surface-2/60', !callable(c) && 'opacity-70')}>
                  <td className="px-4 py-2">
                    <input type="checkbox" aria-label={`Select ${c.name}`} checked={picked.has(c.id)} disabled={!callable(c)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{ROLE_OPTIONS.find((r) => r.value === c.role)?.label} · {LANGUAGE_OPTIONS.find((l) => l.value === c.language)?.label.split(' ').pop()}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="max-w-[220px] truncate text-foreground">{loc?.name ?? c.locationId}</div>
                    <div className="text-[10px] text-muted-foreground">{loc?.location}</div>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{mask(c.phone)}</td>
                  <td className="py-2 pr-3">
                    <button onClick={() => setConsent(c, !c.consent)} className={cn('flex items-center gap-1 text-[11px] font-semibold', c.consent ? 'text-success' : 'text-muted-foreground')} title="Toggle whether this person agreed to automated recall calls">
                      {c.consent ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                      {c.optedOut ? 'Opted out' : c.consent ? 'Recorded' : 'Missing'}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', STATUS_STYLE[st])}>{STATUS_LABEL[st]}</span>
                  </td>
                  <td className="pr-3">
                    <button onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`} className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-critical">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  {contacts.length === 0
                    ? 'No contacts yet. LOGIS has no people or phone numbers on record — add the managers and owners for the affected sites, or import a CSV.'
                    : 'No contacts match this filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
        <span className="text-[11px] text-muted-foreground">{blocked ?? `Up to ${concurrency} calls run at once; the rest wait in the queue.`}</span>
        <div className="ml-auto flex items-center gap-2">
          {props.hasCampaign && (
            <>
              <button onClick={props.onRetry} disabled={campaignRunning} className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold hover:bg-surface-2 disabled:opacity-50">
                <RotateCcw className="h-3.5 w-3.5" /> Retry unanswered
              </button>
              <button onClick={props.onStop} disabled={!campaignRunning} className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold hover:bg-surface-2 disabled:opacity-50">
                <Square className="h-3.5 w-3.5" /> Stop pending
              </button>
            </>
          )}
          <button
            disabled={!!blocked || calling || campaignRunning}
            onClick={async () => {
              setCalling(true);
              try {
                await props.onCall(pickedIds);
              } finally {
                setCalling(false);
              }
            }}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {calling ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
            Call selected ({pickedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function AddContact({ locations, defaultSite, onDone }: { locations: ActionLocation[]; defaultSite: string | null; onDone: () => void }) {
  const [locationId, setLocationId] = useState(defaultSite ?? locations[0]?.id ?? '');
  const [name, setName] = useState('');
  const [role, setRole] = useState<ContactRole>('warehouse_manager');
  const [phone, setPhone] = useState('+91');
  const [language, setLanguage] = useState<Language>('en');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const loc = locations.find((l) => l.id === locationId);

  async function save() {
    if (!loc) return;
    setSaving(true);
    try {
      const res = await fetch('/api/action/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, locationType: loc.kind, name, role, phone, language, consent }),
      });
      const j: { error?: { message: string } } = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not save contact');
      toast.success(`${name} added`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save contact');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 border-b border-border bg-surface-2/40 p-4 md:grid-cols-6">
      <select className={cn(input, 'col-span-2')} value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Site">
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <select className={input} value={role} onChange={(e) => setRole(e.target.value as ContactRole)} aria-label="Role">
        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <input className={cn(input, 'font-mono')} placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
      <select className={input} value={language} onChange={(e) => setLanguage(e.target.value as Language)} aria-label="Language">
        {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <label className="col-span-2 flex items-center gap-2 text-[11px] text-foreground md:col-span-5">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
        This person has agreed to receive automated recall calls on this number (required before LOGIS will call).
      </label>
      <button onClick={save} disabled={saving || !name.trim() || !loc} className="h-8 rounded-full bg-dark-action px-3 text-[12px] font-semibold text-dark-action-fg disabled:opacity-50">
        {saving ? 'Saving…' : 'Save contact'}
      </button>
    </div>
  );
}

function ImportContacts({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState('location_id,name,role,phone,language,consent\n');
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch('/api/action/contacts/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
      const j: { data?: { added: number; errors: string[] }; error?: { message: string } } = await res.json();
      if (!res.ok || !j.data) throw new Error(j.error?.message ?? 'Import failed');
      toast.success(`${j.data.added} contacts imported`);
      if (j.data.errors.length) toast.error(j.data.errors.slice(0, 3).join(' · '));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 border-b border-border bg-surface-2/40 p-4">
      <p className="text-[11px] text-muted-foreground">
        Columns: <code>location_id</code> (a LOGIS warehouse or store id), <code>name</code>, <code>role</code> (warehouse_manager, store_owner, store_staff, warehouse_worker, distributor), <code>phone</code> (+91…), <code>language</code> (en, hi, mr…), <code>consent</code> (yes/no).
      </p>
      <div className="flex gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-[11px]"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
        />
      </div>
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-surface p-2 font-mono text-[11px] outline-none" aria-label="CSV" />
      <button onClick={run} disabled={busy} className="h-8 rounded-full bg-dark-action px-3 text-[12px] font-semibold text-dark-action-fg disabled:opacity-50">
        {busy ? 'Importing…' : 'Import contacts'}
      </button>
    </div>
  );
}
