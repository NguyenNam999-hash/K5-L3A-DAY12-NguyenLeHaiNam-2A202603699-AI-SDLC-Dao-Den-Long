import type { Game } from '../core/game';
import { MAP_LIMITS } from '../core/terrain';
import { TUNING } from '../core/tuning';

const TAU = Math.PI * 2;
/** Metres from the player to the rim of the minimap. */
const VIEW_RANGE = 28;
const FALLBACK_SIZE = 168;

/**
 * Top-right overhead map of the area around Mây. Drawn with 2D canvas so it never
 * touches game state: it only reads positions the core already exposes.
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private size = FALLBACK_SIZE;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('minimap: 2D context unavailable');
    this.ctx = ctx;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssSize = Math.max(80, Math.round(rect.width || FALLBACK_SIZE));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = cssSize;
    this.canvas.width = Math.round(cssSize * dpr);
    this.canvas.height = Math.round(cssSize * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(game: Game, yawDeg: number): void {
    const ctx = this.ctx;
    const s = this.size;
    const half = s / 2;
    const rim = half - 2;
    const scale = (half - 4) / VIEW_RANGE;
    const toX = (x: number): number => half + (x - game.px) * scale;
    const toY = (z: number): number => half + (z - game.pz) * scale;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, rim, 0, TAU);
    ctx.clip();

    ctx.fillStyle = 'rgba(9, 8, 20, 0.84)';
    ctx.fillRect(0, 0, s, s);

    // Map silhouette.
    ctx.strokeStyle = 'rgba(201, 180, 138, 0.28)';
    ctx.fillStyle = 'rgba(47, 93, 80, 0.22)';
    ctx.lineWidth = 1;
    if (game.night === 1) {
      ctx.beginPath();
      ctx.arc(toX(0), toY(0), MAP_LIMITS.night1Radius * scale, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (game.night === 2) {
      for (const cx of [0, MAP_LIMITS.night2IslandBCenterX]) {
        ctx.beginPath();
        ctx.arc(toX(cx), toY(0), MAP_LIMITS.night2IslandRadius * scale, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillRect(toX(26), toY(-2), 18 * scale, 4 * scale);
    } else {
      ctx.beginPath();
      ctx.arc(toX(0), toY(0), MAP_LIMITS.night3Radius * scale, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(toX(0), toY(0), 24 * scale, 0, Math.PI);
      ctx.arc(toX(0), toY(0), 12 * scale, Math.PI, 0, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(47, 93, 80, 0.32)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(toX(0), toY(0), 8 * scale, 0, TAU);
      ctx.fillStyle = 'rgba(47, 93, 80, 0.45)';
      ctx.fill();
    }

    // Safe circles only around lanterns with enough fuel.
    for (const lantern of game.lanterns) {
      if (!lantern.lit || game.fuelOf(lantern) < TUNING.low_fuel_threshold) continue;
      ctx.beginPath();
      ctx.arc(toX(lantern.x), toY(lantern.z), Math.max(3, TUNING.safe_radius * scale), 0, TAU);
      ctx.fillStyle = 'rgba(255, 179, 71, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 196, 128, 0.28)';
      ctx.stroke();
    }

    for (const mote of game.motes) {
      ctx.beginPath();
      ctx.arc(toX(mote.x), toY(mote.z), 1.6, 0, TAU);
      ctx.fillStyle = mote.kind === 'dropped' ? 'rgba(180, 220, 255, 0.9)' : 'rgba(255, 246, 194, 0.9)';
      ctx.fill();
    }

    for (const charm of game.charms) {
      if (!charm.available) continue;
      ctx.save();
      ctx.translate(toX(charm.x), toY(charm.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
      ctx.restore();
    }

    for (const drifter of game.drifters) {
      if (drifter.state === 'removed') continue;
      ctx.beginPath();
      ctx.moveTo(toX(drifter.x), toY(drifter.z) - 4);
      ctx.lineTo(toX(drifter.x) + 3.4, toY(drifter.z) + 2.6);
      ctx.lineTo(toX(drifter.x) - 3.4, toY(drifter.z) + 2.6);
      ctx.closePath();
      ctx.fillStyle = drifter.state === 'flee' ? 'rgba(143, 163, 184, 0.45)' : '#8fa3b8';
      ctx.fill();
    }

    for (const shade of game.shades) {
      const x = toX(shade.x);
      const y = toY(shade.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, TAU);
      ctx.fillStyle = 'rgba(122, 60, 255, 0.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fillStyle = shade.state === 'stunned' ? '#3a3450' : '#b98cff';
      ctx.fill();
    }

    for (const lantern of game.lanterns) {
      const x = toX(lantern.x);
      const y = toY(lantern.z);
      const fuel = game.fuelOf(lantern);
      if (lantern.lit) {
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, TAU);
        ctx.fillStyle = fuel < TUNING.low_fuel_threshold ? 'rgba(255, 122, 77, 0.9)' : '#ffb347';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 4.8, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, fuel / TUNING.fuel_max)));
        ctx.strokeStyle = 'rgba(255, 220, 160, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Hollow ring: an off lantern stays recognisable without colour.
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, TAU);
        ctx.strokeStyle = lantern.everLit ? 'rgba(255, 210, 150, 0.55)' : 'rgba(255, 210, 150, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Wind arrow.
    if (game.wind.active) {
      const a = (game.wind.dirDeg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(half - Math.cos(a) * 10, half - Math.sin(a) * 10);
      ctx.lineTo(half + Math.cos(a) * 10, half + Math.sin(a) * 10);
      ctx.strokeStyle = 'rgba(143, 163, 184, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Player arrow (north-up, +z points down the canvas).
    const yaw = (yawDeg * Math.PI) / 180;
    const fx = Math.sin(yaw);
    const fy = Math.cos(yaw);
    const px = -fy;
    const py = fx;
    ctx.beginPath();
    ctx.moveTo(half + fx * 7, half + fy * 7);
    ctx.lineTo(half - fx * 4 + px * 4.5, half - fy * 4 + py * 4.5);
    ctx.lineTo(half - fx * 4 - px * 4.5, half - fy * 4 - py * 4.5);
    ctx.closePath();
    ctx.fillStyle = '#e8e2d0';
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(half, half, rim, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 196, 128, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
