// GET /api/action/overview?incidentId= — recall picture, contacts, provider readiness and the latest campaign
import { NextRequest, NextResponse } from 'next/server';
import { buildRecallPicture } from '@/services/action/context';
import { latestCampaign, listCalls, listContacts, openDb } from '@/services/action/store';
import { concurrencyLimit, voiceProvider } from '@/services/action/voice';
import { aiConfigured } from '@/services/action/ai';
import { errorResponse, fail } from '../_shared';

export async function GET(request: NextRequest) {
  const db = openDb();
  try {
    const picture = buildRecallPicture(db, request.nextUrl.searchParams.get('incidentId'));
    if (!picture) return fail(404, 'NO_INCIDENT', 'No incidents exist in the current dataset.');
    const ids = new Set(picture.locations.map((l) => l.id));
    const contacts = listContacts(db).filter((c) => ids.has(c.locationId));
    const campaign = latestCampaign(db, picture.context.incidentId);
    const provider = voiceProvider();
    return NextResponse.json({
      data: {
        ...picture,
        contacts,
        campaign: campaign ? { ...campaign, calls: listCalls(db, campaign.id) } : null,
        providers: {
          voice: { name: provider.name, ...provider.status(), concurrency: concurrencyLimit() },
          ai: { configured: aiConfigured() },
        },
      },
    });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
