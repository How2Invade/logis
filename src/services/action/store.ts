// Persistence for the Action module: recall contacts, campaigns and per-contact calls.
import Database from 'better-sqlite3';
import path from 'path';

export type ContactRole = 'warehouse_manager' | 'store_owner' | 'store_staff' | 'warehouse_worker' | 'distributor';
export type Language = 'en' | 'hi' | 'mr' | 'gu' | 'ta' | 'te' | 'kn' | 'bn';
export type CallStatus = 'queued' | 'dialing' | 'ringing' | 'in-progress' | 'ended' | 'failed' | 'canceled';

export interface Contact {
  id: string;
  locationId: string;
  locationType: 'warehouse' | 'store';
  name: string;
  role: ContactRole;
  phone: string;
  language: Language;
  consent: boolean;
  optedOut: boolean;
  createdAt: string;
}

export interface CallFeedback {
  answered: boolean;
  acknowledged: boolean;
  remainingUnits: number | null;
  quarantineConfirmed: boolean;
  soldOrDispatchedUnits: number | null;
  distributionStopped: boolean;
  needsAssistance: boolean;
  escalationRequired: boolean;
  escalationReason: string | null;
  notes: string;
}

export interface CallRecord {
  id: string;
  campaignId: string;
  contactId: string;
  agentSlot: number | null;
  status: CallStatus;
  provider: string;
  providerCallId: string | null;
  endedReason: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  feedback: CallFeedback | null;
  feedbackError: string | null;
  error: string | null;
  attempts: number;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  incidentId: string;
  subject: string;
  body: string;
  language: Language;
  concurrency: number;
  status: 'running' | 'completed' | 'stopped';
  createdAt: string;
}

let ready = false;

export function openDb(): Database.Database {
  const db = new Database(path.join(process.cwd(), 'logis.db'));
  db.pragma('journal_mode = WAL');
  if (!ready) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recall_contacts (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        location_type TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'en',
        consent INTEGER NOT NULL DEFAULT 0,
        opted_out INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recall_contacts_location ON recall_contacts(location_id);
      CREATE TABLE IF NOT EXISTS recall_campaigns (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        language TEXT NOT NULL,
        concurrency INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recall_calls (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        agent_slot INTEGER,
        status TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_call_id TEXT,
        ended_reason TEXT,
        transcript TEXT,
        recording_url TEXT,
        feedback_json TEXT,
        feedback_error TEXT,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        ended_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recall_calls_campaign ON recall_calls(campaign_id);
    `);
    ready = true;
  }
  return db;
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

interface ContactRow {
  id: string; location_id: string; location_type: string; name: string; role: string; phone: string;
  language: string; consent: number; opted_out: number; created_at: string;
}
const toContact = (r: ContactRow): Contact => ({
  id: r.id,
  locationId: r.location_id,
  locationType: r.location_type === 'store' ? 'store' : 'warehouse',
  name: r.name,
  role: r.role as ContactRole,
  phone: r.phone,
  language: r.language as Language,
  consent: r.consent === 1,
  optedOut: r.opted_out === 1,
  createdAt: r.created_at,
});

export function listContacts(db: Database.Database): Contact[] {
  return (db.prepare('SELECT * FROM recall_contacts ORDER BY created_at').all() as ContactRow[]).map(toContact);
}

export function insertContact(db: Database.Database, c: Omit<Contact, 'id' | 'createdAt'>): Contact {
  const row = { ...c, id: newId('CT'), createdAt: now() };
  db.prepare(`INSERT INTO recall_contacts (id, location_id, location_type, name, role, phone, language, consent, opted_out, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(row.id, row.locationId, row.locationType, row.name, row.role, row.phone, row.language, row.consent ? 1 : 0, row.optedOut ? 1 : 0, row.createdAt);
  return row;
}

export function updateContact(db: Database.Database, id: string, patch: Partial<Pick<Contact, 'name' | 'role' | 'phone' | 'language' | 'consent' | 'optedOut'>>): void {
  const cur = db.prepare('SELECT * FROM recall_contacts WHERE id = ?').get(id) as ContactRow | undefined;
  if (!cur) throw new Error('contact not found');
  const c = { ...toContact(cur), ...patch };
  db.prepare('UPDATE recall_contacts SET name = ?, role = ?, phone = ?, language = ?, consent = ?, opted_out = ? WHERE id = ?')
    .run(c.name, c.role, c.phone, c.language, c.consent ? 1 : 0, c.optedOut ? 1 : 0, id);
}

export function deleteContact(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM recall_contacts WHERE id = ?').run(id);
}

interface CampaignRow { id: string; incident_id: string; subject: string; body: string; language: string; concurrency: number; status: string; created_at: string }
const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id, incidentId: r.incident_id, subject: r.subject, body: r.body, language: r.language as Language,
  concurrency: r.concurrency, status: r.status as Campaign['status'], createdAt: r.created_at,
});

export function insertCampaign(db: Database.Database, c: Omit<Campaign, 'id' | 'createdAt' | 'status'>, contactIds: string[], provider: string): Campaign {
  const campaign: Campaign = { ...c, id: newId('RC'), status: 'running', createdAt: now() };
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO recall_campaigns (id, incident_id, subject, body, language, concurrency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(campaign.id, campaign.incidentId, campaign.subject, campaign.body, campaign.language, campaign.concurrency, campaign.status, campaign.createdAt);
    const ins = db.prepare('INSERT INTO recall_calls (id, campaign_id, contact_id, status, provider, attempts, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)');
    for (const cid of contactIds) ins.run(newId('CL'), campaign.id, cid, 'queued', provider, now());
  });
  tx();
  return campaign;
}

export function getCampaign(db: Database.Database, id: string): Campaign | null {
  const r = db.prepare('SELECT * FROM recall_campaigns WHERE id = ?').get(id) as CampaignRow | undefined;
  return r ? toCampaign(r) : null;
}

export function latestCampaign(db: Database.Database, incidentId: string): Campaign | null {
  const r = db.prepare('SELECT * FROM recall_campaigns WHERE incident_id = ? ORDER BY created_at DESC LIMIT 1').get(incidentId) as CampaignRow | undefined;
  return r ? toCampaign(r) : null;
}

export function setCampaignStatus(db: Database.Database, id: string, status: Campaign['status']): void {
  db.prepare('UPDATE recall_campaigns SET status = ? WHERE id = ?').run(status, id);
}

interface CallRow {
  id: string; campaign_id: string; contact_id: string; agent_slot: number | null; status: string; provider: string;
  provider_call_id: string | null; ended_reason: string | null; transcript: string | null; recording_url: string | null;
  feedback_json: string | null; feedback_error: string | null; error: string | null; attempts: number;
  started_at: string | null; ended_at: string | null; updated_at: string;
}
const toCall = (r: CallRow): CallRecord => ({
  id: r.id, campaignId: r.campaign_id, contactId: r.contact_id, agentSlot: r.agent_slot, status: r.status as CallStatus,
  provider: r.provider, providerCallId: r.provider_call_id, endedReason: r.ended_reason, transcript: r.transcript,
  recordingUrl: r.recording_url, feedback: r.feedback_json ? (JSON.parse(r.feedback_json) as CallFeedback) : null,
  feedbackError: r.feedback_error, error: r.error, attempts: r.attempts, startedAt: r.started_at, endedAt: r.ended_at, updatedAt: r.updated_at,
});

export function listCalls(db: Database.Database, campaignId: string): CallRecord[] {
  return (db.prepare('SELECT * FROM recall_calls WHERE campaign_id = ? ORDER BY rowid').all(campaignId) as CallRow[]).map(toCall);
}

export function patchCall(db: Database.Database, id: string, patch: Partial<Omit<CallRecord, 'id' | 'campaignId' | 'contactId'>>): void {
  const map: Record<string, string> = {
    agentSlot: 'agent_slot', status: 'status', providerCallId: 'provider_call_id', endedReason: 'ended_reason', transcript: 'transcript',
    recordingUrl: 'recording_url', feedbackError: 'feedback_error', error: 'error', attempts: 'attempts', startedAt: 'started_at', endedAt: 'ended_at',
  };
  const sets: string[] = [];
  const vals: Array<string | number | null> = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'feedback') {
      sets.push('feedback_json = ?');
      vals.push(v ? JSON.stringify(v) : null);
    } else if (map[k]) {
      sets.push(`${map[k]} = ?`);
      vals.push(v as string | number | null);
    }
  }
  sets.push('updated_at = ?');
  vals.push(now());
  db.prepare(`UPDATE recall_calls SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}
