'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from 'next-themes';
import type { NetworkMap, ViewMode } from '@/lib/types/network';
import { Scene } from './Scene';
import { Overlay, type ToastState, type TraceStatus } from './Overlay';
import { buildLayout } from './cityLayout';
import { buildTracePlans, type Selection, type TwinState } from './state';
import { buildTruckRuns } from './Vehicles';
import { makePalette } from './palette';
import { buildDemoNetwork } from './demo';
import { disposeCaches } from './primitives';
import { createController, flyTo, resetView, zoomBy } from './useIsoCamera';
import { SiteScene, createSiteCam, resetSiteCam, type SiteSelection } from './site/SiteScene';
import { SiteOverlay } from './site/SiteOverlay';
import { allocatePallets } from './site/siteLayout';
import { createSim, snapshot, type SiteStats } from './site/siteSim';

async function loadNetwork(): Promise<NetworkMap> {
  const res = await fetch('/api/network/map');
  if (!res.ok) throw new Error(`network map ${res.status}`);
  const json: { data?: NetworkMap } = await res.json();
  if (!json.data || json.data.nodes.length === 0) throw new Error('empty network');
  return json.data;
}

type View = 'network' | 'site';

export function NetworkTwin() {
  const [data, setData] = useState<NetworkMap | null>(null);
  const [mode, setMode] = useState<ViewMode>('logis');
  const [selection, setSelection] = useState<Selection>(null);
  const [trace, setTrace] = useState<TraceStatus>('idle');
  const [revealed, setRevealed] = useState(0);
  const [held, setHeld] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>('network');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteSel, setSiteSel] = useState<SiteSelection>(null);
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);
  const [simKey, setSimKey] = useState(0);
  const [siteCam, setSiteCam] = useState(createSiteCam);
  const pendingRun = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    const onFs = () => setFullscreen(document.fullscreenElement === el);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => undefined);
  }, []);
  const compact = width < 1150;

  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => makePalette(resolvedTheme !== 'light'), [resolvedTheme]);

  useEffect(() => {
    let alive = true;
    loadNetwork()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(buildDemoNetwork()));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => disposeCaches(), []);

  const layout = useMemo(() => (data ? buildLayout(data) : null), [data]);
  const plans = useMemo(() => (data && layout ? buildTracePlans(data, layout) : null), [data, layout]);
  const plan = plans?.[mode] ?? null;
  const runs = useMemo(() => (data && layout ? buildTruckRuns(data.shipments, layout) : []), [data, layout]);
  const warehouses = useMemo(() => data?.nodes.filter((n) => n.kind === 'warehouse') ?? [], [data]);

  const siteNode = useMemo(() => warehouses.find((w) => w.id === siteId) ?? null, [warehouses, siteId]);
  const alloc = useMemo(() => (siteNode ? allocatePallets(siteNode) : null), [siteNode]);
  const siteShips = useMemo(() => (data && siteId ? data.shipments.filter((s) => s.origin === siteId || s.destination === siteId) : []), [data, siteId]);
  const sim = useMemo(() => {
    void simKey; // a new key forces a fresh simulation for Replay
    return alloc ? createSim(alloc.pallets, siteShips, mode) : null;
  }, [alloc, siteShips, mode, simKey]);

  const [ctrl] = useState(createController);
  const [twin] = useState<TwinState>(() => ({
    mode: 'logis',
    trace: { playing: false, active: false, t: 0 },
    plan: { revealAt: new Map(), order: [], levels: [], duration: 0, segments: [] },
    held: new Set(),
    truckPos: new Map(),
    palette,
    view: { zoomRatio: 1, zoom: 5 },
    hovered: null,
    labels: new Map(),
  }));
  twin.palette = palette;
  if (plan) twin.plan = plan;

  useEffect(() => {
    if (sim && pendingRun.current) {
      pendingRun.current = false;
      sim.running = true;
      setSiteStats(snapshot(sim));
    }
  }, [sim]);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const changeMode = useCallback((m: ViewMode) => {
    twin.mode = m;
    setMode(m);
  }, [twin]);

  const toggleTrace = useCallback(() => {
    const tr = twin.trace;
    if (!tr.active) {
      setSelection(null);
      twin.trace = { playing: true, active: true, t: 0 };
      setRevealed(0);
      setTrace('playing');
      return;
    }
    tr.playing = !tr.playing;
    setTrace(tr.playing ? 'playing' : 'paused');
  }, [twin]);

  const onTraceDone = useCallback(() => {
    setTrace('idle');
    setRevealed(twin.plan.order.length);
    resetView(ctrl);
  }, [twin, ctrl]);

  const enterSite = useCallback((id: string) => {
    twin.trace = { playing: false, active: false, t: 0 };
    setTrace('idle');
    setSiteId(id);
    setSiteSel(null);
    setSiteStats(null);
    setSiteCam(createSiteCam());
    setView('site');
  }, [twin]);

  const openDefaultSite = useCallback(() => {
    const pick =
      (selection?.kind === 'node' && warehouses.find((w) => w.id === selection.id)) ||
      [...warehouses].sort((a, b) => b.units.affected - a.units.affected)[0];
    if (pick) enterSite(pick.id);
  }, [selection, warehouses, enterSite]);

  const runSite = useCallback(() => {
    if (!sim) return;
    if (sim.done) {
      pendingRun.current = true;
      setSiteSel(null);
      setSimKey((k) => k + 1);
    } else if (!sim.running) {
      sim.running = true;
      setSiteStats(snapshot(sim));
    }
  }, [sim]);

  const focus = useCallback((s: Selection, close?: boolean) => {
    setSelection(s);
    if (!s || !layout) return;
    if (close && s.kind === 'node' && layout.placements.get(s.id)?.kind === 'warehouse') {
      enterSite(s.id);
      return;
    }
    let pos: { x: number; z: number } | undefined;
    const zoom = close ? Math.max(2.6, 9 / ctrl.base) : Math.max(1.6, twin.view.zoomRatio, 6 / ctrl.base);
    if (s.kind === 'truck') pos = twin.truckPos.get(s.id);
    else pos = layout.placements.get(s.id);
    if (!pos) return;
    // shift right on screen so the target sits in the map area left of the 290px inspector
    const off = 150 / (ctrl.base * zoom);
    flyTo(ctrl, pos.x + Math.cos(ctrl.azT) * off, pos.z - Math.sin(ctrl.azT) * off, zoom);
  }, [layout, twin, ctrl, enterSite]);

  const hold = useCallback((id: string) => {
    twin.held.add(id);
    setHeld(new Set(twin.held));
    showToast({ message: `${id} stopped and held for inspection`, tone: 'success' });
  }, [twin, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === '/' && view === 'network') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (view === 'site') runSite();
        else toggleTrace();
      } else if (e.key === 'r' || e.key === 'R') {
        const d = (e.shiftKey ? -1 : 1) * (Math.PI / 2);
        if (view === 'site') siteCam.azT += d;
        else ctrl.azT += d;
      } else if (e.key === 'Escape') {
        setSelection(null);
        setSiteSel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTrace, runSite, ctrl, siteCam, view]);

  const palletZone = useCallback((id: string) => {
    const p = sim?.pallets.find((q) => q.info.id === id);
    if (!p) return '—';
    if (p.state === 'carried') return 'On forklift';
    return p.slot.zone === 'rack' ? 'In rack' : p.slot.zone === 'quarantine' ? 'Quarantined' : 'Overflow';
  }, [sim]);

  const ready = data && layout && plan;
  const inSite = view === 'site' && siteNode && sim && alloc;

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-background">
      {ready && (
        <Canvas
          orthographic
          shadows
          dpr={[1, 2]}
          camera={{ position: [150, 140, 150], zoom: 5, near: -600, far: 2000 }}
          gl={{ antialias: true }}
          onPointerMissed={() => {
            if (inSite) {
              if (!siteCam.moved) setSiteSel(null);
            } else if (!ctrl.moved) setSelection(null);
          }}
        >
          {inSite ? (
            <SiteScene
              key={siteNode.id}
              node={siteNode}
              sim={sim}
              palette={palette}
              held={twin.held}
              cam={siteCam}
              selection={siteSel}
              onSelect={setSiteSel}
              onStats={setSiteStats}
            />
          ) : (
            <Scene
              data={data}
              layout={layout}
              runs={runs}
              state={twin}
              ctrl={ctrl}
              selection={selection}
              onSelect={setSelection}
              onOpenSite={enterSite}
              onTraceProgress={setRevealed}
              onTraceDone={onTraceDone}
            />
          )}
        </Canvas>
      )}
      {ready && inSite ? (
        <SiteOverlay
          key={siteNode.id}
          data={data}
          node={siteNode}
          warehouses={warehouses}
          pallets={alloc.pallets}
          stats={siteStats}
          mode={mode}
          onMode={(m) => {
            setSiteSel(null);
            changeMode(m);
          }}
          onRun={runSite}
          selection={siteSel}
          onSelect={(s) => {
            siteCam.follow = s !== null && s.kind !== 'pallet';
            setSiteSel(s);
          }}
          onSite={enterSite}
          onBack={() => {
            setView('network');
            setSiteSel(null);
          }}
          held={held}
          onHold={hold}
          onRotate={(d) => {
            siteCam.azT += d * (Math.PI / 2);
          }}
          onZoom={(f) => {
            siteCam.distT = Math.min(140, Math.max(16, siteCam.distT * f));
          }}
          onReset={() => resetSiteCam(siteCam)}
          palletZone={palletZone}
          compact={compact}
          fullscreen={fullscreen}
          onFullscreen={toggleFullscreen}
        />
      ) : ready ? (
        <Overlay
          data={data}
          mode={mode}
          onMode={changeMode}
          trace={trace}
          onTrace={toggleTrace}
          revealed={revealed}
          order={plan.order}
          selection={selection}
          onFocus={focus}
          onClear={() => setSelection(null)}
          onOpenSite={openDefaultSite}
          held={held}
          onHold={hold}
          onRotate={(d) => {
            ctrl.azT += d * (Math.PI / 2);
          }}
          onZoom={(f) => zoomBy(ctrl, f)}
          onReset={() => resetView(ctrl)}
          toast={toast}
          searchRef={searchRef}
          fullscreen={fullscreen}
          onFullscreen={toggleFullscreen}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="text-sm font-medium text-muted-foreground">Building network twin…</div>
          </div>
        </div>
      )}
      {inSite && toast && (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-20 -translate-x-1/2 rounded-xl border border-success/40 bg-surface/95 px-4 py-2 text-[12px] font-semibold text-success shadow-sm">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default NetworkTwin;
