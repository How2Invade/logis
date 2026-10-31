import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Cyl, boxGeo, mat, planeGeo, roofLogoTexture } from '../primitives';
import { NodeLabel, StatusRing, pickHandlers, useToneMaterials, type NodeProps } from './NodeDecor';
import { displayTone, ease, toneColor } from '../state';
import { crateTones } from '../palette';

const PALLETS = 10;
const DOORS = [-4.2, -1.4, 1.4, 4.2];
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

function Forklift({ phase, color, dark }: { phase: number; color: string; dark: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.45 + phase;
    g.position.x = Math.sin(t) * 4.2;
    g.rotation.y = Math.cos(t) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={ref} position={[0, 0, 4.1 + phase * 0.3]}>
      <Box size={[0.9, 0.7, 1.3]} color={color} position={[0, 0.6, 0]} />
      <Box size={[0.8, 0.5, 0.5]} color={dark} position={[0, 1.15, -0.2]} />
      <Box size={[0.75, 1.7, 0.1]} color={dark} position={[0, 1.1, 0.7]} />
      <Box size={[0.6, 0.06, 0.8]} color={dark} position={[0, 0.3, 1.1]} />
    </group>
  );
}

export function Warehouse({ node, placement, state, selected, onSelect, onOpen }: NodeProps & { onOpen: (id: string) => void }) {
  const p = state.palette;
  const { solid, glow } = useToneMaterials(node, state);
  const pallets = useRef<THREE.InstancedMesh>(null);
  const detail = useRef<THREE.Group>(null);
  const logo = useMemo(
    () => new THREE.MeshBasicMaterial({ map: roofLogoTexture('LOGIS', p.blue), transparent: true, depthWrite: false }),
    [p.blue]
  );
  useEffect(() => () => logo.dispose(), [logo]);

  useEffect(() => {
    const mesh = pallets.current;
    if (!mesh) return;
    for (let k = 0; k < PALLETS; k++) {
      _m.makeTranslation(-4.95 + k * 1.1, 0.6, 5.9);
      mesh.setMatrixAt(k, _m);
      mesh.setColorAt(k, _c.set(p.neutral));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [p.neutral]);

  useFrame((_, dt) => {
    const mesh = pallets.current;
    if (mesh?.instanceColor) {
      const tones = crateTones(node, state.mode, PALLETS);
      const hidden = displayTone(state, node) === 'neutral';
      mesh.count = tones.length;
      const k = ease(dt, 4);
      for (let i = 0; i < tones.length; i++) {
        const t = hidden ? 'neutral' : tones[i];
        mesh.getColorAt(i, _c);
        _c.lerp(toneColor(state, t), k);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    if (detail.current) detail.current.visible = state.view.zoom >= 10;
  });

  return (
    <>
      <group position={[placement.x, 0, placement.z]} rotation={[0, placement.rot, 0]} {...pickHandlers(node.id, state, onSelect)} onDoubleClick={(e) => { e.stopPropagation(); onOpen(node.id); }}>
        <Box size={[15, 0.06, 13.5]} color={p.concrete} position={[0, 0.21, 0]} />
        <Box size={[12, 5, 8]} color={p.blue} position={[0, 2.7, -1]} cast />
        <Box size={[12.35, 0.25, 8.35]} material={solid} position={[0, 5.1, -1]} />
        <Box size={[12.2, 0.3, 8.2]} color={p.roof} position={[0, 5.37, -1]} cast />
        <mesh geometry={planeGeo(6, 2.25)} material={logo} position={[-1.2, 5.54, -1]} renderOrder={3} dispose={null} />
        <Box size={[0.9, 0.5, 0.9]} color={p.roof} position={[4, 5.75, -3]} />
        <Box size={[0.9, 0.5, 0.9]} color={p.roof} position={[4, 5.75, 1]} />
        {DOORS.map((x) => (
          <Box key={x} size={[1.9, 2.6, 0.08]} color={p.door} position={[x, 1.5, 3.04]} />
        ))}
        <Box size={[12, 0.08, 2.6]} color={p.concrete} position={[0, 0.26, 4.4]} />
        {node.cold && (
          <>
            <Cyl r={1.1} h={4.6} color={p.roof} position={[-3, 2.5, -6.2]} cast />
            <Cyl r={1.1} h={4.6} color={p.roof} position={[0, 2.5, -6.2]} cast />
            <Box size={[0.25, 0.25, 0.25]} color={p.route} position={[1.6, 5.2, -6.2]} />
          </>
        )}
        <instancedMesh ref={pallets} args={[boxGeo(0.9, 0.7, 0.9), undefined, PALLETS]} material={mat('#ffffff', 0.7)} castShadow dispose={null} />
        <group ref={detail} visible={false}>
          <Forklift phase={0} color={p.forklift} dark={p.door} />
          <Forklift phase={2.4} color={p.forklift} dark={p.door} />
        </group>
        <StatusRing material={glow} radius={8.8} />
      </group>
      <NodeLabel node={node} state={state} x={placement.x} z={placement.z} y={6.2} minZoom={0} selected={selected} />
    </>
  );
}
