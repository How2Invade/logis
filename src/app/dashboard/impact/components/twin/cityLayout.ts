import type { MapNode, NodeKind, NetworkMap } from '@/lib/types/network';

export const TS = 8;
export const GI = 25;
export const GJ = 16;
export const LANE = 1.5;

type Tile = [number, number];
type Pt = [number, number];
const DIRS: Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const isRoad = (i: number, j: number) => i % 3 === 0 || j % 3 === 0;
const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < GI && j < GJ;
export const tileX = (i: number) => (i - (GI - 1) / 2) * TS;
export const tileZ = (j: number) => (j - (GJ - 1) / 2) * TS;

export interface Placement {
  id: string;
  kind: NodeKind;
  x: number;
  z: number;
  rot: number;
  door: Pt;
  entry: Tile;
  size: [number, number, number];
}

export interface RoadTile { i: number; j: number; kind: 'x' | 'h' | 'v' }
export interface House { x: number; z: number; rot: number; w: number; h: number; d: number; roof: number }
export interface Segment { x1: number; z1: number; x2: number; z2: number }

export interface CityLayout {
  placements: Map<string, Placement>;
  roads: RoadTile[];
  blocks: Pt[];
  fields: Pt[];
  crops: Pt[];
  houses: House[];
  trees: Array<{ x: number; z: number; s: number }>;
  lamps: Pt[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const blockTiles = (bi: number, bj: number): Tile[] => [
  [3 * bi + 1, 3 * bj + 1], [3 * bi + 2, 3 * bj + 1], [3 * bi + 1, 3 * bj + 2], [3 * bi + 2, 3 * bj + 2],
];

const SIZES: Record<NodeKind, [number, number, number]> = {
  supplier: [10, 6, 9],
  plant: [15, 7, 11],
  warehouse: [13, 6, 10],
  store: [5.4, 4, 5.4],
};

const WAREHOUSE_BLOCKS: Tile[] = [[3, 2], [4, 1], [4, 3], [3, 0], [3, 4], [4, 0], [4, 4], [2, 0], [2, 4]];

export function buildLayout(data: NetworkMap): CityLayout {
  const rand = seeded(hashStr(data.nodes.map((n) => n.id).join('|')));
  const placements = new Map<string, Placement>();
  const usedBlocks = new Set<string>();
  const usedTiles = new Set<string>();

  const placeBlock = (n: MapNode, bi: number, bj: number) => {
    usedBlocks.add(`${bi},${bj}`);
    blockTiles(bi, bj).forEach(([i, j]) => usedTiles.add(`${i},${j}`));
    const x = (tileX(3 * bi + 1) + tileX(3 * bi + 2)) / 2;
    const z = (tileZ(3 * bj + 1) + tileZ(3 * bj + 2)) / 2;
    const size = SIZES[n.kind];
    placements.set(n.id, { id: n.id, kind: n.kind, x, z, rot: 0, size, entry: [3 * bi + 1, 3 * bj + 3], door: [x, z + size[2] / 2 + 1.2] });
  };

  const suppliers = data.nodes.filter((n) => n.kind === 'supplier');
  suppliers.forEach((n, k) => placeBlock(n, Math.floor(k / 5) * 1, k % 5));

  const plant = data.nodes.find((n) => n.kind === 'plant');
  if (plant) placeBlock(plant, 2, 2);

  const warehouses = data.nodes.filter((n) => n.kind === 'warehouse');
  warehouses.forEach((n, k) => {
    const free = WAREHOUSE_BLOCKS.filter(([bi, bj]) => !usedBlocks.has(`${bi},${bj}`));
    const b = free[0] ?? WAREHOUSE_BLOCKS[k % WAREHOUSE_BLOCKS.length];
    placeBlock(n, b[0], b[1]);
  });

  const storeTiles: Tile[] = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let bj = 0; bj < 5; bj++) {
      for (let bi = 5; bi < 8; bi++) {
        blockTiles(bi, bj).forEach(([i, j]) => {
          if ((i + j) % 2 === pass) storeTiles.push([i, j]);
        });
      }
    }
  }
  const stores = data.nodes.filter((n) => n.kind === 'store');
  stores.forEach((n, k) => {
    const t = storeTiles[k];
    if (!t) return;
    const [i, j] = t;
    usedTiles.add(`${i},${j}`);
    const face = DIRS.findIndex(([di, dj]) => inGrid(i + di, j + dj) && isRoad(i + di, j + dj));
    const [di, dj] = DIRS[face < 0 ? 2 : face];
    const x = tileX(i);
    const z = tileZ(j);
    const size = SIZES.store;
    placements.set(n.id, {
      id: n.id, kind: 'store', x, z, rot: Math.atan2(di, dj), size,
      entry: [i + di, j + dj],
      door: [x + di * (size[2] / 2 + 1), z + dj * (size[2] / 2 + 1)],
    });
  });

  const roads: RoadTile[] = [];
  const blocks: Pt[] = [];
  const lamps: Pt[] = [];
  for (let i = 0; i < GI; i++) {
    for (let j = 0; j < GJ; j++) {
      if (!isRoad(i, j)) continue;
      const kind = i % 3 === 0 && j % 3 === 0 ? 'x' : j % 3 === 0 ? 'h' : 'v';
      roads.push({ i, j, kind });
      if (kind === 'x' && (i + j) % 2 === 0) lamps.push([tileX(i) + TS / 2 - 0.7, tileZ(j) + TS / 2 - 0.7]);
    }
  }

  const fields: Pt[] = [];
  const crops: Pt[] = [];
  const houses: House[] = [];
  const trees: Array<{ x: number; z: number; s: number }> = [];
  for (let bi = 0; bi < 8; bi++) {
    for (let bj = 0; bj < 5; bj++) {
      const cx = (tileX(3 * bi + 1) + tileX(3 * bi + 2)) / 2;
      const cz = (tileZ(3 * bj + 1) + tileZ(3 * bj + 2)) / 2;
      blocks.push([cx, cz]);
      if (usedBlocks.has(`${bi},${bj}`)) {
        for (let k = 0; k < 3; k++) trees.push({ x: cx - TS + 0.8 + rand() * 1.2, z: cz - TS + 1 + k * 3.2, s: 0.8 + rand() * 0.3 });
        continue;
      }
      if (bi === 1) {
        fields.push([cx, cz]);
        for (let r = 0; r < 7; r++) crops.push([cx, cz - TS + 2 + r * 2.1]);
        continue;
      }
      blockTiles(bi, bj).forEach(([i, j]) => {
        if (usedTiles.has(`${i},${j}`)) return;
        const x = tileX(i);
        const z = tileZ(j);
        if (rand() < 0.22) {
          for (let k = 0; k < 4; k++) trees.push({ x: x + (rand() - 0.5) * 5.5, z: z + (rand() - 0.5) * 5.5, s: 0.7 + rand() * 0.5 });
          return;
        }
        const face = DIRS.findIndex(([di, dj]) => inGrid(i + di, j + dj) && isRoad(i + di, j + dj));
        const [di, dj] = DIRS[face < 0 ? 2 : face];
        houses.push({ x, z, rot: Math.atan2(di, dj), w: 3.4 + rand() * 1.4, h: 2 + rand() * 1.6, d: 3.4 + rand() * 1.2, roof: Math.floor(rand() * 5) });
        trees.push({ x: x - di * 2.6 + dj * 2.4, z: z - dj * 2.6 + di * 2.4, s: 0.6 + rand() * 0.4 });
      });
      const occupied = blockTiles(bi, bj).filter(([i, j]) => usedTiles.has(`${i},${j}`)).length;
      if (occupied > 0 && occupied < 4) trees.push({ x: cx + (rand() - 0.5) * 2, z: cz + (rand() - 0.5) * 2, s: 0.7 });
    }
  }

  const half = TS / 2;
  return {
    placements, roads, blocks, fields, crops, houses, trees, lamps,
    bounds: { minX: tileX(0) - half, maxX: tileX(GI - 1) + half, minZ: tileZ(0) - half, maxZ: tileZ(GJ - 1) + half },
  };
}

export function bfs(a: Tile, b: Tile): Tile[] | null {
  const key = (t: Tile) => `${t[0]},${t[1]}`;
  const prev = new Map<string, Tile | null>([[key(a), null]]);
  const queue: Tile[] = [a];
  while (queue.length) {
    const cur = queue.shift() as Tile;
    if (cur[0] === b[0] && cur[1] === b[1]) {
      const path: Tile[] = [];
      let p: Tile | null = cur;
      while (p) {
        path.unshift(p);
        p = prev.get(key(p)) ?? null;
      }
      return path;
    }
    for (const [di, dj] of DIRS) {
      const n: Tile = [cur[0] + di, cur[1] + dj];
      if (!inGrid(n[0], n[1]) || !isRoad(n[0], n[1]) || prev.has(key(n))) continue;
      prev.set(key(n), cur);
      queue.push(n);
    }
  }
  return null;
}

const rightOf = (dx: number, dz: number): Pt => [-dz, dx];

export function lanePolyline(tiles: Tile[], start: Pt, end: Pt): Pt[] {
  const pts: Pt[] = [start];
  for (let k = 0; k < tiles.length; k++) {
    const [i, j] = tiles[k];
    const cx = tileX(i);
    const cz = tileZ(j);
    const din = k > 0 ? [Math.sign(i - tiles[k - 1][0]), Math.sign(j - tiles[k - 1][1])] : null;
    const dout = k < tiles.length - 1 ? [Math.sign(tiles[k + 1][0] - i), Math.sign(tiles[k + 1][1] - j)] : null;
    const a = din ?? dout;
    const b = dout ?? din;
    if (!a || !b) {
      pts.push([cx, cz]);
      continue;
    }
    const ra = rightOf(a[0], a[1]);
    const rb = rightOf(b[0], b[1]);
    const same = a[0] === b[0] && a[1] === b[1];
    pts.push(same ? [cx + ra[0] * LANE, cz + ra[1] * LANE] : [cx + (ra[0] + rb[0]) * LANE, cz + (ra[1] + rb[1]) * LANE]);
  }
  pts.push(end);
  return pts;
}

export function centerSegments(tiles: Tile[], start: Pt, end: Pt): Segment[] {
  const pts: Pt[] = [start, ...tiles.map(([i, j]) => [tileX(i), tileZ(j)] as Pt), end];
  const segs: Segment[] = [];
  for (let k = 1; k < pts.length; k++) {
    segs.push({ x1: pts[k - 1][0], z1: pts[k - 1][1], x2: pts[k][0], z2: pts[k][1] });
  }
  return segs;
}

export function routeBetween(layout: CityLayout, from: string, to: string): { tiles: Tile[]; start: Pt; end: Pt } | null {
  const a = layout.placements.get(from);
  const b = layout.placements.get(to);
  if (!a || !b) return null;
  const tiles = bfs(a.entry, b.entry);
  if (!tiles) return null;
  return { tiles, start: a.door, end: b.door };
}
