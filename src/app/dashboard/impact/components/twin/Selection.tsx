import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { NetworkMap } from '@/lib/types/network';
import { boxGeo, cylGeo, planeGeo, sphereGeo } from './primitives';
import { centerSegments, routeBetween, type CityLayout, type Segment } from './cityLayout';
import { SegmentStrips } from './Roads';
import type { TruckRun } from './Vehicles';
import type { Selection as Sel, TwinState } from './state';

export function cornerBrackets(w: number, h: number, d: number): THREE.BufferGeometry {
  const e = Math.min(w, h, d) * 0.28 + 0.25;
  const pts: number[] = [];
  for (const x of [-w / 2, w / 2]) {
    for (const y of [0, h]) {
      for (const z of [-d / 2, d / 2]) {
        const sx = x < 0 ? 1 : -1;
        const sy = y === 0 ? 1 : -1;
        const sz = z < 0 ? 1 : -1;
        pts.push(x, y, z, x + sx * e, y, z, x, y, z, x, y + sy * e, z, x, y, z, x, y, z + sz * e);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

interface Props {
  selection: Sel;
  data: NetworkMap;
  layout: CityLayout;
  runs: TruckRun[];
  state: TwinState;
}

export function SelectionMarker({ selection, data, layout, runs, state }: Props) {
  const group = useRef<THREE.Group>(null);
  const pin = useRef<THREE.Group>(null);
  const color = state.palette.route;

  const info = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'truck') {
      const run = runs.find((r) => r.shipment.id === selection.id);
      if (!run) return null;
      const segs: Segment[] = [];
      for (let k = 1; k < run.fwd.length; k++) segs.push({ x1: run.fwd[k - 1][0], z1: run.fwd[k - 1][1], x2: run.fwd[k][0], z2: run.fwd[k][1] });
      const dest = layout.placements.get(run.shipment.destination);
      return { size: [2.4, 2.8, 5.6] as const, segs, pins: dest ? [dest.door] : [] };
    }
    const p = layout.placements.get(selection.id);
    if (!p) return null;
    const node = data.nodes.find((n) => n.id === selection.id);
    const links = data.edges.filter((e) => (node?.kind === 'store' ? e.to === selection.id : e.from === selection.id));
    const segs: Segment[] = [];
    const pins: Array<[number, number]> = [];
    for (const e of links) {
      const r = routeBetween(layout, e.from, e.to);
      if (!r) continue;
      segs.push(...centerSegments(layout, r));
      const other = layout.placements.get(e.from === selection.id ? e.to : e.from);
      if (other) pins.push(other.door);
    }
    return { size: [p.size[0] + 1, p.size[1] + 0.5, p.size[2] + 1] as const, segs, pins: pins.slice(0, 12) };
  }, [selection, data, layout, runs]);

  const geo = useMemo(() => (info ? cornerBrackets(info.size[0], info.size[1], info.size[2]) : null), [info]);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color }), [color]);
  const fillMat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false }), [color]);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }), [color]);
  const pinMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 }), [color]);
  const lines = useMemo(() => (geo ? new THREE.LineSegments(geo, lineMat) : null), [geo, lineMat]);
  useEffect(() => () => geo?.dispose(), [geo]);
  useEffect(() => () => {
    lineMat.dispose();
    fillMat.dispose();
    glowMat.dispose();
    pinMat.dispose();
  }, [lineMat, fillMat, glowMat, pinMat]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || !selection) return;
    if (selection.kind === 'truck') {
      const t = state.truckPos.get(selection.id);
      if (t) {
        g.position.set(t.x, 0, t.z);
        g.rotation.y = t.yaw;
      }
    } else {
      const p = layout.placements.get(selection.id);
      if (p) {
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.rot;
      }
    }
    if (pin.current) pin.current.position.y = 0.4 * Math.sin(clock.elapsedTime * 3);
  });

  if (!info || !lines) return null;
  const [w, h, d] = info.size;
  return (
    <>
      <group ref={group}>
        <primitive object={lines} />
        <mesh geometry={boxGeo(w, h, d)} material={fillMat} position={[0, h / 2, 0]} renderOrder={4} dispose={null} />
        <mesh geometry={planeGeo(w + 1.6, d + 1.6)} material={glowMat} position={[0, 0.3, 0]} renderOrder={4} dispose={null} />
      </group>
      <SegmentStrips segments={info.segs} color={color} width={0.55} y={0.34} opacity={0.8} state={state} />
      <group ref={pin}>
        {info.pins.map(([x, z], k) => (
          <group key={k} position={[x, 0, z]}>
            <mesh geometry={cylGeo(0.75, 0, 1.6, 12)} material={pinMat} position={[0, 2.2, 0]} dispose={null} />
            <mesh geometry={sphereGeo(0.75)} material={pinMat} position={[0, 3.2, 0]} dispose={null} />
          </group>
        ))}
      </group>
    </>
  );
}
