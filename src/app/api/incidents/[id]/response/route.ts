// POST /api/incidents/[id]/response - Generate response plan
import { NextRequest, NextResponse } from 'next/server';
import { analyzeIncident, generateResponse } from '@/services/incidentService';
import { z } from 'zod';

const responseSchema = z.object({
  treatUncertainAsAffected: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = responseSchema.safeParse(body);
    
    // Run impact analysis first
    const impact = analyzeIncident(id);
    const plan = generateResponse(
      id, 
      impact, 
      parsed.success ? parsed.data.treatUncertainAsAffected : false
    );
    
    return NextResponse.json({ data: plan });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'RESPONSE_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
