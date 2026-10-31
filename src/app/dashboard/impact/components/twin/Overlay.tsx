'use client';

import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import {
  Search, Play, Pause, RotateCcw, RotateCw, Plus, Minus, Crosshair, X, Truck, Warehouse, Factory, Store, Sprout,
  ShieldAlert, PackageX, IndianRupee, Network, ZoomIn, ExternalLink, CheckCircle2, Maximize2, Minimize2,
} from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { MapNode, MapShipment, NetworkMap, ViewMode } from '@/lib/types/network';
import { recallUnits, toneFor, type Tone } from './palette';
import type { Selection } from './state';

export type TraceStatus = 'idle' | 'playing' | 'paused';
export interface ToastState { message: string; tone: 'success' | 'info' }

interface OverlayProps {
  data: NetworkMap;
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  trace: TraceStatus;
  onTrace: () => void;
  revealed: number;
  order: string[];
  selection: Selection;
  onFocus: (s: Selection, close?: boolean) => void;
  onClear: () => void;
  onOpenSite: () => void;
  held: Set<string>;
  onHold: (id: string) => void;
  onRotate: (dir: 1 | -1) => void;
  onZoom: (f: number) => void;
  onReset: () => void;
  toast: ToastState | null;
  searchRef: RefObject<HTMLInputElement | null>;
  fullscreen: boolean;
  onFullscreen: () => void;
}

const TONE_CHIP: Record<Tone, string> = {
  affected: 'text-critical bg-critical/12 border-critical/30',
  uncertain: 'text-warning bg-warning/12 border-warning/30',
  safe: 'text-success bg-success/12 border-success/30',
  idle: 'text-muted-foreground bg-surface-2 border-border',
};
const TONE_LABEL: Record<Tone, string> = { affected: 'Affected', uncertain: 'Verify', safe: 'Clear', idle: 'No stock' };
const KIND_LABEL: Record<MapNode['kind'], string> = { supplier: 'Supplier', plant: 'Processing plant', warehouse: 'Distribution center', store: 'Retail store' };
const KIND_ICON = { supplier: Sprout, plant: Factory, warehouse: Warehouse, store: Store };
const STAGES = ['Supplier lot', 'Plant batch', 'Warehouse', 'In transit', 'Store', 'Sold'];
const STAGE_OF: Record<MapNode['kind'], number> = { supplier: 0, plant: 1, warehouse: 2, store: 4 };

const card = 'pointer-events-auto rounded-xl border border-border bg-surface/90 backdrop-blur-md shadow-sm';

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', TONE_CHIP[tone])}>{children}</span>;
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
      {children}
    </button>
  );
}

function shipmentTone(s: MapShipment, mode: ViewMode, held: boolean): Tone {
  if (held) return 'idle';
  return mode === 'naive' ? 'affected' : s.impact;
}

function SearchBox({ data, onFocus, inputRef }: { data: NetworkMap; onFocus: OverlayProps['onFocus']; inputRef: RefObject<HTMLInputElement | null> }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const nodes = data.nodes
      .filter((n) => `${n.id} ${n.name} ${n.location}`.toLowerCase().includes(t))
      .map((n) => ({ key: n.id, label: n.name, sub: `${n.id} · ${n.location}`, sel: { kind: 'node' as const, id: n.id } }));
    const ships = data.shipments
      .filter((s) => `${s.id} ${s.batchId} ${s.product}`.toLowerCase().includes(t))
      .map((s) => ({ key: s.id, label: `${s.id} · ${s.product}`, sub: `Batch ${s.batchId} · ${s.origin} → ${s.destination}`, sel: { kind: 'truck' as const, id: s.id } }));
    return [...nodes, ...ships].slice(0, 8);
  }, [q, data]);

  return (
    <div className="relative">
      <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) { onFocus(results[0].sel); setQ(''); setOpen(false); e.currentTarget.blur(); }
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          placeholder="Search node, truck, batch"
          className="w-full min-w-0 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border px-1 text-[10px] text-muted-foreground">/</kbd>
      </div>
      {open && results.length > 0 && (
        <div className={cn(card, 'absolute left-0 right-0 top-9 z-30 overflow-hidden bg-surface p-1')}>
          {results.map((r) => (
            <button key={r.key} onMouseDown={() => { onFocus(r.sel); setQ(''); }} className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2">
              <div className="truncate text-[12px] font-semibold text-foreground">{r.label}</div>
              <div className="truncate text-[10px] text-muted-foreground">{r.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitsBar({ node }: { node: MapNode }) {
  const u = node.units;
  const total = u.affected + u.uncertain + u.safe;
  if (total === 0) return <div className="text-[12px] text-muted-foreground">No stock held here.</div>;
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full border border-border bg-surface-2">
        <div className="bg-critical" style={{ width: pct(u.affected) }} />
        <div className="bg-warning" style={{ width: pct(u.uncertain) }} />
        <div className="bg-success" style={{ width: pct(u.safe) }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><div className="text-muted-foreground">Affected</div><div className="font-semibold tabular-nums text-critical">{formatNumber(u.affected)}</div></div>
        <div><div className="text-muted-foreground">Verify</div><div className="font-semibold tabular-nums text-warning">{formatNumber(u.uncertain)}</div></div>
        <div><div className="text-muted-foreground">Clear</div><div className="font-semibold tabular-nums text-success">{formatNumber(u.safe)}</div></div>
      </div>
    </div>
  );
}

function NodeInspector({ node, data, mode, onFocus, held }: { node: MapNode; data: NetworkMap; mode: ViewMode; onFocus: OverlayProps['onFocus']; held: Set<string> }) {
  const tone = toneFor(node, mode);
  const Icon = KIND_ICON[node.kind];
  const ships = data.shipments.filter((s) => s.origin === node.id || s.destination === node.id);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{KIND_LABEL[node.kind]} · {node.id}</div>
          <div className="truncate text-[15px] font-semibold text-foreground">{node.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{node.location}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={tone}>{TONE_LABEL[tone]}</Chip>
        {node.isSource && <Chip tone="affected">Contamination source</Chip>}
        {node.cold && <Chip tone="idle">Cold chain</Chip>}
      </div>
      {node.kind !== 'supplier' && node.kind !== 'plant' && (
        <>
          <UnitsBar node={node} />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-surface-2 p-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">LOGIS recalls</div>
              <div className="text-[16px] font-semibold tabular-nums text-foreground">{formatNumber(recallUnits(node, 'logis'))}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Naive recalls</div>
              <div className="text-[16px] font-semibold tabular-nums text-foreground">{formatNumber(recallUnits(node, 'naive'))}</div>
            </div>
          </div>
        </>
      )}
      {node.kind === 'plant' && <p className="text-[12px] text-muted-foreground">{formatNumber(node.units.affected)} production batches used the contaminated lot.</p>}
      {node.kind === 'supplier' && <p className="text-[12px] text-muted-foreground">{node.isSource ? `Supplied lot ${data.incident.sourceLot}, the origin of this incident.` : 'No link to the contaminated lot.'}</p>}
      {node.stock.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inventory</div>
          <div className="space-y-1">
            {node.stock.slice(0, 6).map((s) => {
              const t: Tone = s.status === 'affected' ? 'affected' : s.status === 'uncertain' ? 'uncertain' : 'safe';
              return (
                <div key={s.label} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-foreground">{s.label}</span>
                  <span className="flex shrink-0 items-center gap-2"><span className="tabular-nums font-semibold">{formatNumber(s.units)}</span><Chip tone={mode === 'naive' ? 'affected' : t}>{mode === 'naive' ? 'Recall' : TONE_LABEL[t]}</Chip></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {ships.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trucks on the road</div>
          <div className="space-y-1">
            {ships.slice(0, 5).map((s) => {
              const t = shipmentTone(s, mode, held.has(s.id));
              return (
                <button key={s.id} onClick={() => onFocus({ kind: 'truck', id: s.id })} className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] hover:bg-surface-2">
                  <span className="flex min-w-0 items-center gap-2"><Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{s.id} → {s.destination}</span></span>
                  <Chip tone={t}>{held.has(s.id) ? 'Held' : TONE_LABEL[t]}</Chip>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TruckInspector({ s, data, mode, held, onHold }: { s: MapShipment; data: NetworkMap; mode: ViewMode; held: boolean; onHold: (id: string) => void }) {
  const name = (id: string) => data.nodes.find((n) => n.id === id)?.name ?? id;
  const tone = shipmentTone(s, mode, held);
  const eta = new Date(s.eta);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Truck className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Shipment · {s.id}</div>
          <div className="truncate text-[15px] font-semibold text-foreground">{s.product}</div>
          <div className="text-[11px] text-muted-foreground">Batch {s.batchId} · {formatNumber(s.quantity)} units</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={tone}>{held ? 'Held for inspection' : s.impact === 'affected' ? 'Carrying affected stock' : s.impact === 'uncertain' ? 'Needs verification' : 'Clean load'}</Chip>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3 text-[12px]">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">From</span><span className="truncate text-right font-medium">{name(s.origin)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">To</span><span className="truncate text-right font-medium">{name(s.destination)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">ETA</span><span className="font-medium tabular-nums">{Number.isNaN(eta.getTime()) ? '—' : eta.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>
      {s.impact !== 'safe' && !held && (
        <button onClick={() => onHold(s.id)} className="flex w-full items-center justify-center gap-2 rounded-full bg-critical px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:opacity-90">
          <ShieldAlert className="h-4 w-4" /> Hold for inspection
        </button>
      )}
      {held && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[12px] font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> Truck stopped. Load quarantined pending lab result.
        </div>
      )}
      {s.impact === 'safe' && <p className="text-[12px] text-muted-foreground">This load has no link to {data.incident.sourceLot}. LOGIS keeps it moving; a naive recall would stop it.</p>}
    </div>
  );
}

export function Overlay(props: OverlayProps) {
  const { data, mode, onMode, trace, onTrace, revealed, order, selection, onFocus, onClear, held, onHold, toast } = props;
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const tracing = trace !== 'idle';

  const kpi = useMemo(() => {
    const atRisk = data.nodes.filter((n) => {
      const t = toneFor(n, mode);
      return n.kind !== 'supplier' && (t === 'affected' || t === 'uncertain');
    }).length;
    const traceNodes = order.map((id) => byId.get(id)).filter((n): n is MapNode => !!n);
    const share = (n: MapNode) => (n.kind === 'plant' ? 0 : mode === 'naive' ? n.units.naiveRecall : n.units.affected);
    const totalAff = traceNodes.reduce((s, n) => s + share(n), 0) || 1;
    const revAff = traceNodes.slice(0, revealed).reduce((s, n) => s + share(n), 0);
    const frac = tracing ? revAff / totalAff : 1;
    const stop = mode === 'naive' ? data.shipments.length : data.shipments.filter((s) => s.impact !== 'safe').length;
    return {
      units: Math.round((mode === 'naive' ? data.totals.naiveUnits : data.totals.affected) * frac),
      atRisk: tracing ? traceNodes.slice(0, revealed).filter((n) => n.kind !== 'supplier').length : atRisk,
      stop,
      held: data.shipments.filter((s) => held.has(s.id)).length,
    };
  }, [data, mode, order, byId, revealed, tracing, held]);

  const stage = useMemo(() => {
    if (tracing) {
      const last = byId.get(order[Math.max(0, revealed - 1)]);
      return last ? STAGE_OF[last.kind] : 0;
    }
    if (selection?.kind === 'truck') return 3;
    if (selection?.kind === 'node') {
      const n = byId.get(selection.id);
      return n ? STAGE_OF[n.kind] : 5;
    }
    return 5;
  }, [tracing, byId, order, revealed, selection]);

  const selNode = selection?.kind === 'node' ? byId.get(selection.id) : undefined;
  const selShip = selection?.kind === 'truck' ? data.shipments.find((s) => s.id === selection.id) : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 @container">
      {/* Top bar */}
      <div className={cn(card, 'absolute left-3 right-3 top-3 flex h-12 items-center gap-3 px-3')}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Network className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              Network Twin
              {data.isDemo && <span className="rounded border border-warning/30 bg-warning/12 px-1 text-[9px] font-bold uppercase tracking-wider text-warning">Demo data</span>}
            </div>
            <div className="hidden truncate text-[10px] text-muted-foreground @3xl:block">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-critical align-middle" />
              {data.incident.id} · {data.incident.title}
            </div>
          </div>
        </div>
        <div className="ml-auto w-44 @4xl:w-60">
          <SearchBox data={data} onFocus={onFocus} inputRef={props.searchRef} />
        </div>
        <div className="flex h-8 items-center rounded-lg border border-border bg-surface-2 p-0.5">
          {(['logis', 'naive'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              disabled={trace === 'playing'}
              className={cn(
                'h-7 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50',
                mode === m ? (m === 'logis' ? 'bg-dark-action text-dark-action-fg shadow-sm' : 'bg-critical text-white shadow-sm') : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'logis' ? 'LOGIS' : 'Naive'}
            </button>
          ))}
        </div>
        <button
          onClick={props.onOpenSite}
          disabled={!data.nodes.some((n) => n.kind === 'warehouse')}
          title="Open the 3D warehouse view (or double-click a warehouse)"
          className="flex h-8 disabled:opacity-40 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 text-[12px] font-semibold text-foreground hover:bg-surface"
        >
          <Warehouse className="h-3.5 w-3.5" />
          <span className="hidden @3xl:inline">Warehouse view</span>
        </button>
        <button
          onClick={onTrace}
          title="Trace the incident (Space)"
          className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-semibold shadow-sm transition-opacity hover:opacity-90', trace === 'playing' ? 'bg-warning/15 text-warning' : 'bg-primary text-primary-foreground')}
        >
          {trace === 'playing' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="hidden @2xl:inline">{trace === 'playing' ? 'Pause' : trace === 'paused' ? 'Resume' : 'Trace incident'}</span>
        </button>
        <div className="hidden items-center @3xl:flex">
          <IconBtn onClick={() => props.onRotate(-1)} title="Rotate left (Shift+R)"><RotateCcw className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onRotate(1)} title="Rotate right (R)"><RotateCw className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onZoom(1 / 1.3)} title="Zoom out"><Minus className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onZoom(1.3)} title="Zoom in"><Plus className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={props.onReset} title="Reset view"><Crosshair className="h-4 w-4" /></IconBtn>
        </div>
        <IconBtn onClick={props.onFullscreen} title={props.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{props.fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</IconBtn>
      </div>

      {/* KPI cards */}
      <div className={cn('absolute left-3 top-[68px] max-w-[620px] grid-cols-4 gap-2', selection ? 'right-[305px] hidden @4xl:grid' : 'right-3 grid')}>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><PackageX className="h-3 w-3" />{mode === 'naive' ? 'Units recalled' : 'Affected units'}</div>
          <div className="mt-1 truncate text-[16px] @4xl:text-[20px] font-semibold leading-none tabular-nums text-critical">{formatNumber(kpi.units)}</div>
        </div>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><ShieldAlert className="h-3 w-3" />Nodes at risk</div>
          <div className="mt-1 truncate text-[16px] @4xl:text-[20px] font-semibold leading-none tabular-nums text-foreground">{kpi.atRisk}<span className="text-[12px] font-medium text-muted-foreground"> / {data.nodes.length - data.nodes.filter((n) => n.kind === 'supplier').length}</span></div>
        </div>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><Truck className="h-3 w-3" />Trucks to stop</div>
          <div className="mt-1 truncate text-[16px] @4xl:text-[20px] font-semibold leading-none tabular-nums text-foreground">{kpi.stop}<span className="text-[12px] font-medium text-muted-foreground"> · {kpi.held} held</span></div>
        </div>
        <div className={cn(card, 'min-w-0 p-2', mode === 'logis' ? 'border-success/40' : 'border-critical/40')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><IndianRupee className="h-3 w-3" />{mode === 'logis' ? 'Saved vs naive' : 'Naive cost'}</div>
          <div className={cn('mt-1 truncate text-[16px] @4xl:text-[20px] font-semibold leading-none tabular-nums', mode === 'logis' ? 'text-success' : 'text-critical')}>
            {formatCurrency(mode === 'logis' ? data.totals.costSaved : data.totals.naiveCost)}
          </div>
        </div>
        <div className={cn(card, 'col-span-4 hidden px-3 py-2 text-[11px] leading-snug text-muted-foreground @5xl:block')}>
          {mode === 'logis' ? (
            <>LOGIS recalls <b className="text-foreground">{formatNumber(data.totals.logisUnits)}</b> units instead of {formatNumber(data.totals.naiveUnits)}: <b className="text-success">{formatNumber(data.totals.unitsSaved)} units</b> spared from an unnecessary recall and <b className="text-success">{formatCurrency(data.totals.costSaved)}</b> saved.</>
          ) : (
            <>A naive recall pulls <b className="text-critical">every stocked node</b> that touched the product: {formatNumber(data.totals.naiveUnits)} units for {formatCurrency(data.totals.naiveCost)}. Switch to LOGIS to see the real path.</>
          )}
        </div>
      </div>

      {/* Inspector */}
      {selection && (
      <div className={cn(card, 'absolute bottom-3 right-3 top-[68px] flex w-[290px] flex-col overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Inspector</div>
          {selection && <IconBtn onClick={onClear} title="Clear selection (Esc)"><X className="h-4 w-4" /></IconBtn>}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selNode && <NodeInspector node={selNode} data={data} mode={mode} onFocus={onFocus} held={held} />}
          {selShip && <TruckInspector s={selShip} data={data} mode={mode} held={held.has(selShip.id)} onHold={onHold} />}
        </div>
        {selection && (
          <div className="flex gap-2 border-t border-border p-3">
            <button onClick={() => onFocus(selection, true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-surface-2">
              <ZoomIn className="h-3.5 w-3.5" /> {selNode?.kind === 'warehouse' ? 'Open warehouse view' : 'Center on map'}
            </button>
            <a href={`/dashboard/incidents/${data.incident.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-dark-action px-3 py-1.5 text-[12px] font-semibold text-dark-action-fg hover:opacity-90">
              Incident <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
      )}

      {/* Bottom: trace stepper + legend */}
      <div className={cn(card, 'absolute bottom-3 left-3 max-w-[760px] px-4 py-2.5', selection ? 'right-[305px]' : 'right-3')}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trace · {data.incident.sourceLot}</div>
          <div className="hidden items-center gap-3 text-[10px] text-muted-foreground @4xl:flex">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-critical" />Affected</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Verify</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Clear</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" />No stock</span>
            <span className="hidden @6xl:inline">· Drag pan · Scroll zoom · / search · Space trace · R rotate · Esc clear</span>
          </div>
        </div>
        <div className="mt-2.5 flex items-center">
          {STAGES.map((label, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-colors',
                    done ? 'border-critical bg-critical text-white' : active ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-muted-foreground')}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className={cn('whitespace-nowrap text-[10px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</div>
                </div>
                {i < STAGES.length - 1 && <div className={cn('mx-1.5 mb-4 h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-critical' : 'bg-border')} />}
              </div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className={cn(card, 'absolute bottom-[92px] left-3 px-4 py-2 text-[12px] font-semibold', toast.tone === 'success' ? 'text-success' : 'text-foreground')}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
