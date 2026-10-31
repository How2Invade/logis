// POST /api/action/campaigns — launch a recall call campaign for selected contacts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildRecallPicture } from '@/services/action/context';
import { insertCampaign, listContacts, openDb } from '@/services/action/store';
import { concurrencyLimit, voiceProvider } from '@/services/action/voice';
import { tickCampaign } from '@/services/action/orchestrator';
import { LANGUAGE, errorResponse, fail } from '../_shared';

const Body = z.object({
  incidentId: z.string().min(1),
  contactIds: z.array(z.string()).min(1).max(500),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(4000),
  language: LANGUAGE.default('en'),
});

export async function POST(request: NextRequest) {
  const db = openDb();
  try {
    const input = Body.parse(await request.json());
    const provider = voiceProvider();
    const status = provider.status();
    if (!status.configured) {
      return fail(412, 'VOICE_NOT_CONFIGURED', `No calls were placed. Set ${status.missing.join(' and ')} in logis/.env.local and restart the server.`);
    }
    const picture = buildRecallPicture(db, input.incidentId);
    if (!picture) return fail(404, 'NO_INCIDENT', 'Incident not found.');
    const sites = new Set(picture.locations.map((l) => l.id));
    const contacts = new Map(listContacts(db).map((c) => [c.id, c]));
    const rejected: string[] = [];
    const callable = input.contactIds.filter((id) => {
      const c = contacts.get(id);
      const ok = !!c && c.consent && !c.optedOut && sites.has(c.locationId);
      if (!ok) rejected.push(c ? `${c.name}: ${!c.consent ? 'no call consent' : c.optedOut ? 'opted out' : 'not at an affected site'}` : `${id}: unknown contact`);
      return ok;
    });
    if (callable.length === 0) return fail(400, 'NO_CALLABLE_CONTACTS', `None of the selected contacts can be called. ${rejected.join('; ')}`);

    const campaign = insertCampaign(
      db,
      { incidentId: picture.context.incidentId, subject: input.subject, body: input.body, language: input.language, concurrency: concurrencyLimit() },
      callable,
      provider.name
    );
    const state = await tickCampaign(db, campaign.id);
    return NextResponse.json({ data: { ...state, rejected } }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
