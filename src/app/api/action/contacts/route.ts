// GET /api/action/contacts — all recall contacts; POST — add one
import { NextRequest, NextResponse } from 'next/server';
import { insertContact, listContacts, openDb } from '@/services/action/store';
import { ContactInput, errorResponse } from '../_shared';

export async function GET() {
  const db = openDb();
  try {
    return NextResponse.json({ data: listContacts(db) });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}

export async function POST(request: NextRequest) {
  const db = openDb();
  try {
    const input = ContactInput.parse(await request.json());
    return NextResponse.json({ data: insertContact(db, input) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
