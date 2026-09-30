// POST /api/incidents/[id]/recovery - Generate recovery plan
import { NextRequest, NextResponse } from 'next/server';
import { computeRecoveryPlan } from '@/services/incidentService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recovery = computeRecoveryPlan(id);
    return NextResponse.json({ data: recovery });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'RECOVERY_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
