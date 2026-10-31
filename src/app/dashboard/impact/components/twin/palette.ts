import type { MapNode, ViewMode } from '@/lib/types/network';

export type Tone = 'affected' | 'uncertain' | 'safe' | 'idle';

export interface Palette {
  isDark: boolean;
  bg: string;
  grass: string;
  block: string;
  road: string;
  lane: string;
  crossing: string;
  field: string;
  crop: string;
  tree: string;
  trunk: string;
  houseBody: string;
  roofs: string[];
  storeBodies: string[];
  blue: string;
  roof: string;
  door: string;
  metal: string;
  concrete: string;
  barn: string;
  truckBody: string;
  forklift: string;
  label: { bg: string; fg: string; sub: string; chip: string; chipFg: string; border: string };
  tone: Record<Tone, string>;
  neutral: string;
  route: string;
}

export function makePalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      isDark,
      bg: '#151515',
      grass: '#1a1b19',
      block: '#222220',
      road: '#2d2b28',
      lane: '#57534c',
      crossing: '#3a3834',
      field: '#232b20',
      crop: '#2f3d29',
      tree: '#3f6b4e',
      trunk: '#4a3f36',
      houseBody: '#34322f',
      roofs: ['#5a4a6e', '#6b4a3e', '#3e5468', '#6a5a3a', '#3e5e50'],
      storeBodies: ['#3b4a5e', '#5a4252', '#3e5648', '#5e5238', '#4a4560'],
      blue: '#3b5fd6',
      roof: '#d9dce4',
      door: '#121418',
      metal: '#6c7380',
      concrete: '#3a3936',
      barn: '#8a4b3c',
      truckBody: '#d6d8de',
      forklift: '#e0b43a',
      label: { bg: 'rgba(30,30,30,0.94)', fg: '#f5f3ef', sub: '#a29e97', chip: '#3b5fd6', chipFg: '#ffffff', border: 'rgba(255,255,255,0.10)' },
      tone: { affected: '#d66a61', uncertain: '#d19a43', safe: '#6fa687', idle: '#5d5a55' },
      neutral: '#6b6863',
      route: '#5b8cff',
    };
  }
  return {
    isDark,
    bg: '#ece7de',
    grass: '#e3dfd2',
    block: '#efeae1',
    road: '#cfc9d8',
    lane: '#f8f6f1',
    crossing: '#e2ddea',
    field: '#dfe3c9',
    crop: '#c8d1a6',
    tree: '#86b98f',
    trunk: '#9c8a78',
    houseBody: '#ffffff',
    roofs: ['#9b7fd1', '#e0876a', '#7f9fd6', '#e3b45c', '#6fb59b'],
    storeBodies: ['#ffffff', '#fdf4ec', '#f1f5fd', '#f2f8f1', '#fbf0f4'],
    blue: '#2f5be0',
    roof: '#f6f7fb',
    door: '#1d2433',
    metal: '#a3abb8',
    concrete: '#e6e2da',
    barn: '#b8604c',
    truckBody: '#ffffff',
    forklift: '#f2c230',
    label: { bg: 'rgba(255,255,255,0.96)', fg: '#202020', sub: '#7b766d', chip: '#2f5be0', chipFg: '#ffffff', border: 'rgba(32,32,32,0.10)' },
    tone: { affected: '#c85a52', uncertain: '#c58a32', safe: '#4f8a68', idle: '#b8b2a7' },
    neutral: '#c9c3b8',
    route: '#2f5be0',
  };
}

export function toneFor(node: MapNode, mode: ViewMode): Tone {
  if (node.isSource) return 'affected';
  if (mode === 'naive') {
    if (node.kind === 'plant') return 'affected';
    if (node.kind === 'supplier') return 'safe';
    return node.units.naiveRecall > 0 ? 'affected' : 'idle';
  }
  if (node.kind === 'supplier') return 'safe';
  if (node.units.affected > 0) return 'affected';
  if (node.units.uncertain > 0) return 'uncertain';
  return node.units.naiveRecall > 0 ? 'safe' : 'idle';
}

export function crateTones(node: MapNode, mode: ViewMode, count: number): Tone[] {
  const { affected, uncertain, safe } = node.units;
  const total = affected + uncertain + safe;
  if (total === 0) return [];
  if (mode === 'naive') return Array<Tone>(count).fill('affected');
  const red = Math.max(affected > 0 ? 1 : 0, Math.round((affected / total) * count));
  const amber = Math.min(count - red, Math.max(uncertain > 0 ? 1 : 0, Math.round((uncertain / total) * count)));
  return Array.from({ length: count }, (_, i): Tone => (i < red ? 'affected' : i < red + amber ? 'uncertain' : 'safe'));
}

export function recallUnits(node: MapNode, mode: ViewMode): number {
  return mode === 'naive' ? node.units.naiveRecall : node.units.affected;
}
