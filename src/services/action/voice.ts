// Outbound voice-agent provider. Vapi is implemented; the interface leaves room for Exotel or others.
import type { CallStatus, Language } from './store';

export interface StartCallInput {
  phone: string;
  name: string;
  language: Language;
  firstMessage: string;
  systemPrompt: string;
  metadata: Record<string, string>;
}

export interface ProviderCall {
  status: CallStatus;
  endedReason: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface VoiceProvider {
  name: string;
  status(): { configured: boolean; missing: string[] };
  startCall(input: StartCallInput): Promise<string>;
  getCall(id: string): Promise<ProviderCall>;
}

export const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export const concurrencyLimit = () => {
  const n = Number(process.env.VOICE_CONCURRENCY ?? 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(50, Math.floor(n)) : 10;
};

const vapiBase = () => process.env.VAPI_BASE_URL ?? 'https://api.vapi.ai';
const TRANSCRIBER_LANG: Record<Language, string> = { en: 'en-IN', hi: 'hi', mr: 'multi', gu: 'multi', ta: 'multi', te: 'multi', kn: 'multi', bn: 'multi' };

interface VapiCall {
  id: string;
  status?: string;
  endedReason?: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  recordingUrl?: string;
  artifact?: { transcript?: string; recordingUrl?: string; recording?: { stereoUrl?: string; mono?: { combinedUrl?: string } } };
}

class VapiError extends Error {}

async function vapi<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${vapiBase()}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY ?? ''}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (j.message) detail = Array.isArray(j.message) ? j.message.join('; ') : j.message;
    } catch {
      // keep raw text
    }
    throw new VapiError(`Vapi ${res.status}: ${detail}`);
  }
  return JSON.parse(text) as T;
}

function mapStatus(s: string | undefined): CallStatus {
  switch (s) {
    case 'scheduled':
    case 'queued':
      return 'dialing';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
    case 'forwarding':
      return 'in-progress';
    case 'ended':
      return 'ended';
    default:
      return 'failed';
  }
}

export const vapiProvider: VoiceProvider = {
  name: 'vapi',
  status() {
    const missing = ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID'].filter((k) => !process.env[k]);
    return { configured: missing.length === 0, missing };
  },
  async startCall(input) {
    const assistant: Record<string, unknown> = {
      firstMessage: input.firstMessage,
      model: {
        provider: process.env.VAPI_MODEL_PROVIDER ?? 'openai',
        model: process.env.VAPI_MODEL ?? 'gpt-4o',
        messages: [{ role: 'system', content: input.systemPrompt }],
      },
      transcriber: { provider: 'deepgram', model: 'nova-2', language: TRANSCRIBER_LANG[input.language] },
      maxDurationSeconds: 300,
      metadata: input.metadata,
    };
    if (process.env.VAPI_VOICE_PROVIDER && process.env.VAPI_VOICE_ID) {
      assistant.voice = { provider: process.env.VAPI_VOICE_PROVIDER, voiceId: process.env.VAPI_VOICE_ID };
    }
    const call = await vapi<VapiCall>('/call', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: input.phone, name: input.name.slice(0, 40) },
        assistant,
      }),
    });
    return call.id;
  },
  async getCall(id) {
    const c = await vapi<VapiCall>(`/call/${encodeURIComponent(id)}`);
    return {
      status: mapStatus(c.status),
      endedReason: c.endedReason ?? null,
      transcript: c.artifact?.transcript ?? c.transcript ?? null,
      recordingUrl: c.artifact?.recording?.stereoUrl ?? c.artifact?.recording?.mono?.combinedUrl ?? c.artifact?.recordingUrl ?? c.recordingUrl ?? null,
      startedAt: c.startedAt ?? null,
      endedAt: c.endedAt ?? null,
    };
  },
};

export const voiceProvider = (): VoiceProvider => vapiProvider;
