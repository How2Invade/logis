import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import type { MapNode, ViewMode } from '@/lib/types/network';
import { LABEL_PX, boxGeo, cylGeo, labelTexture, mat, planeGeo, ringGeo, sphereGeo } from '../primitives';
import type { Palette } from '../palette';
import { cornerBrackets } from '../Selection';
import { ease } from '../state';
import {
  BUILDING, CHARGERS, DOOR_H, DOOR_W, DOOR_X, OVER_BOUNDS, QUAR_BOUNDS, RACK_X, ROAD_Z, WALL_Z,
} from './siteLayout';
import { flaggedIn, snapshot, stepSim, type SiteSim, type SiteStats } from './siteSim';
import { badgeTexture, hatchTexture, liveryTexture, signTexture } from './siteTextures';

export type SiteSelection = { kind: 'pallet' | 'forklift' | 'truck'; id: string } | null;

export interface SiteCam {
  target: THREE.Vector3;
  targetT: THREE.Vector3;
  dist: number;
  distT: number;
  az: number;
  azT: number;
  follow: boolean;
  moved: boolean;
}

const HOME_AZ = -0.62;
const EL = 0.6;

export function createSiteCam(): SiteCam {
  return { target: new THREE.Vector3(-7, 0, 1), targetT: new THREE.Vector3(-7, 0, 2), dist: 190, distT: 56, az: HOME_AZ - 0.5, azT: HOME_AZ, follow: false, moved: false };
}

export function resetSiteCam(c: SiteCam): void {
  c.targetT.set(-7, 0, 2);
  c.distT = 56;
  c.azT = Math.round((c.azT - HOME_AZ) / (Math.PI * 2)) * Math.PI * 2 + HOME_AZ;
  c.follow = false;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _c3 = new THREE.Color();
const _y = new THREE.Vector3(0, 1, 0);

interface Box3 { x: number; y: number; z: number; w: number; h: number; d: number; ry?: number }

function useStaticInstances(ref: RefObject<THREE.InstancedMesh | null>, items: Box3[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e.set(0, b.ry ?? 0, 0)), _s.set(b.w, b.h, b.d));
      m.setMatrixAt(i, _m);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, items]);
}

function Instanced({ items, color, rough = 0.8, cast = false }: { items: Box3[]; color: string; rough?: number; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useStaticInstances(ref, items);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[boxGeo(1, 1, 1), undefined, items.length]} material={mat(color, rough)} castShadow={cast} receiveShadow dispose={null} />;
}

function useDisposable<T extends { dispose(): void }>(t: T): T {
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

function TexPlane({ map, w, h, position, rotation, flat }: { map: THREE.Texture; w: number; h: number; position: [number, number, number]; rotation?: [number, number, number]; flat?: boolean }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map, roughness: 0.75, transparent: true, depthWrite: !flat, polygonOffset: !!flat, polygonOffsetFactor: -2 }), [map, flat]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={position} rotation={rotation ?? (flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0])} material={material} receiveShadow>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

function Yard({ p, mode }: { p: Palette; mode: ViewMode }) {
  const s = p.site;
  const lines = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    for (const bx of DOOR_X) {
      out.push({ x: bx - 2.4, y: 0.03, z: 3.6, w: 0.16, h: 0.02, d: 9.6 }, { x: bx + 2.4, y: 0.03, z: 3.6, w: 0.16, h: 0.02, d: 9.6 }, { x: bx, y: 0.03, z: 8.4, w: 4.96, h: 0.02, d: 0.16 });
    }
    for (let x = -13.4; x <= 13.4; x += 1.9) out.push({ x, y: 0.03, z: 10.2, w: 0.95, h: 0.02, d: 0.14 });
    const rect = (b: { x0: number; x1: number; z0: number; z1: number }) => {
      out.push({ x: (b.x0 + b.x1) / 2, y: 0.03, z: b.z0, w: b.x1 - b.x0, h: 0.02, d: 0.16 }, { x: (b.x0 + b.x1) / 2, y: 0.03, z: b.z1, w: b.x1 - b.x0, h: 0.02, d: 0.16 });
      out.push({ x: b.x0, y: 0.03, z: (b.z0 + b.z1) / 2, w: 0.16, h: 0.02, d: b.z1 - b.z0 }, { x: b.x1, y: 0.03, z: (b.z0 + b.z1) / 2, w: 0.16, h: 0.02, d: b.z1 - b.z0 });
    };
    rect(OVER_BOUNDS);
    rect({ x0: 17, x1: 29.4, z0: 3.2, z1: 9 });
    return out;
  }, []);
  const roadDashes = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    for (let x = -120; x <= 120; x += 4.5) out.push({ x, y: 0.035, z: ROAD_Z, w: 2.2, h: 0.02, d: 0.18 });
    return out;
  }, []);
  const chargers = useMemo<Box3[]>(() => CHARGERS.map((c) => ({ x: c.x, y: 0.75, z: c.z - 1.5, w: 0.9, h: 1.5, d: 0.6 })), []);
  const hatch = useDisposable(
    useMemo(() => hatchTexture(p.tone.affected, s.yard, 'QUARANTINE', mode === 'naive' ? 'BLANKET RECALL HOLD' : 'AFFECTED + VERIFY ONLY'), [p.tone.affected, s.yard, mode])
  );
  const qb = QUAR_BOUNDS;
  return (
    <group>
      <mesh geometry={planeGeo(600, 600)} material={mat(p.grass, 1)} position={[0, -0.03, 0]} receiveShadow dispose={null} />
      <mesh geometry={planeGeo(68, 35.6)} material={mat(s.yard, 0.95)} position={[0, 0, -1.6]} receiveShadow dispose={null} />
      <mesh geometry={planeGeo(240, 6.4)} material={mat(s.road, 0.95)} position={[0, 0.01, ROAD_Z]} receiveShadow dispose={null} />
      <mesh geometry={planeGeo(12.4, 5.8)} material={mat(s.pad, 0.95)} position={[23.2, 0.015, 6.1]} receiveShadow dispose={null} />
      <TexPlane map={hatch} w={qb.x1 - qb.x0} h={qb.z1 - qb.z0} position={[(qb.x0 + qb.x1) / 2, 0.02, (qb.z0 + qb.z1) / 2]} flat />
      <Instanced items={lines} color={s.line} rough={0.6} />
      <Instanced items={roadDashes} color={p.lane} rough={0.6} />
      <Instanced items={chargers} color={s.charger} rough={0.5} cast />
    </group>
  );
}

function sawtoothRoof(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const { x0, x1, h } = BUILDING;
  const teeth = 4;
  const w = (x1 - x0) / teeth;
  shape.moveTo(x0, h);
  for (let k = 0; k < teeth; k++) {
    shape.lineTo(x0 + (k + 1) * w, h + 1.9);
    shape.lineTo(x0 + (k + 1) * w, h);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: BUILDING.z1 - BUILDING.z0, bevelEnabled: false });
}

function Building({ p, node }: { p: Palette; node: MapNode }) {
  const s = p.site;
  const { x0, x1, z0, h } = BUILDING;
  const roof = useDisposable(useMemo(sawtoothRoof, []));
  const roofMats = useMemo(() => [mat(s.wall, 0.8), mat(s.roof, 0.55)], [s.wall, s.roof]);

  const wall = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    const edges = [x0, ...DOOR_X.flatMap((x) => [x - DOOR_W / 2 - 0.2, x + DOOR_W / 2 + 0.2]), x1];
    for (let i = 0; i < edges.length; i += 2) out.push({ x: (edges[i] + edges[i + 1]) / 2, y: h / 2, z: WALL_Z, w: edges[i + 1] - edges[i], h, d: 0.3 });
    for (const x of DOOR_X) out.push({ x, y: (DOOR_H + h) / 2 + 0.2, z: WALL_Z, w: DOOR_W + 0.4, h: h - DOOR_H - 0.4, d: 0.3 });
    out.push({ x: 0, y: h / 2, z: z0, w: x1 - x0, h, d: 0.3 });
    out.push({ x: x0, y: h / 2, z: (z0 + WALL_Z) / 2, w: 0.3, h, d: WALL_Z - z0 }, { x: x1, y: h / 2, z: (z0 + WALL_Z) / 2, w: 0.3, h, d: WALL_Z - z0 });
    return out;
  }, [x0, x1, z0, h]);
  const ribs = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    for (let x = x0 + 0.3; x < x1; x += 0.55) {
      if (DOOR_X.some((d) => Math.abs(x - d) < DOOR_W / 2 + 0.3)) {
        out.push({ x, y: (DOOR_H + h) / 2 + 0.25, z: WALL_Z + 0.17, w: 0.12, h: h - DOOR_H - 0.5, d: 0.06 });
      } else out.push({ x, y: h / 2, z: WALL_Z + 0.17, w: 0.12, h, d: 0.06 });
    }
    for (let z = z0 + 0.3; z < WALL_Z; z += 0.55) out.push({ x: x0 - 0.17, y: h / 2, z, w: 0.06, h, d: 0.12 });
    return out;
  }, [x0, x1, z0, h]);
  const frames = useMemo<Box3[]>(() => DOOR_X.flatMap((x) => [
    { x: x - DOOR_W / 2 - 0.12, y: DOOR_H / 2 + 0.1, z: WALL_Z + 0.22, w: 0.3, h: DOOR_H + 0.2, d: 0.3 },
    { x: x + DOOR_W / 2 + 0.12, y: DOOR_H / 2 + 0.1, z: WALL_Z + 0.22, w: 0.3, h: DOOR_H + 0.2, d: 0.3 },
    { x, y: DOOR_H + 0.18, z: WALL_Z + 0.22, w: DOOR_W + 0.54, h: 0.3, d: 0.3 },
    { x: x - DOOR_W / 2 + 0.25, y: 0.35, z: WALL_Z + 0.42, w: 0.3, h: 0.7, d: 0.25 },
    { x: x + DOOR_W / 2 - 0.25, y: 0.35, z: WALL_Z + 0.42, w: 0.3, h: 0.7, d: 0.25 },
  ]), []);
  const interiors = useMemo<Box3[]>(() => DOOR_X.map((x) => ({ x, y: DOOR_H / 2, z: WALL_Z - 1.6, w: DOOR_W, h: DOOR_H, d: 0.1 })), []);
  const stock = useMemo<Box3[]>(() => DOOR_X.flatMap((x, i) => [
    { x, y: 0.1, z: WALL_Z - 0.9, w: 1.3, h: 0.18, d: 1.2 },
    { x, y: 0.75, z: WALL_Z - 0.9, w: 1.2, h: 1.1, d: 1.1 },
    ...(i % 2 === 0 ? [{ x: x + 0.1, y: 1.72, z: WALL_Z - 0.9, w: 1.0, h: 0.8, d: 1.0 }] : []),
  ]), []);
  const sign = useDisposable(useMemo(() => signTexture(node.id, node.name, s, p.blue), [node.id, node.name, s, p.blue]));
  const badges = useMemo(() => DOOR_X.map((_, i) => badgeTexture(`D${i + 1}`, s.doorFrame)), [s.doorFrame]);
  useEffect(() => () => badges.forEach((b) => b.dispose()), [badges]);

  return (
    <group>
      <Instanced items={wall} color={s.wall} cast />
      <Instanced items={ribs} color={s.rib} />
      <Instanced items={interiors} color={s.interior} rough={1} />
      <Instanced items={frames} color={s.doorFrame} rough={0.5} cast />
      <Instanced items={stock} color={s.loads[0]} />
      <mesh geometry={roof} material={roofMats} position={[0, 0, z0]} castShadow receiveShadow />
      <TexPlane map={sign} w={8.4} h={1.31} position={[0, 5.32, WALL_Z + 0.2]} />
      {badges.map((b, i) => (
        <TexPlane key={i} map={b} w={0.8} h={0.6} position={[DOOR_X[i] - DOOR_W / 2 + 0.3, DOOR_H + 0.62, WALL_Z + 0.4]} />
      ))}
      {node.cold && (
        <>
          <mesh geometry={cylGeo(1.4, 1.4, 7)} material={mat(s.wall)} position={[x1 + 2.2, 3.5, z0 + 3]} castShadow dispose={null} />
          <mesh geometry={cylGeo(1.4, 1.4, 7)} material={mat(s.wall)} position={[x1 + 2.2, 3.5, z0 + 6.4]} castShadow dispose={null} />
        </>
      )}
    </group>
  );
}

function Racks({ p }: { p: Palette }) {
  const posts = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    for (const rx of RACK_X) for (let z = -17; z <= -2.6 + 0.01; z += 2.4) for (const dx of [-0.6, 0.6]) out.push({ x: rx + dx, y: 2.1, z, w: 0.14, h: 4.2, d: 0.14 });
    return out;
  }, []);
  const beams = useMemo<Box3[]>(() => {
    const out: Box3[] = [];
    for (const rx of RACK_X) for (const y of [1.5, 2.9, 4.15]) for (const dx of [-0.6, 0.6]) out.push({ x: rx + dx, y, z: -9.8, w: 0.1, h: 0.14, d: 14.4 });
    return out;
  }, []);
  return (
    <group>
      <Instanced items={posts} color={p.site.rack} rough={0.5} cast />
      <Instanced items={beams} color={p.site.beam} rough={0.5} />
    </group>
  );
}

function Pallets({ sim, p, onPick }: { sim: SiteSim; p: Palette; onPick: (id: string) => void }) {
  const base = useRef<THREE.InstancedMesh>(null);
  const load = useRef<THREE.InstancedMesh>(null);
  const pinHead = useRef<THREE.InstancedMesh>(null);
  const pinTip = useRef<THREE.InstancedMesh>(null);
  const n = sim.pallets.length;
  const tip = useDisposable(
    useMemo(() => {
      const g = new THREE.ConeGeometry(0.42, 1.0, 16);
      g.rotateX(Math.PI);
      return g;
    }, [])
  );

  useLayoutEffect(() => {
    sim.pallets.forEach((pl, i) => {
      load.current?.setColorAt(i, _c.set(p.site.loads[pl.info.style]));
      pinHead.current?.setColorAt(i, _c.set(p.tone.affected));
      pinTip.current?.setColorAt(i, _c.set(p.tone.affected));
    });
    [load, pinHead, pinTip].forEach((r) => {
      if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, [sim, p]);

  useFrame(({ clock }, dt) => {
    const k = ease(dt, 5);
    const t = clock.elapsedTime;
    sim.pallets.forEach((pl, i) => {
      _q.setFromAxisAngle(_y, pl.yaw);
      _m.compose(_p.set(pl.x, pl.y + 0.08, pl.z), _q, _s.set(1, 1, 1));
      base.current?.setMatrixAt(i, _m);
      _m.compose(_p.set(pl.x, pl.y + 0.6, pl.z), _q, _s.set(1, 1, 1));
      load.current?.setMatrixAt(i, _m);
      const flagged = flaggedIn(pl.info.status, sim.mode);
      const toneKey = sim.mode === 'naive' ? 'affected' : pl.info.status;
      if (load.current) {
        load.current.getColorAt(i, _c);
        _c2.set(p.site.loads[pl.info.style]);
        if (flagged) _c2.lerp(_c3.set(p.tone[toneKey === 'safe' ? 'affected' : toneKey]), 0.72);
        _c.lerp(_c2, k);
        load.current.setColorAt(i, _c);
      }
      const pinned = flagged && (pl.state === 'stored' || pl.state === 'claimed');
      const bob = 0.18 * Math.sin(t * 3 + i);
      const sc = pinned ? 1 : 0.0001;
      _m.compose(_p.set(pl.x, pl.y + 2.75 + bob, pl.z), _q.identity(), _s.set(sc, sc, sc));
      pinHead.current?.setMatrixAt(i, _m);
      _m.compose(_p.set(pl.x, pl.y + 2.05 + bob, pl.z), _q, _s.set(sc, sc, sc));
      pinTip.current?.setMatrixAt(i, _m);
      if (pinHead.current) {
        _c.set(p.tone[toneKey === 'safe' ? 'affected' : toneKey]);
        pinHead.current.setColorAt(i, _c);
        pinTip.current?.setColorAt(i, _c);
      }
    });
    for (const m of [base.current, load.current, pinHead.current, pinTip.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  if (n === 0) return null;
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || e.instanceId === undefined) return;
    e.stopPropagation();
    const pl = sim.pallets[e.instanceId];
    if (pl) onPick(pl.info.id);
  };
  return (
    <group>
      <instancedMesh ref={base} args={[boxGeo(1.3, 0.16, 1.2), undefined, n]} material={mat(p.site.wood, 0.9)} castShadow receiveShadow frustumCulled={false} dispose={null} />
      <instancedMesh
        ref={load}
        args={[boxGeo(1.18, 0.9, 1.1), undefined, n]}
        material={mat('#ffffff', 0.7)}
        castShadow
        receiveShadow
        frustumCulled={false}
        onClick={pick}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
        dispose={null}
      />
      <instancedMesh ref={pinHead} args={[sphereGeo(0.5), undefined, n]} material={mat('#ffffff', 0.35)} frustumCulled={false} dispose={null} />
      <instancedMesh ref={pinTip} args={[tip, undefined, n]} material={mat('#ffffff', 0.35)} frustumCulled={false} />
    </group>
  );
}

function Forklift({ sim, index, p, onPick }: { sim: SiteSim; index: number; p: Palette; onPick: (id: string) => void }) {
  const g = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  const s = p.site;
  useFrame(() => {
    const f = sim.forklifts[index];
    if (!f || !g.current) return;
    g.current.position.set(f.x, 0, f.z);
    g.current.rotation.y = f.yaw;
    if (carriage.current) carriage.current.position.y = f.lift;
  });
  const f = sim.forklifts[index];
  const dark = s.tire;
  return (
    <group
      ref={g}
      onClick={(e) => {
        if (e.delta > 6 || !f) return;
        e.stopPropagation();
        onPick(f.id);
      }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <mesh geometry={boxGeo(1.1, 0.4, 1.7)} material={mat(p.blue, 0.5)} position={[0, 0.42, -0.1]} castShadow dispose={null} />
      <mesh geometry={boxGeo(1.06, 0.62, 1.15)} material={mat(p.forklift, 0.45)} position={[0, 0.92, -0.35]} castShadow dispose={null} />
      <mesh geometry={boxGeo(1.06, 0.55, 0.4)} material={mat(p.forklift, 0.45)} position={[0, 0.9, -1.0]} castShadow dispose={null} />
      <mesh geometry={boxGeo(1.22, 0.52, 0.52)} material={mat(dark, 0.9)} position={[0, 0.27, 0.42]} dispose={null} />
      <mesh geometry={boxGeo(1.22, 0.46, 0.46)} material={mat(dark, 0.9)} position={[0, 0.24, -0.72]} dispose={null} />
      {[[-0.48, 0.2], [0.48, 0.2], [-0.48, -0.85], [0.48, -0.85]].map(([x, z], i) => (
        <mesh key={i} geometry={boxGeo(0.08, 1.3, 0.08)} material={mat(dark, 0.6)} position={[x, 1.85, z]} dispose={null} />
      ))}
      <mesh geometry={boxGeo(1.08, 0.08, 1.2)} material={mat(dark, 0.6)} position={[0, 2.52, -0.32]} castShadow dispose={null} />
      <mesh geometry={boxGeo(0.46, 0.55, 0.38)} material={mat(s.vest, 0.7)} position={[0, 1.5, -0.4]} dispose={null} />
      <mesh geometry={sphereGeo(0.17)} material={mat(s.skin, 0.7)} position={[0, 1.95, -0.4]} dispose={null} />
      <mesh geometry={boxGeo(0.09, 2.9, 0.1)} material={mat(dark, 0.5)} position={[-0.33, 1.45, 0.66]} dispose={null} />
      <mesh geometry={boxGeo(0.09, 2.9, 0.1)} material={mat(dark, 0.5)} position={[0.33, 1.45, 0.66]} dispose={null} />
      <group ref={carriage}>
        <mesh geometry={boxGeo(0.8, 0.5, 0.06)} material={mat(dark, 0.5)} position={[0, 0.3, 0.74]} dispose={null} />
        <mesh geometry={boxGeo(0.12, 0.05, 1.05)} material={mat(dark, 0.4)} position={[-0.24, 0.03, 1.25]} dispose={null} />
        <mesh geometry={boxGeo(0.12, 0.05, 1.05)} material={mat(dark, 0.4)} position={[0.24, 0.03, 1.25]} dispose={null} />
      </group>
    </group>
  );
}

function Truck({ sim, index, p, onPick }: { sim: SiteSim; index: number; p: Palette; onPick: (id: string) => void }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const t = sim.trucks[index];
  const color = p.site.liveries[t?.livery ?? 0];
  const livery = useDisposable(useMemo(() => liveryTexture(color), [color]));
  const sideMat = useMemo(() => new THREE.MeshStandardMaterial({ map: livery, roughness: 0.6 }), [livery]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: p.tone.affected, transparent: true, opacity: 0.7, depthWrite: false }), [p.tone.affected]);
  useEffect(() => () => {
    sideMat.dispose();
    ringMat.dispose();
  }, [sideMat, ringMat]);

  useFrame(({ clock }) => {
    const tr = sim.trucks[index];
    if (!tr || !g.current) return;
    g.current.position.set(tr.x, 0, tr.z);
    g.current.rotation.y = tr.yaw;
    if (ring.current) {
      ring.current.visible = tr.held;
      const sc = 1 + 0.06 * Math.sin(clock.elapsedTime * 4 + index);
      ring.current.scale.set(sc, 1, sc);
    }
  });
  if (!t) return null;
  const dark = p.site.tire;
  return (
    <group
      ref={g}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        onPick(t.ship.id);
      }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <mesh geometry={boxGeo(2.5, 2.9, 6.6)} material={mat(p.truckBody, 0.55)} position={[0, 2.15, -1.3]} castShadow dispose={null} />
      <mesh material={sideMat} position={[1.255, 2.15, -1.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6.4, 2.8]} />
      </mesh>
      <mesh material={sideMat} position={[-1.255, 2.15, -1.3]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6.4, 2.8]} />
      </mesh>
      <mesh geometry={boxGeo(2.4, 2.2, 1.9)} material={mat(color, 0.45)} position={[0, 1.65, 3.05]} castShadow dispose={null} />
      <mesh geometry={boxGeo(2.1, 0.85, 0.06)} material={mat(p.site.glass, 0.2)} position={[0, 2.15, 4.02]} dispose={null} />
      <mesh geometry={boxGeo(2.2, 0.45, 8.6)} material={mat(dark, 0.8)} position={[0, 0.6, 0]} dispose={null} />
      {[3.0, -2.6, -3.7].map((z) => (
        <mesh key={z} geometry={cylGeo(0.46, 0.46, 2.6, 14)} material={mat(dark, 0.9)} position={[0, 0.46, z]} rotation={[0, 0, Math.PI / 2]} dispose={null} />
      ))}
      <mesh ref={ring} geometry={ringGeo(5, 5.6)} material={ringMat} position={[0, 0.06, -0.3]} renderOrder={2} dispose={null} />
    </group>
  );
}

const BRACKET: Record<'pallet' | 'forklift' | 'truck', [number, number, number]> = {
  pallet: [1.6, 1.3, 1.5],
  forklift: [1.7, 2.8, 3],
  truck: [3, 4, 9.8],
};

function SelectionMarker({ sim, selection, p, cam }: { sim: SiteSim; selection: SiteSelection; p: Palette; cam: SiteCam }) {
  const group = useRef<THREE.Group>(null);
  const label = useRef<THREE.Sprite>(null);
  const shown = useRef('');
  const dpr = useThree((s) => s.viewport.dpr);
  const geo = useMemo(() => (selection ? cornerBrackets(...BRACKET[selection.kind]) : null), [selection]);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: p.route }), [p.route]);
  const lines = useMemo(() => (geo ? new THREE.LineSegments(geo, lineMat) : null), [geo, lineMat]);
  const labelMat = useMemo(() => new THREE.SpriteMaterial({ depthTest: false, transparent: true }), []);
  useEffect(() => () => geo?.dispose(), [geo]);
  useEffect(() => () => {
    lineMat.dispose();
    labelMat.dispose();
  }, [lineMat, labelMat]);

  useFrame(({ camera, size }) => {
    if (!selection || !group.current) return;
    let pos: { x: number; y: number; z: number; yaw: number; text: string; h: number } | null = null;
    if (selection.kind === 'pallet') {
      const pl = sim.pallets.find((q) => q.info.id === selection.id);
      if (pl) pos = { x: pl.x, y: pl.y, z: pl.z, yaw: pl.yaw, text: pl.info.product, h: 1.3 };
    } else if (selection.kind === 'forklift') {
      const f = sim.forklifts.find((q) => q.id === selection.id);
      if (f) pos = { x: f.x, y: 0, z: f.z, yaw: f.yaw, text: f.task, h: 2.8 };
    } else {
      const t = sim.trucks.find((q) => q.ship.id === selection.id);
      if (t) pos = { x: t.x, y: 0, z: t.z, yaw: t.yaw, text: t.held ? 'Held for inspection' : t.ship.product, h: 4 };
    }
    group.current.visible = !!pos;
    if (!pos) return;
    group.current.position.set(pos.x, pos.y, pos.z);
    group.current.rotation.y = pos.yaw;
    if (cam.follow && selection.kind !== 'pallet') cam.targetT.set(pos.x, 0, pos.z);
    const text = pos.text.length > 30 ? `${pos.text.slice(0, 29)}…` : pos.text;
    if (shown.current !== text) {
      shown.current = text;
      const { texture } = labelTexture(selection.id, text, p.label, dpr);
      labelMat.map = texture;
      labelMat.needsUpdate = true;
      if (label.current) label.current.userData.aspect = texture.image.width / texture.image.height;
    }
    if (label.current) {
      const aspect = (label.current.userData.aspect as number | undefined) ?? 4;
      const persp = camera as THREE.PerspectiveCamera;
      const world = new THREE.Vector3(pos.x, pos.y + pos.h + 0.9, pos.z);
      const dist = camera.position.distanceTo(world);
      const hWorld = (LABEL_PX * 2 * dist * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))) / size.height;
      label.current.position.set(0, pos.h + 0.9 + hWorld / 2, 0);
      label.current.scale.set(hWorld * aspect, hWorld, 1);
    }
  });

  if (!selection || !lines) return null;
  const [w, h, d] = BRACKET[selection.kind];
  return (
    <group ref={group}>
      <primitive object={lines} />
      <mesh position={[0, h / 2, 0]} renderOrder={4}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={p.route} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <sprite ref={label} material={labelMat} renderOrder={30} />
    </group>
  );
}

function SiteCameraRig({ cam }: { cam: SiteCam }) {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; sx: number; sy: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
      cam.moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) cam.moved = true;
      if (!cam.moved) return;
      cam.follow = false;
      el.style.cursor = 'grabbing';
      const k = cam.dist * 0.0017;
      const nx = cam.targetT.x - Math.cos(cam.az) * dx * k - Math.sin(cam.az) * dy * k * 1.6;
      const nz = cam.targetT.z + Math.sin(cam.az) * dx * k - Math.cos(cam.az) * dy * k * 1.6;
      cam.targetT.set(clamp(nx, -45, 45), 0, clamp(nz, -22, 26));
    };
    const up = () => {
      drag = null;
      el.style.cursor = '';
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.distT = clamp(cam.distT * Math.exp(e.deltaY * 0.0012), 16, 140);
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [cam, gl]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    const k = ease(dt, 3.5);
    cam.target.lerp(cam.targetT, k);
    cam.dist += (cam.distT - cam.dist) * k;
    cam.az += (cam.azT - cam.az) * k;
    const t = cam.target;
    c.position.set(t.x + Math.sin(cam.az) * Math.cos(EL) * cam.dist, Math.sin(EL) * cam.dist, t.z + Math.cos(cam.az) * Math.cos(EL) * cam.dist);
    c.lookAt(t);
  });
  return <PerspectiveCamera ref={ref} makeDefault fov={30} near={0.5} far={1200} position={[-60, 80, 80]} />;
}

function SimDriver({ sim, held, onStats }: { sim: SiteSim; held: Set<string>; onStats: (s: SiteStats) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1) * 2.6;
    stepSim(sim, step, held);
    acc.current += dt;
    if (acc.current > 0.25) {
      acc.current = 0;
      onStats(snapshot(sim));
    }
  });
  useEffect(() => {
    onStats(snapshot(sim));
  }, [sim, onStats]);
  return null;
}

const TREES: Array<[number, number, number]> = [
  [-36, -14, 1.1], [-37, -6, 0.9], [-36, 4, 1], [-37, 12, 1.2], [36, -14, 1], [37, -4, 1.1], [36, 12, 0.9],
  [-20, -21, 1], [-6, -21, 1.1], [8, -21, 0.9], [22, -21, 1.1], [33, -19, 1], [-33, -20, 1],
];

function Trees({ p }: { p: Palette }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    TREES.forEach(([x, z, s], i) => {
      trunk.current?.setMatrixAt(i, _m.compose(_p.set(x, 1.1 * s, z), _q.identity(), _s.set(s, s, s)));
      crown.current?.setMatrixAt(i, _m.compose(_p.set(x, 3 * s, z), _q.identity(), _s.set(1.5 * s, 1.7 * s, 1.5 * s)));
    });
    [trunk, crown].forEach((r) => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true;
        r.current.computeBoundingSphere();
      }
    });
  }, []);
  return (
    <>
      <instancedMesh ref={trunk} args={[boxGeo(0.3, 2.2, 0.3), undefined, TREES.length]} material={mat(p.trunk)} dispose={null} />
      <instancedMesh ref={crown} args={[sphereGeo(1), undefined, TREES.length]} material={mat(p.tree, 0.75)} castShadow dispose={null} />
    </>
  );
}

interface SiteSceneProps {
  node: MapNode;
  sim: SiteSim;
  palette: Palette;
  held: Set<string>;
  cam: SiteCam;
  selection: SiteSelection;
  onSelect: (s: SiteSelection) => void;
  onStats: (s: SiteStats) => void;
}

export function SiteScene({ node, sim, palette: p, held, cam, selection, onSelect, onStats }: SiteSceneProps) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    scene.background = new THREE.Color(p.bg);
    scene.fog = new THREE.Fog(p.bg, 160, 420);
  }, [scene, p.bg]);

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fffaf0', p.isDark ? 1.1 : 1.7);
    l.position.set(-40, 70, 45);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 5, far: 220 });
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.03;
    return l;
  }, [p.isDark]);
  useEffect(() => () => sun.dispose(), [sun]);

  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current % 30 === 0) gl.domElement.dataset.calls = String(gl.info.render.calls);
  });

  const pick = (kind: 'pallet' | 'forklift' | 'truck') => (id: string) => {
    cam.follow = kind !== 'pallet';
    onSelect({ kind, id });
  };

  return (
    <>
      <SiteCameraRig cam={cam} />
      <hemisphereLight args={[p.isDark ? '#cfd6e6' : '#ffffff', p.isDark ? '#22201d' : '#c9cfdc', p.isDark ? 0.55 : 1.05]} />
      <ambientLight intensity={p.isDark ? 0.25 : 0.35} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <SimDriver sim={sim} held={held} onStats={onStats} />
      <Yard p={p} mode={sim.mode} />
      <Building p={p} node={node} />
      <Racks p={p} />
      <Trees p={p} />
      <mesh geometry={boxGeo(2.6, 2.6, 6.2)} material={mat(p.site.container, 0.6)} position={[28, 1.3, -10]} rotation={[0, 0.25, 0]} castShadow dispose={null} />
      <Pallets sim={sim} p={p} onPick={pick('pallet')} />
      {sim.forklifts.map((f, i) => (
        <Forklift key={f.id} sim={sim} index={i} p={p} onPick={pick('forklift')} />
      ))}
      {sim.trucks.map((t, i) => (
        <Truck key={t.ship.id} sim={sim} index={i} p={p} onPick={pick('truck')} />
      ))}
      <SelectionMarker sim={sim} selection={selection} p={p} cam={cam} />
    </>
  );
}

