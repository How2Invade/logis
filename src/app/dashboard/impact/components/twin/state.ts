import * as THREE from 'three';
import type { MapNode, NetworkMap, ViewMode } from '@/lib/types/network';
import { routeBetween, centerSegments, type CityLayout, type Segment } from './cityLayout';
import { toneFor, type Palette, type Tone } from './palette';

export interface TraceLevel { time: number; x: number; z: number }

export interface TracePlan {
  revealAt: Map<string, number>;
  order: string[];
  levels: TraceLevel[];
  duration: number;
  logisSegments: Array<Segment & { at: number }>;
  naiveSegments: Segment[];
}

export interface TwinState {
  mode: ViewMode;
  trace: { playing: boolean; active: boolean; t: number };
  plan: TracePlan;
  held: Set<string>;
  truckPos: Map<string, { x: number; z: number; yaw: number }>;
  palette: Palette;
  view: { zoomRatio: number };
  hovered: string | null;
}

export type Selection = { kind: 'node' | 'truck'; id: string } | null;

const HOP = 0.9;
const STAGGER = 0.09;

export function buildTracePlan(data: NetworkMap, layout: CityLayout): TracePlan {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const hit = (n: MapNode) => toneFor(n, 'logis') === 'affected' || toneFor(n, 'logis') === 'uncertain';
  const tiers: MapNode[][] = [
    data.nodes.filter((n) => n.isSource),
    data.nodes.filter((n) => n.kind === 'plant'),
    data.nodes.filter((n) => n.kind === 'warehouse' && hit(n)),
    data.nodes.filter((n) => n.kind === 'store' && hit(n)),
  ];
  const revealAt = new Map<string, number>();
  const order: string[] = [];
  const levels: TraceLevel[] = [];
  let t = 0;
  for (const tier of tiers) {
    if (tier.length === 0) continue;
    const pts = tier.map((n) => layout.placements.get(n.id)).filter((p): p is NonNullable<typeof p> => !!p);
    if (pts.length) {
      levels.push({ time: t, x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length });
    }
    tier.forEach((n, k) => {
      revealAt.set(n.id, t + k * STAGGER);
      order.push(n.id);
    });
    t += HOP + tier.length * STAGGER;
  }

  const logisSegments: Array<Segment & { at: number }> = [];
  const naiveSegments: Segment[] = [];
  const seenL = new Set<string>();
  const seenN = new Set<string>();
  const segKey = (s: Segment) => `${s.x1.toFixed(1)},${s.z1.toFixed(1)},${s.x2.toFixed(1)},${s.z2.toFixed(1)}`;
  for (const e of data.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) continue;
    const route = routeBetween(layout, e.from, e.to);
    if (!route) continue;
    const segs = centerSegments(route.tiles, route.start, route.end);
    const inLogis = revealAt.has(e.from) && revealAt.has(e.to);
    const inNaive = (from.isSource || from.kind !== 'supplier') && (to.kind === 'plant' || to.units.naiveRecall > 0);
    for (const s of segs) {
      const k = segKey(s);
      if (inLogis && !seenL.has(k)) {
        seenL.add(k);
        logisSegments.push({ ...s, at: revealAt.get(e.to) ?? 0 });
      }
      if (inNaive && !seenN.has(k)) {
        seenN.add(k);
        naiveSegments.push(s);
      }
    }
  }
  logisSegments.sort((a, b) => a.at - b.at);
  return { revealAt, order, levels, duration: t, logisSegments, naiveSegments };
}

export function displayTone(state: TwinState, node: MapNode): Tone | 'neutral' {
  if (state.trace.active) {
    const at = state.plan.revealAt.get(node.id);
    if (at === undefined || state.trace.t < at) return 'neutral';
  }
  return toneFor(node, state.mode);
}

const _c = new THREE.Color();
export function toneColor(state: TwinState, tone: Tone | 'neutral'): THREE.Color {
  return _c.set(tone === 'neutral' ? state.palette.neutral : state.palette.tone[tone]);
}

export const ease = (dt: number, rate = 6) => 1 - Math.exp(-dt * rate);
