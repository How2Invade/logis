import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { MapNode } from '@/lib/types/network';
import { dotTexture, labelTexture, ringGeo } from '../primitives';
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

export const shortCode = (n: MapNode) => (n.kind === 'plant' ? 'PLANT' : n.id);
export const shortName = (n: MapNode) => n.name.replace(/^NovaFoods\s+/, '').replace(/^FreshMart\s+/, '');

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
  const { texture, aspect } = useMemo(
    () => labelTexture(shortCode(node), node.isSource ? `${shortName(node)} · SOURCE` : shortName(node), state.palette.label),
    [node, state.palette]
  );
  const labelMat = useMemo(() => new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }), [texture]);
  const dotMat = useMemo(() => new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false, transparent: true }), []);
  useEffect(() => () => labelMat.dispose(), [labelMat]);
  useEffect(() => () => dotMat.dispose(), [dotMat]);

  useFrame(({ camera }, dt) => {
    const show = selected || state.hovered === node.id || state.view.zoomRatio >= minZoom;
    const h = 24 / camera.zoom;
    if (label.current) {
      label.current.visible = show;
      label.current.scale.set(h * aspect, h, 1);
      label.current.position.set(x, y + h * 1.25, z);
    }
    if (dot.current) {
      const d = 13 / camera.zoom;
      dot.current.visible = show || state.view.zoomRatio >= minZoom * 0.6;
      dot.current.scale.set(d, d, 1);
      dot.current.position.set(x, y + (show ? h * 0.25 : 0), z);
      dotMat.color.lerp(toneColor(state, displayTone(state, node)), ease(dt, 5));
    }
  });

  return (
    <>
      <sprite ref={label} material={labelMat} renderOrder={20} />
      <sprite ref={dot} material={dotMat} renderOrder={21} />
    </>
  );
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
