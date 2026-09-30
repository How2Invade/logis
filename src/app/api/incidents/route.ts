// GET /api/incidents - List all incidents
// POST /api/incidents - Create a new incident
import { NextRequest, NextResponse } from 'next/server';
import { getAllIncidents, createIncident } from '@/services/incidentService';
import { z } from 'zod';

export async function GET() {
  try {
    const incidents = getAllIncidents();
    return NextResponse.json({ data: incidents });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'FETCH_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

const createIncidentSchema = z.object({
  type: z.enum(['contamination', 'temperature_excursion', 'component_defect']),
  sourceLot: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  location: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createIncidentSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
        { status: 400 }
      );
    }

    const incident = createIncident(parsed.data);
    return NextResponse.json({ data: incident }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'CREATE_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
