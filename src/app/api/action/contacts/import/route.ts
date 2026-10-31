// POST /api/action/contacts/import — CSV: location_id,name,role,phone,language,consent
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insertContact, openDb } from '@/services/action/store';
import { ContactInput, errorResponse } from '../../_shared';

const Body = z.object({ csv: z.string().max(500_000) });

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export async function POST(request: NextRequest) {
  const db = openDb();
  try {
    const { csv } = Body.parse(await request.json());
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = splitCsvLine(lines[0] ?? '').map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const col = (row: string[], name: string) => row[header.indexOf(name)] ?? '';
    const known = new Map<string, 'warehouse' | 'store'>();
    for (const r of db.prepare('SELECT id FROM warehouses').all() as Array<{ id: string }>) known.set(r.id, 'warehouse');
    for (const r of db.prepare('SELECT id FROM stores').all() as Array<{ id: string }>) known.set(r.id, 'store');

    let added = 0;
    const errors: string[] = [];
    lines.slice(1).forEach((line, i) => {
      const row = splitCsvLine(line);
      const locationId = col(row, 'location_id');
      const locationType = known.get(locationId);
      if (!locationType) {
        errors.push(`Row ${i + 2}: unknown location_id "${locationId}"`);
        return;
      }
      const parsed = ContactInput.safeParse({
        locationId,
        locationType,
        name: col(row, 'name'),
        role: col(row, 'role') || (locationType === 'warehouse' ? 'warehouse_manager' : 'store_owner'),
        phone: col(row, 'phone'),
        language: col(row, 'language') || 'en',
        consent: ['yes', 'true', '1', 'y'].includes(col(row, 'consent').toLowerCase()),
      });
      if (!parsed.success) {
        errors.push(`Row ${i + 2}: ${parsed.error.issues.map((x) => x.message).join('; ')}`);
        return;
      }
      insertContact(db, parsed.data);
      added++;
    });
    return NextResponse.json({ data: { added, errors } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    db.close();
  }
}
