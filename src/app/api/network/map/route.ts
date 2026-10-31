// GET /api/network/map?incidentId= — read-only supply network snapshot for the 3D twin
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { buildNetworkMap } from '@/services/networkMapService';

export async function GET(request: NextRequest) {
  const db = new Database(path.join(process.cwd(), 'logis.db'), { readonly: true, fileMustExist: true });
  try {
    return NextResponse.json({ data: buildNetworkMap(db, request.nextUrl.searchParams.get('incidentId')) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: { code: 'NETWORK_MAP_ERROR', message } }, { status: 500 });
  } finally {
    db.close();
  }
}
