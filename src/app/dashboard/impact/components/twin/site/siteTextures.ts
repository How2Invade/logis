import * as THREE from 'three';
import { MONO, SANS, canvasTexture, roundRect } from '../primitives';
import type { SitePalette } from '../palette';

function crisp(t: THREE.CanvasTexture): THREE.CanvasTexture {
  t.anisotropy = 8;
  return t;
}

function logoMark(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.fillStyle = color;
  roundRect(g, x, y, s, s, s * 0.22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x + s * 0.28, y + s * 0.24);
  g.lineTo(x + s * 0.28, y + s * 0.76);
  g.lineTo(x + s * 0.74, y + s * 0.76);
  g.lineTo(x + s * 0.74, y + s * 0.62);
  g.lineTo(x + s * 0.42, y + s * 0.62);
  g.lineTo(x + s * 0.42, y + s * 0.24);
  g.closePath();
  g.fill();
}

export function signTexture(code: string, name: string, p: SitePalette, accent: string): THREE.CanvasTexture {
  return crisp(
    canvasTexture(1024, 160, (g) => {
      g.fillStyle = p.sign.bg;
      roundRect(g, 4, 4, 1016, 152, 22);
      g.fill();
      logoMark(g, 26, 26, 108, accent);
      g.fillStyle = p.sign.fg;
      g.font = `800 64px ${SANS}`;
      g.textBaseline = 'middle';
      g.fillText('LOGIS', 156, 62);
      g.fillStyle = p.sign.sub;
      g.font = `600 36px ${SANS}`;
      const sub = `${code} · ${name}`;
      g.fillText(sub.length > 44 ? `${sub.slice(0, 43)}…` : sub, 158, 118);
    })
  );
}

export function badgeTexture(text: string, bg: string): THREE.CanvasTexture {
  return crisp(
    canvasTexture(128, 96, (g) => {
      g.fillStyle = bg;
      roundRect(g, 4, 4, 120, 88, 16);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = `800 52px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 64, 52);
    })
  );
}

export function liveryTexture(color: string): THREE.CanvasTexture {
  return crisp(
    canvasTexture(1024, 448, (g) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 1024, 448);
      g.fillStyle = color;
      g.fillRect(0, 330, 1024, 70);
      g.globalAlpha = 0.35;
      g.fillRect(0, 300, 1024, 18);
      g.globalAlpha = 1;
      logoMark(g, 70, 90, 150, color);
      g.fillStyle = color;
      g.font = `800 120px ${SANS}`;
      g.textBaseline = 'middle';
      g.fillText('LOGIS', 250, 150);
      g.fillStyle = '#4a5468';
      g.font = `600 44px ${SANS}`;
      g.fillText('Freight · Traced. Trusted. Delivered.', 254, 242);
    })
  );
}

export function hatchTexture(color: string, base: string, label: string, sub: string): THREE.CanvasTexture {
  return crisp(
    canvasTexture(1040, 704, (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 1040, 704);
      g.strokeStyle = color;
      g.globalAlpha = 0.28;
      g.lineWidth = 26;
      for (let x = -704; x < 1040 + 704; x += 78) {
        g.beginPath();
        g.moveTo(x, 704);
        g.lineTo(x + 704, 0);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.lineWidth = 16;
      g.strokeRect(8, 8, 1024, 688);
      g.fillStyle = base;
      roundRect(g, 260, 40, 520, 104, 18);
      g.fill();
      g.fillStyle = color;
      g.font = `800 64px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, 520, 84);
      g.font = `600 30px ${MONO}`;
      g.fillText(sub, 520, 128);
    })
  );
}
