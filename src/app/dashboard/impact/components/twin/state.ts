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
  segments: Array<Segment & { at: number }>;
}

export type TracePlans = Record<ViewMode, TracePlan>;

export interface TwinState {
  mode: ViewMode;
  trace: { playing: boolean; active: boolean; t: number };
  plan: TracePlan;
  held: Set<string>;
  truckPos: Map<string, { x: number; z: number; yaw: number }>;
  palette: Palette;
  view: { zoomRatio: number; zoom: number };
  hovered: string | null;
  labels: Map<string, LabelSlot>;
}

export interface LabelSlot {
  x: number;
  y: number;
  z: number;
  aspect: number;
  priority: number;
  want: boolean;
  allowed: boolean;
}

export type Selection = { kind: 'node' | 'truck'; id: string } | null;

const HOP = 0.9;
const STAGGER = 0.09;

function buildPlan(data: NetworkMap, layout: CityLayout, mode: ViewMode): TracePlan {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const hit = (n: MapNode) => {
    const t = toneFor(n, mode);
    return t === 'affected' || t === 'uncertain';
  };
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
    // big networks reveal a tier within ~2.5s instead of one node at a time
    const stagger = Math.min(STAGGER, 2.5 / tier.length);
    tier.forEach((n, k) => {
      revealAt.set(n.id, t + k * stagger);
      order.push(n.id);
    });
    t += HOP + tier.length * stagger;
  }

  const segments: Array<Segment & { at: number }> = [];
  const seen = new Set<string>();
  const segKey = (s: Segment) => `${s.x1.toFixed(1)},${s.z1.toFixed(1)},${s.x2.toFixed(1)},${s.z2.toFixed(1)}`;
  for (const e of data.edges) {
    if (!byId.has(e.from) || !byId.has(e.to) || !revealAt.has(e.from) || !revealAt.has(e.to)) continue;
    const route = routeBetween(layout, e.from, e.to);
    if (!route) continue;
    for (const s of centerSegments(layout, route)) {
      const k = segKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      segments.push({ ...s, at: revealAt.get(e.to) ?? 0 });
    }
  }
  segments.sort((a, b) => a.at - b.at);
  return { revealAt, order, levels, duration: t, segments };
}

export function buildTracePlans(data: NetworkMap, layout: CityLayout): TracePlans {
  return { logis: buildPlan(data, layout, 'logis'), naive: buildPlan(data, layout, 'naive') };
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
