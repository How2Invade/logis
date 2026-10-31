// GET /api/action/maplibre/[file] — serves MapLibre's module worker files from the installed package.
// The bundler does not emit MapLibre 6's separate worker modules, so they are served from node_modules.
import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const ALLOWED = new Set(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!ALLOWED.has(file)) return new Response('Not found', { status: 404 });
  const body = await readFile(path.join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist', file), 'utf8');
  return new Response(body, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
