import * as THREE from 'three';
import { BENCH, createBenchScenario } from '../core/bench-scenario';
import { Game } from '../core/game';
import { DT } from '../core/tuning';
import { IDLE_INPUT } from '../core/types';
import { createWorld } from '../render/world';

/**
 * Standard benchmark scene (Contract v1.3): fixed 1280x720, Night 1, 200 wander
 * shades, 100 motes, L1-L3 lit, camera orbiting (0,0,0) at r=30, y=15, 15 s/turn.
 * Warm-up is not measured. Results land in `window.__bench` for scripts/bench.mjs.
 */

interface BenchResult {
  dts: number[];
  renderer: string;
}

declare global {
  interface Window {
    __bench?: BenchResult;
    __benchFirstFrameAt?: number;
    __benchPhase?: 'warmup' | 'measure' | 'done';
  }
}

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 42;
const duration = Number(params.get('duration')) || 30;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 700);
const game = new Game({ seed, night: 1, benchmark: true, scenario: createBenchScenario(seed) });
const world = createWorld(scene, 1);

const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : 'WebGL2';

window.__benchPhase = 'warmup';
let first = 0;
let warmupEnd = 0;
let measureEnd = 0;
let last = 0;
let simAcc = 0;
let elapsed = 0;
const dts: number[] = [];

function frame(now: number): void {
  if (first === 0) {
    first = now;
    window.__benchFirstFrameAt = Date.now();
    last = now;
  }
  const dtMs = Math.min(100, now - last);
  last = now;
  elapsed += dtMs / 1000;

  const angle = (elapsed / BENCH.orbitSeconds) * Math.PI * 2;
  camera.position.set(
    BENCH.cameraRadius * Math.cos(angle),
    BENCH.cameraHeight,
    -BENCH.cameraRadius * Math.sin(angle),
  );
  camera.lookAt(0, 0, 0);

  simAcc += Math.min(0.1, dtMs / 1000);
  let guard = 0;
  while (simAcc >= DT && guard < 6) {
    game.step(IDLE_INPUT);
    game.drainEvents();
    simAcc -= DT;
    guard += 1;
  }
  world.update(game, elapsed);
  renderer.render(scene, camera);

  if (warmupEnd === 0) {
    if (now - first >= BENCH.warmupSeconds * 1000) {
      warmupEnd = now;
      window.__benchPhase = 'measure';
    }
  } else if (measureEnd === 0) {
    dts.push(dtMs);
    if (now - warmupEnd >= duration * 1000) {
      measureEnd = now;
      window.__benchPhase = 'done';
      window.__bench = {
        dts,
        renderer: `Chromium + Three.js ${THREE.REVISION} · ${gpu}`,
      };
      return;
    }
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
