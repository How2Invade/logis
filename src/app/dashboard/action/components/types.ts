export type { ActionLocation } from '@/services/action/context';
export type { Contact, CallRecord, Campaign, CallFeedback, ContactRole, Language } from '@/services/action/store';
export type { DraftMessage, RecallContext } from '@/services/action/ai';

import type { ActionLocation } from '@/services/action/context';
import type { CallRecord, Campaign, Contact } from '@/services/action/store';
import type { RecallContext } from '@/services/action/ai';

export type SiteCallState = 'none' | 'calling' | 'acknowledged' | 'escalated' | 'unanswered';

export interface Overview {
  context: RecallContext;
  incidentType: string;
  incidents: Array<{ id: string; title: string; severity: string; status: string }>;
  locations: ActionLocation[];
  contacts: Contact[];
  campaign: (Campaign & { calls: CallRecord[] }) | null;
  providers: {
    voice: { name: string; configured: boolean; missing: string[]; concurrency: number };
    ai: { configured: boolean };
  };
}
