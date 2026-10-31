// PATCH /api/action/contacts/[id] — edit; DELETE — remove
import { NextRequest, NextResponse } from 'next/server';
import { deleteContact, openDb, updateContact } from '@/services/action/store';
import { ContactInput, errorResponse } from '../../_shared';

const Patch = ContactInput.pick({ name: true, role: true, phone: true, language: true, consent: true, optedOut: true }).partial();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = openDb();
  try {
    const { id } = await params;
    updateContact(db, id, Patch.parse(await request.json()));
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = openDb();
  try {
    const { id } = await params;
    deleteContact(db, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
