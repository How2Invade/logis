import { useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ease } from './state';

const EL = 0.6155;
const R = 220;

export interface CamController {
  target: THREE.Vector3;
  targetT: THREE.Vector3;
  zoom: number;
  zoomT: number;
  az: number;
  azT: number;
  base: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  moved: boolean;
}

export function createController(): CamController {
  return {
    target: new THREE.Vector3(),
    targetT: new THREE.Vector3(),
    zoom: 0,
    zoomT: 0,
    az: Math.PI / 4,
    azT: Math.PI / 4,
    base: 5,
    bounds: { minX: -100, maxX: 100, minZ: -64, maxZ: 64 },
    moved: false,
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function zoomBy(c: CamController, factor: number): void {
  c.zoomT = clamp(c.zoomT * factor, c.base * 0.55, c.base * 7);
}

export function flyTo(c: CamController, x: number, z: number, zoomMul?: number): void {
  c.targetT.set(clamp(x, c.bounds.minX, c.bounds.maxX), 0, clamp(z, c.bounds.minZ, c.bounds.maxZ));
  if (zoomMul !== undefined) c.zoomT = clamp(c.base * zoomMul, c.base * 0.55, c.base * 7);
}

export function resetView(c: CamController): void {
  c.targetT.set(0, 0, 0);
  c.zoomT = c.base;
  c.azT = Math.round((c.azT - Math.PI / 4) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 4;
}

export function useIsoCamera(c: CamController, width: number, height: number, span: number): void {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    // fit the iso footprint of the whole map: its diagonal projects to ~0.71·span wide, ~0.41·span tall
    const base = clamp(Math.min(width / (span * 0.6), (height - 110) / (span * 0.36)), 0.8, 9);
    const first = c.zoom === 0;
    c.zoomT = first ? base : c.zoomT * (base / c.base);
    c.base = base;
    if (first) c.zoom = base;
  }, [c, width, height, span]);

  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; sx: number; sy: number } | null = null;
    const pinch = new Map<number, { x: number; y: number }>();
    let pinchD = 0;

    const down = (e: PointerEvent) => {
      pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        drag = null;
        return;
      }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
      c.moved = false;
    };
    const move = (e: PointerEvent) => {
      if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomBy(c, d / pinchD);
        pinchD = d;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) c.moved = true;
      if (!c.moved) return;
      el.style.cursor = 'grabbing';
      const upp = 1 / c.zoom;
      const k = (dy * upp) / Math.sin(EL);
      const nx = c.targetT.x - Math.cos(c.az) * dx * upp - Math.sin(c.az) * k;
      const nz = c.targetT.z + Math.sin(c.az) * dx * upp - Math.cos(c.az) * k;
      c.targetT.set(clamp(nx, c.bounds.minX, c.bounds.maxX), 0, clamp(nz, c.bounds.minZ, c.bounds.maxZ));
      c.target.copy(c.targetT);
    };
    const up = (e: PointerEvent) => {
      pinch.delete(e.pointerId);
      drag = null;
      el.style.cursor = '';
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(c, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [c, gl]);

  useFrame((_, dt) => {
    const k = ease(dt, 5);
    c.target.lerp(c.targetT, k);
    c.zoom += (c.zoomT - c.zoom) * k;
    c.az += (c.azT - c.az) * k;
    const t = c.target;
    camera.position.set(t.x + R * Math.cos(EL) * Math.sin(c.az), R * Math.sin(EL), t.z + R * Math.cos(EL) * Math.cos(c.az));
    camera.lookAt(t);
    if (camera instanceof THREE.OrthographicCamera && Math.abs(camera.zoom - c.zoom) > 1e-4) {
      camera.zoom = c.zoom;
      camera.updateProjectionMatrix();
    }
  });
}
