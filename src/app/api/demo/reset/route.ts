// POST /api/demo/reset - Reset database to initial seed state
import { NextResponse } from 'next/server';
import { seedDatabase } from '@/db/seed';

export async function POST() {
  try {
    seedDatabase();
    return NextResponse.json({ data: { message: 'Database reset to initial seed state' } });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'RESET_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
