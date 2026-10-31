import type { ImpactTone, MapNode } from '@/lib/types/network';

// Site coordinates are metres. The building's front wall sits on z = -2, docks face +z, the road runs along z ≈ 19.
export const WALL_Z = -2;
export const BUILDING = { x0: -14, x1: 14, z0: -16, z1: WALL_Z, h: 6 };
export const DOOR_X = [-10.5, -3.5, 3.5, 10.5];
export const DOOR_W = 4.2;
export const DOOR_H = 4.4;
export const DOCKED_Z = 2.7;
export const ROAD_Z = 19;
export const LANE_Z = 2;

export type Zone = 'rack' | 'quarantine' | 'overflow';

export interface Slot {
  x: number;
  y: number;
  z: number;
  /** where a forklift stops to reach this slot, and the heading it faces */
  ax: number;
  az: number;
  yaw: number;
  zone: Zone;
}

export interface PalletInfo {
  id: string;
  product: string;
  batch: string;
  units: number;
  status: ImpactTone;
  style: number;
}

const LEVELS = [0.18, 1.58, 2.98];
const RACK_BAYS = [-15.8, -13.4, -11, -8.6, -6.2, -3.8];
export const RACK_X = [-27.6, -20.4];
export const AISLE_X = -24;
/** distance from a forklift's centre to the pallet on its forks */
export const FORK_REACH = 1.45;

function rackSlots(): Slot[] {
  const out: Slot[] = [];
  RACK_X.forEach((rx, r) => {
    const side = r === 0 ? 1 : -1;
    for (const bz of RACK_BAYS) {
      for (const y of LEVELS) out.push({ x: rx, y, z: bz, ax: rx + side * FORK_REACH, az: bz, yaw: r === 0 ? -Math.PI / 2 : Math.PI / 2, zone: 'rack' });
    }
  });
  return out;
}

export const QUAR_X = [-28.4, -25.95, -23.5, -21.05, -18.6];
export const QUAR_Z = [10.6, 7.6, 4.6];
export const QUAR_BOUNDS = { x0: -30, x1: -17, z0: 3.2, z1: 12 };
export const OVER_BOUNDS = { x0: -30, x1: -17, z0: 12.5, z1: 14.7 };

export function quarantineSlots(): Slot[] {
  // far rows first, both levels, so forklifts never drive through a filled row
  const out: Slot[] = [];
  for (const z of QUAR_Z) for (const y of [0.18, 1.22]) for (const x of QUAR_X) out.push({ x, y, z, ax: x, az: z - FORK_REACH, yaw: 0, zone: 'quarantine' });
  return out;
}

export const OVER_Z = 13.6;
export function overflowSlots(): Slot[] {
  const out: Slot[] = [];
  for (const y of [0.18, 1.22, 2.26]) for (const x of QUAR_X) out.push({ x, y, z: OVER_Z, ax: x, az: OVER_Z + FORK_REACH, yaw: Math.PI, zone: 'overflow' });
  return out;
}

export const STOCK_SLOTS: Slot[] = rackSlots();
export const MAX_PALLETS = STOCK_SLOTS.length;

export const CHARGERS: Array<{ x: number; z: number }> = [18.6, 21.4, 24.2, 27].map((x) => ({ x, z: 5.4 }));
export const PARK_Z = 7.3;
export const JUNCTION_X = -16;
export const CROSS_Z = 11.5;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const tone = (s: string): ImpactTone => (s === 'affected' ? 'affected' : s === 'uncertain' ? 'uncertain' : 'safe');

/** Turn a warehouse's real stock lines into ≤ MAX_PALLETS pallets, keeping proportions and at least one pallet per flagged line. */
export function allocatePallets(node: MapNode): { pallets: PalletInfo[]; unitsPerPallet: number } {
  const lines = node.stock.filter((l) => l.units > 0);
  const total = lines.reduce((s, l) => s + l.units, 0);
  if (total === 0) return { pallets: [], unitsPerPallet: 0 };
  const target = Math.min(MAX_PALLETS, Math.max(8, Math.min(MAX_PALLETS, lines.length * 3)));
  const exact = lines.map((l) => (l.units / total) * target);
  const counts = exact.map((e, i) => Math.max(tone(lines[i].status) !== 'safe' ? 1 : 0, Math.floor(e)));
  let sum = counts.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (sum >= target) break;
    counts[i]++;
    sum++;
  }
  while (sum > MAX_PALLETS) {
    let k = -1;
    for (let i = 0; i < counts.length; i++) {
      const min = tone(lines[i].status) !== 'safe' ? 1 : 0;
      if (counts[i] > min && (k < 0 || counts[i] > counts[k])) k = i;
    }
    if (k < 0) break;
    counts[k]--;
    sum--;
  }

  const pallets: PalletInfo[] = [];
  lines.forEach((l, i) => {
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      pallets.push({
        id: `PAL-${String(pallets.length + 1).padStart(3, '0')}`,
        product: l.product,
        batch: l.batch,
        units: Math.round(l.units / n),
        status: tone(l.status),
        style: hash(l.product) % 3,
      });
    }
  });
  // interleave so contaminated pallets sit among clean stock rather than in one block, like a real rack
  const keyed = pallets.map((p, i) => ({ p, k: hash(`${node.id}|${p.batch}|${i}`) }));
  keyed.sort((a, b) => a.k - b.k);
  return { pallets: keyed.map((x) => x.p), unitsPerPallet: Math.round(total / Math.max(1, sum)) };
}
