import type { ImpactTone, MapShipment, ViewMode } from '@/lib/types/network';
import {
  CHARGERS, CROSS_Z, DOCKED_Z, DOOR_X, FORK_REACH, JUNCTION_X, LANE_Z, PARK_Z, ROAD_Z, STOCK_SLOTS,
  overflowSlots, quarantineSlots, type PalletInfo, type Slot,
} from './siteLayout';

export type PalletState = 'stored' | 'claimed' | 'carried' | 'moved';

export interface SimPallet {
  info: PalletInfo;
  slot: Slot;
  x: number;
  y: number;
  z: number;
  yaw: number;
  state: PalletState;
}

type Step =
  | { t: 'move'; x: number; z: number }
  | { t: 'face'; yaw: number }
  | { t: 'lift'; h: number }
  | { t: 'pick'; p: number }
  | { t: 'drop'; p: number; slot: Slot };

export interface SimForklift {
  id: string;
  operator: string;
  x: number;
  z: number;
  yaw: number;
  lift: number;
  carrying: number;
  steps: Step[];
  task: string;
  battery: number;
  moves: number;
  speed: number;
  home: { x: number; z: number };
  charger: string;
}

type TruckPhase = 'docked' | 'leave' | 'approach' | 'toQueue' | 'queue';

export interface SimTruck {
  ship: MapShipment;
  bay: number;
  phase: TruckPhase;
  path: Array<{ x: number; z: number; rev: boolean }>;
  seg: number;
  x: number;
  z: number;
  yaw: number;
  timer: number;
  held: boolean;
  livery: number;
}

export interface SiteSim {
  mode: ViewMode;
  running: boolean;
  done: boolean;
  elapsed: number;
  pallets: SimPallet[];
  forklifts: SimForklift[];
  trucks: SimTruck[];
  free: Slot[];
  flagged: number;
  moved: number;
  overflow: number;
  unitsPulled: number;
}

const OPERATORS = ['Priya Nair', 'Arjun Mehta', 'Kavya Rao', 'Rohit Singh'];
const FL_SPEED = 8.5;
const TURN = 5;
const LIFT_SPEED = 1.8;
const TRUCK_SPEED = 9;
const REVERSE_SPEED = 3.6;
const QUEUE_X = (k: number) => 31 + k * 11;
const TRUCK_LANE = ROAD_Z - 1.5;

export const flaggedIn = (status: ImpactTone, mode: ViewMode) => mode === 'naive' || status !== 'safe';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function lanePoints(fx: number, fz: number, tx: number, tz: number, zone: 'left' | 'over' | 'home'): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const fromRight = fx > JUNCTION_X - 0.5;
  if (fromRight) pts.push([fx, CROSS_Z], [JUNCTION_X, CROSS_Z], [JUNCTION_X, LANE_Z]);
  else if (fz > CROSS_Z) pts.push([JUNCTION_X, fz], [JUNCTION_X, LANE_Z]);
  else pts.push([fx, LANE_Z]);
  if (zone === 'left') pts.push([tx, LANE_Z], [tx, tz]);
  else if (zone === 'over') pts.push([JUNCTION_X, LANE_Z], [JUNCTION_X, tz], [tx, tz]);
  else pts.push([JUNCTION_X, LANE_Z], [JUNCTION_X, CROSS_Z], [tx, CROSS_Z], [tx, tz]);
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

const zoneOf = (s: Slot): 'left' | 'over' => (s.zone === 'overflow' ? 'over' : 'left');

function bayPathIn(bx: number, fromX: number): SimTruck['path'] {
  return [
    { x: fromX, z: TRUCK_LANE, rev: false },
    { x: bx + 13, z: TRUCK_LANE, rev: false },
    { x: bx + 6, z: 14.5, rev: false },
    { x: bx, z: 10.5, rev: false },
    { x: bx, z: DOCKED_Z, rev: true },
  ];
}

function bayPathOut(bx: number): SimTruck['path'] {
  return [
    { x: bx, z: DOCKED_Z, rev: false },
    { x: bx, z: 10.5, rev: false },
    { x: bx - 6, z: 15, rev: false },
    { x: bx - 13, z: TRUCK_LANE, rev: false },
    { x: -90, z: TRUCK_LANE, rev: false },
  ];
}

export function createSim(pallets: PalletInfo[], shipments: MapShipment[], mode: ViewMode): SiteSim {
  const simPallets: SimPallet[] = pallets.map((info, i) => {
    const slot = STOCK_SLOTS[i];
    return { info, slot, x: slot.x, y: slot.y, z: slot.z, yaw: 0, state: 'stored' };
  });
  const fleet = Math.min(CHARGERS.length, pallets.length > 24 ? 4 : 3);
  const forklifts: SimForklift[] = CHARGERS.slice(0, fleet).map((c, i) => ({
    id: `FL-${String(i + 1).padStart(2, '0')}`,
    operator: OPERATORS[i % OPERATORS.length],
    x: c.x,
    z: PARK_Z,
    yaw: Math.PI,
    lift: 0.05,
    carrying: -1,
    steps: [],
    task: 'Charging',
    battery: 72 + ((i * 9) % 25),
    moves: 0,
    speed: 0,
    home: { x: c.x, z: PARK_Z },
    charger: `C${i + 1}`,
  }));

  const ordered = [...shipments].sort((a, b) => (a.impact === 'safe' ? 1 : 0) - (b.impact === 'safe' ? 1 : 0)).slice(0, 6);
  const trucks: SimTruck[] = ordered.map((ship, i) => {
    const docked = i < DOOR_X.length;
    const x = docked ? DOOR_X[i] : QUEUE_X(i - DOOR_X.length);
    return {
      ship,
      bay: docked ? i : -1,
      phase: docked ? 'docked' : 'queue',
      path: [],
      seg: 0,
      x,
      z: docked ? DOCKED_Z : TRUCK_LANE,
      yaw: docked ? 0 : -Math.PI / 2,
      timer: docked ? 4 + i * 3.5 : 0,
      held: false,
      livery: i % 3,
    };
  });

  return {
    mode,
    running: false,
    done: false,
    elapsed: 0,
    pallets: simPallets,
    forklifts,
    trucks,
    free: [...quarantineSlots(), ...overflowSlots()],
    flagged: simPallets.filter((p) => flaggedIn(p.info.status, mode)).length,
    moved: 0,
    overflow: 0,
    unitsPulled: 0,
  };
}

function planJob(sim: SiteSim, f: SimForklift): boolean {
  let best = -1;
  let bestD = Infinity;
  sim.pallets.forEach((p, i) => {
    if (p.state !== 'stored' || !flaggedIn(p.info.status, sim.mode)) return;
    const d = Math.abs(p.slot.ax - f.x) + Math.abs(p.slot.az - f.z) + p.slot.y * 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const dest = sim.free[0];
  if (best < 0 || !dest) return false;
  sim.free.shift();
  const p = sim.pallets[best];
  p.state = 'claimed';
  const steps: Step[] = [];
  for (const [x, z] of lanePoints(f.x, f.z, p.slot.ax, p.slot.az, 'left')) steps.push({ t: 'move', x, z });
  steps.push({ t: 'face', yaw: p.slot.yaw }, { t: 'lift', h: p.slot.y }, { t: 'pick', p: best }, { t: 'lift', h: 0.35 });
  for (const [x, z] of lanePoints(p.slot.ax, p.slot.az, dest.ax, dest.az, zoneOf(dest))) steps.push({ t: 'move', x, z });
  steps.push({ t: 'face', yaw: dest.yaw }, { t: 'lift', h: dest.y }, { t: 'drop', p: best, slot: dest }, { t: 'lift', h: 0.05 });
  f.steps = steps;
  f.task = dest.zone === 'overflow' ? `Overflow ${p.info.id}` : `Quarantine ${p.info.id}`;
  return true;
}

function goHome(f: SimForklift) {
  const steps: Step[] = [];
  for (const [x, z] of lanePoints(f.x, f.z, f.home.x, f.home.z, 'home')) steps.push({ t: 'move', x, z });
  steps.push({ t: 'face', yaw: Math.PI }, { t: 'lift', h: 0.05 });
  f.steps = steps;
  f.task = 'Returning to charger';
}

function stepForklift(sim: SiteSim, f: SimForklift, dt: number) {
  const atHome = Math.hypot(f.x - f.home.x, f.z - f.home.z) < 0.1;
  if (f.steps.length === 0) {
    if (sim.running && planJob(sim, f)) {
      // job planned
    } else if (!atHome) {
      goHome(f);
    } else {
      f.task = 'Charging at bay';
      f.speed = 0;
      f.battery = Math.min(100, f.battery + dt * 1.5);
      return;
    }
  }
  const s = f.steps[0];
  f.speed = 0;
  if (s.t === 'move') {
    const dx = s.x - f.x;
    const dz = s.z - f.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      f.steps.shift();
      return;
    }
    const want = Math.atan2(dx, dz);
    const diff = wrap(want - f.yaw);
    f.yaw = wrap(f.yaw + Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt));
    if (Math.abs(diff) < 0.4) {
      const stepLen = Math.min(d, FL_SPEED * dt);
      f.x += (dx / d) * stepLen;
      f.z += (dz / d) * stepLen;
      f.speed = FL_SPEED;
      f.battery = Math.max(5, f.battery - dt * 0.35);
    }
  } else if (s.t === 'face') {
    const diff = wrap(s.yaw - f.yaw);
    if (Math.abs(diff) < 0.02) {
      f.yaw = s.yaw;
      f.steps.shift();
    } else f.yaw = wrap(f.yaw + Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt));
  } else if (s.t === 'lift') {
    const diff = s.h - f.lift;
    if (Math.abs(diff) < 0.01) {
      f.lift = s.h;
      f.steps.shift();
    } else f.lift += Math.sign(diff) * Math.min(Math.abs(diff), LIFT_SPEED * dt);
  } else if (s.t === 'pick') {
    sim.pallets[s.p].state = 'carried';
    f.carrying = s.p;
    f.steps.shift();
  } else if (s.t === 'drop') {
    const p = sim.pallets[s.p];
    p.state = 'moved';
    p.slot = s.slot;
    p.x = s.slot.x;
    p.y = s.slot.y;
    p.z = s.slot.z;
    p.yaw = 0;
    f.carrying = -1;
    f.moves++;
    sim.moved++;
    sim.unitsPulled += p.info.units;
    if (s.slot.zone === 'overflow') sim.overflow++;
    f.steps.shift();
  }
  if (f.carrying >= 0) {
    const p = sim.pallets[f.carrying];
    p.x = f.x + Math.sin(f.yaw) * FORK_REACH;
    p.z = f.z + Math.cos(f.yaw) * FORK_REACH;
    p.y = f.lift;
    p.yaw = f.yaw;
  }
}

function isHeld(sim: SiteSim, t: SimTruck, userHeld: Set<string>): boolean {
  if (userHeld.has(t.ship.id)) return true;
  if (!sim.running) return false;
  return sim.mode === 'naive' || t.ship.impact !== 'safe';
}

function stepTruck(sim: SiteSim, t: SimTruck, dt: number, userHeld: Set<string>) {
  t.held = isHeld(sim, t, userHeld);
  if (t.held) return;
  if (t.phase === 'docked') {
    t.timer -= dt;
    if (t.timer <= 0) {
      t.phase = 'leave';
      t.path = bayPathOut(DOOR_X[t.bay]);
      t.seg = 1;
    }
    return;
  }
  if (t.phase === 'queue') return;
  const target = t.path[t.seg];
  if (!target) return;
  const dx = target.x - t.x;
  const dz = target.z - t.z;
  const d = Math.hypot(dx, dz);
  const speed = target.rev ? REVERSE_SPEED : TRUCK_SPEED;
  if (d > 0.01) {
    const want = target.rev ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    t.yaw = wrap(t.yaw + wrap(want - t.yaw) * Math.min(1, dt * 4));
    const step = Math.min(d, speed * dt);
    t.x += (dx / d) * step;
    t.z += (dz / d) * step;
    return;
  }
  t.seg++;
  if (t.seg < t.path.length) return;
  if (t.phase === 'approach') {
    t.phase = 'docked';
    t.yaw = 0;
    t.timer = 7;
  } else if (t.phase === 'leave') {
    const bay = t.bay;
    const next = sim.trucks.find((o) => o.phase === 'queue');
    if (next) {
      next.bay = bay;
      next.phase = 'approach';
      next.path = bayPathIn(DOOR_X[bay], next.x);
      next.seg = 1;
      t.bay = -1;
      t.phase = 'toQueue';
      const queued = sim.trucks.filter((o) => o.phase === 'queue' || o.phase === 'toQueue').length;
      t.x = 90;
      t.z = TRUCK_LANE;
      t.yaw = -Math.PI / 2;
      t.path = [{ x: 90, z: TRUCK_LANE, rev: false }, { x: QUEUE_X(queued - 1), z: TRUCK_LANE, rev: false }];
      t.seg = 1;
    } else {
      t.phase = 'approach';
      t.x = 90;
      t.z = TRUCK_LANE;
      t.yaw = -Math.PI / 2;
      t.path = bayPathIn(DOOR_X[bay], 90);
      t.seg = 1;
    }
  } else if (t.phase === 'toQueue') {
    t.phase = 'queue';
  }
}

export function stepSim(sim: SiteSim, dt: number, userHeld: Set<string>): void {
  if (sim.running && !sim.done) sim.elapsed += dt;
  for (const f of sim.forklifts) stepForklift(sim, f, dt);
  for (const t of sim.trucks) stepTruck(sim, t, dt, userHeld);
  if (sim.running && !sim.done) {
    const pending = sim.pallets.some((p) => p.state !== 'moved' && flaggedIn(p.info.status, sim.mode) && (p.state !== 'stored' || sim.free.length > 0));
    const busy = sim.forklifts.some((f) => f.carrying >= 0 || f.steps.some((s) => s.t === 'drop'));
    if (!pending && !busy) sim.done = true;
  }
}

export interface SiteStats {
  running: boolean;
  done: boolean;
  elapsed: number;
  flagged: number;
  moved: number;
  overflow: number;
  unitsPulled: number;
  stranded: number;
  trucksHeld: number;
  trucksDocked: number;
  trucksQueued: number;
  forklifts: Array<{ id: string; operator: string; task: string; battery: number; moves: number; speed: number; carrying: string | null; charger: string }>;
  trucks: Array<{ id: string; product: string; impact: ImpactTone; status: string; bay: number; held: boolean }>;
}

export function snapshot(sim: SiteSim): SiteStats {
  const truckStatus = (t: SimTruck) =>
    t.held ? 'Held' : t.phase === 'docked' ? 'Loading' : t.phase === 'approach' ? 'Docking' : t.phase === 'leave' ? 'Departing' : t.phase === 'queue' ? 'At gate' : 'Arriving';
  return {
    running: sim.running,
    done: sim.done,
    elapsed: sim.elapsed,
    flagged: sim.flagged,
    moved: sim.moved,
    overflow: sim.overflow,
    unitsPulled: sim.unitsPulled,
    stranded: sim.pallets.filter((p) => p.state === 'stored' && flaggedIn(p.info.status, sim.mode)).length,
    trucksHeld: sim.trucks.filter((t) => t.held).length,
    trucksDocked: sim.trucks.filter((t) => t.phase === 'docked').length,
    trucksQueued: sim.trucks.filter((t) => t.phase === 'queue').length,
    forklifts: sim.forklifts.map((f) => ({
      id: f.id,
      operator: f.operator,
      task: f.task,
      battery: Math.round(f.battery),
      moves: f.moves,
      speed: f.speed,
      carrying: f.carrying >= 0 ? sim.pallets[f.carrying].info.id : null,
      charger: f.charger,
    })),
    trucks: sim.trucks.map((t) => ({ id: t.ship.id, product: t.ship.product, impact: t.ship.impact, status: truckStatus(t), bay: t.bay, held: t.held })),
  };
}
