import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { boxGeo, mat, planeGeo, sphereGeo } from './primitives';
import { TS, type CityLayout, type Segment } from './cityLayout';
import { ease, type TwinState } from './state';
import type { Palette } from './palette';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

function useInstances(ref: RefObject<THREE.InstancedMesh | null>, items: Array<{ x: number; y: number; z: number; ry?: number; sx?: number; sy?: number; sz?: number }>) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, k) => {
      _q.setFromEuler(_e.set(0, it.ry ?? 0, 0));
      _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1));
      mesh.setMatrixAt(k, _m);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items]);
}

export function Ground({ layout, palette }: { layout: CityLayout; palette: Palette }) {
  const b = layout.bounds;
  const blocksRef = useRef<THREE.InstancedMesh>(null);
  const roadRef = useRef<THREE.InstancedMesh>(null);
  const dashRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const fieldRef = useRef<THREE.InstancedMesh>(null);
  const cropRef = useRef<THREE.InstancedMesh>(null);

  const blocks = useMemo(() => layout.blocks.map(([x, z]) => ({ x, y: 0.09, z })), [layout]);
  const roads = useMemo(() => layout.roads.map((r) => ({ x: r.x, y: 0.03, z: r.z })), [layout]);
  const dashes = useMemo(
    () => layout.roads.filter((r) => r.kind !== 'x').map((r) => ({ x: r.x, y: 0.075, z: r.z, ry: r.kind === 'v' ? Math.PI / 2 : 0 })),
    [layout]
  );
  const crossings = useMemo(
    () => layout.roads.filter((r) => r.kind === 'x').map((r) => ({ x: r.x, y: 0.07, z: r.z })),
    [layout]
  );
  const fields = useMemo(() => layout.fields.map(([x, z]) => ({ x, y: 0.2, z })), [layout]);
  const crops = useMemo(() => layout.crops.map(([x, z]) => ({ x, y: 0.32, z })), [layout]);

  useInstances(blocksRef, blocks);
  useInstances(roadRef, roads);
  useInstances(dashRef, dashes);
  useInstances(crossRef, crossings);
  useInstances(fieldRef, fields);
  useInstances(cropRef, crops);

  const bw = TS * 2 - 0.5;
  return (
    <group>
      <mesh geometry={planeGeo(b.maxX - b.minX + 160, b.maxZ - b.minZ + 160)} material={mat(palette.grass, 1)} receiveShadow dispose={null} />
      <instancedMesh ref={blocksRef} args={[boxGeo(bw, 0.18, bw), undefined, blocks.length]} material={mat(palette.block, 0.95)} receiveShadow dispose={null} />
      <instancedMesh ref={roadRef} args={[boxGeo(TS, 0.06, TS), undefined, roads.length]} material={mat(palette.road, 0.95)} receiveShadow dispose={null} />
      <instancedMesh ref={dashRef} args={[boxGeo(TS * 0.42, 0.02, 0.2), undefined, dashes.length]} material={mat(palette.lane, 0.9)} dispose={null} />
      <instancedMesh ref={crossRef} args={[boxGeo(TS * 0.72, 0.02, TS * 0.72), undefined, crossings.length]} material={mat(palette.crossing, 0.95)} dispose={null} />
      <instancedMesh ref={fieldRef} args={[boxGeo(bw - 1, 0.1, bw - 1), undefined, fields.length]} material={mat(palette.field, 1)} receiveShadow dispose={null} />
      <instancedMesh ref={cropRef} args={[boxGeo(bw - 2.4, 0.18, 0.9), undefined, crops.length]} material={mat(palette.crop, 1)} dispose={null} />
    </group>
  );
}

export function Foliage({ layout, palette }: { layout: CityLayout; palette: Palette }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  const trunks = useMemo(() => layout.trees.map((t) => ({ x: t.x, y: 0.9 * t.s, z: t.z, sy: t.s })), [layout]);
  const crowns = useMemo(() => layout.trees.map((t) => ({ x: t.x, y: 2.1 * t.s, z: t.z, sx: t.s, sy: t.s * 1.1, sz: t.s })), [layout]);
  const bodies = useMemo(() => layout.houses.map((h) => ({ x: h.x, y: h.h / 2 + 0.18, z: h.z, ry: h.rot, sx: h.w, sy: h.h, sz: h.d })), [layout]);
  const roofs = useMemo(() => layout.houses.map((h) => ({ x: h.x, y: h.h + 0.38, z: h.z, ry: h.rot, sx: h.w + 0.5, sy: 0.4, sz: h.d + 0.5 })), [layout]);
  const poles = useMemo(() => layout.lamps.map(([x, z]) => ({ x, y: 2.2, z })), [layout]);
  const heads = useMemo(() => layout.lamps.map(([x, z]) => ({ x, y: 4.4, z })), [layout]);

  useInstances(trunkRef, trunks);
  useInstances(crownRef, crowns);
  useInstances(bodyRef, bodies);
  useInstances(roofRef, roofs);
  useInstances(poleRef, poles);
  useInstances(headRef, heads);

  useLayoutEffect(() => {
    const mesh = roofRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    layout.houses.forEach((h, k) => mesh.setColorAt(k, c.set(palette.roofs[h.roof % palette.roofs.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [layout, palette]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[boxGeo(0.22, 1.8, 0.22), undefined, trunks.length]} material={mat(palette.trunk)} dispose={null} />
      <instancedMesh ref={crownRef} args={[sphereGeo(1), undefined, crowns.length]} material={mat(palette.tree, 0.75)} castShadow dispose={null} />
      <instancedMesh ref={bodyRef} args={[boxGeo(1, 1, 1), undefined, bodies.length]} material={mat(palette.houseBody)} castShadow receiveShadow dispose={null} />
      <instancedMesh ref={roofRef} args={[boxGeo(1, 1, 1), undefined, roofs.length]} material={mat('#ffffff', 0.7)} castShadow dispose={null} />
      <instancedMesh ref={poleRef} args={[boxGeo(0.14, 4.4, 0.14), undefined, poles.length]} material={mat(palette.metal)} dispose={null} />
      <instancedMesh ref={headRef} args={[boxGeo(0.7, 0.16, 0.3), undefined, heads.length]} material={mat('#fff6d8', 0.6, '#ffe7a0', palette.isDark ? 0.8 : 0.3)} dispose={null} />
    </group>
  );
}

interface StripsProps {
  segments: Segment[];
  color: string;
  width: number;
  y: number;
  opacity: number;
  visibleCount?: (state: TwinState) => number;
  targetOpacity?: (state: TwinState) => number;
  state?: TwinState;
  pulse?: boolean;
}

export function SegmentStrips({ segments, color, width, y, opacity, visibleCount, targetOpacity, state, pulse }: StripsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    [color, opacity]
  );
  useLayoutEffect(() => () => material.dispose(), [material]);

  const items = useMemo(
    () =>
      segments.map((s) => {
        const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
        return { x: (s.x1 + s.x2) / 2, y, z: (s.z1 + s.z2) / 2, ry: Math.atan2(s.x2 - s.x1, s.z2 - s.z1), sx: width, sy: 1, sz: len + width };
      }),
    [segments, width, y]
  );
  useInstances(ref, items);

  useFrame(({ clock }, dt) => {
    const mesh = ref.current;
    if (!mesh || !state) return;
    if (visibleCount) mesh.count = Math.min(items.length, visibleCount(state));
    const base = targetOpacity ? targetOpacity(state) : opacity;
    const target = pulse ? base * (0.78 + 0.22 * Math.sin(clock.elapsedTime * 3)) : base;
    material.opacity += (target - material.opacity) * ease(dt, 5);
    mesh.visible = material.opacity > 0.02 && mesh.count > 0;
  });

  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[boxGeo(1, 0.05, 1), undefined, items.length]} material={material} renderOrder={2} dispose={null} />;
}
