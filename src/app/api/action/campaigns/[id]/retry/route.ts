// POST /api/action/campaigns/[id]/retry — re-queue unanswered and failed calls
import { NextRequest, NextResponse } from 'next/server';
import { openDb } from '@/services/action/store';
import { retryCampaign } from '@/services/action/orchestrator';
import { errorResponse } from '../../../_shared';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = openDb();
  try {
    const { id } = await params;
    return NextResponse.json({ data: { requeued: retryCampaign(db, id) } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
