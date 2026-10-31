'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from 'next-themes';
import type { NetworkMap, ViewMode } from '@/lib/types/network';
import { Scene } from './Scene';
import { Overlay, type ToastState, type TraceStatus } from './Overlay';
import { buildLayout } from './cityLayout';
import { buildTracePlan, type Selection, type TwinState } from './state';
import { buildTruckRuns } from './Vehicles';
import { makePalette } from './palette';
import { buildDemoNetwork } from './demo';
import { createController, flyTo, resetView, zoomBy } from './useIsoCamera';

async function loadNetwork(): Promise<NetworkMap> {
  const res = await fetch('/api/network/map');
  if (!res.ok) throw new Error(`network map ${res.status}`);
  const json: { data?: NetworkMap } = await res.json();
  if (!json.data || json.data.nodes.length === 0) throw new Error('empty network');
  return json.data;
}

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

  const layout = useMemo(() => (data ? buildLayout(data) : null), [data]);
  const plan = useMemo(() => (data && layout ? buildTracePlan(data, layout) : null), [data, layout]);
  const runs = useMemo(() => (data && layout ? buildTruckRuns(data.shipments, layout) : []), [data, layout]);

  const [ctrl] = useState(createController);
  const [twin] = useState<TwinState>(() => ({
    mode: 'logis',
    trace: { playing: false, active: false, t: 0 },
    plan: { revealAt: new Map(), order: [], levels: [], duration: 0, logisSegments: [], naiveSegments: [] },
    held: new Set(),
    truckPos: new Map(),
    palette,
    view: { zoomRatio: 1 },
    hovered: null,
  }));
  twin.palette = palette;
  if (plan) twin.plan = plan;

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
      changeMode('logis');
      setSelection(null);
      twin.trace = { playing: true, active: true, t: 0 };
      setRevealed(0);
      setTrace('playing');
      return;
    }
    tr.playing = !tr.playing;
    setTrace(tr.playing ? 'playing' : 'paused');
  }, [twin, changeMode]);

  const onTraceDone = useCallback(() => {
    setTrace('idle');
    setRevealed(twin.plan.order.length);
    resetView(ctrl);
  }, [twin, ctrl]);

  const focus = useCallback((s: Selection, close?: boolean) => {
    setSelection(s);
    if (!s || !layout) return;
    let pos: { x: number; z: number } | undefined;
    let zoom = close ? 2.6 : Math.max(1.6, twin.view.zoomRatio);
    if (s.kind === 'truck') pos = twin.truckPos.get(s.id);
    else {
      const p = layout.placements.get(s.id);
      pos = p;
      if (close && p?.kind === 'warehouse') zoom = 3.4;
    }
    if (!pos) return;
    // shift right on screen so the target sits in the map area left of the 290px inspector
    const off = 150 / (ctrl.base * zoom);
    flyTo(ctrl, pos.x + Math.cos(ctrl.azT) * off, pos.z - Math.sin(ctrl.azT) * off, zoom);
  }, [layout, twin, ctrl]);

  const hold = useCallback((id: string) => {
    twin.held.add(id);
    setHeld(new Set(twin.held));
    showToast({ message: `${id} stopped and held for inspection`, tone: 'success' });
  }, [twin, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.code === 'Space') {
        e.preventDefault();
        toggleTrace();
      } else if (e.key === 'r' || e.key === 'R') {
        ctrl.azT += (e.shiftKey ? -1 : 1) * (Math.PI / 2);
      } else if (e.key === 'Escape') {
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTrace, ctrl]);

  const ready = data && layout && plan;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {ready && (
        <Canvas
          orthographic
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [150, 140, 150], zoom: 5, near: -600, far: 2000 }}
          gl={{ antialias: true }}
          onPointerMissed={() => {
            if (!ctrl.moved) setSelection(null);
          }}
        >
          <Scene
            data={data}
            layout={layout}
            runs={runs}
            state={twin}
            ctrl={ctrl}
            selection={selection}
            onSelect={setSelection}
            onTraceProgress={setRevealed}
            onTraceDone={onTraceDone}
          />
        </Canvas>
      )}
      {ready ? (
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
          held={held}
          onHold={hold}
          onRotate={(d) => {
            ctrl.azT += d * (Math.PI / 2);
          }}
          onZoom={(f) => zoomBy(ctrl, f)}
          onReset={() => resetView(ctrl)}
          toast={toast}
          searchRef={searchRef}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="text-sm font-medium text-muted-foreground">Building network twin…</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkTwin;
