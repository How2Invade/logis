// GET /api/action/campaigns/[id] — advance the campaign (poll live calls, dial queued) and return its state
import { NextRequest, NextResponse } from 'next/server';
import { openDb } from '@/services/action/store';
import { tickCampaign } from '@/services/action/orchestrator';
import { errorResponse, fail } from '../../_shared';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = openDb();
  try {
    const { id } = await params;
    const state = await tickCampaign(db, id);
    if (!state) return fail(404, 'NOT_FOUND', 'Campaign not found.');
    return NextResponse.json({ data: state });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
