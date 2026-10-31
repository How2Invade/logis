import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { MapNode } from '@/lib/types/network';
import { LABEL_PX, dotTexture, labelTexture, ringGeo } from '../primitives';
import { displayTone, ease, toneColor, type Selection, type TwinState } from '../state';
import type { Placement } from '../cityLayout';

export interface NodeProps {
  node: MapNode;
  placement: Placement;
  state: TwinState;
  selected: boolean;
  onSelect: (s: Selection) => void;
}

export function useToneMaterials(node: MapNode, state: TwinState) {
  const mats = useMemo(() => {
    const solid = new THREE.MeshStandardMaterial({ color: state.palette.neutral, roughness: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: state.palette.neutral, transparent: true, opacity: 0.3, depthWrite: false });
    return { solid, glow };
  }, [state.palette.neutral]);
  useEffect(() => () => {
    mats.solid.dispose();
    mats.glow.dispose();
  }, [mats]);

  useFrame(({ clock }, dt) => {
    const tone = displayTone(state, node);
    const k = ease(dt, 5);
    mats.solid.color.lerp(toneColor(state, tone), k);
    mats.glow.color.lerp(toneColor(state, tone), k);
    const strong = tone === 'affected' || tone === 'uncertain';
    const pulse = node.isSource && !state.trace.active ? 0.15 * Math.sin(clock.elapsedTime * 4) : 0;
    mats.glow.opacity += ((strong ? 0.5 : 0.22) + pulse - mats.glow.opacity) * k;
    mats.solid.emissive.copy(mats.solid.color);
    mats.solid.emissiveIntensity = strong ? 0.18 : 0.04;
  });
  return mats;
}

export function StatusRing({ material, radius, pulse }: { material: THREE.Material; radius: number; pulse?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pulse || !ref.current) return;
    const s = 1 + 0.08 * Math.sin(clock.elapsedTime * 4);
    ref.current.scale.set(s, 1, s);
  });
  return <mesh ref={ref} geometry={ringGeo(radius - 0.55, radius)} material={material} position={[0, 0.22, 0]} renderOrder={1} dispose={null} />;
}

export const shortCode = (n: MapNode) => (n.kind === 'plant' ? 'PLANT' : n.id.length > 16 ? `${n.id.slice(0, 15)}…` : n.id);
export const shortName = (n: MapNode) => {
  const clean = n.name.replace(/^NovaFoods\s+/, '').replace(/^FreshMart\s+/, '').replace(/\s*\[.*\]\s*$/, '');
  return clean.length > 26 ? `${clean.slice(0, 25).trimEnd()}…` : clean;
};

const PRIORITY: Record<MapNode['kind'], number> = { plant: 70, warehouse: 60, supplier: 40, store: 20 };

interface LabelProps {
  node: MapNode;
  state: TwinState;
  x: number;
  z: number;
  y: number;
  minZoom: number;
  selected: boolean;
}

export function NodeLabel({ node, state, x, z, y, minZoom, selected }: LabelProps) {
  const label = useRef<THREE.Sprite>(null);
  const dot = useRef<THREE.Sprite>(null);
  const pixelRatio = useThree((s) => s.viewport.dpr);
  const { texture, aspect } = useMemo(
    () => labelTexture(shortCode(node), node.isSource ? `${shortName(node)} · SOURCE` : shortName(node), state.palette.label, pixelRatio),
    [node, state.palette, pixelRatio]
  );
  const labelMat = useMemo(() => new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }), [texture]);
  const dotMat = useMemo(() => new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false, transparent: true }), []);
  useEffect(() => () => labelMat.dispose(), [labelMat]);
  useEffect(() => () => dotMat.dispose(), [dotMat]);
  useEffect(() => () => {
    state.labels.delete(node.id);
  }, [state, node.id]);

  useFrame(({ camera }, dt) => {
    const want = selected || state.hovered === node.id || state.view.zoom >= minZoom;
    const tone = displayTone(state, node);
    const priority = selected ? 100 : state.hovered === node.id ? 90 : node.isSource ? 80 : PRIORITY[node.kind] + (tone === 'affected' ? 8 : tone === 'uncertain' ? 4 : 0);
    const h = LABEL_PX / camera.zoom;
    const slot = state.labels.get(node.id);
    if (slot) {
      slot.x = x;
      slot.y = y + h * 1.25;
      slot.z = z;
      slot.aspect = aspect;
      slot.priority = priority;
      slot.want = want;
    } else {
      state.labels.set(node.id, { x, y: y + h * 1.25, z, aspect, priority, want, allowed: true });
    }
    const show = want && (slot?.allowed ?? true);
    if (label.current) {
      label.current.visible = show;
      label.current.scale.set(h * aspect, h, 1);
      label.current.position.set(x, y + h * 1.25, z);
    }
    if (dot.current) {
      const d = 13 / camera.zoom;
      dot.current.visible = show || state.view.zoom >= minZoom * 0.6;
      dot.current.scale.set(d, d, 1);
      dot.current.position.set(x, y + (show ? h * 0.25 : 0), z);
      dotMat.color.lerp(toneColor(state, tone), ease(dt, 5));
    }
  });

  return (
    <>
      <sprite ref={label} material={labelMat} renderOrder={20} />
      <sprite ref={dot} material={dotMat} renderOrder={21} />
    </>
  );
}

const _v = new THREE.Vector3();

export function LabelDeclutter({ state }: { state: TwinState }) {
  const frame = useRef(0);
  useFrame(({ camera, size }) => {
    if (++frame.current % 3 !== 0) return;
    const slots = [...state.labels.values()].filter((s) => {
      if (!s.want) s.allowed = false;
      return s.want;
    });
    slots.sort((a, b) => b.priority - a.priority);
    const kept: Array<[number, number, number, number]> = [];
    const pad = 4;
    for (const s of slots) {
      _v.set(s.x, s.y, s.z).project(camera);
      const cx = (_v.x * 0.5 + 0.5) * size.width;
      const cy = (-_v.y * 0.5 + 0.5) * size.height;
      const w = LABEL_PX * s.aspect;
      const r: [number, number, number, number] = [cx - w / 2 - pad, cy - LABEL_PX / 2 - pad, cx + w / 2 + pad, cy + LABEL_PX / 2 + pad];
      const offscreen = r[2] < 0 || r[0] > size.width || r[3] < 0 || r[1] > size.height;
      const clash = kept.some((k) => r[0] < k[2] && r[2] > k[0] && r[1] < k[3] && r[3] > k[1]);
      s.allowed = !clash && !offscreen;
      if (s.allowed) kept.push(r);
    }
  });
  return null;
}

export function pickHandlers(id: string, state: TwinState, onSelect: (s: Selection) => void, kind: 'node' | 'truck' = 'node') {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      onSelect({ kind, id });
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      state.hovered = id;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      if (state.hovered === id) state.hovered = null;
      document.body.style.cursor = '';
    },
  };
}
