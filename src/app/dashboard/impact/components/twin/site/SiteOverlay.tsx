'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, RotateCcw, RotateCw, Plus, Minus, Home, X, Truck, Package, Forklift,
  Warehouse, ShieldAlert, IndianRupee, CheckCircle2, AlertTriangle, Boxes, Maximize2, Minimize2, ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { ImpactTone, MapNode, NetworkMap, ViewMode } from '@/lib/types/network';
import type { PalletInfo } from './siteLayout';
import type { SiteStats } from './siteSim';
import type { SiteSelection } from './SiteScene';

const card = 'pointer-events-auto rounded-xl border border-border bg-surface/90 backdrop-blur-md shadow-sm';
const CHIP: Record<ImpactTone | 'idle' | 'info', string> = {
  affected: 'text-critical bg-critical/12 border-critical/30',
  uncertain: 'text-warning bg-warning/12 border-warning/30',
  safe: 'text-success bg-success/12 border-success/30',
  idle: 'text-muted-foreground bg-surface-2 border-border',
  info: 'text-primary bg-primary/12 border-primary/30',
};
const LABEL: Record<ImpactTone, string> = { affected: 'Affected', uncertain: 'Verify', safe: 'Clear' };

function Chip({ tone, children }: { tone: keyof typeof CHIP; children: ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', CHIP[tone])}>{children}</span>;
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
      {children}
    </button>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-surface-2">
      <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right font-medium text-foreground">{v}</span>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden h-8 items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 text-[11px] font-semibold text-success @4xl:flex">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
      Live {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </div>
  );
}

export interface SiteOverlayProps {
  data: NetworkMap;
  node: MapNode;
  warehouses: MapNode[];
  pallets: PalletInfo[];
  stats: SiteStats | null;
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  onRun: () => void;
  selection: SiteSelection;
  onSelect: (s: SiteSelection) => void;
  onSite: (id: string) => void;
  onBack: () => void;
  held: Set<string>;
  onHold: (id: string) => void;
  onRotate: (d: 1 | -1) => void;
  onZoom: (f: number) => void;
  onReset: () => void;
  palletZone: (id: string) => string;
  compact: boolean;
  fullscreen: boolean;
  onFullscreen: () => void;
}

type Tab = 'docks' | 'forklifts' | 'trucks';

export function SiteOverlay(props: SiteOverlayProps) {
  const { data, node, warehouses, pallets, stats, mode, onMode, onRun, selection, onSelect, held, onHold } = props;
  const [tab, setTab] = useState<Tab>('docks');
  const [depotOpen, setDepotOpen] = useState(!props.compact);
  const [listOpen, setListOpen] = useState(!props.compact);
  const idx = warehouses.findIndex((w) => w.id === node.id);
  const step = (d: number) => {
    if (warehouses.length < 2) return;
    props.onSite(warehouses[(idx + d + warehouses.length) % warehouses.length].id);
  };

  const totalUnits = pallets.reduce((s, p) => s + p.units, 0);
  const flaggedUnits = pallets.filter((p) => mode === 'naive' || p.status !== 'safe').reduce((s, p) => s + p.units, 0);
  const rate = mode === 'naive'
    ? (data.totals.naiveUnits > 0 ? data.totals.naiveCost / data.totals.naiveUnits : 0)
    : (data.totals.logisUnits > 0 ? data.totals.logisCost / data.totals.logisUnits : 0);
  const running = stats?.running ?? false;
  const done = stats?.done ?? false;
  const docked = stats?.trucksDocked ?? 0;
  const occupancy = Math.round((pallets.length / 36) * 100);
  const projectedCost = Math.round(flaggedUnits * rate);
  const spent = Math.round((stats?.unitsPulled ?? 0) * rate);

  const selPallet = selection?.kind === 'pallet' ? pallets.find((p) => p.id === selection.id) : undefined;
  const selForklift = selection?.kind === 'forklift' ? stats?.forklifts.find((f) => f.id === selection.id) : undefined;
  const selTruck = selection?.kind === 'truck' ? stats?.trucks.find((t) => t.id === selection.id) : undefined;
  const selShip = selection?.kind === 'truck' ? data.shipments.find((s) => s.id === selection.id) : undefined;
  const nameOf = (id: string) => data.nodes.find((n) => n.id === id)?.name ?? id;

  const docks = useMemo(() => [0, 1, 2, 3].map((b) => stats?.trucks.find((t) => t.bay === b && (t.status === 'Loading' || t.status === 'Held' || t.status === 'Docking'))), [stats]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 @container">
      {/* Top bar */}
      <div className={cn(card, 'absolute left-3 right-3 top-3 flex h-12 items-center gap-2 px-2.5')}>
        <button onClick={props.onBack} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground" title="Back to network view">
          <ArrowLeft className="h-4 w-4" /><span className="hidden @3xl:inline">Network</span>
        </button>
        <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-surface-2 py-0.5 pl-1 pr-0.5">
          <span className="shrink-0 rounded-md bg-primary px-1.5 py-1 font-mono text-[10px] font-bold text-primary-foreground">{node.id.length > 12 ? `${node.id.slice(0, 11)}…` : node.id}</span>
          <div className="min-w-0 px-1">
            <div className="max-w-[180px] truncate text-[12px] font-semibold leading-tight text-foreground">{node.name}</div>
            <div className="text-[10px] leading-tight text-muted-foreground">{occupancy}% full · {docked}/4 docked</div>
          </div>
          <IconBtn onClick={() => step(-1)} title="Previous warehouse"><ChevronLeft className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => step(1)} title="Next warehouse"><ChevronRight className="h-4 w-4" /></IconBtn>
        </div>
        <div className="ml-auto flex h-8 items-center rounded-lg border border-border bg-surface-2 p-0.5">
          {(['logis', 'naive'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              disabled={running && !done}
              className={cn('h-7 whitespace-nowrap rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50',
                mode === m ? (m === 'logis' ? 'bg-dark-action text-dark-action-fg shadow-sm' : 'bg-critical text-white shadow-sm') : 'text-muted-foreground hover:text-foreground')}
            >
              {m === 'logis' ? 'LOGIS' : 'Naive'}
            </button>
          ))}
        </div>
        <button
          onClick={onRun}
          disabled={running && !done}
          title="Run the response (Space)"
          className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-semibold shadow-sm transition-opacity hover:opacity-90 disabled:cursor-default',
            running && !done ? 'bg-warning/15 text-warning' : 'bg-primary text-primary-foreground')}
        >
          {done ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="hidden @2xl:inline">{running && !done ? 'Responding…' : done ? 'Replay' : 'Run response'}</span>
        </button>
        <LiveClock />
        <div className="hidden items-center @3xl:flex">
          <IconBtn onClick={() => props.onRotate(-1)} title="Rotate left (Shift+R)"><RotateCcw className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onRotate(1)} title="Rotate right (R)"><RotateCw className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onZoom(1.25)} title="Zoom out"><Minus className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => props.onZoom(0.8)} title="Zoom in"><Plus className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={props.onReset} title="Reset view"><Home className="h-4 w-4" /></IconBtn>
        </div>
        <IconBtn onClick={props.onFullscreen} title={props.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{props.fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</IconBtn>
      </div>

      {/* KPIs */}
      <div className={cn('absolute left-3 top-[68px] grid max-w-[640px] grid-cols-2 gap-2 @4xl:grid-cols-4', depotOpen || selection ? 'right-[300px]' : 'right-3')}>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><Boxes className="h-3 w-3 shrink-0" />Stock on hand</div>
          <div className="mt-1 truncate text-[17px] font-semibold leading-none tabular-nums text-foreground">{formatNumber(totalUnits)}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{pallets.length} pallets · {node.id}</div>
        </div>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><Truck className="h-3 w-3 shrink-0" />Trucks on site</div>
          <div className="mt-1 truncate text-[17px] font-semibold leading-none tabular-nums text-foreground">{stats?.trucks.length ?? 0}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{docked} docked · <span className={cn((stats?.trucksHeld ?? 0) > 0 && 'font-semibold text-critical')}>{stats?.trucksHeld ?? 0} held</span></div>
        </div>
        <div className={cn(card, 'min-w-0 p-2')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><ShieldAlert className="h-3 w-3 shrink-0" />{mode === 'naive' ? 'Pallets pulled' : 'Flagged pallets'}</div>
          <div className="mt-1 truncate text-[17px] font-semibold leading-none tabular-nums text-critical">{stats?.moved ?? 0}<span className="text-[12px] text-muted-foreground"> / {stats?.flagged ?? 0}</span></div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{running ? 'moved to quarantine' : 'awaiting response'}</div>
        </div>
        <div className={cn(card, 'min-w-0 p-2', mode === 'logis' ? 'border-success/40' : 'border-critical/40')}>
          <div className="flex items-center gap-1.5 truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground @4xl:text-[10px]"><IndianRupee className="h-3 w-3 shrink-0" />Recall cost here</div>
          <div className={cn('mt-1 truncate text-[17px] font-semibold leading-none tabular-nums', mode === 'logis' ? 'text-success' : 'text-critical')}>{formatCurrency(running ? spent : projectedCost)}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{formatNumber(running ? stats?.unitsPulled ?? 0 : flaggedUnits)} units · {mode === 'logis' ? 'LOGIS' : 'naive'} rate</div>
        </div>
      </div>

      {/* Result */}
      {done && stats && (
        <div className={cn(card, 'absolute left-3 top-[146px] max-w-[460px] px-3 py-2 text-[12px] leading-snug', mode === 'logis' ? 'border-success/40' : 'border-critical/40', depotOpen || selection ? 'right-[300px]' : 'right-3')}>
          {mode === 'logis' ? (
            <span className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span><b className="text-foreground">Response complete.</b> {stats.moved} flagged pallets quarantined, {pallets.length - stats.flagged} clean pallets untouched. {stats.trucks.length - stats.trucksHeld > 0 ? `${stats.trucks.length - stats.trucksHeld} clean trucks kept moving.` : stats.trucks.length > 0 ? 'Every truck here carries a flagged batch, so all were held.' : ''}</span></span>
          ) : (
            <span className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" /><span><b className="text-foreground">Blanket recall.</b> {stats.moved} pallets pulled{stats.overflow > 0 ? `, ${stats.overflow} overflowed quarantine` : ''}{stats.stranded > 0 ? `, ${stats.stranded} still waiting` : ''}; all {stats.trucksHeld} trucks stopped.</span></span>
          )}
        </div>
      )}

      {/* Right panel */}
      {(depotOpen || selection) && (
        <div className={cn(card, 'absolute bottom-3 right-3 top-[68px] flex w-[285px] flex-col overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {selection ? (selection.kind === 'pallet' ? 'Pallet' : selection.kind === 'forklift' ? 'Forklift' : 'Truck') : 'Distribution center'} · {selection?.id ?? node.id}
            </div>
            <IconBtn onClick={() => (selection ? onSelect(null) : setDepotOpen(false))} title="Close"><X className="h-4 w-4" /></IconBtn>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
            {!selection && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Warehouse className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-foreground">{node.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{node.location}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone={running && !done ? 'uncertain' : 'safe'}>{running && !done ? 'Quarantine active' : 'Operational'}</Chip>
                  <Chip tone="info">{docked} docked</Chip>
                  {node.cold && <Chip tone="idle">Cold chain</Chip>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-surface-2 p-2">
                    <div className="text-[10px] text-muted-foreground">LOGIS recalls</div>
                    <div className="text-[15px] font-semibold tabular-nums text-foreground">{formatNumber(node.units.affected)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 p-2">
                    <div className="text-[10px] text-muted-foreground">Naive recalls</div>
                    <div className="text-[15px] font-semibold tabular-nums text-foreground">{formatNumber(node.units.naiveRecall)}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Rack occupancy</span><span>{occupancy}%</span></div>
                  <Bar value={occupancy} tone="bg-primary" />
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>Inventory</span><span>units</span></div>
                  <div className="space-y-1">
                    {node.stock.slice(0, 7).map((s) => {
                      const t: ImpactTone = s.status === 'affected' ? 'affected' : s.status === 'uncertain' ? 'uncertain' : 'safe';
                      return (
                        <div key={s.label} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="min-w-0"><span className="block truncate text-foreground">{s.product}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{s.batch}</span></span>
                          <span className="flex shrink-0 items-center gap-1.5"><span className="font-semibold tabular-nums">{formatNumber(s.units)}</span><Chip tone={mode === 'naive' ? 'affected' : t}>{mode === 'naive' ? 'Recall' : LABEL[t]}</Chip></span>
                        </div>
                      );
                    })}
                    {node.stock.length === 0 && <div className="text-[12px] text-muted-foreground">No stock recorded at this site.</div>}
                  </div>
                </div>
              </>
            )}

            {selPallet && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Package className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-foreground">{selPallet.product}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">Batch {selPallet.batch}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5"><Chip tone={selPallet.status}>{LABEL[selPallet.status]}</Chip><Chip tone="idle">{props.palletZone(selPallet.id)}</Chip></div>
                <div className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
                  <Row k="Units on pallet" v={formatNumber(selPallet.units)} />
                  <Row k="LOGIS action" v={selPallet.status === 'affected' ? 'Quarantine' : selPallet.status === 'uncertain' ? 'Hold + lab verify' : 'Keep shipping'} />
                  <Row k="Naive action" v="Pull & quarantine" />
                </div>
                <Trace stage={2} source={data.incident.sourceLot} batch={selPallet.batch} site={node.id} />
              </>
            )}

            {selForklift && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Forklift className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-foreground">{selForklift.id}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{selForklift.operator}</div>
                  </div>
                </div>
                <Chip tone={selForklift.carrying ? 'info' : 'idle'}>{selForklift.task}</Chip>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Battery</span><span>{selForklift.battery}%</span></div>
                  <Bar value={selForklift.battery} tone={selForklift.battery < 25 ? 'bg-critical' : 'bg-success'} />
                </div>
                <div className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
                  <Row k="Carrying" v={selForklift.carrying ? `${selForklift.carrying} · ${pallets.find((p) => p.id === selForklift.carrying)?.product ?? ''}` : 'Empty'} />
                  <Row k="Moves this response" v={selForklift.moves} />
                  <Row k="Speed" v={`${(selForklift.speed * 3.6).toFixed(1)} km/h`} />
                  <Row k="Charger" v={selForklift.charger} />
                  <Row k="Site" v={node.name} />
                </div>
              </>
            )}

            {selShip && selTruck && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Truck className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-foreground">{selShip.product}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">Batch {selShip.batchId} · {formatNumber(selShip.quantity)} units</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5"><Chip tone={selShip.impact}>{LABEL[selShip.impact]}</Chip><Chip tone={selTruck.held ? 'affected' : 'info'}>{selTruck.status}{selTruck.bay >= 0 ? ` · D${selTruck.bay + 1}` : ''}</Chip></div>
                <div className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
                  <Row k="From" v={nameOf(selShip.origin)} />
                  <Row k="To" v={nameOf(selShip.destination)} />
                </div>
                {selShip.impact !== 'safe' && !held.has(selShip.id) && (
                  <button onClick={() => onHold(selShip.id)} className="flex w-full items-center justify-center gap-2 rounded-full bg-critical px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:opacity-90">
                    <ShieldAlert className="h-4 w-4" /> Hold for inspection
                  </button>
                )}
                <Trace stage={3} source={data.incident.sourceLot} batch={selShip.batchId} site={node.id} />
              </>
            )}
          </div>
        </div>
      )}
      {!depotOpen && !selection && (
        <button onClick={() => setDepotOpen(true)} className={cn(card, 'absolute right-3 top-[68px] flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-foreground')}>
          <Warehouse className="h-3.5 w-3.5" /> Site details
        </button>
      )}

      {/* Bottom-left: docks / forklifts / trucks */}
      <div className={cn(card, 'absolute bottom-3 left-3 w-[340px] max-w-[calc(100%-320px)] overflow-hidden')}>
        <div className={cn('flex items-center gap-1 px-2 py-1.5', listOpen && 'border-b border-border')}>
          {(['docks', 'forklifts', 'trucks'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setListOpen(true); }} className={cn('rounded-md px-2 py-1 text-[11px] font-semibold capitalize', tab === t ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t} <span className="font-mono text-[10px] text-muted-foreground">{t === 'docks' ? `${docks.filter(Boolean).length}/4` : t === 'forklifts' ? stats?.forklifts.length ?? 0 : stats?.trucks.length ?? 0}</span>
            </button>
          ))}
          <button onClick={() => setListOpen((o) => !o)} className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={listOpen ? 'Collapse list' : 'Expand list'}>
            {listOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className={cn('max-h-[136px] overflow-y-auto', !listOpen && 'hidden')}>
          {tab === 'docks' && docks.map((t, b) => (
            <button key={b} onClick={() => t && onSelect({ kind: 'truck', id: t.id })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface-2">
              <span className="w-7 shrink-0 font-mono text-[11px] font-bold text-foreground">D{b + 1}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{t ? `${t.id} · ${t.product}` : 'No truck assigned'}</span>
              <Chip tone={!t ? 'idle' : t.held ? 'affected' : 'info'}>{t ? t.status : 'Free'}</Chip>
            </button>
          ))}
          {tab === 'forklifts' && stats?.forklifts.map((f) => (
            <button key={f.id} onClick={() => onSelect({ kind: 'forklift', id: f.id })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface-2">
              <span className="w-10 shrink-0 font-mono text-[11px] font-bold text-foreground">{f.id}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.task}</span>
              <span className="w-14 shrink-0"><Bar value={f.battery} tone={f.battery < 25 ? 'bg-critical' : 'bg-success'} /></span>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{f.battery}%</span>
            </button>
          ))}
          {tab === 'trucks' && stats?.trucks.map((t) => (
            <button key={t.id} onClick={() => onSelect({ kind: 'truck', id: t.id })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-surface-2">
              <span className="w-[72px] shrink-0 truncate font-mono text-[11px] font-bold text-foreground">{t.id}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.product}</span>
              <Chip tone={t.held ? 'affected' : t.impact === 'safe' ? 'safe' : t.impact}>{t.status}</Chip>
            </button>
          ))}
          {tab !== 'docks' && (stats?.[tab].length ?? 0) === 0 && <div className="px-3 py-3 text-[12px] text-muted-foreground">No {tab} at this site.</div>}
        </div>
      </div>
    </div>
  );
}

function Trace({ stage, source, batch, site }: { stage: number; source: string; batch: string; site: string }) {
  const steps = [
    { label: 'Supplier lot', sub: source },
    { label: 'Plant batch', sub: batch },
    { label: 'Warehouse', sub: site },
    { label: 'In transit', sub: '' },
    { label: 'Store', sub: '' },
  ];
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Traceability</div>
      <div className="space-y-1">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold',
              i < stage ? 'border-primary bg-primary text-primary-foreground' : i === stage ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground')}>
              {i < stage ? '✓' : i + 1}
            </span>
            <span className={cn(i <= stage ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            {s.sub && i <= stage && <span className="ml-auto max-w-[130px] truncate font-mono text-[10px] text-muted-foreground">{s.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
