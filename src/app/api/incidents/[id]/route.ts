// GET /api/incidents/[id] - Get incident by ID
import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById } from '@/services/incidentService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incident = getIncidentById(id);
    if (!incident) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Incident ${id} not found` } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: incident });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
