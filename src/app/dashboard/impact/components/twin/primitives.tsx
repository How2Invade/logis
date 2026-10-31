import * as THREE from 'three';

const MATS = new Map<string, THREE.MeshStandardMaterial>();
const GEOS = new Map<string, THREE.BufferGeometry>();
const TEXS = new Map<string, THREE.CanvasTexture>();

export function mat(color: string, rough = 0.82, emissive?: string, emissiveIntensity = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${emissive ?? ''}|${emissiveIntensity}`;
  let m = MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    if (emissive) {
      m.emissive.set(emissive);
      m.emissiveIntensity = emissiveIntensity;
    }
    MATS.set(key, m);
  }
  return m;
}

function cachedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = GEOS.get(key);
  if (hit) return hit as T;
  const g = make();
  GEOS.set(key, g);
  return g;
}

export const boxGeo = (w: number, h: number, d: number) =>
  cachedGeo(`b|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylGeo = (rt: number, rb: number, h: number, seg = 16) =>
  cachedGeo(`c|${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sphereGeo = (r: number) => cachedGeo(`s|${r}`, () => new THREE.SphereGeometry(r, 16, 12));
export const ringGeo = (inner: number, outer: number) =>
  cachedGeo(`r|${inner}|${outer}`, () => {
    const g = new THREE.RingGeometry(inner, outer, 48);
    g.rotateX(-Math.PI / 2);
    return g;
  });
export const planeGeo = (w: number, h: number) =>
  cachedGeo(`p|${w}|${h}`, () => {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateX(-Math.PI / 2);
    return g;
  });

export function disposeCaches(): void {
  MATS.forEach((m) => m.dispose());
  GEOS.forEach((g) => g.dispose());
  TEXS.forEach((t) => t.dispose());
  MATS.clear();
  GEOS.clear();
  TEXS.clear();
}

type Vec3 = [number, number, number];

interface BoxProps {
  size: Vec3;
  color?: string;
  material?: THREE.Material;
  position?: Vec3;
  rotation?: Vec3;
  cast?: boolean;
}

export function Box({ size, color = '#ffffff', material, position, rotation, cast = false }: BoxProps) {
  return (
    <mesh
      geometry={boxGeo(size[0], size[1], size[2])}
      material={material ?? mat(color)}
      position={position}
      rotation={rotation}
      castShadow={cast}
      receiveShadow
      dispose={null}
    />
  );
}

interface CylProps {
  r: number;
  h: number;
  color: string;
  position: Vec3;
  rotation?: Vec3;
  rTop?: number;
  cast?: boolean;
}

export function Cyl({ r, h, color, position, rotation, rTop, cast = false }: CylProps) {
  return (
    <mesh
      geometry={cylGeo(rTop ?? r, r, h)}
      material={mat(color)}
      position={position}
      rotation={rotation}
      castShadow={cast}
      receiveShadow
      dispose={null}
    />
  );
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export interface LabelStyle {
  bg: string;
  fg: string;
  sub: string;
  chip: string;
  chipFg: string;
  border: string;
}

export interface LabelTex {
  texture: THREE.CanvasTexture;
  aspect: number;
}

export function labelTexture(code: string, name: string, style: LabelStyle): LabelTex {
  const key = `l|${code}|${name}|${style.bg}|${style.chip}`;
  const H = 88;
  const measure = document.createElement('canvas').getContext('2d');
  let codeW = 120;
  let nameW = 200;
  if (measure) {
    measure.font = `700 34px ${MONO}`;
    codeW = measure.measureText(code).width + 28;
    measure.font = `650 38px ${SANS}`;
    nameW = measure.measureText(name).width;
  }
  const W = Math.ceil(12 + codeW + 16 + nameW + 22);
  const cached = TEXS.get(key);
  if (cached) return { texture: cached, aspect: W / H };
  const texture = canvasTexture(W, H, (g) => {
    roundRect(g, 2, 2, W - 4, H - 4, 18);
    g.fillStyle = style.bg;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = style.border;
    g.stroke();
    roundRect(g, 12, 14, codeW, H - 28, 10);
    g.fillStyle = style.chip;
    g.fill();
    g.fillStyle = style.chipFg;
    g.font = `700 34px ${MONO}`;
    g.textBaseline = 'middle';
    g.fillText(code, 26, H / 2 + 1);
    g.fillStyle = style.fg;
    g.font = `650 38px ${SANS}`;
    g.fillText(name, 12 + codeW + 16, H / 2 + 2);
  });
  TEXS.set(key, texture);
  return { texture, aspect: W / H };
}

export function dotTexture(): THREE.CanvasTexture {
  const hit = TEXS.get('dot');
  if (hit) return hit;
  const t = canvasTexture(64, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.stroke();
  });
  TEXS.set('dot', t);
  return t;
}

export function roofLogoTexture(text: string, fg: string): THREE.CanvasTexture {
  const key = `roof|${text}|${fg}`;
  const hit = TEXS.get(key);
  if (hit) return hit;
  const t = canvasTexture(256, 96, (g) => {
    g.fillStyle = fg;
    g.font = `800 56px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 50);
  });
  TEXS.set(key, t);
  return t;
}
