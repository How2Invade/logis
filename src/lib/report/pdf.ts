import type { ReportData } from './data';
import { ACTION_TYPE_LABELS } from './data';
import type { GraphNode } from '@/lib/types';
import type { TrackedAction } from '@/lib/actionTracker';
import { formatCurrency, formatNumber } from '@/lib/utils';

/**
 * LOGIS Incident Intelligence Report — dedicated PDF rendering layer.
 * Draws directly with jsPDF primitives (no DOM capture, no window.print, no CSS colour parsing).
 * Every colour is a HEX value converted to RGB, so oklab()/oklch() can never reach the renderer.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;
const CW = PAGE_W - 2 * M;
const TOTAL_PAGES = 6;

const C = {
  ink: '#181818',
  warm: '#F5F2EC',
  panel: '#F8F6F1',
  white: '#FFFFFF',
  orange: '#F29B5B',
  red: '#C85A52',
  green: '#4F8A68',
  amber: '#C58A32',
  neutral: '#737373',
  border: '#E5E1D9',
  normal: '#D8D5CE',
  sold: '#6F6F6F',
  onDarkMuted: '#A7A39C',
};

type RGB = [number, number, number];
type Color = string | RGB;

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function tint(hex: string, t: number): RGB {
  const [r, g, b] = hexToRgb(hex);
  return [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t)];
}
const toRGB = (c: Color): RGB => (typeof c === 'string' ? hexToRgb(c) : c);

const STATUS_RANK: Record<string, number> = { source: 0, affected: 1, uncertain: 2, safe: 3, sold: 4, not_relevant: 5 };
function statusColor(s: string): string {
  if (s === 'affected' || s === 'source') return C.red;
  if (s === 'uncertain') return C.amber;
  if (s === 'safe') return C.green;
  if (s === 'sold') return C.sold;
  return C.normal;
}
function priorityColor(p?: string): string {
  if (p === 'critical') return C.red;
  if (p === 'high') return C.amber;
  return C.neutral;
}

// ---------------------------------------------------------------------------
// Fonts — Noto Sans is embedded so ₹ and typographic punctuation render correctly.
// ---------------------------------------------------------------------------
let fontCache: { regular: string; bold: string } | null = null;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function loadFonts() {
  if (fontCache) return fontCache;
  try {
    const [r, b] = await Promise.all([fetch('/fonts/NotoSans-Regular.ttf'), fetch('/fonts/NotoSans-Bold.ttf')]);
    if (!r.ok || !b.ok) return null;
    fontCache = { regular: bufferToBase64(await r.arrayBuffer()), bold: bufferToBase64(await b.arrayBuffer()) };
    return fontCache;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
class R {
  constructor(public doc: any, public family: string, public unicode: boolean) {}

  t(s: string) {
    return this.unicode ? s : s.replace(/₹/g, 'Rs ').replace(/[—–]/g, '-').replace(/…/g, '...');
  }
  font(style: 'normal' | 'bold', size: number, color: Color) {
    this.doc.setFont(this.family, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...toRGB(color));
  }
  width(s: string, cs = 0) {
    const str = this.t(s);
    return this.doc.getTextWidth(str) + cs * Math.max(0, str.length - 1);
  }
  text(s: string, x: number, y: number, opts: { align?: 'left' | 'right' | 'center'; cs?: number } = {}) {
    const str = this.t(s);
    const cs = opts.cs || 0;
    let xx = x;
    if (opts.align && opts.align !== 'left') {
      const w = this.width(s, cs);
      xx = opts.align === 'right' ? x - w : x - w / 2;
    }
    this.doc.setCharSpace(cs);
    this.doc.text(str, xx, y);
    this.doc.setCharSpace(0);
  }
  label(s: string, x: number, y: number, color: Color = C.neutral, size = 6.5, align?: 'left' | 'right' | 'center') {
    this.font('bold', size, color);
    this.text(s.toUpperCase(), x, y, { cs: 0.35, align });
  }
  split(s: string, w: number, size: number, style: 'normal' | 'bold' = 'normal'): string[] {
    this.font(style, size, C.ink);
    return this.doc.splitTextToSize(this.t(s), w);
  }
  /** Draws wrapped text and returns the y of the last baseline. */
  para(s: string, x: number, y: number, w: number, size: number, color: Color, lh = 1.45, style: 'normal' | 'bold' = 'normal') {
    const lines = this.split(s, w, size, style);
    this.font(style, size, color);
    const step = size * 0.3528 * lh;
    lines.forEach((l, i) => this.doc.text(l, x, y + i * step));
    return y + (lines.length - 1) * step;
  }
  fit(s: string, w: number, size: number, style: 'normal' | 'bold' = 'normal') {
    this.font(style, size, C.ink);
    let str = this.t(s);
    if (this.doc.getTextWidth(str) <= w) return str;
    while (str.length > 1 && this.doc.getTextWidth(str + '…') > w) str = str.slice(0, -1);
    return str.trimEnd() + (this.unicode ? '…' : '...');
  }
  rect(x: number, y: number, w: number, h: number, fill: Color, r = 0) {
    this.doc.setFillColor(...toRGB(fill));
    if (r) this.doc.roundedRect(x, y, w, h, r, r, 'F');
    else this.doc.rect(x, y, w, h, 'F');
  }
  strokeRect(x: number, y: number, w: number, h: number, color: Color, lw = 0.3, r = 0) {
    this.doc.setDrawColor(...toRGB(color));
    this.doc.setLineWidth(lw);
    if (r) this.doc.roundedRect(x, y, w, h, r, r, 'S');
    else this.doc.rect(x, y, w, h, 'S');
  }
  line(x1: number, y1: number, x2: number, y2: number, color: Color, lw = 0.3) {
    this.doc.setDrawColor(...toRGB(color));
    this.doc.setLineWidth(lw);
    this.doc.line(x1, y1, x2, y2);
  }
  circle(x: number, y: number, r: number, fill: Color, stroke?: Color, lw = 0.3) {
    this.doc.setFillColor(...toRGB(fill));
    if (stroke) {
      this.doc.setDrawColor(...toRGB(stroke));
      this.doc.setLineWidth(lw);
      this.doc.circle(x, y, r, 'FD');
    } else {
      this.doc.circle(x, y, r, 'F');
    }
  }
  ring(x: number, y: number, r: number, color: Color, lw = 0.35) {
    this.doc.setDrawColor(...toRGB(color));
    this.doc.setLineWidth(lw);
    this.doc.circle(x, y, r, 'S');
  }
  curve(x1: number, y1: number, x2: number, y2: number, color: Color, lw: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    this.doc.setDrawColor(...toRGB(color));
    this.doc.setLineWidth(lw);
    this.doc.lines([[dx * 0.5, 0, dx * 0.5, dy, dx, dy]], x1, y1, [1, 1], 'S', false);
  }
  arrow(x1: number, y: number, x2: number, color: Color, lw = 0.4) {
    this.line(x1, y, x2 - 1.4, y, color, lw);
    this.doc.setFillColor(...toRGB(color));
    this.doc.triangle(x2, y, x2 - 1.8, y - 1.1, x2 - 1.8, y + 1.1, 'F');
  }
  check(x: number, y: number, size: number, color: Color) {
    this.doc.setDrawColor(...toRGB(color));
    this.doc.setLineWidth(0.45);
    this.doc.setLineCap?.('round');
    this.doc.lines([[size * 0.22, size * 0.24], [size * 0.42, -size * 0.5]], x + size * 0.2, y + size * 0.52, [1, 1], 'S', false);
  }
  pill(s: string, x: number, y: number, fill: Color, color: Color, size = 6, align: 'left' | 'right' = 'left', stroke?: Color) {
    this.font('bold', size, color);
    const w = this.width(s.toUpperCase(), 0.3) + 4;
    const h = size * 0.3528 + 2.4;
    const xx = align === 'right' ? x - w : x;
    this.rect(xx, y, w, h, fill, h / 2);
    if (stroke) this.strokeRect(xx, y, w, h, stroke, 0.3, h / 2);
    this.font('bold', size, color);
    this.text(s.toUpperCase(), xx + 2, y + h - 1.25, { cs: 0.3 });
    return w;
  }
}

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------
function header(r: R, d: ReportData) {
  r.rect(M, 9.6, 3, 3, C.orange, 0.4);
  r.font('bold', 9.5, C.ink);
  r.text('LOGIS', M + 5, 12.4, { cs: 0.6 });
  r.label('Incident Intelligence Report', M + 21, 12.2, C.neutral, 6.2);
  r.font('bold', 8.5, C.ink);
  r.text(d.incident.id, PAGE_W - M, 12.4, { align: 'right' });
  r.line(M, 16.5, PAGE_W - M, 16.5, C.border, 0.3);
}

function footer(r: R, d: ReportData, page: number) {
  const y = PAGE_H - 9;
  r.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14, C.border, 0.3);
  r.label('Synthetic Demonstration Data', M, y, C.neutral, 6);
  r.font('normal', 6.5, C.neutral);
  r.text(`Generated ${fmtDateTime(d.generatedAt)}`, PAGE_W / 2, y, { align: 'center' });
  r.font('bold', 6.8, C.ink);
  r.text(`Page ${page} of ${TOTAL_PAGES}`, PAGE_W - M, y, { align: 'right' });
}

function sectionTitle(r: R, eyebrow: string, title: string, subtitle: string) {
  r.label(eyebrow, M, 27, C.orange, 6.8);
  r.font('bold', 19, C.ink);
  r.text(title, M, 36);
  r.font('normal', 8.8, C.neutral);
  r.text(subtitle, M, 42);
}

function blockLabel(r: R, s: string, x: number, y: number, right?: string) {
  r.rect(x, y - 2.7, 1.1, 3.4, C.orange);
  r.label(s, x + 3, y, C.ink, 7);
  if (right) {
    r.font('normal', 6.5, C.neutral);
    r.text(right, PAGE_W - M, y, { align: 'right' });
  }
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function signed(n: number, f: (v: number) => string) {
  if (n === 0) return 'No change';
  return `${n > 0 ? '+' : '−'}${f(Math.abs(n))}`;
}
function shortProduct(name: string) {
  return name.replace(/^Product [A-Z] - /, '');
}

// ---------------------------------------------------------------------------
// PAGE 1 — Incident & executive summary
// ---------------------------------------------------------------------------
function page1(r: R, d: ReportData) {
  const i = d.incident, im = d.impact, at = d.actionTracker;

  // Hero band
  r.rect(0, 0, PAGE_W, 76, C.ink);
  r.rect(M, 14, 4, 4, C.orange, 0.5);
  r.font('bold', 11, C.white);
  r.text('LOGIS', M + 6.5, 17.6, { cs: 1 });
  r.label('Generated', PAGE_W - M, 14.2, C.onDarkMuted, 5.8, 'right');
  r.font('normal', 8, C.white);
  r.text(fmtDateTime(d.generatedAt), PAGE_W - M, 18.6, { align: 'right' });

  r.label('Incident Intelligence Report', M, 33, C.orange, 8);
  let size = 26;
  r.font('bold', size, C.white);
  while (r.width(i.headline) > CW && size > 16) { size -= 1; r.font('bold', size, C.white); }
  r.text(i.headline, M, 46);
  r.font('normal', 13, C.normal);
  r.text(i.lotLabel, M, 55);

  let px = M;
  px += r.pill(i.severity, px, 61.5, C.red, C.white, 6.2) + 2.5;
  px += r.pill(i.status, px, 61.5, C.ink, C.amber, 6.2, 'left', C.amber) + 4;
  r.font('normal', 7.5, C.onDarkMuted);
  r.text(`Detected ${fmtDateTime(i.detectedAt)}`, px, 65.2);

  // Metadata row
  const metaY = 84;
  const colW = CW / 4;
  const meta: { l: string; v: string; s: string; c: string }[] = [
    { l: 'Incident', v: i.id, s: i.type.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()), c: C.ink },
    { l: 'Severity', v: i.severity.toUpperCase(), s: `Risk score ${d.response.riskScore} / 100`, c: C.red },
    { l: 'Status', v: i.status.toUpperCase(), s: `${at.completed} of ${at.total} actions complete`, c: C.amber },
    { l: 'Source', v: i.sourceName, s: `${i.sourceId} · Lot ${i.sourceLot}`, c: C.ink },
  ];
  meta.forEach((m, k) => {
    const x = M + k * colW + (k === 0 ? 0 : 5);
    if (k > 0) r.line(M + k * colW, metaY, M + k * colW, metaY + 18, C.border, 0.3);
    r.label(m.l, x, metaY + 4, C.neutral, 6);
    r.font('bold', 10.5, m.c);
    r.text(r.fit(m.v, colW - 7, 10.5, 'bold'), x, metaY + 11);
    r.font('normal', 7, C.neutral);
    r.text(r.fit(m.s, colW - 7, 7), x, metaY + 16);
  });
  r.line(M, metaY + 23, PAGE_W - M, metaY + 23, C.border, 0.3);

  // Executive summary
  let y = metaY + 32;
  blockLabel(r, 'Executive Summary', M, y);
  y = r.para(i.executiveSummary, M, y + 7, CW, 9, C.ink, 1.5);

  // KPI row
  y += 7;
  const kh = 27;
  const gap = 4;
  const kw = (CW - gap * 3) / 4;
  const base = im.affectedUnits + im.safeUnits + im.uncertainUnits;
  const kpis = [
    { v: formatNumber(im.affectedUnits), l: 'Affected', s: `${Math.round((im.affectedUnits / base) * 100)}% of traced inventory`, c: C.red },
    { v: formatNumber(im.safeUnits), l: 'Safe', s: `${Math.round((im.safeUnits / base) * 100)}% of traced inventory`, c: C.green },
    { v: formatNumber(im.uncertainUnits), l: 'Needs Verification', s: `${Math.round((im.uncertainUnits / base) * 100)}% of traced inventory`, c: C.amber },
    { v: formatCurrency(im.estimatedImpactINR), l: 'Estimated Impact', s: 'Product value at risk', c: C.ink },
  ];
  kpis.forEach((k, idx) => {
    const x = M + idx * (kw + gap);
    r.rect(x, y, kw, kh, C.panel, 1.5);
    r.rect(x, y, kw, 1.1, k.c);
    r.font('bold', 17, k.c);
    r.text(k.v, x + 4.5, y + 12.5);
    r.label(k.l, x + 4.5, y + 18.5, C.ink, 6);
    r.font('normal', 6.3, C.neutral);
    r.text(k.s, x + 4.5, y + 23);
  });
  y += kh + 8;

  // Composition bar
  r.label('Inventory composition', M, y, C.neutral, 6);
  const comp = [
    { l: 'Affected', v: im.affectedUnits, c: C.red },
    { l: 'Needs verification', v: im.uncertainUnits, c: C.amber },
    { l: 'Safe', v: im.safeUnits, c: C.green },
    { l: 'Already sold', v: im.soldUnits, c: C.sold },
  ];
  const compTotal = comp.reduce((s, c) => s + c.v, 0);
  let bx = M;
  comp.forEach(c => {
    const w = (c.v / compTotal) * CW;
    r.rect(bx, y + 2.5, Math.max(w - 0.4, 0.2), 3.2, c.c);
    bx += w;
  });
  let lx = M;
  comp.forEach(c => {
    r.circle(lx + 1, y + 10, 1, c.c);
    r.font('normal', 6.8, C.ink);
    const s = `${c.l} ${formatNumber(c.v)}`;
    r.text(s, lx + 3, y + 11);
    lx += r.width(s) + 9;
  });
  y += 21;

  // Key findings
  blockLabel(r, 'Key Findings', M, y);
  y += 7;
  i.keyFindings.forEach(f => {
    r.rect(M, y - 2.2, 1.6, 1.6, C.orange, 0.3);
    const last = r.para(f, M + 5, y, CW - 5, 8.5, C.ink, 1.42);
    y = last + 6.2;
  });

  // Synthetic data stamp
  const sy = PAGE_H - 26;
  r.strokeRect(M, sy, CW, 8, C.border, 0.3, 1);
  r.label('Synthetic Demonstration Data', M + 4, sy + 5.1, C.ink, 6.3);
  r.font('normal', 6.5, C.neutral);
  r.text('All figures are generated by LOGIS from its synthetic demonstration dataset.', PAGE_W - M - 4, sy + 5.1, { align: 'right' });
}

// ---------------------------------------------------------------------------
// PAGE 2 — Impact analysis (static network + facility impact)
// ---------------------------------------------------------------------------
interface VNode { id: string; label: string; status: string; col: number; r: number; x: number; y: number; strong?: boolean }

function drawNetwork(r: R, d: ReportData, x: number, y: number, w: number, h: number) {
  const { nodes, edges } = d.impact.network;
  const byId = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));
  const statusOf = (id: string) => byId.get(id)?.status || 'not_relevant';

  r.rect(x, y, w, h, C.panel, 2);

  const colNames = ['Supplier', 'Source Lot', 'Batch', 'Product', 'Warehouse', 'Shipments', 'Store'];
  const firstX = x + 30;
  const lastX = x + w - 9;
  const colX = colNames.map((_, k) => firstX + ((lastX - firstX) / (colNames.length - 1)) * k);
  colNames.forEach((n, k) => r.label(n, colX[k], y + 7, C.neutral, 5.6, 'center'));
  r.line(x + 5, y + 9.5, x + w - 5, y + 9.5, C.border, 0.25);

  const cols: VNode[][] = colNames.map(() => []);
  const vmap = new Map<string, VNode>();
  const add = (v: Omit<VNode, 'x' | 'y'>) => {
    const vn = { ...v, x: colX[v.col], y: 0 };
    cols[v.col].push(vn);
    vmap.set(vn.id, vn);
  };
  const byRank = (a: VNode, b: VNode) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.id.localeCompare(b.id);

  nodes.filter(n => n.type === 'supplier').forEach(n => add({ id: n.id, label: n.label.replace(/\s+(Co\.|Solutions|Exports|Mills|Farms)$/, ''), status: n.status, col: 0, r: 1.5 }));
  nodes.filter(n => n.type === 'lot').forEach(n => add({ id: n.id, label: n.id, status: n.status, col: 1, r: n.status === 'source' ? 2.3 : 1.15, strong: n.status === 'source' }));
  nodes.filter(n => n.type === 'batch').forEach(n => add({ id: n.id, label: n.id, status: n.status, col: 2, r: 1.3 }));
  nodes.filter(n => n.type === 'product').forEach(n => add({ id: n.id, label: shortProduct(n.label), status: n.status, col: 3, r: 1.5 }));
  nodes.filter(n => n.type === 'warehouse').forEach(n => add({ id: n.id, label: n.id, status: n.status, col: 4, r: 1.9 }));

  // Shipments are grouped per origin warehouse and classification (status of the batch they carry).
  const shipments = nodes.filter(n => n.type === 'shipment');
  const groupOf = new Map<string, string>();
  const groups = new Map<string, { origin: string; status: string; count: number }>();
  for (const sh of shipments) {
    const data = (sh.data || {}) as Record<string, unknown>;
    const origin = String(data.origin || '');
    const bStatus = statusOf(String(data.batchId || ''));
    const status = bStatus === 'source' ? 'affected' : bStatus;
    const key = `SG:${origin}:${status}`;
    groupOf.set(sh.id, key);
    const g = groups.get(key) || { origin, status, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  // Stores take the most severe status of the shipments they received.
  const storeStatus = new Map<string, string>();
  for (const e of edges) {
    const gk = groupOf.get(e.source);
    if (!gk) continue;
    const st = groups.get(gk)!.status;
    const cur = storeStatus.get(e.target);
    if (!cur || (STATUS_RANK[st] ?? 9) < (STATUS_RANK[cur] ?? 9)) storeStatus.set(e.target, st);
  }
  nodes.filter(n => n.type === 'store').forEach(n => add({ id: n.id, label: n.id, status: storeStatus.get(n.id) || n.status, col: 6, r: 1.15 }));

  // Order + position columns 0-4
  const top = y + 15;
  const bottom = y + h - 12;
  const place = (list: VNode[], maxStep: number) => {
    const n = list.length;
    const step = n > 1 ? Math.min(maxStep, (bottom - top) / (n - 1)) : 0;
    const mid = (top + bottom) / 2;
    list.forEach((v, k) => (v.y = mid - ((n - 1) * step) / 2 + k * step));
  };
  for (let k = 0; k <= 4; k++) { cols[k].sort(byRank); place(cols[k], k === 0 ? 12 : k === 4 ? 14 : 9); }

  // Shipment groups ordered by warehouse position, then classification
  const groupList = Array.from(groups.entries()).sort((a, b) => {
    const wa = vmap.get(a[1].origin)?.y ?? 0;
    const wb = vmap.get(b[1].origin)?.y ?? 0;
    return wa - wb || (STATUS_RANK[a[1].status] ?? 9) - (STATUS_RANK[b[1].status] ?? 9);
  });
  groupList.forEach(([key, g]) => add({ id: key, label: String(g.count), status: g.status, col: 5, r: Math.min(3.2, 0.9 + Math.sqrt(g.count) * 0.28) }));
  place(cols[5], 9);

  // Visual edges (supplier → lot collapses the raw-material hop)
  const vEdges = new Map<string, { from: string; to: string; status: string }>();
  const addEdge = (from: string, to: string, status: string) => {
    if (!vmap.has(from) || !vmap.has(to)) return;
    const k = `${from}>${to}`;
    const cur = vEdges.get(k);
    if (!cur || (STATUS_RANK[status] ?? 9) < (STATUS_RANK[cur.status] ?? 9)) vEdges.set(k, { from, to, status });
  };
  const supplierOfMaterial = new Map<string, string[]>();
  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s?.type === 'supplier' && t?.type === 'material') supplierOfMaterial.set(t.id, [...(supplierOfMaterial.get(t.id) || []), s.id]);
  }
  for (const e of edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) continue;
    if (s.type === 'material' && t.type === 'lot') (supplierOfMaterial.get(s.id) || []).forEach(sup => addEdge(sup, t.id, t.status));
    else if (t.type === 'shipment') { const g = groupOf.get(t.id)!; addEdge(s.id, g, groups.get(g)!.status); }
    else if (s.type === 'shipment') { const g = groupOf.get(s.id)!; addEdge(g, t.id, groups.get(g)!.status); }
    else if (s.type !== 'supplier') addEdge(s.id, t.id, t.status);
  }

  // Stores ordered by the barycentre of their incoming shipment groups (reduces crossings)
  const bary = new Map<string, number>();
  cols[6].forEach(st => {
    const ys = Array.from(vEdges.values()).filter(e => e.to === st.id).map(e => vmap.get(e.from)!.y);
    bary.set(st.id, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0);
  });
  cols[6].sort((a, b) => (bary.get(a.id)! - bary.get(b.id)!));
  place(cols[6], 9);

  // Edges: draw quiet colours first so affected paths sit on top
  const edgeStyle = (s: string): [RGB, number] => {
    if (s === 'affected' || s === 'source') return [tint(C.red, 0.28), 0.26];
    if (s === 'uncertain') return [tint(C.amber, 0.25), 0.24];
    if (s === 'safe') return [tint(C.green, 0.4), 0.2];
    return [hexToRgb(C.normal), 0.18];
  };
  const order = ['not_relevant', 'sold', 'safe', 'uncertain', 'affected', 'source'];
  Array.from(vEdges.values())
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
    .forEach(e => {
      const a = vmap.get(e.from)!;
      const b = vmap.get(e.to)!;
      const [col, lw] = edgeStyle(e.status);
      r.curve(a.x + a.r, a.y, b.x - b.r, b.y, col, lw);
    });

  // Labels (left of node, on a panel-coloured backing so lines never cut through text)
  cols.forEach(list => list.forEach(v => {
    const size = v.col === 5 ? 5.4 : 5.2;
    const style = v.strong || v.col === 5 ? 'bold' : 'normal';
    r.font(style, size, v.strong ? C.red : v.status === 'safe' ? C.neutral : C.ink);
    const lw = r.width(v.label);
    const lx = v.x - v.r - 1.3;
    r.rect(lx - lw - 0.6, v.y - 1.45, lw + 1.2, 2.5, C.panel);
    r.font(style, size, v.strong ? C.red : v.status === 'safe' ? C.neutral : C.ink);
    r.text(v.label, lx, v.y + 0.65, { align: 'right' });
  }));

  // Nodes
  cols.forEach(list => list.forEach(v => {
    if (v.strong) r.ring(v.x, v.y, v.r + 1.2, C.red, 0.35);
    r.circle(v.x, v.y, v.r, statusColor(v.status), C.white, 0.3);
  }));

  // Legend
  const ly = y + h - 4.5;
  let lx = x + 6;
  const present = new Set(Array.from(vmap.values()).map(v => (v.status === 'source' ? 'affected' : v.status)));
  [
    { s: 'affected', l: 'Affected' },
    { s: 'uncertain', l: 'Needs verification' },
    { s: 'safe', l: 'Safe' },
    { s: 'sold', l: 'Already sold' },
    { s: 'not_relevant', l: 'Normal' },
  ].filter(i => present.has(i.s)).forEach(i => {
    r.circle(lx + 1, ly - 0.7, 1, statusColor(i.s));
    r.font('normal', 6.2, C.ink);
    r.text(i.l, lx + 3, ly);
    lx += r.width(i.l) + 8;
  });
  r.ring(lx + 1.2, ly - 0.7, 1.6, C.red, 0.35);
  r.circle(lx + 1.2, ly - 0.7, 0.9, C.red);
  r.font('normal', 6.2, C.ink);
  r.text(`Source lot ${d.incident.sourceLot}`, lx + 4, ly);
  r.font('normal', 6, C.neutral);
  r.text(`${nodes.length} entities · ${edges.length} links traced · shipments grouped by origin and classification`, x + w - 6, ly, { align: 'right' });
}

function page2(r: R, d: ReportData) {
  const im = d.impact;
  sectionTitle(r, '02 — Impact', 'Impact Analysis', `Downstream trace of lot ${d.incident.sourceLot} from supplier to store.`);

  drawNetwork(r, d, M, 48, CW, 106);

  // Impact summary
  let y = 164;
  blockLabel(r, 'Impact Summary', M, y);
  y += 5;
  const stats = [
    { l: 'Affected', v: im.affectedUnits, c: C.red },
    { l: 'Safe', v: im.safeUnits, c: C.green },
    { l: 'Needs Verification', v: im.uncertainUnits, c: C.amber },
    { l: 'Already Sold', v: im.soldUnits, c: C.sold },
  ];
  const sw = CW / 4;
  stats.forEach((s, k) => {
    const x = M + k * sw;
    if (k > 0) r.line(x, y + 1, x, y + 15, C.border, 0.3);
    const tx = x + (k === 0 ? 0 : 5);
    r.font('bold', 16, s.c);
    r.text(formatNumber(s.v), tx, y + 9);
    r.label(s.l, tx, y + 14.5, C.neutral, 5.9);
  });

  // Facility impact
  y = 198;
  blockLabel(r, 'Facility Impact', M, y, 'Warehouse inventory by classification (units)');
  const fac = im.facilities;
  const chartX = M;
  const chartW = 94;
  const labelW = 0;
  const top = y + 7;
  const rowH = Math.min(15, 62 / Math.max(fac.length, 1));
  const maxTotal = Math.max(...fac.map(f => f.affected + f.safe + f.uncertain), 1);
  const niceMax = Math.ceil(maxTotal / 2000) * 2000;
  const barX = chartX + labelW;
  const barW = chartW - 12;

  // gridlines
  for (let g = 0; g <= 4; g++) {
    const gx = barX + (barW * g) / 4;
    r.line(gx, top, gx, top + rowH * fac.length, C.border, 0.2);
    r.font('normal', 5.5, C.neutral);
    r.text(formatNumber((niceMax * g) / 4), gx, top + rowH * fac.length + 3.5, { align: 'center' });
  }
  fac.forEach((f, k) => {
    const ry = top + k * rowH;
    r.font('bold', 6.8, C.ink);
    r.text(`${f.id}`, barX, ry + 3.6);
    r.font('normal', 6.3, C.neutral);
    r.text(f.name, barX + r.width(f.id) + 6, ry + 3.6);
    let bx = barX;
    const by = ry + 5.2;
    [{ v: f.affected, c: C.red }, { v: f.uncertain, c: C.amber }, { v: f.safe, c: C.green }].forEach(seg => {
      const w = (seg.v / niceMax) * barW;
      if (w > 0) r.rect(bx, by, w, 5, seg.c);
      bx += w;
    });
    r.font('bold', 6.5, C.ink);
    r.text(formatNumber(f.affected + f.safe + f.uncertain), bx + 1.5, by + 3.6);
  });
  // chart legend
  const legY = top + rowH * fac.length + 9;
  let lx = barX;
  [{ l: 'Affected', c: C.red }, { l: 'Needs verification', c: C.amber }, { l: 'Safe', c: C.green }].forEach(i => {
    r.rect(lx, legY - 2.1, 2.4, 2.4, i.c, 0.4);
    r.font('normal', 6.2, C.ink);
    r.text(i.l, lx + 3.6, legY);
    lx += r.width(i.l) + 9;
  });

  // Table
  const tx = M + 102;
  const tw = CW - 102;
  const cols = [{ l: 'Facility', w: tw - 48, a: 'left' as const }, { l: 'Affected', w: 16, a: 'right' as const }, { l: 'Safe', w: 16, a: 'right' as const }, { l: 'Uncertain', w: 16, a: 'right' as const }];
  let ty = top + 1;
  let cx = tx;
  cols.forEach(c => { r.label(c.l, c.a === 'right' ? cx + c.w : cx, ty, C.neutral, 5.6, c.a); cx += c.w; });
  r.line(tx, ty + 2, tx + tw, ty + 2, C.ink, 0.35);
  ty += 2;
  const rowsH = 8.4;
  fac.forEach((f, k) => {
    const ry = ty + k * rowsH;
    r.font('bold', 7.2, C.ink);
    r.text(f.id, tx, ry + 4);
    r.font('normal', 5.8, C.neutral);
    r.text(r.fit(f.name, cols[0].w - 2, 5.8), tx, ry + 7);
    let cx2 = tx + cols[0].w;
    [{ v: f.affected, c: C.red }, { v: f.safe, c: C.green }, { v: f.uncertain, c: C.amber }].forEach((v, j) => {
      cx2 += cols[j + 1].w;
      r.font('bold', 7.4, v.c);
      r.text(formatNumber(v.v), cx2, ry + 5.2, { align: 'right' });
    });
    r.line(tx, ry + rowsH, tx + tw, ry + rowsH, C.border, 0.25);
  });
  const totY = ty + fac.length * rowsH;
  const sum = (k: 'affected' | 'safe' | 'uncertain') => fac.reduce((s, f) => s + f[k], 0);
  r.label('Total', tx, totY + 5.2, C.ink, 6.2);
  let cx3 = tx + cols[0].w;
  (['affected', 'safe', 'uncertain'] as const).forEach((k, j) => {
    cx3 += cols[j + 1].w;
    r.font('bold', 7.4, C.ink);
    r.text(formatNumber(sum(k)), cx3, totY + 5.2, { align: 'right' });
  });
  r.font('normal', 5.8, C.neutral);
  r.para(`Remaining affected units are held at ${im.affectedStores} stores or are in transit across ${im.affectedShipments} shipments.`, tx, totY + 11, tw, 5.8, C.neutral, 1.35);
}

// ---------------------------------------------------------------------------
// PAGE 3 — Recommended response
// ---------------------------------------------------------------------------
function page3(r: R, d: ReportData) {
  const rs = d.response;
  sectionTitle(r, '03 — Decision', 'Recommended Response', 'Broad recall versus LOGIS targeted response for the same incident.');

  const y = 50;
  const pw = 80;
  const ph = 66;
  const lx = M;
  const rx = PAGE_W - M - pw;

  // Naive panel
  r.rect(lx, y, pw, ph, C.panel, 2);
  r.label('Naive Broad Recall', lx + 7, y + 10, C.neutral, 6.6);
  r.font('normal', 6.8, C.neutral);
  r.text('Recall every traced unit, including safe stock', lx + 7, y + 15);
  r.font('bold', 28, C.ink);
  r.text(formatNumber(rs.naive.totalUnits), lx + 7, y + 31);
  r.font('normal', 8, C.neutral);
  r.text('units recalled', lx + 7, y + 37);
  r.line(lx + 7, y + 42, lx + pw - 7, y + 42, C.border, 0.3);
  const naiveRows = [['Estimated cost', formatCurrency(rs.naive.totalCost)], ['Response time', `${rs.naive.estimatedTimeHours} hours`], ['Disruption score', `${rs.naive.disruptionScore} / 100`]];
  naiveRows.forEach((row, k) => {
    r.font('normal', 7.6, C.neutral);
    r.text(row[0], lx + 7, y + 50 + k * 6.5);
    r.font('bold', 8.4, C.ink);
    r.text(row[1], lx + pw - 7, y + 50 + k * 6.5, { align: 'right' });
  });

  // LOGIS panel
  r.rect(rx, y, pw, ph, C.ink, 2);
  r.label('LOGIS Targeted Response', rx + 7, y + 10, C.orange, 6.6);
  r.pill('Recommended', rx + pw - 6, y + 6.6, C.orange, C.ink, 5.4, 'right');
  r.font('normal', 6.8, C.onDarkMuted);
  r.text('Recall only affected and unverified units', rx + 7, y + 15);
  r.font('bold', 28, C.white);
  r.text(formatNumber(rs.logis.totalUnits), rx + 7, y + 31);
  r.font('normal', 8, C.onDarkMuted);
  r.text('units recalled', rx + 7, y + 37);
  r.line(rx + 7, y + 42, rx + pw - 7, y + 42, '#33312E', 0.3);
  const logisRows = [['Estimated cost', formatCurrency(rs.logis.totalCost)], ['Response time', `${rs.logis.estimatedTimeHours} hours`], ['Disruption score', `${rs.logis.disruptionScore} / 100`]];
  logisRows.forEach((row, k) => {
    r.font('normal', 7.6, C.onDarkMuted);
    r.text(row[0], rx + 7, y + 50 + k * 6.5);
    r.font('bold', 8.4, C.white);
    r.text(row[1], rx + pw - 7, y + 50 + k * 6.5, { align: 'right' });
  });

  // VS badge
  r.circle(PAGE_W / 2, y + ph / 2, 5.5, C.white, C.border, 0.4);
  r.font('bold', 7.5, C.neutral);
  r.text('VS', PAGE_W / 2, y + ph / 2 + 1.3, { align: 'center' });

  r.font('normal', 6.3, C.amber);
  r.text('SIMULATED — costs, times and disruption scores are model estimates computed on synthetic data.', M, y + ph + 6);

  // Reduction bars
  let by = 134;
  blockLabel(r, 'Reduction versus Broad Recall', M, by);
  by += 6;
  const metrics = [
    { l: 'Units recalled', n: rs.naive.totalUnits, g: rs.logis.totalUnits, f: formatNumber },
    { l: 'Estimated cost', n: rs.naive.totalCost, g: rs.logis.totalCost, f: formatCurrency },
    { l: 'Response time', n: rs.naive.estimatedTimeHours, g: rs.logis.estimatedTimeHours, f: (v: number) => `${v} h` },
  ];
  const bx = M + 30;
  const bw = 110;
  metrics.forEach((m, k) => {
    const ry = by + k * 13;
    r.font('bold', 7.4, C.ink);
    r.text(m.l, M, ry + 5);
    r.rect(bx, ry + 1, bw, 3.4, tint(C.neutral, 0.72), 0.6);
    r.rect(bx, ry + 5.6, Math.max((m.g / m.n) * bw, 1), 3.4, C.orange, 0.6);
    r.font('normal', 6.2, C.neutral);
    r.text(`Broad ${m.f(m.n)}`, bx + bw + 2, ry + 3.6);
    r.font('bold', 6.2, C.ink);
    r.text(`LOGIS ${m.f(m.g)}`, bx + bw + 2, ry + 8.2);
    const pct = Math.round((1 - m.g / m.n) * 100);
    r.font('bold', 11, C.green);
    r.text(`−${pct}%`, PAGE_W - M, ry + 7, { align: 'right' });
  });

  // Highlight result
  const hy = 184;
  const hh = 32;
  r.rect(M, hy, CW, hh, tint(C.orange, 0.86), 2);
  r.pill('Simulated', PAGE_W - M - 4, hy + 4, C.white, C.amber, 5.4, 'right', C.amber);
  r.font('bold', 26, C.ink);
  r.text(formatNumber(rs.unnecessaryRecallAvoided), M + 8, hy + 18);
  r.font('normal', 8.4, C.ink);
  r.text('unnecessary recalls avoided', M + 8, hy + 25);
  r.line(PAGE_W / 2, hy + 7, PAGE_W / 2, hy + hh - 7, tint(C.orange, 0.55), 0.4);
  r.font('bold', 26, C.green);
  r.text(formatCurrency(rs.costSaved), PAGE_W / 2 + 8, hy + 18);
  r.font('normal', 8.4, C.ink);
  r.text('estimated savings versus broad recall', PAGE_W / 2 + 8, hy + 25);

  // Why LOGIS
  let wy = 228;
  blockLabel(r, 'Why LOGIS?', M, wy);
  wy += 8;
  const reasons = [
    'Traces downstream dependencies',
    'Separates affected from safe inventory',
    'Identifies uncertain inventory requiring verification',
    'Produces targeted response actions',
    'Reduces unnecessary operational disruption',
  ];
  const colW = CW / 2;
  reasons.forEach((s, k) => {
    const cx = M + (k % 2) * colW;
    const cy = wy + Math.floor(k / 2) * 9;
    r.font('bold', 8, C.orange);
    r.text(String(k + 1).padStart(2, '0'), cx, cy);
    r.font('normal', 8.4, C.ink);
    r.text(s, cx + 7, cy);
  });
  r.font('normal', 6.8, C.neutral);
  r.text(`Incident risk score ${rs.riskScore} / 100 (${rs.riskLevel.toUpperCase()}).`, M, wy + 30);
}

// ---------------------------------------------------------------------------
// PAGE 4 — Response execution (live Action Tracker)
// ---------------------------------------------------------------------------
function selectActions(actions: TrackedAction[], limit: number): TrackedAction[] {
  const done = actions.filter(a => a.completed);
  const pending = actions.filter(a => !a.completed).sort((a, b) => a.priority - b.priority);
  const picked: TrackedAction[] = done.slice(0, limit);
  const byType = new Map<string, TrackedAction[]>();
  pending.forEach(a => byType.set(a.type, [...(byType.get(a.type) || []), a]));
  let round = 0;
  while (picked.length < limit && Array.from(byType.values()).some(l => l.length > round)) {
    for (const list of byType.values()) {
      if (picked.length >= limit) break;
      if (list[round]) picked.push(list[round]);
    }
    round++;
  }
  return picked;
}

function page4(r: R, d: ReportData) {
  const at = d.actionTracker;
  sectionTitle(r, '04 — Execution', 'Response Execution', at.source === 'live_tracker'
    ? 'Live status of the Action Tracker at the time this report was generated.'
    : 'Action Tracker generated from the recommended response plan; no actions have been completed yet.');

  // Progress block
  const y = 50;
  r.rect(M, y, CW, 30, C.panel, 2);
  r.label('Response Progress', M + 7, y + 8.5, C.neutral, 6.4);
  r.font('bold', 22, C.ink);
  const big = `${at.completed} / ${at.total}`;
  r.text(big, M + 7, y + 19.5);
  r.label('Completed', M + 9 + r.width(big) + 0, y + 19.3, C.neutral, 6.4);
  r.font('bold', 22, C.orange);
  r.text(`${at.progressPercent}%`, PAGE_W - M - 7, y + 19.5, { align: 'right' });
  r.rect(M + 7, y + 23.5, CW - 14, 2.2, C.border, 1.1);
  if (at.progressPercent > 0) r.rect(M + 7, y + 23.5, Math.max(((CW - 14) * at.progressPercent) / 100, 2.2), 2.2, at.progressPercent === 100 ? C.green : C.ink, 1.1);

  // Checklist
  const limit = 10;
  const rows = selectActions(at.actions, limit);
  let ly = 90;
  blockLabel(r, 'Action Tracker', M, ly, `Showing ${rows.length} of ${at.total} actions · completed first, then highest priority per workstream`);
  ly += 4;
  const rowH = 9.8;
  rows.forEach((a, k) => {
    const ry = ly + k * rowH;
    const bxs = 3.8;
    if (a.completed) {
      r.rect(M, ry + 1.6, bxs, bxs, C.green, 0.7);
      r.check(M, ry + 1.6, bxs, C.white);
    } else {
      r.strokeRect(M, ry + 1.6, bxs, bxs, C.neutral, 0.35, 0.7);
    }
    const tx = M + 7.5;
    const maxW = CW - 7.5 - 30;
    const desc = r.fit(a.description, maxW, 8.4, 'bold');
    r.font('bold', 8.4, a.completed ? C.neutral : C.ink);
    r.text(desc, tx, ry + 4.6);
    if (a.completed) {
      const w = r.width(desc);
      r.line(tx, ry + 3.5, tx + w, ry + 3.5, C.neutral, 0.3);
    }
    const meta = a.completed
      ? `Completed${a.completedAt ? ` · ${a.completedAt}` : ''} · ${a.owner || 'Unassigned'} · ${formatNumber(a.units || 0)} units`
      : `Assigned to ${a.owner || 'Unassigned'} · ${formatNumber(a.units || 0)} units · ${a.location}`;
    r.font('normal', 6.6, a.completed ? C.green : C.neutral);
    r.text(r.fit(meta, maxW, 6.6), tx, ry + 8.3);
    if (a.completed) {
      r.label('Done', PAGE_W - M, ry + 5, C.green, 6.2, 'right');
    } else {
      const pc = priorityColor(a.priorityLevel);
      r.pill(`${a.priorityLevel || 'medium'}`, PAGE_W - M, ry + 1.8, tint(pc, 0.85), pc, 5.6, 'right');
    }
    r.line(M, ry + rowH, PAGE_W - M, ry + rowH, C.border, 0.25);
  });

  // Workstreams table
  let ty = ly + rows.length * rowH + 10;
  blockLabel(r, 'Workstreams', M, ty);
  ty += 6;
  const cols = [
    { l: 'Workstream', w: 52, a: 'left' as const },
    { l: 'Priority', w: 24, a: 'left' as const },
    { l: 'Actions', w: 18, a: 'right' as const },
    { l: 'Completed', w: 24, a: 'right' as const },
    { l: 'Units', w: 24, a: 'right' as const },
    { l: 'Est. cost', w: 32, a: 'right' as const },
  ];
  let cx = M;
  cols.forEach(c => { r.label(c.l, c.a === 'right' ? cx + c.w : cx, ty, C.neutral, 5.6, c.a); cx += c.w; });
  r.line(M, ty + 2, PAGE_W - M, ty + 2, C.ink, 0.35);
  ty += 2;
  const trh = 6.2;
  at.byType.forEach((t, k) => {
    const ry = ty + k * trh;
    const vals = [t.label, t.priority, String(t.total), `${t.completed} / ${t.total}`, formatNumber(t.units), formatCurrency(t.cost)];
    let x = M;
    vals.forEach((v, j) => {
      const c = cols[j];
      if (j === 1) {
        r.label(v, x, ry + 4.3, priorityColor(v), 5.8);
      } else {
        r.font(j === 0 ? 'bold' : 'normal', 7.2, C.ink);
        r.text(v, c.a === 'right' ? x + c.w : x, ry + 4.3, { align: c.a });
      }
      x += c.w;
    });
    r.line(M, ry + trh, PAGE_W - M, ry + trh, C.border, 0.25);
  });

  // Remaining band
  const by = Math.min(ty + at.byType.length * trh + 7, PAGE_H - 34);
  const hw = (CW - 4) / 2;
  [
    { l: 'Critical actions remaining', v: at.remainingCritical, c: C.red },
    { l: 'High priority actions remaining', v: at.remainingHigh, c: C.amber },
  ].forEach((b, k) => {
    const x = M + k * (hw + 4);
    r.rect(x, by, hw, 15, tint(b.c, 0.88), 1.5);
    r.font('bold', 18, b.c);
    r.text(String(b.v), x + 6, by + 10.6);
    r.label(b.l, x + 8 + r.width(String(b.v)) + 2, by + 9.3, b.c, 6.4);
  });
}

// ---------------------------------------------------------------------------
// PAGE 5 — Recovery & resource optimisation
// ---------------------------------------------------------------------------
function page5(r: R, d: ReportData) {
  const rc = d.recovery;
  sectionTitle(r, '05 — Recovery', 'Recovery & Resource Optimization', 'Redirecting capacity freed by the incident toward unmet demand.');

  // KPI cards
  const y = 50;
  const gap = 4;
  const kw = (CW - gap * 3) / 4;
  [
    { l: 'Idle Machines', v: formatNumber(rc.idleMachines) },
    { l: 'Available Workers', v: formatNumber(rc.availableWorkers) },
    { l: 'Free Storage', v: formatNumber(rc.freeStorage), s: 'slots' },
    { l: 'Available Trucks', v: formatNumber(rc.availableTrucks) },
  ].forEach((k, idx) => {
    const x = M + idx * (kw + gap);
    r.rect(x, y, kw, 23, C.panel, 1.5);
    r.rect(x, y + 4, 1, 15, C.orange);
    r.font('bold', 18, C.ink);
    r.text(k.v, x + 5, y + 12);
    if (k.s) { r.font('normal', 7, C.neutral); r.text(k.s, x + 6 + r.width(k.v) + 1, y + 12); r.font('bold', 18, C.ink); }
    r.label(k.l, x + 5, y + 18, C.neutral, 5.9);
  });

  // Summary strip
  const sy = 80;
  const sw = CW / 4;
  [
    { l: 'Potential recovery value', v: formatCurrency(rc.potentialRecoveryValue), c: C.green },
    { l: 'Idle resources', v: `${rc.idleBefore} → ${rc.idleAfter}`, c: C.ink },
    { l: 'Recovery cost', v: formatCurrency(rc.estimatedCost), c: C.ink },
    { l: 'Recovery time', v: `${rc.estimatedRecoveryTimeHours} hours`, c: C.ink },
  ].forEach((s, k) => {
    const x = M + k * sw;
    if (k > 0) r.line(x, sy, x, sy + 10, C.border, 0.3);
    const tx = x + (k === 0 ? 0 : 5);
    r.label(s.l, tx, sy + 3, C.neutral, 5.6);
    r.font('bold', 10, s.c);
    if (s.v.includes('→')) {
      const [a, b] = s.v.split(' → ');
      r.text(a, tx, sy + 9.5);
      const aw = r.width(a);
      r.arrow(tx + aw + 1.5, sy + 8.2, tx + aw + 7.5, C.neutral, 0.35);
      r.font('bold', 10, s.c);
      r.text(b, tx + aw + 9, sy + 9.5);
    } else {
      r.text(s.v, tx, sy + 9.5);
    }
  });

  // Unmet demand table
  let ty = 104;
  blockLabel(r, 'Unmet Demand', M, ty);
  ty += 6;
  const cols = [
    { l: 'Product', w: 58, a: 'left' as const },
    { l: 'Demand', w: 22, a: 'right' as const },
    { l: 'Current supply', w: 28, a: 'right' as const },
    { l: 'Gap', w: 20, a: 'right' as const },
    { l: 'Value at risk', w: 28, a: 'right' as const },
    { l: 'Deadline', w: 18, a: 'right' as const },
  ];
  let cx = M;
  cols.forEach(c => { r.label(c.l, c.a === 'right' ? cx + c.w : cx, ty, C.neutral, 5.6, c.a); cx += c.w; });
  r.line(M, ty + 2, PAGE_W - M, ty + 2, C.ink, 0.35);
  ty += 2;
  const trh = 6.4;
  rc.unmetDemand.forEach((u, k) => {
    const ry = ty + k * trh;
    const vals = [shortProduct(u.productName), formatNumber(u.demandUnits), formatNumber(u.currentCapacity), formatNumber(u.gap), formatCurrency(u.totalValue),
      new Date(u.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })];
    let x = M;
    vals.forEach((v, j) => {
      const c = cols[j];
      r.font(j === 0 || j === 3 ? 'bold' : 'normal', 7.2, j === 3 ? C.red : C.ink);
      r.text(v, c.a === 'right' ? x + c.w : x, ry + 4.4, { align: c.a });
      x += c.w;
    });
    r.line(M, ry + trh, PAGE_W - M, ry + trh, C.border, 0.25);
  });
  const totY = ty + rc.unmetDemand.length * trh;
  r.label('Total', M, totY + 4.6, C.ink, 6);
  const tGap = rc.unmetDemand.reduce((s, u) => s + u.gap, 0);
  const tVal = rc.unmetDemand.reduce((s, u) => s + u.totalValue, 0);
  r.font('bold', 7.2, C.red);
  r.text(formatNumber(tGap), M + 58 + 22 + 28 + 20, totY + 4.6, { align: 'right' });
  r.font('bold', 7.2, C.ink);
  r.text(formatCurrency(tVal), M + 58 + 22 + 28 + 20 + 28, totY + 4.6, { align: 'right' });

  // Proposed allocations
  let ay = totY + 15;
  blockLabel(r, 'Proposed Allocations', M, ay, `${rc.allocations.length} recommendations from the Recovery Center`);
  ay += 4;
  const allocs = rc.allocations.slice(0, 4);
  const aw = (CW - 4) / 2;
  const ah = 21;
  allocs.forEach((a, k) => {
    const x = M + (k % 2) * (aw + 4);
    const yy = ay + Math.floor(k / 2) * (ah + 3);
    r.strokeRect(x, yy, aw, ah, C.border, 0.3, 1.5);
    r.font('bold', 8.4, C.ink);
    r.text(a.resourceName, x + 5, yy + 6.5);
    const rw = r.width(a.resourceName);
    r.arrow(x + 5 + rw + 2, yy + 5.4, x + 5 + rw + 9, C.orange, 0.45);
    r.font('bold', 8.4, C.ink);
    r.text(r.fit(shortProduct(a.targetProductName), aw - rw - 22, 8.4, 'bold'), x + 5 + rw + 11, yy + 6.5);
    const gapRow = rc.unmetDemand.find(u => u.productId === a.targetProductId);
    const cover = gapRow && gapRow.gap > 0 ? Math.round((a.demandCovered / gapRow.gap) * 100) : null;
    const third = aw / 3;
    [
      { l: 'Capacity', v: `${formatNumber(a.capacityUsed)} units/day` },
      { l: 'Expected benefit', v: formatCurrency(a.expectedBenefit), c: C.green },
      { l: cover !== null ? 'Gap covered' : 'Delay reduction', v: cover !== null ? `${cover}%` : `${a.expectedDelayReduction} h` },
    ].forEach((m, j) => {
      const mx = x + 5 + j * (third - 1.5);
      r.label(m.l, mx, yy + 12.5, C.neutral, 5.3);
      r.font('bold', 7.8, m.c || C.ink);
      r.text(m.v, mx, yy + 17.5);
    });
  });

  // Capacity vs demand chart
  let cy = ay + Math.ceil(allocs.length / 2) * (ah + 3) + 8;
  blockLabel(r, 'Available Capacity vs Unmet Demand', M, cy);
  // legend
  let lx = PAGE_W - M - 62;
  [{ l: 'Unmet demand', c: tint(C.red, 0.35) }, { l: 'Allocated capacity', c: C.green }].forEach(i => {
    r.rect(lx, cy - 2.2, 2.4, 2.4, i.c, 0.4);
    r.font('normal', 6.2, C.ink);
    r.text(i.l, lx + 3.6, cy);
    lx += r.width(i.l) + 9;
  });
  cy += 4;
  const capBy = new Map<string, number>();
  rc.allocations.forEach(a => capBy.set(a.targetProductId, (capBy.get(a.targetProductId) || 0) + a.capacityUsed));
  const maxV = Math.max(...rc.unmetDemand.map(u => Math.max(u.gap, capBy.get(u.productId) || 0)), 1);
  const labelW = 42;
  const barW = CW - labelW - 22;
  const avail = PAGE_H - 22 - cy;
  const rh = Math.min(8.4, avail / Math.max(rc.unmetDemand.length, 1));
  rc.unmetDemand.forEach((u, k) => {
    const ry = cy + k * rh;
    r.font('normal', 6.6, C.ink);
    r.text(r.fit(shortProduct(u.productName), labelW - 3, 6.6), M, ry + 4.4);
    const cap = capBy.get(u.productId) || 0;
    const gw = (u.gap / maxV) * barW;
    const cw = (cap / maxV) * barW;
    r.rect(M + labelW, ry + 1, Math.max(gw, 0.6), 2.8, tint(C.red, 0.35), 0.5);
    r.rect(M + labelW, ry + 4.3, Math.max(cw, 0.6), 2.8, cap > 0 ? C.green : C.border, 0.5);
    r.font('normal', 5.8, C.neutral);
    r.text(formatNumber(u.gap), M + labelW + gw + 1.5, ry + 3.4);
    r.font('bold', 5.8, cap > 0 ? C.green : C.neutral);
    r.text(cap > 0 ? `${formatNumber(cap)}/day` : 'No idle capacity', M + labelW + Math.max(cw, 0.6) + 1.5, ry + 6.7);
  });
}

// ---------------------------------------------------------------------------
// PAGE 6 — Scenario analysis & conclusion
// ---------------------------------------------------------------------------
function page6(r: R, d: ReportData) {
  const sc = d.scenario;
  sectionTitle(r, '06 — Next Steps', 'Scenario Analysis', 'How the response changes under alternative operating conditions.');

  // Scenario cards
  const y = 50;
  const gap = 3;
  const cw = (CW - gap * 3) / 4;
  const ch = 27;
  sc.presets.forEach((p, k) => {
    const x = M + k * (cw + gap);
    const active = p.id === sc.activeId;
    r.rect(x, y, cw, ch, active ? C.ink : C.panel, 1.5);
    if (active) r.pill('Active', x + 4, y + 3.5, C.orange, C.ink, 5.2);
    else r.label(`Scenario ${k + 1}`, x + 4, y + 6.4, C.neutral, 5.2);
    const tl = r.split(p.title, cw - 8, 7.6, 'bold').slice(0, 2);
    r.font('bold', 7.6, active ? C.white : C.ink);
    tl.forEach((l, j) => r.doc.text(l, x + 4, y + 13 + j * 3.6));
    const dl = r.split(p.description, cw - 8, 6.1).slice(0, 2);
    r.font('normal', 6.1, active ? C.onDarkMuted : C.neutral);
    dl.forEach((l, j) => r.doc.text(l, x + 4, y + 21 + j * 2.9));
  });

  // Active scenario metrics
  let my = 88;
  blockLabel(r, `Active Scenario — ${sc.activeTitle}`, M, my, sc.selectedInSimulator ? 'Last scenario run in the Scenario Simulator' : 'Default scenario (no simulation run yet)');
  my += 4;
  const b = sc.baseline, s = sc.scenario;
  const tiles = [
    { l: 'Affected Units', v: formatNumber(s.affectedUnits), delta: s.affectedUnits - b.affectedUnits, f: formatNumber, worseUp: true },
    { l: 'Safe Units', v: formatNumber(s.safeUnits), delta: s.safeUnits - b.safeUnits, f: formatNumber, worseUp: false },
    { l: 'Response Cost', v: formatCurrency(s.responseCost), delta: s.responseCost - b.responseCost, f: formatCurrency, worseUp: true },
    { l: 'Response Time', v: `${s.responseTimeHours} h`, delta: s.responseTimeHours - b.responseTimeHours, f: (v: number) => `${v} h`, worseUp: true },
  ];
  const tw = CW / 4;
  tiles.forEach((t, k) => {
    const x = M + k * tw;
    if (k > 0) r.line(x, my + 1, x, my + 19, C.border, 0.3);
    const tx = x + (k === 0 ? 0 : 5);
    r.label(t.l, tx, my + 4, C.neutral, 5.8);
    r.font('bold', 15, C.ink);
    r.text(t.v, tx, my + 12);
    const worse = t.delta !== 0 && (t.delta > 0) === t.worseUp;
    r.font('bold', 6.6, t.delta === 0 ? C.neutral : worse ? C.red : C.green);
    r.text(`${signed(t.delta, t.f)}${t.delta === 0 ? '' : ' vs baseline'}`, tx, my + 17.5);
  });

  // Comparison table
  let ty = 124;
  blockLabel(r, 'Impact Comparison', M, ty);
  ty += 6;
  const cols = [
    { l: 'Metric', w: 64, a: 'left' as const },
    { l: 'Baseline', w: 34, a: 'right' as const },
    { l: 'Scenario', w: 34, a: 'right' as const },
    { l: 'Change', w: 42, a: 'right' as const },
  ];
  let cx = M;
  cols.forEach(c => { r.label(c.l, c.a === 'right' ? cx + c.w : cx, ty, C.neutral, 5.6, c.a); cx += c.w; });
  r.line(M, ty + 2, PAGE_W - M, ty + 2, C.ink, 0.35);
  ty += 2;
  const rows = [
    { l: 'Affected Units', b: b.affectedUnits, s: s.affectedUnits, f: formatNumber, worseUp: true },
    { l: 'Safe Units', b: b.safeUnits, s: s.safeUnits, f: formatNumber, worseUp: false },
    { l: 'Uncertain Units', b: b.uncertainUnits, s: s.uncertainUnits, f: formatNumber, worseUp: true },
    { l: 'Response Cost', b: b.responseCost, s: s.responseCost, f: formatCurrency, worseUp: true },
    { l: 'Response Time', b: b.responseTimeHours, s: s.responseTimeHours, f: (v: number) => `${v} h`, worseUp: true },
  ];
  const trh = 7;
  rows.forEach((row, k) => {
    const ry = ty + k * trh;
    const delta = row.s - row.b;
    const worse = delta !== 0 && (delta > 0) === row.worseUp;
    let x = M;
    r.font('bold', 7.6, C.ink); r.text(row.l, x, ry + 4.8); x += cols[0].w;
    r.font('normal', 7.6, C.ink); r.text(row.f(row.b), x + cols[1].w, ry + 4.8, { align: 'right' }); x += cols[1].w;
    r.font('bold', 7.6, C.ink); r.text(row.f(row.s), x + cols[2].w, ry + 4.8, { align: 'right' }); x += cols[2].w;
    r.font('bold', 7.6, delta === 0 ? C.neutral : worse ? C.red : C.green);
    r.text(signed(delta, row.f), x + cols[3].w, ry + 4.8, { align: 'right' });
    r.line(M, ry + trh, PAGE_W - M, ry + trh, C.border, 0.25);
  });

  // Conclusion
  const cy = 176;
  const chh = PAGE_H - 22 - cy;
  r.rect(M, cy, CW, chh, C.ink, 2.5);
  r.label('Conclusion', M + 8, cy + 10, C.orange, 7);
  r.font('normal', 8.4, C.onDarkMuted);
  r.text('LOGIS converts complex supply-chain incident data into four decisive steps:', M + 8, cy + 16.5);

  const steps = [
    { t: 'TRACE', m: `${formatNumber(d.impact.network.nodes.length)} entities traced` },
    { t: 'ASSESS', m: `${formatNumber(d.impact.affectedUnits)} affected isolated` },
    { t: 'RESPOND', m: `${formatNumber(d.response.logis.totalUnits)} units targeted` },
    { t: 'RECOVER', m: `${formatCurrency(d.recovery.potentialRecoveryValue)} recoverable` },
  ];
  const sx = M + 8;
  const sWidth = CW - 16;
  const boxW = (sWidth - 3 * 9) / 4;
  steps.forEach((st, k) => {
    const x = sx + k * (boxW + 9);
    const yy = cy + 23;
    r.strokeRect(x, yy, boxW, 19, '#3A3835', 0.4, 1.5);
    r.font('bold', 7, C.orange);
    r.text(String(k + 1).padStart(2, '0'), x + 4, yy + 6);
    r.font('bold', 11, C.white);
    r.text(st.t, x + 4, yy + 12.2, { cs: 0.6 });
    r.font('normal', 6.2, C.onDarkMuted);
    r.text(r.fit(st.m, boxW - 8, 6.2), x + 4, yy + 16.4);
    if (k < 3) r.arrow(x + boxW + 1.8, yy + 9.5, x + boxW + 7.4, C.orange, 0.5);
  });

  const closing =
    `From a single failed inspection on lot ${d.incident.sourceLot}, LOGIS isolated ${formatNumber(d.impact.affectedUnits)} affected units from ` +
    `${formatNumber(d.impact.safeUnits)} safe units, replaced a ${formatNumber(d.response.naive.totalUnits)}-unit broad recall with a ` +
    `${formatNumber(d.response.logis.totalUnits)}-unit targeted response, and redirected idle capacity toward ${formatCurrency(d.recovery.potentialRecoveryValue)} of unmet demand.`;
  const last = r.para(closing, M + 8, cy + 52, CW - 16, 8.6, C.white, 1.5);
  r.font('bold', 10.5, C.orange);
  r.text('Understand the impact. Act precisely. Recover faster.', M + 8, Math.min(last + 9, cy + chh - 6));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function generateLogisPDF(data: ReportData, filename: string): Promise<void> {
  const mod: any = await import('jspdf');
  const JsPDF = mod.jsPDF || mod.default;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const fonts = await loadFonts();
  let family = 'helvetica';
  let unicode = false;
  if (fonts) {
    try {
      doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
      family = 'NotoSans';
      unicode = true;
    } catch {
      family = 'helvetica';
      unicode = false;
    }
  }

  doc.setProperties({
    title: `LOGIS Incident Intelligence Report — ${data.incident.id}`,
    subject: data.incident.title,
    author: 'LOGIS',
    keywords: 'LOGIS, incident, synthetic demonstration data',
    creator: 'LOGIS Report Renderer',
  });

  const r = new R(doc, family, unicode);
  const pages = [page1, page2, page3, page4, page5, page6];
  pages.forEach((draw, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    if (idx > 0) header(r, data);
    draw(r, data);
    footer(r, data, idx + 1);
  });

  doc.save(filename);
}

export { ACTION_TYPE_LABELS };
