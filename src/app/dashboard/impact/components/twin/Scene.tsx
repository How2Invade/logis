import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { NetworkMap } from '@/lib/types/network';
import { Ground, Foliage, SegmentStrips } from './Roads';
import { Supplier } from './nodes/Supplier';
import { Plant } from './nodes/Plant';
import { Warehouse } from './nodes/Warehouse';
import { Stores } from './nodes/Stores';
import { Vehicles, type TruckRun } from './Vehicles';
import { SelectionMarker } from './Selection';
import { LabelDeclutter } from './nodes/NodeDecor';
import { useIsoCamera, flyTo, type CamController } from './useIsoCamera';
import type { CityLayout } from './cityLayout';
import type { Selection, TwinState } from './state';

interface SceneProps {
  data: NetworkMap;
  layout: CityLayout;
  runs: TruckRun[];
  state: TwinState;
  ctrl: CamController;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onOpenSite: (id: string) => void;
  onTraceProgress: (revealed: number) => void;
  onTraceDone: () => void;
}

function TraceDriver({ state, ctrl, onTraceProgress, onTraceDone }: Pick<SceneProps, 'state' | 'ctrl' | 'onTraceProgress' | 'onTraceDone'>) {
  const last = useRef({ revealed: -1, level: -1 });
  useFrame((_, dt) => {
    const tr = state.trace;
    if (!tr.active) {
      last.current = { revealed: -1, level: -1 };
      return;
    }
    if (tr.playing) tr.t += Math.min(dt, 0.25);
    const plan = state.plan;
    let revealed = 0;
    for (const id of plan.order) if ((plan.revealAt.get(id) ?? Infinity) <= tr.t) revealed++;
    if (revealed !== last.current.revealed) {
      last.current.revealed = revealed;
      onTraceProgress(revealed);
    }
    let level = -1;
    plan.levels.forEach((l, k) => {
      if (l.time <= tr.t) level = k;
    });
    if (level !== last.current.level && level >= 0) {
      last.current.level = level;
      const l = plan.levels[level];
      flyTo(ctrl, l.x * 0.6, l.z * 0.6, level === 0 ? 1.15 : 1.05);
    }
    if (tr.t > plan.duration + 0.8) {
      tr.active = false;
      tr.playing = false;
      onTraceDone();
    }
  });
  return null;
}

function Rig({ ctrl, state, layout }: { ctrl: CamController; state: TwinState; layout: CityLayout }) {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const b = layout.bounds;
  const span = b.maxX - b.minX + (b.maxZ - b.minZ);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    ctrl.bounds = layout.bounds;
  }, [ctrl, layout]);
  useIsoCamera(ctrl, width, height, span);
  const frames = useRef(0);
  useFrame(() => {
    state.view.zoomRatio = ctrl.zoom / ctrl.base;
    state.view.zoom = ctrl.zoom;
    if (++frames.current % 30 === 0) gl.domElement.dataset.calls = String(gl.info.render.calls);
  });
  return null;
}

export function Scene(props: SceneProps) {
  const { data, layout, runs, state, ctrl, selection, onSelect } = props;
  const p = state.palette;
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    scene.background = new THREE.Color(p.bg);
    scene.fog = new THREE.Fog(p.bg, 300, 520);
  }, [scene, p.bg]);

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fffaf0', p.isDark ? 1.0 : 1.55);
    l.position.set(-70, 140, 90);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 400 });
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.04;
    return l;
  }, [p.isDark]);
  useEffect(() => () => sun.dispose(), [sun]);

  const byKind = useMemo(() => {
    const withPlacement = data.nodes
      .map((node) => ({ node, placement: layout.placements.get(node.id) }))
      .filter((x): x is { node: typeof x.node; placement: NonNullable<typeof x.placement> } => !!x.placement);
    return {
      suppliers: withPlacement.filter((x) => x.node.kind === 'supplier'),
      plants: withPlacement.filter((x) => x.node.kind === 'plant'),
      warehouses: withPlacement.filter((x) => x.node.kind === 'warehouse'),
      stores: withPlacement.filter((x) => x.node.kind === 'store'),
    };
  }, [data, layout]);

  const sel = (id: string) => selection?.kind === 'node' && selection.id === id;

  return (
    <>
      <hemisphereLight args={[p.isDark ? '#cfd6e6' : '#ffffff', p.isDark ? '#22201d' : '#c9bfae', p.isDark ? 0.55 : 1.0]} />
      <ambientLight intensity={p.isDark ? 0.25 : 0.35} />
      <primitive object={sun} />
      <Rig ctrl={ctrl} state={state} layout={layout} />
      <TraceDriver state={state} ctrl={ctrl} onTraceProgress={props.onTraceProgress} onTraceDone={props.onTraceDone} />

      <Ground layout={layout} palette={p} />
      <Foliage layout={layout} palette={p} />

      <SegmentStrips
        key={state.mode}
        segments={state.plan.segments}
        color={p.tone.affected}
        width={1.1}
        y={0.12}
        opacity={0.85}
        state={state}
        pulse
        visibleCount={(s) => (s.trace.active ? s.plan.segments.filter((g) => g.at <= s.trace.t).length : s.plan.segments.length)}
      />

      {byKind.suppliers.map(({ node, placement }) => (
        <Supplier key={node.id} node={node} placement={placement} state={state} selected={sel(node.id)} onSelect={onSelect} />
      ))}
      {byKind.plants.map(({ node, placement }) => (
        <Plant key={node.id} node={node} placement={placement} state={state} selected={sel(node.id)} onSelect={onSelect} />
      ))}
      {byKind.warehouses.map(({ node, placement }) => (
        <Warehouse key={node.id} node={node} placement={placement} state={state} selected={sel(node.id)} onSelect={onSelect} onOpen={props.onOpenSite} />
      ))}
      <Stores stores={byKind.stores} state={state} selectedId={selection?.kind === 'node' ? selection.id : null} onSelect={onSelect} />
      <Vehicles runs={runs} state={state} onSelect={onSelect} />
      <LabelDeclutter state={state} />
      <SelectionMarker selection={selection} data={data} layout={layout} runs={runs} state={state} />
    </>
  );
}
