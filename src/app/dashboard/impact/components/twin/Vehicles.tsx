import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { MapShipment } from '@/lib/types/network';
import { boxGeo, mat, ringGeo } from './primitives';
import { lanePolyline, routeBetween, type CityLayout } from './cityLayout';
import { ease, toneColor, type Selection, type TwinState } from './state';
import type { Tone } from './palette';

type Pt = [number, number];

export interface TruckRun {
  shipment: MapShipment;
  fwd: Pt[];
  back: Pt[];
  fwdCum: number[];
  backCum: number[];
  dist: number;
  forward: boolean;
  speed: number;
  wait: number;
  blocked: number;
  x: number;
  z: number;
  hx: number;
  hz: number;
}

const MAX_SPEED = 7;
const cumulative = (pts: Pt[]) => {
  const out = [0];
  for (let k = 1; k < pts.length; k++) out.push(out[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return out;
};

function sample(pts: Pt[], cum: number[], d: number): { x: number; z: number; hx: number; hz: number } {
  let k = 1;
  while (k < cum.length - 1 && cum[k] < d) k++;
  const a = pts[k - 1];
  const b = pts[k];
  const len = cum[k] - cum[k - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[k - 1]) / len));
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, hx: (b[0] - a[0]) / len, hz: (b[1] - a[1]) / len };
}

export function buildTruckRuns(shipments: MapShipment[], layout: CityLayout): TruckRun[] {
  const runs: TruckRun[] = [];
  shipments.forEach((s, k) => {
    const r = routeBetween(layout, s.origin, s.destination);
    if (!r) return;
    const fwd = lanePolyline(r.tiles, r.start, r.end);
    const back = lanePolyline([...r.tiles].reverse(), r.end, r.start);
    const fwdCum = cumulative(fwd);
    const backCum = cumulative(back);
    const total = fwdCum[fwdCum.length - 1];
    const dist = ((k * 0.37) % 1) * total;
    const p = sample(fwd, fwdCum, dist);
    runs.push({ shipment: s, fwd, back, fwdCum, backCum, dist, forward: k % 3 !== 2, speed: MAX_SPEED, wait: 0, blocked: 0, ...p });
  });
  return runs;
}

const PARTS = {
  trailer: new THREE.Matrix4().makeTranslation(0, 1.35, -0.8),
  cab: new THREE.Matrix4().makeTranslation(0, 1.05, 1.9),
  chassis: new THREE.Matrix4().makeTranslation(0, 0.42, 0),
};
const _g = new THREE.Matrix4();
const _o = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

interface VehiclesProps {
  runs: TruckRun[];
  state: TwinState;
  onSelect: (s: Selection) => void;
}

export function Vehicles({ runs, state, onSelect }: VehiclesProps) {
  const p = state.palette;
  const trailer = useRef<THREE.InstancedMesh>(null);
  const cab = useRef<THREE.InstancedMesh>(null);
  const chassis = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.InstancedMesh>(null);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), []);
  useLayoutEffect(() => () => ringMat.dispose(), [ringMat]);

  useLayoutEffect(() => {
    runs.forEach((_, k) => {
      cab.current?.setColorAt(k, _c.set(p.neutral));
      ring.current?.setColorAt(k, _c.set(p.neutral));
    });
    if (cab.current?.instanceColor) cab.current.instanceColor.needsUpdate = true;
    if (ring.current?.instanceColor) ring.current.instanceColor.needsUpdate = true;
  }, [runs, p.neutral]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = ease(dt, 5);
    const n = runs.length;
    for (let i = 0; i < n; i++) {
      const r = runs[i];
      const held = state.held.has(r.shipment.id);
      let blocked = false;
      if (r.blocked < 2.5) {
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const o = runs[j];
          const dx = o.x - r.x;
          const dz = o.z - r.z;
          const ahead = dx * r.hx + dz * r.hz;
          if (ahead > 0 && ahead < 4.8 && Math.abs(dx * r.hz - dz * r.hx) < 1.0) {
            blocked = true;
            break;
          }
        }
      }
      r.blocked = blocked ? r.blocked + dt : 0;
      const recalled = state.mode === 'naive' && !state.trace.active;
      const target = held || recalled || blocked || r.wait > 0 ? 0 : MAX_SPEED;
      r.speed += (target - r.speed) * Math.min(1, dt * (target > r.speed ? 2 : 8));
      if (r.wait > 0) r.wait -= dt;

      const pts = r.forward ? r.fwd : r.back;
      const cum = r.forward ? r.fwdCum : r.backCum;
      const total = cum[cum.length - 1];
      r.dist += r.speed * dt;
      if (r.dist >= total) {
        r.dist = 0;
        r.forward = !r.forward;
        r.wait = 1.4;
      }
      const s = sample(r.forward ? r.fwd : r.back, r.forward ? r.fwdCum : r.backCum, r.dist);
      if (pts.length > 1) {
        r.x = s.x;
        r.z = s.z;
        if (Math.hypot(s.hx, s.hz) > 0.01) {
          r.hx += (s.hx - r.hx) * ease(dt, 10);
          r.hz += (s.hz - r.hz) * ease(dt, 10);
        }
      }
      const yaw = Math.atan2(r.hx, r.hz);
      state.truckPos.set(r.shipment.id, { x: r.x, z: r.z, yaw });

      _g.compose(_v.set(r.x, 0, r.z), _q.setFromAxisAngle(_y, yaw), _s.set(1, 1, 1));
      trailer.current?.setMatrixAt(i, _o.multiplyMatrices(_g, PARTS.trailer));
      cab.current?.setMatrixAt(i, _o.multiplyMatrices(_g, PARTS.cab));
      chassis.current?.setMatrixAt(i, _o.multiplyMatrices(_g, PARTS.chassis));

      const revealed = !state.trace.active || (state.plan.revealAt.get(r.shipment.destination) ?? Infinity) <= state.trace.t;
      let tone: Tone | 'neutral';
      if (!revealed) tone = 'neutral';
      else if (held) tone = 'idle';
      else if (state.mode === 'naive') tone = 'affected';
      else tone = r.shipment.impact;
      const flagged = revealed && (held || tone === 'affected' || tone === 'uncertain');
      const pulse = held || recalled ? 1.1 : 1 + 0.18 * Math.sin(clock.elapsedTime * 5 + i);
      _s.setScalar(flagged ? pulse : 0.0001);
      ring.current?.setMatrixAt(i, _o.compose(_v.set(r.x, 0.22, r.z), _q.identity(), _s));
      _s.set(1, 1, 1);

      if (cab.current) {
        cab.current.getColorAt(i, _c);
        _c.lerp(toneColor(state, tone), k);
        cab.current.setColorAt(i, _c);
        ring.current?.setColorAt(i, _c);
      }
    }
    for (const m of [trailer.current, cab.current, chassis.current, ring.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || e.instanceId === undefined) return;
    e.stopPropagation();
    const r = runs[e.instanceId];
    if (r) onSelect({ kind: 'truck', id: r.shipment.id });
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const out = () => {
    document.body.style.cursor = '';
  };

  const n = runs.length;
  if (n === 0) return null;
  return (
    <group>
      <instancedMesh ref={trailer} args={[boxGeo(1.8, 1.9, 3.8), undefined, n]} material={mat(p.truckBody, 0.6)} castShadow onClick={pick} onPointerOver={over} onPointerOut={out} frustumCulled={false} dispose={null} />
      <instancedMesh ref={cab} args={[boxGeo(1.8, 1.5, 1.3), undefined, n]} material={mat('#ffffff', 0.5)} castShadow onClick={pick} onPointerOver={over} onPointerOut={out} frustumCulled={false} dispose={null} />
      <instancedMesh ref={chassis} args={[boxGeo(1.6, 0.45, 5.2), undefined, n]} material={mat(p.door)} frustumCulled={false} dispose={null} />
      <instancedMesh ref={ring} args={[ringGeo(2.4, 3), undefined, n]} material={ringMat} renderOrder={1} frustumCulled={false} dispose={null} />
    </group>
  );
}
