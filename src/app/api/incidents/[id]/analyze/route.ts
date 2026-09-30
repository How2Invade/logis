// POST /api/incidents/[id]/analyze - Run impact analysis
import { NextRequest, NextResponse } from 'next/server';
import { analyzeIncident } from '@/services/incidentService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const impact = analyzeIncident(id);
    return NextResponse.json({ data: impact });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'ANALYSIS_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
