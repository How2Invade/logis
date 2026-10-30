import { NextRequest, NextResponse } from 'next/server';
import { loadIncidentCUS } from '@/lib/cusLoader';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = loadIncidentCUS(id);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'CUS_COMPUTATION_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

