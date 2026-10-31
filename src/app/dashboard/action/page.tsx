'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, MapPin, Users, Bot, CheckCircle2, Circle, Radio, Settings2, PackageX, Warehouse, Store } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatNumber } from '@/lib/utils';
import { MessageComposer } from './components/MessageComposer';
import { ContactsPanel, contactStatus } from './components/ContactsPanel';
import { CallBoard } from './components/CallBoard';
import type { CallRecord, Campaign, Language, Overview, SiteCallState } from './components/types';

const RecallMap = dynamic(() => import('./components/RecallMap').then((m) => m.RecallMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">Loading map…</div>,
});

type CampaignState = Campaign & { calls: CallRecord[] };

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof MapPin; label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={cn('mt-2 text-[26px] font-semibold leading-none tabular-nums', tone ?? 'text-foreground')}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

export default function ActionPage() {
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [site, setSite] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; language: Language } | null>(null);
  const [approved, setApproved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/action/overview${incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : ''}`, { cache: 'no-store' });
      const j: { data?: Overview; error?: { message: string } } = await res.json();
      if (!res.ok || !j.data) throw new Error(j.error?.message ?? 'Could not load the recall picture');
      setData(j.data);
      setCampaign(j.data.campaign);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the recall picture');
    }
  }, [incidentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = campaign?.status === 'running';
  const campaignId = campaign?.id ?? null;
  useEffect(() => {
    if (!running || !campaignId) return;
    const id = campaignId;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/action/campaigns/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const j: { data?: { campaign: Campaign; calls: CallRecord[] } } = await res.json();
      if (j.data) setCampaign({ ...j.data.campaign, calls: j.data.calls });
    }, 2500);
    return () => clearInterval(timer);
  }, [running, campaignId]);

  const calls = useMemo(() => campaign?.calls ?? [], [campaign]);
  const siteCallState = useMemo(() => {
    const out: Record<string, SiteCallState> = {};
    if (!data) return out;
    const byContact = new Map(data.contacts.map((c) => [c.id, c]));
    const rank: Record<SiteCallState, number> = { none: 0, acknowledged: 1, unanswered: 2, calling: 3, escalated: 4 };
    for (const call of calls) {
      const loc = byContact.get(call.contactId)?.locationId;
      if (!loc) continue;
      const st = contactStatus(call);
      const s: SiteCallState = st === 'calling' || st === 'queued' ? 'calling' : st === 'acknowledged' ? 'acknowledged' : st === 'unanswered' || st === 'failed' ? 'unanswered' : st === 'escalated' ? 'escalated' : 'none';
      if (rank[s] > rank[out[loc] ?? 'none']) out[loc] = s;
    }
    return out;
  }, [calls, data]);

  async function startCalls(contactIds: string[]) {
    if (!data || !draft) return;
    const res = await fetch('/api/action/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: data.context.incidentId, contactIds, subject: draft.subject, body: draft.body, language: draft.language }),
    });
    const j: { data?: { campaign: Campaign; calls: CallRecord[]; rejected: string[] }; error?: { message: string } } = await res.json();
    if (!res.ok || !j.data) {
      toast.error(j.error?.message ?? 'Calls could not be started');
      return;
    }
    setCampaign({ ...j.data.campaign, calls: j.data.calls });
    toast.success(`Recall campaign started — ${j.data.calls.length} calls`);
    if (j.data.rejected.length) toast.error(`Skipped: ${j.data.rejected.join('; ')}`);
  }

  async function campaignAction(kind: 'stop' | 'retry') {
    if (!campaign) return;
    const res = await fetch(`/api/action/campaigns/${encodeURIComponent(campaign.id)}/${kind}`, { method: 'POST' });
    if (!res.ok) toast.error(`Could not ${kind} the campaign`);
    const next = await fetch(`/api/action/campaigns/${encodeURIComponent(campaign.id)}`, { cache: 'no-store' }).then((r) => r.json() as Promise<{ data?: { campaign: Campaign; calls: CallRecord[] } }>);
    if (next.data) setCampaign({ ...next.data.campaign, calls: next.data.calls });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="rounded-xl border border-critical/30 bg-critical/10 p-5 text-[13px] text-critical">{error}</div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex h-[60vh] items-center justify-center text-[13px] text-muted-foreground">Building the recall picture…</div>;
  }

  const ctx = data.context;
  const voice = data.providers.voice;
  const active = calls.filter((c) => ['dialing', 'ringing', 'in-progress'].includes(c.status)).length;
  const finished = calls.filter((c) => c.feedback);
  const acked = finished.filter((c) => c.feedback?.acknowledged).length;
  const callableContacts = data.contacts.filter((c) => c.consent && !c.optedOut).length;
  const selected = data.locations.find((l) => l.id === site) ?? null;
  const steps = [
    { label: 'Identify affected warehouses and retail stores', done: data.locations.length > 0 },
    { label: 'Review locations and responsible contacts', done: data.contacts.length > 0 },
    { label: 'Generate and approve the recall message', done: !!draft && approved },
    { label: 'Launch parallel AI voice calls', done: !!campaign },
    { label: 'Collect acknowledgements and resolve escalations', done: !!campaign && calls.length > 0 && calls.every((c) => c.feedback?.acknowledged && !c.feedback.escalationRequired) },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] space-y-5 px-8 py-6 text-foreground lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight">Action Centre</h1>
          <p className="text-[13px] text-muted-foreground">Notify every affected site, run AI recall calls in parallel, and track acknowledgements.</p>
        </div>
        <select
          value={ctx.incidentId}
          onChange={(e) => {
            setIncidentId(e.target.value);
            setDraft(null);
            setApproved(false);
            setSite(null);
          }}
          className="h-9 max-w-[360px] rounded-lg border border-border bg-surface px-3 text-[12px]"
          aria-label="Incident"
        >
          {data.incidents.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.title}</option>)}
        </select>
      </div>

      {(!voice.configured || !data.providers.ai.configured) && (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-[12px] leading-relaxed text-foreground">
          <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-1">
            {!voice.configured && (
              <p>
                <b>Voice calls are not connected.</b> LOGIS will not place or simulate calls until a voice provider is configured. Add{' '}
                {voice.missing.map((m, i) => <span key={m}><code className="rounded bg-surface px-1">{m}</code>{i < voice.missing.length - 1 ? ' and ' : ''}</span>)}{' '}
                to <code className="rounded bg-surface px-1">logis/.env.local</code> (a Vapi private key and an imported Twilio, Vonage or Telnyx number id), then restart the server.
              </p>
            )}
            {!data.providers.ai.configured && (
              <p>
                <b>Claude is not connected.</b> Messages use the built-in template and call transcripts are saved without structured feedback. Set <code className="rounded bg-surface px-1">ANTHROPIC_API_KEY</code> to enable both.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Radio} label="Recall status" value={running ? 'Live' : campaign ? (campaign.status === 'completed' ? 'Done' : 'Stopped') : 'Ready'} sub={campaign ? `${calls.length} calls in latest campaign` : 'No campaign yet'} tone={running ? 'text-primary' : undefined} />
        <Kpi icon={MapPin} label="Affected locations" value={String(data.locations.length)} sub={`${data.locations.filter((l) => l.kind === 'warehouse').length} warehouses · ${data.locations.filter((l) => l.kind === 'store').length} stores`} tone="text-critical" />
        <Kpi icon={Users} label="People to contact" value={String(data.contacts.length)} sub={`${callableContacts} with call consent`} />
        <Kpi icon={Bot} label="Voice agents available" value={voice.configured ? String(Math.max(0, voice.concurrency - active)) : '0'} sub={voice.configured ? `${active} on calls · ${voice.concurrency} slots` : 'Provider not configured'} />
        <Kpi icon={CheckCircle2} label="Acknowledgements" value={calls.length ? `${Math.round((acked / calls.length) * 100)}%` : '0%'} sub={`${acked} of ${calls.length} confirmed on call`} tone={acked ? 'text-success' : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border border-l-4 border-l-critical bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-critical"><AlertTriangle className="h-3.5 w-3.5" />Recall incident · {ctx.severity}</div>
            <h2 className="mt-1.5 text-[15px] font-semibold leading-snug">{ctx.title}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">{ctx.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-[10px] text-muted-foreground">Source lot</div><div className="font-mono font-semibold">{ctx.sourceLot}</div></div>
              <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-[10px] text-muted-foreground">Affected units</div><div className="font-semibold tabular-nums text-critical">{formatNumber(ctx.affectedUnits)}</div></div>
            </div>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Affected batches ({ctx.batches.length})</div>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
              {ctx.batches.slice(0, 12).map((b) => (
                <div key={b.batchId} className="flex justify-between gap-2 text-[11px]"><span className="truncate">{b.product}</span><span className="shrink-0 font-mono text-muted-foreground">{b.batchId}</span></div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Action workflow</div>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-start gap-2 text-[12px]">
                  {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className={s.done ? 'text-foreground' : 'text-muted-foreground'}>{i + 1}. {s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="h-[460px] rounded-xl border border-border bg-surface p-1.5 shadow-sm">
            <RecallMap locations={data.locations} callState={siteCallState} selectedId={site} onSelect={setSite} />
          </div>
          <div className="flex h-[460px] flex-col rounded-xl border border-border bg-surface p-4 shadow-sm">
            {selected ? (
              <>
                <div className="flex items-start gap-2">
                  {selected.kind === 'warehouse' ? <Warehouse className="mt-0.5 h-5 w-5 text-primary" /> : <Store className="mt-0.5 h-5 w-5 text-primary" />}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{selected.kind} · {selected.id}</div>
                    <div className="text-[14px] font-semibold leading-snug">{selected.name}</div>
                    <div className="text-[11px] text-muted-foreground">{selected.location}{selected.precision === 'state' ? ' (placed at state level)' : ''}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                  <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-muted-foreground">Affected</div><div className="font-semibold text-critical">{formatNumber(selected.affected)}</div></div>
                  <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-muted-foreground">Verify</div><div className="font-semibold text-warning">{formatNumber(selected.uncertain)}</div></div>
                  <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-muted-foreground">Clear</div><div className="font-semibold text-success">{formatNumber(selected.safe)}</div></div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{selected.inTransitShipments} flagged shipments on the road · {selected.batchIds.length} flagged batches held</div>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Responsible contacts</div>
                <div className="mt-1 flex-1 space-y-1.5 overflow-y-auto">
                  {data.contacts.filter((c) => c.locationId === selected.id).map((c) => {
                    const call = [...calls].reverse().find((x) => x.contactId === c.id);
                    return (
                      <div key={c.id} className="rounded-lg border border-border p-2 text-[12px]">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.role.replace(/_/g, ' ')} · {c.phone}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{contactStatus(call).replace('-', ' ')}</div>
                      </div>
                    );
                  })}
                  {data.contacts.every((c) => c.locationId !== selected.id) && <div className="text-[12px] text-muted-foreground">No contacts recorded for this site.</div>}
                </div>
                <button onClick={() => setSite(null)} className="mt-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Clear selection</button>
              </>
            ) : (
              <div className="flex flex-1 flex-col">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Most exposed sites</div>
                <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
                  {data.locations.map((l) => (
                    <button key={l.id} onClick={() => setSite(l.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-surface-2">
                      <span className="min-w-0"><span className="block truncate font-medium">{l.name}</span><span className="text-[10px] text-muted-foreground">{l.id} · {l.location}</span></span>
                      <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums text-critical"><PackageX className="h-3 w-3" />{formatNumber(l.affected)}</span>
                    </button>
                  ))}
                  {data.locations.length === 0 && <div className="text-[12px] text-muted-foreground">No sites hold affected stock for this incident.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
        <MessageComposer
          incidentId={ctx.incidentId}
          locations={data.locations}
          aiConfigured={data.providers.ai.configured}
          draft={draft}
          onDraft={setDraft}
          approved={approved}
          onApprove={setApproved}
        />
        <ContactsPanel
          locations={data.locations}
          contacts={data.contacts}
          calls={calls}
          selectedSite={site}
          voiceReady={voice.configured}
          messageReady={!!draft && approved}
          campaignRunning={running}
          hasCampaign={!!campaign}
          concurrency={voice.concurrency}
          onChanged={load}
          onCall={startCalls}
          onStop={() => campaignAction('stop')}
          onRetry={() => campaignAction('retry')}
        />
      </div>

      {campaign && <CallBoard campaign={campaign} contacts={data.contacts} locations={data.locations} />}
    </div>
  );
}
