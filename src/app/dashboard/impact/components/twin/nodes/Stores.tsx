import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { MapNode } from '@/lib/types/network';
import { boxGeo, mat, ringGeo } from '../primitives';
import { NodeLabel } from './NodeDecor';
import { displayTone, ease, toneColor, type Selection, type TwinState } from '../state';
import { crateTones } from '../palette';

const CRATES = 4;
import type { Placement } from '../cityLayout';

interface StoresProps {
  stores: Array<{ node: MapNode; placement: Placement }>;
  state: TwinState;
  selectedId: string | null;
  onSelect: (s: Selection) => void;
}

const _g = new THREE.Matrix4();
const _l = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

function local(x: number, y: number, z: number, rx = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
}

const PARTS = {
  body: local(0, 1.68, 0),
  roof: local(0, 3.35, 0),
  awning: local(0, 2.45, 2.65, 0.35),
  sign: local(0, 2.95, 2.33),
  ring: local(0, 0.22, 0),
};
const CRATE_AT = Array.from({ length: CRATES }, (_, c) => local(3.15, 0.62 + c * 0.86, 1.4));
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

export function Stores({ stores, state, selectedId, onSelect }: StoresProps) {
  const p = state.palette;
  const body = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  const awning = useRef<THREE.InstancedMesh>(null);
  const sign = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.InstancedMesh>(null);
  const crates = useRef<THREE.InstancedMesh>(null);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), []);
  useLayoutEffect(() => () => ringMat.dispose(), [ringMat]);

  useLayoutEffect(() => {
    const set = (ref: RefObject<THREE.InstancedMesh | null>, part: THREE.Matrix4) => {
      const mesh = ref.current;
      if (!mesh) return;
      stores.forEach(({ placement }, k) => {
        _g.compose(_v.set(placement.x, 0, placement.z), _q.setFromEuler(_e.set(0, placement.rot, 0)), _one);
        mesh.setMatrixAt(k, _l.multiplyMatrices(_g, part));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    set(body, PARTS.body);
    set(roof, PARTS.roof);
    set(awning, PARTS.awning);
    set(sign, PARTS.sign);
    set(ring, PARTS.ring);
    const cm = crates.current;
    if (cm) {
      stores.forEach(({ node, placement }, k) => {
        _g.compose(_v.set(placement.x, 0, placement.z), _q.setFromEuler(_e.set(0, placement.rot, 0)), _one);
        const stocked = node.units.naiveRecall > 0;
        CRATE_AT.forEach((part, c) => {
          cm.setMatrixAt(k * CRATES + c, stocked ? _l.multiplyMatrices(_g, part) : _zero);
          cm.setColorAt(k * CRATES + c, _c.set(p.neutral));
        });
      });
      cm.instanceMatrix.needsUpdate = true;
      if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
      cm.computeBoundingSphere();
    }
    stores.forEach((_, k) => {
      body.current?.setColorAt(k, _c.set(p.storeBodies[k % p.storeBodies.length]));
      awning.current?.setColorAt(k, _c.set(p.neutral));
      ring.current?.setColorAt(k, _c.set(p.neutral));
    });
    [body, awning, ring].forEach((r) => {
      if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, [stores, p]);

  useFrame((_, dt) => {
    const a = awning.current;
    const r = ring.current;
    if (!a?.instanceColor || !r?.instanceColor) return;
    const k = ease(dt, 5);
    stores.forEach(({ node }, i) => {
      const target = toneColor(state, displayTone(state, node));
      a.getColorAt(i, _c);
      _c.lerp(target, k);
      a.setColorAt(i, _c);
      r.setColorAt(i, _c);
    });
    a.instanceColor.needsUpdate = true;
    r.instanceColor.needsUpdate = true;
    const cm = crates.current;
    if (!cm?.instanceColor) return;
    stores.forEach(({ node }, i) => {
      const tones = crateTones(node, state.mode, CRATES);
      const hidden = displayTone(state, node) === 'neutral';
      tones.forEach((t, c) => {
        cm.getColorAt(i * CRATES + c, _c);
        _c.lerp(toneColor(state, hidden ? 'neutral' : t), k);
        cm.setColorAt(i * CRATES + c, _c);
      });
    });
    cm.instanceColor.needsUpdate = true;
  });

  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6 || e.instanceId === undefined) return;
      e.stopPropagation();
      const s = stores[e.instanceId];
      if (s) onSelect({ kind: 'node', id: s.node.id });
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (e.instanceId === undefined) return;
      e.stopPropagation();
      state.hovered = stores[e.instanceId]?.node.id ?? null;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      state.hovered = null;
      document.body.style.cursor = '';
    },
  };

  const n = stores.length;
  if (n === 0) return null;
  return (
    <>
      <instancedMesh ref={body} args={[boxGeo(4.6, 3, 4.6), undefined, n]} material={mat('#ffffff')} castShadow receiveShadow {...handlers} dispose={null} />
      <instancedMesh ref={roof} args={[boxGeo(5.1, 0.35, 5.1), undefined, n]} material={mat(p.roof, 0.7)} castShadow dispose={null} />
      <instancedMesh ref={awning} args={[boxGeo(4.4, 0.18, 1.3), undefined, n]} material={mat('#ffffff', 0.6)} dispose={null} />
      <instancedMesh ref={sign} args={[boxGeo(3.2, 0.6, 0.08), undefined, n]} material={mat(p.blue)} dispose={null} />
      <instancedMesh ref={crates} args={[boxGeo(0.8, 0.78, 0.8), undefined, n * CRATES]} material={mat('#ffffff', 0.7)} castShadow dispose={null} />
      <instancedMesh ref={ring} args={[ringGeo(3.4, 4), undefined, n]} material={ringMat} renderOrder={1} dispose={null} />
      {stores.map(({ node, placement }) => (
        <NodeLabel key={node.id} node={node} state={state} x={placement.x} z={placement.z} y={4} minZoom={7} selected={selectedId === node.id} />
      ))}
    </>
  );
}
