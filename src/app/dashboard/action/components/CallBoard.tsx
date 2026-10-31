'use client';

import { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, PhoneOff, PhoneCall, Phone } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { contactStatus } from './ContactsPanel';
import type { ActionLocation, CallRecord, Campaign, Contact } from './types';

interface Props {
  campaign: Campaign & { calls: CallRecord[] };
  contacts: Contact[];
  locations: ActionLocation[];
}

const LIVE = new Set(['dialing', 'ringing', 'in-progress']);
const PHASE: Record<string, string> = { dialing: 'Dialling', ringing: 'Ringing', 'in-progress': 'In conversation' };

function YesNo({ v, label }: { v: boolean; label: string }) {
  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', v ? 'border-success/30 bg-success/12 text-success' : 'border-border bg-surface-2 text-muted-foreground')}>
      {label}: {v ? 'yes' : 'no'}
    </span>
  );
}

export function CallBoard({ campaign, contacts, locations }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const contact = new Map(contacts.map((c) => [c.id, c]));
  const site = new Map(locations.map((l) => [l.id, l]));
  const live = campaign.calls.filter((c) => LIVE.has(c.status));
  const slots = Array.from({ length: campaign.concurrency }, (_, i) => live.find((c) => c.agentSlot === i + 1) ?? null);
  const done = campaign.calls.filter((c) => !LIVE.has(c.status) && c.status !== 'queued');
  const queued = campaign.calls.filter((c) => c.status === 'queued').length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Voice agents</h3>
            <p className="text-[12px] text-muted-foreground">
              {live.length} on calls · {queued} queued · {done.length} finished · campaign {campaign.status}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {slots.map((call, i) => {
            const c = call ? contact.get(call.contactId) : undefined;
            return (
              <div key={i} className={cn('rounded-lg border p-2.5 transition-colors', call ? 'border-primary/40 bg-primary/8' : 'border-border bg-surface-2/50')}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" /> Agent {String(i + 1).padStart(2, '0')}
                  {call && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                </div>
                <div className="mt-1 truncate text-[12px] font-semibold text-foreground">{c ? c.name : 'Idle'}</div>
                <div className="truncate text-[11px] text-muted-foreground">{call ? `${PHASE[call.status]} · ${site.get(c?.locationId ?? '')?.name ?? ''}` : 'Available'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-[15px] font-semibold text-foreground">Call results</h3>
          <p className="text-[12px] text-muted-foreground">Structured from each transcript. A call that was only answered is never counted as an acknowledgement.</p>
        </div>
        <div className="divide-y divide-border">
          {campaign.calls.map((call) => {
            const c = contact.get(call.contactId);
            const st = contactStatus(call);
            const fb = call.feedback;
            const isOpen = open === call.id;
            return (
              <div key={call.id} className="px-5 py-3">
                <button onClick={() => setOpen(isOpen ? null : call.id)} className="flex w-full items-center gap-3 text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  {LIVE.has(call.status) ? <PhoneCall className="h-4 w-4 text-primary" /> : call.status === 'failed' || st === 'unanswered' ? <PhoneOff className="h-4 w-4 text-warning" /> : <Phone className="h-4 w-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{c?.name ?? call.contactId} <span className="font-normal text-muted-foreground">· {site.get(c?.locationId ?? '')?.name ?? ''}</span></div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {call.error ?? fb?.notes ?? (call.status === 'queued' ? 'Waiting for a free agent' : LIVE.has(call.status) ? PHASE[call.status] : call.feedbackError ?? call.endedReason ?? call.status)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{st.replace('-', ' ')}</span>
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-3 pl-11">
                    {fb && (
                      <div className="flex flex-wrap gap-1.5">
                        <YesNo v={fb.answered} label="Answered" />
                        <YesNo v={fb.acknowledged} label="Acknowledged" />
                        <YesNo v={fb.distributionStopped} label="Distribution stopped" />
                        <YesNo v={fb.quarantineConfirmed} label="Quarantine confirmed" />
                        <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">On hand: {fb.remainingUnits === null ? '—' : formatNumber(fb.remainingUnits)}</span>
                        <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">Sold/dispatched: {fb.soldOrDispatchedUnits === null ? '—' : formatNumber(fb.soldOrDispatchedUnits)}</span>
                        {fb.needsAssistance && <span className="rounded-md border border-warning/30 bg-warning/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">Needs help</span>}
                        {fb.escalationRequired && <span className="rounded-md border border-critical/30 bg-critical/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-critical">Escalate: {fb.escalationReason ?? 'follow up'}</span>}
                      </div>
                    )}
                    {call.recordingUrl && (
                      <audio controls preload="none" src={call.recordingUrl} className="h-8 w-full max-w-md" />
                    )}
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                      {call.transcript ?? (LIVE.has(call.status) ? 'Transcript appears when the call ends.' : 'No transcript.')}
                    </pre>
                    <div className="text-[10px] text-muted-foreground">
                      Provider {call.provider}{call.providerCallId ? ` · call ${call.providerCallId}` : ''} · attempt {call.attempts}{call.endedReason ? ` · ended: ${call.endedReason}` : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
