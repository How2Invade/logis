// POST /api/action/campaigns/[id]/stop — cancel calls that have not been dialled yet
import { NextRequest, NextResponse } from 'next/server';
import { openDb } from '@/services/action/store';
import { stopCampaign } from '@/services/action/orchestrator';
import { errorResponse } from '../../../_shared';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = openDb();
  try {
    const { id } = await params;
    stopCampaign(db, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
