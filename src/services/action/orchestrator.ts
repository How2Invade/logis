// Runs a recall campaign: dials up to N contacts at once, tracks live status, records transcripts and feedback.
import type Database from 'better-sqlite3';
import { aiConfigured, callScript, extractFeedback } from './ai';
import { buildRecallPicture, contextFor } from './context';
import { getCampaign, listCalls, listContacts, patchCall, setCampaignStatus, type CallFeedback, type CallRecord, type Campaign } from './store';
import { voiceProvider } from './voice';

const ACTIVE = new Set(['dialing', 'ringing', 'in-progress']);
const UNANSWERED = new Set(['customer-did-not-answer', 'customer-busy', 'voicemail', 'customer-did-not-give-microphone-permission']);

// one tick per campaign at a time, so overlapping polls can never dial the same contact twice
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  void next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  });
  return next;
}

const unansweredFeedback = (reason: string | null): CallFeedback => ({
  answered: false,
  acknowledged: false,
  remainingUnits: null,
  quarantineConfirmed: false,
  soldOrDispatchedUnits: null,
  distributionStopped: false,
  needsAssistance: false,
  escalationRequired: true,
  escalationReason: `Call not answered${reason ? ` (${reason})` : ''} — retry or reach by another channel.`,
  notes: 'No conversation took place.',
});

export async function tickCampaign(db: Database.Database, campaignId: string): Promise<{ campaign: Campaign; calls: CallRecord[] } | null> {
  return withLock(campaignId, async () => {
    const campaign = getCampaign(db, campaignId);
    if (!campaign) return null;
    const provider = voiceProvider();
    const picture = buildRecallPicture(db, campaign.incidentId);
    const contacts = new Map(listContacts(db).map((c) => [c.id, c]));
    let calls = listCalls(db, campaignId);

    // 1. refresh live calls
    await Promise.all(
      calls.filter((c) => ACTIVE.has(c.status) && c.providerCallId).map(async (c) => {
        try {
          const live = await provider.getCall(c.providerCallId as string);
          patchCall(db, c.id, { status: live.status, endedReason: live.endedReason, startedAt: live.startedAt ?? c.startedAt, endedAt: live.endedAt, transcript: live.transcript, recordingUrl: live.recordingUrl });
        } catch (e) {
          patchCall(db, c.id, { error: e instanceof Error ? e.message : String(e) });
        }
      })
    );
    calls = listCalls(db, campaignId);

    // 2. structured feedback for calls that just ended
    await Promise.all(
      calls.filter((c) => c.status === 'ended' && !c.feedback && !c.feedbackError).map(async (c) => {
        const contact = contacts.get(c.contactId);
        const hasDialogue = (c.transcript ?? '').trim().length > 0 && !UNANSWERED.has(c.endedReason ?? '');
        if (!hasDialogue) {
          patchCall(db, c.id, { feedback: unansweredFeedback(c.endedReason) });
          return;
        }
        if (!aiConfigured() || !picture) {
          patchCall(db, c.id, { feedbackError: 'Transcript saved. Structured feedback needs ANTHROPIC_API_KEY.' });
          return;
        }
        try {
          const fb = await extractFeedback(c.transcript as string, contextFor(picture, contact?.locationId ?? null));
          patchCall(db, c.id, { feedback: fb });
        } catch (e) {
          patchCall(db, c.id, { feedbackError: e instanceof Error ? e.message : String(e) });
        }
      })
    );
    calls = listCalls(db, campaignId);

    // 3. start queued calls in free agent slots
    if (campaign.status === 'running') {
      const busy = new Set(calls.filter((c) => ACTIVE.has(c.status)).map((c) => c.agentSlot));
      const free = Array.from({ length: campaign.concurrency }, (_, i) => i + 1).filter((s) => !busy.has(s));
      const queued = calls.filter((c) => c.status === 'queued');
      const { configured } = provider.status();
      for (const call of queued.slice(0, free.length)) {
        const slot = free.shift() as number;
        const contact = contacts.get(call.contactId);
        if (!contact || !contact.consent || contact.optedOut) {
          patchCall(db, call.id, { status: 'canceled', error: 'Contact has no call consent or has opted out.' });
          continue;
        }
        if (!configured || !picture) {
          patchCall(db, call.id, { status: 'failed', error: 'Voice provider is not configured — no call was placed.' });
          continue;
        }
        const ctx = contextFor(picture, contact.locationId);
        const script = callScript(ctx, contact.name, contact.role, contact.language, campaign.body);
        patchCall(db, call.id, { status: 'dialing', agentSlot: slot, attempts: call.attempts + 1, startedAt: new Date().toISOString(), error: null });
        try {
          const id = await provider.startCall({
            phone: contact.phone,
            name: contact.name,
            language: contact.language,
            firstMessage: script.firstMessage,
            systemPrompt: script.system,
            metadata: { campaignId, callId: call.id, contactId: contact.id, incidentId: campaign.incidentId },
          });
          patchCall(db, call.id, { providerCallId: id });
        } catch (e) {
          patchCall(db, call.id, { status: 'failed', agentSlot: null, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    calls = listCalls(db, campaignId);
    const pending = calls.some((c) => c.status === 'queued' || ACTIVE.has(c.status) || (c.status === 'ended' && !c.feedback && !c.feedbackError));
    if (campaign.status === 'running' && !pending) setCampaignStatus(db, campaignId, 'completed');
    return { campaign: getCampaign(db, campaignId) as Campaign, calls };
  });
}

export function stopCampaign(db: Database.Database, campaignId: string): void {
  for (const c of listCalls(db, campaignId)) if (c.status === 'queued') patchCall(db, c.id, { status: 'canceled', error: 'Stopped before dialing.' });
  setCampaignStatus(db, campaignId, 'stopped');
}

export function retryCampaign(db: Database.Database, campaignId: string): number {
  let n = 0;
  for (const c of listCalls(db, campaignId)) {
    const unanswered = c.status === 'ended' && c.feedback && !c.feedback.answered;
    if (c.status === 'failed' || c.status === 'canceled' || unanswered) {
      patchCall(db, c.id, { status: 'queued', agentSlot: null, providerCallId: null, endedReason: null, transcript: null, recordingUrl: null, feedback: null, feedbackError: null, error: null, endedAt: null });
      n++;
    }
  }
  if (n > 0) setCampaignStatus(db, campaignId, 'running');
  return n;
}
