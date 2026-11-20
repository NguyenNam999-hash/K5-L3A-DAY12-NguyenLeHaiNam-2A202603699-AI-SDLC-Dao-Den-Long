import './styles.css';
import * as THREE from 'three';
import { Game } from '../core/game';
import { DT } from '../core/tuning';
import type { InputFrame } from '../core/types';
import { AudioFx } from './audio';
import { Hud } from './hud';
import { createWorld } from './world';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const flashEl = document.querySelector<HTMLDivElement>('#flash')!;
const startScreen = document.querySelector<HTMLDivElement>('#start-screen')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start-btn')!;
const replayBtn = document.querySelector<HTMLButtonElement>('#replay-btn')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
const world = createWorld(scene);
const hud = new Hud();
const audio = new AudioFx();

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
let game = new Game({
  seed: Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 1e9),
});

let started = false;
let elapsed = 0;
let accumulator = 0;
let lastFrame = performance.now();
let yawDeg = 0;
let pitch = 0.42;
let shake = 0;
let overlayScheduled = false;

const keys = new Set<string>();
let jumpQueued = false;
let interactQueued = false;
let pulseQueued = false;

const camPos = new THREE.Vector3(0, 6, -10);
const lookTarget = new THREE.Vector3();

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function readInput(): InputFrame {
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const input: InputFrame = {
    moveX: side,
    moveZ: forward,
    camYawDeg: yawDeg,
    jump: jumpQueued,
    interact: interactQueued,
    pulse: pulseQueued,
  };
  jumpQueued = false;
  interactQueued = false;
  pulseQueued = false;
  return input;
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'KeyE', 'KeyF'].includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  keys.add(event.code);
  if (!started) return;
  if (event.code === 'Space') jumpQueued = true;
  if (event.code === 'KeyE') interactQueued = true;
  if (event.code === 'KeyF') pulseQueued = true;
  if (event.code === 'KeyM') audio.toggle();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', () => {
  if (started && document.pointerLockElement !== canvas) {
    void canvas.requestPointerLock?.();
  }
});

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  yawDeg += event.movementX * 0.16;
  pitch = THREE.MathUtils.clamp(pitch + event.movementY * 0.0016, -0.05, 1.05);
});

function flash(): void {
  shake = 0.5;
  flashEl.classList.add('on');
  window.setTimeout(() => flashEl.classList.remove('on'), 70);
}

function handleEvents(): void {
  for (const event of game.drainEvents()) {
    switch (event.name) {
      case 'mote_picked':
        audio.pickup();
        break;
      case 'deposit':
        audio.deposit();
        break;
      case 'lantern_lit':
        audio.light();
        break;
      case 'pulse':
        world.pulse(game.px, game.pz);
        audio.pulse();
        break;
      case 'player_hit':
        audio.hit();
        flash();
        break;
      case 'game_over':
        audio.result(event.data.result === 'won');
        break;
      case 'shade_spawned':
        break;
    }
  }
}

function updateCamera(dt: number): void {
  lookTarget.set(game.px, game.py + 1.55, game.pz);
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const distance = 9.6;
  const horizontal = Math.cos(pitch) * distance;
  const desired = new THREE.Vector3(
    lookTarget.x - Math.sin(yaw) * horizontal,
    lookTarget.y + Math.sin(pitch) * distance + 0.4,
    lookTarget.z - Math.cos(yaw) * horizontal,
  );
  const smoothing = 1 - Math.pow(0.0008, dt);
  camPos.lerp(desired, smoothing);
  camera.position.copy(camPos);
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= 0.86;
  }
  camera.lookAt(lookTarget);
}

function frame(now: number): void {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  elapsed += dt;

  if (started && game.state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= DT && guard < 6) {
      game.step(readInput());
      accumulator -= DT;
      guard += 1;
    }
    if (accumulator > DT * 6) accumulator = 0;
  }

  handleEvents();
  world.update(game, elapsed);
  hud.update(game);
  updateCamera(dt);
  renderer.render(scene, camera);

  if (game.state !== 'playing' && !overlayScheduled) {
    overlayScheduled = true;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    window.setTimeout(() => hud.showOverlay(game), 900);
  }
}

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  hud.show();
  started = true;
  lastFrame = performance.now();
  audio.init();
  void canvas.requestPointerLock?.();
});

replayBtn.addEventListener('click', () => {
  game = new Game({
    seed: Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 1e9),
  });
  accumulator = 0;
  overlayScheduled = false;
  document.querySelector<HTMLDivElement>('#overlay')!.hidden = true;
  started = true;
  lastFrame = performance.now();
  audio.init();
  void canvas.requestPointerLock?.();
});

window.requestAnimationFrame(frame);

// Dev hook: lets evidence scripts pose visual states (never used by gameplay).
(window as unknown as { __dao?: unknown }).__dao = {
  game: () => game,
};
