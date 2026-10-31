// POST /api/action/message — draft a recall notice from the incident's real data
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildRecallPicture, contextFor } from '@/services/action/context';
import { draftRecallMessage, templateMessage } from '@/services/action/ai';
import { openDb } from '@/services/action/store';
import { LANGUAGE, ROLE, errorResponse, fail } from '../_shared';

const Body = z.object({
  incidentId: z.string().nullable().default(null),
  locationId: z.string().nullable().default(null),
  role: ROLE.default('warehouse_manager'),
  language: LANGUAGE.default('en'),
});

export async function POST(request: NextRequest) {
  const db = openDb();
  try {
    const input = Body.parse(await request.json());
    const picture = buildRecallPicture(db, input.incidentId);
    if (!picture) return fail(404, 'NO_INCIDENT', 'No incidents exist in the current dataset.');
    const ctx = contextFor(picture, input.locationId);
    try {
      return NextResponse.json({ data: await draftRecallMessage(ctx, input.role, input.language) });
    } catch (e) {
      const draft = templateMessage(ctx, input.role, input.language);
      return NextResponse.json({ data: { ...draft, note: `Claude request failed (${e instanceof Error ? e.message : 'error'}); used the built-in template.` } });
    }
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
