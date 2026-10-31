import type { MapNode, NodeKind, NetworkMap } from '@/lib/types/network';

export const TS = 8;
export const LANE = 1.5;

type Tile = [number, number];
type Pt = [number, number];
const DIRS: Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const isRoad = (i: number, j: number) => i % 3 === 0 || j % 3 === 0;

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

export interface RoadTile { i: number; j: number; x: number; z: number; kind: 'x' | 'h' | 'v' }
export interface House { x: number; z: number; rot: number; w: number; h: number; d: number; roof: number }
export interface Segment { x1: number; z1: number; x2: number; z2: number }
export interface Route { tiles: Tile[]; start: Pt; end: Pt }

export interface CityLayout {
  gi: number;
  gj: number;
  placements: Map<string, Placement>;
  roads: RoadTile[];
  blocks: Pt[];
  fields: Pt[];
  crops: Pt[];
  houses: House[];
  trees: Array<{ x: number; z: number; s: number }>;
  lamps: Pt[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  routes: Map<string, Route | null>;
}

export const tileX = (L: { gi: number }, i: number) => (i - (L.gi - 1) / 2) * TS;
export const tileZ = (L: { gj: number }, j: number) => (j - (L.gj - 1) / 2) * TS;

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

export function buildLayout(data: NetworkMap): CityLayout {
  const rand = seeded(hashStr(data.nodes.map((n) => n.id).join('|')));
  const suppliers = data.nodes.filter((n) => n.kind === 'supplier');
  const plants = data.nodes.filter((n) => n.kind === 'plant');
  const warehouses = data.nodes.filter((n) => n.kind === 'warehouse');
  const stores = data.nodes.filter((n) => n.kind === 'store');

  // grid sized from the data: rows grow with warehouses/stores, columns with suppliers/stores
  const rowsB = Math.max(5, Math.ceil(warehouses.length / 2), Math.ceil(Math.sqrt(stores.length / 8)));
  const supCols = Math.max(1, Math.ceil(suppliers.length / rowsB));
  const fieldCol = supCols;
  const plantCol = supCols + 1;
  const whCol = supCols + 2;
  const storeCols = Math.max(3, Math.ceil(stores.length / (4 * rowsB)) + 1);
  const storeCol = whCol + 2;
  const colsB = storeCol + storeCols;
  const L = { gi: 3 * colsB + 1, gj: 3 * rowsB + 1 };
  const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < L.gi && j < L.gj;

  const placements = new Map<string, Placement>();
  const usedBlocks = new Set<string>();
  const usedTiles = new Set<string>();

  const placeBlock = (n: MapNode, bi: number, bj: number) => {
    usedBlocks.add(`${bi},${bj}`);
    blockTiles(bi, bj).forEach(([i, j]) => usedTiles.add(`${i},${j}`));
    const x = (tileX(L, 3 * bi + 1) + tileX(L, 3 * bi + 2)) / 2;
    const z = (tileZ(L, 3 * bj + 1) + tileZ(L, 3 * bj + 2)) / 2;
    const size = SIZES[n.kind];
    placements.set(n.id, { id: n.id, kind: n.kind, x, z, rot: 0, size, entry: [3 * bi + 1, 3 * bj + 3], door: [x, z + size[2] / 2 + 1.2] });
  };

  suppliers.forEach((n, k) => placeBlock(n, Math.floor(k / rowsB), k % rowsB));
  const mid = Math.floor(rowsB / 2);
  plants.forEach((n, k) => placeBlock(n, plantCol, (mid + k) % rowsB));

  // warehouses zig-zag across two columns, spread over the rows
  const whRow = new Map<string, number>();
  const step = warehouses.length > 0 ? rowsB / warehouses.length : 1;
  warehouses.forEach((n, k) => {
    let bj = Math.min(rowsB - 1, Math.floor(k * step + step / 2));
    let bi = whCol + (k % 2);
    while (usedBlocks.has(`${bi},${bj}`)) {
      bi = bi === whCol ? whCol + 1 : whCol;
      if (usedBlocks.has(`${bi},${bj}`)) bj = (bj + 1) % rowsB;
    }
    whRow.set(n.id, bj);
    placeBlock(n, bi, bj);
  });

  // stores sit near the row of the warehouse that supplies them, so routes stay short
  const supplier = new Map<string, string>();
  for (const e of data.edges) if (whRow.has(e.from) && !supplier.has(e.to)) supplier.set(e.to, e.from);
  const storeRow = (n: MapNode) => {
    const w = supplier.get(n.id);
    return w !== undefined ? whRow.get(w) ?? mid : mid;
  };
  const freeTiles: Tile[] = [];
  for (let bj = 0; bj < rowsB; bj++) {
    for (let bi = storeCol; bi < colsB; bi++) blockTiles(bi, bj).forEach((t) => freeTiles.push(t));
  }
  const takenStore = new Set<string>();
  const sortedStores = [...stores].sort((a, b) => storeRow(a) - storeRow(b) || a.id.localeCompare(b.id));
  for (const n of sortedStores) {
    const targetJ = 3 * storeRow(n) + 1.5;
    let best: Tile | null = null;
    let bestScore = Infinity;
    for (const t of freeTiles) {
      const key = `${t[0]},${t[1]}`;
      if (takenStore.has(key)) continue;
      const score = Math.abs(t[1] - targetJ) * 3 + (t[0] - 3 * storeCol) * 0.6 + ((t[0] + t[1]) % 2) * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (!best) break;
    const [i, j] = best;
    takenStore.add(`${i},${j}`);
    usedTiles.add(`${i},${j}`);
    const face = DIRS.findIndex(([di, dj]) => inGrid(i + di, j + dj) && isRoad(i + di, j + dj));
    const [di, dj] = DIRS[face < 0 ? 2 : face];
    const x = tileX(L, i);
    const z = tileZ(L, j);
    const size = SIZES.store;
    placements.set(n.id, {
      id: n.id, kind: 'store', x, z, rot: Math.atan2(di, dj), size,
      entry: [i + di, j + dj],
      door: [x + di * (size[2] / 2 + 1), z + dj * (size[2] / 2 + 1)],
    });
  }

  const roads: RoadTile[] = [];
  const lamps: Pt[] = [];
  for (let i = 0; i < L.gi; i++) {
    for (let j = 0; j < L.gj; j++) {
      if (!isRoad(i, j)) continue;
      const kind = i % 3 === 0 && j % 3 === 0 ? 'x' : j % 3 === 0 ? 'h' : 'v';
      roads.push({ i, j, x: tileX(L, i), z: tileZ(L, j), kind });
      if (kind === 'x' && (i + j) % 2 === 0) lamps.push([tileX(L, i) + TS / 2 - 0.7, tileZ(L, j) + TS / 2 - 0.7]);
    }
  }

  const blocks: Pt[] = [];
  const fields: Pt[] = [];
  const crops: Pt[] = [];
  const houses: House[] = [];
  const trees: Array<{ x: number; z: number; s: number }> = [];
  for (let bi = 0; bi < colsB; bi++) {
    for (let bj = 0; bj < rowsB; bj++) {
      const cx = (tileX(L, 3 * bi + 1) + tileX(L, 3 * bi + 2)) / 2;
      const cz = (tileZ(L, 3 * bj + 1) + tileZ(L, 3 * bj + 2)) / 2;
      blocks.push([cx, cz]);
      if (usedBlocks.has(`${bi},${bj}`)) {
        for (let k = 0; k < 3; k++) trees.push({ x: cx - TS + 0.8 + rand() * 1.2, z: cz - TS + 1 + k * 3.2, s: 0.8 + rand() * 0.3 });
        continue;
      }
      if (bi === fieldCol || bi < supCols) {
        fields.push([cx, cz]);
        for (let r = 0; r < 7; r++) crops.push([cx, cz - TS + 2 + r * 2.1]);
        continue;
      }
      blockTiles(bi, bj).forEach(([i, j]) => {
        if (usedTiles.has(`${i},${j}`)) return;
        const x = tileX(L, i);
        const z = tileZ(L, j);
        if (rand() < 0.22) {
          for (let k = 0; k < 4; k++) trees.push({ x: x + (rand() - 0.5) * 5.5, z: z + (rand() - 0.5) * 5.5, s: 0.7 + rand() * 0.5 });
          return;
        }
        const face = DIRS.findIndex(([di, dj]) => inGrid(i + di, j + dj) && isRoad(i + di, j + dj));
        const [di, dj] = DIRS[face < 0 ? 2 : face];
        houses.push({ x, z, rot: Math.atan2(di, dj), w: 3.4 + rand() * 1.4, h: 2 + rand() * 1.6, d: 3.4 + rand() * 1.2, roof: Math.floor(rand() * 5) });
        trees.push({ x: x - di * 2.6 + dj * 2.4, z: z - dj * 2.6 + di * 2.4, s: 0.6 + rand() * 0.4 });
      });
    }
  }

  const half = TS / 2;
  return {
    ...L,
    placements, roads, blocks, fields, crops, houses, trees, lamps,
    bounds: { minX: tileX(L, 0) - half, maxX: tileX(L, L.gi - 1) + half, minZ: tileZ(L, 0) - half, maxZ: tileZ(L, L.gj - 1) + half },
    routes: new Map(),
  };
}

function bfs(L: CityLayout, a: Tile, b: Tile): Tile[] | null {
  const key = (t: Tile) => t[0] * 4096 + t[1];
  const prev = new Map<number, Tile | null>([[key(a), null]]);
  const queue: Tile[] = [a];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
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
      if (n[0] < 0 || n[1] < 0 || n[0] >= L.gi || n[1] >= L.gj || !isRoad(n[0], n[1]) || prev.has(key(n))) continue;
      prev.set(key(n), cur);
      queue.push(n);
    }
  }
  return null;
}

const rightOf = (dx: number, dz: number): Pt => [-dz, dx];

export function lanePolyline(L: CityLayout, tiles: Tile[], start: Pt, end: Pt): Pt[] {
  const pts: Pt[] = [start];
  for (let k = 0; k < tiles.length; k++) {
    const [i, j] = tiles[k];
    const cx = tileX(L, i);
    const cz = tileZ(L, j);
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

export function centerSegments(L: CityLayout, route: Route): Segment[] {
  const pts: Pt[] = [route.start, ...route.tiles.map(([i, j]) => [tileX(L, i), tileZ(L, j)] as Pt), route.end];
  const segs: Segment[] = [];
  for (let k = 1; k < pts.length; k++) segs.push({ x1: pts[k - 1][0], z1: pts[k - 1][1], x2: pts[k][0], z2: pts[k][1] });
  return segs;
}

export function routeBetween(L: CityLayout, from: string, to: string): Route | null {
  const key = `${from}>${to}`;
  const hit = L.routes.get(key);
  if (hit !== undefined) return hit;
  const a = L.placements.get(from);
  const b = L.placements.get(to);
  const tiles = a && b ? bfs(L, a.entry, b.entry) : null;
  const route = a && b && tiles ? { tiles, start: a.door, end: b.door } : null;
  L.routes.set(key, route);
  return route;
}
