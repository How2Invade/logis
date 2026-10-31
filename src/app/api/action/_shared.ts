import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PHONE_RE } from '@/services/action/voice';

export const LANGUAGE = z.enum(['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'bn']);
export const ROLE = z.enum(['warehouse_manager', 'store_owner', 'store_staff', 'warehouse_worker', 'distributor']);

export const ContactInput = z.object({
  locationId: z.string().min(1),
  locationType: z.enum(['warehouse', 'store']),
  name: z.string().trim().min(1).max(80),
  role: ROLE,
  phone: z.string().trim().transform((p) => p.replace(/[\s()-]/g, '')).pipe(z.string().regex(PHONE_RE, 'Phone must be in international format, e.g. +919876543210')),
  language: LANGUAGE.default('en'),
  consent: z.boolean().default(false),
  optedOut: z.boolean().default(false),
});

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof z.ZodError) return fail(400, 'VALIDATION_ERROR', err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  return fail(500, 'ACTION_ERROR', err instanceof Error ? err.message : 'unknown error');
}
