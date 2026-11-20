import './styles.css';
import * as THREE from 'three';
import { Game } from '../core/game';
import { DT, TUNING } from '../core/tuning';
import { groundHeight, isSolid } from '../core/terrain';
import type { InputFrame, NightId } from '../core/types';
import { AudioFx } from './audio';
import { Hud } from './hud';
import { Minimap } from './minimap';
import { DIFFICULTIES, Settings } from './settings';
import { createWorld, type World } from './world';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const flashEl = document.querySelector<HTMLDivElement>('#flash')!;
const menuScreen = document.querySelector<HTMLDivElement>('#menu-screen')!;
const introScreen = document.querySelector<HTMLDivElement>('#intro-screen')!;
const pauseScreen = document.querySelector<HTMLDivElement>('#pause-screen')!;
const minimapCanvas = document.querySelector<HTMLCanvasElement>('#minimap')!;
const introEyebrow = document.querySelector<HTMLParagraphElement>('#intro-eyebrow')!;
const introTitle = document.querySelector<HTMLHeadingElement>('#intro-title')!;
const introStory = document.querySelector<HTMLParagraphElement>('#intro-story')!;
const introTip = document.querySelector<HTMLParagraphElement>('#intro-tip')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
const hud = new Hud();
const audio = new AudioFx();
const minimap = new Minimap(minimapCanvas);
const settings = new Settings(audio);

type Phase = 'menu' | 'intro' | 'playing' | 'paused' | 'result' | 'sunrise';

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const requestedNight = Number(params.get('night'));
const baseSeed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 1e9);

let phase: Phase = 'menu';
let currentNight: NightId = 1;
let game = new Game({ seed: baseSeed, night: 1 });
let world: World = createWorld(scene, 1);
let totalScore = 0;
const nightScores: Record<NightId, number> = { 1: 0, 2: 0, 3: 0 };
let elapsed = 0;
let accumulator = 0;
let lastFrame = performance.now();
let yawDeg = 0;
let pitch = 0.42;
let shake = 0;
let resultScheduled = false;
let settingsReturn: 'menu' | 'pause' = 'menu';
let lastCountdownSecond = 99;
let windWasActive = false;
let windWarned = false;

/** Hold E for this long to pause the simulation and look straight down. */
const OVERVIEW_HOLD_MS = 180;
let overview = false;
let overviewTimer = 0;

const keys = new Set<string>();
let jumpQueued = false;
let interactQueued = false;
let pulseQueued = false;
let dashQueued = false;

const camPos = new THREE.Vector3(0, 6, -10);
const lookTarget = new THREE.Vector3();
const overviewEye = new THREE.Vector3();
const overviewLook = new THREE.Vector3();

const INTRO: Record<NightId, { name: string; story: string; tip: string }> = {
  1: {
    name: 'Đảo Bến',
    story:
      'Ông Đăng đứng bên bến đò, tay run run che ngọn đèn: “Đêm nay sương xuống sớm. Năm ngọn đèn ở Đảo Bến đã tắt, cháu đi gom đom đóm và thắp lại giúp ta.”',
    tip: 'Mẹo: Bóng Mực chỉ sinh từ giây thứ 5. Thắp đèn sớm để tạo vùng an toàn trước khi chúng đông.',
  },
  2: {
    name: 'Đảo Cau',
    story:
      '“Qua cầu tre là Đảo Cau. Hai bên cầu không có lan can, gió lại hay đổi chiều. Bục gỗ trên đảo sẽ đưa cháu sang bờ bên kia nếu cháu dám nhảy.”',
    tip: 'Mẹo: Giữ Shift để lướt qua khoảng trống. Bùa Gió ở giữa cầu cho lướt không hồi chiêu.',
  },
  3: {
    name: 'Đảo Chuông',
    story:
      '“Đảo Chuông có ba tầng. Chuông chỉ ngân khi cả bảy ngọn đèn cùng sáng. Gió mạnh sẽ thổi mỗi ba mươi giây; hãy nghe lá bay trước khi nó tới.”',
    tip: 'Mẹo: Dốc ở 30° và 150° dẫn lên tầng một. Bục ở tầng một phóng lên tầng hai, nơi giữ ngọn đèn đầu tiên.',
  },
};

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  minimap.resize();
}
window.addEventListener('resize', resize);
resize();

function readInput(): InputFrame {
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const side = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const input: InputFrame = {
    moveX: side,
    moveZ: forward,
    camYawDeg: yawDeg,
    jump: jumpQueued,
    interact: interactQueued,
    pulse: pulseQueued,
    dash: dashQueued,
    pause: false,
  };
  jumpQueued = false;
  interactQueued = false;
  pulseQueued = false;
  dashQueued = false;
  return input;
}

function requestPointerLock(): void {
  if (phase === 'playing' && document.pointerLockElement !== canvas) void canvas.requestPointerLock?.();
}

function hideOverlays(): void {
  menuScreen.hidden = true;
  introScreen.hidden = true;
  pauseScreen.hidden = true;
  hud.hideOverlay();
}

function applyDifficulty(): void {
  const spec = DIFFICULTIES[settings.difficulty];
  game.setDifficulty(spec.speed, spec.count);
  hud.setDifficulty(spec.label);
}

function rebuildWorld(night: NightId): void {
  world.dispose();
  world = createWorld(scene, night);
}

function toMenu(): void {
  phase = 'menu';
  resultScheduled = false;
  audio.stopMusic();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  hideOverlays();
  hud.hide();
  hud.setPaused(null);
  menuScreen.hidden = false;
  settingsReturn = 'menu';
  settings.hide();
  currentNight = 1;
  game = new Game({ seed: baseSeed, night: 1 });
  rebuildWorld(1);
  elapsed = 0;
}

function startCampaign(): void {
  totalScore = 0;
  nightScores[1] = 0;
  nightScores[2] = 0;
  nightScores[3] = 0;
  showIntro(1);
}

function showIntro(night: NightId): void {
  phase = 'intro';
  resultScheduled = false;
  currentNight = night;
  audio.stopMusic();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  hideOverlays();
  hud.hide();
  hud.setPaused(null);
  game = new Game({ seed: baseSeed + night * 7919, night });
  applyDifficulty();
  rebuildWorld(night);
  hud.setupNight(night, game.lanterns.length);
  const intro = INTRO[night];
  introEyebrow.textContent = `Đêm ${night} · ${intro.name}`;
  introTitle.textContent = intro.name;
  introStory.textContent = intro.story;
  introTip.textContent = intro.tip;
  introScreen.hidden = false;
  elapsed = 0;
}

function beginPlay(): void {
  phase = 'playing';
  introScreen.hidden = true;
  hud.show();
  minimap.resize();
  audio.init();
  audio.startMusic(currentNight);
  lastFrame = performance.now();
  accumulator = 0;
  lastCountdownSecond = 99;
  yawDeg = 0;
  pitch = 0.42;
  requestPointerLock();
}

function retryNight(): void {
  showIntro(currentNight);
}

function openPause(): void {
  if (phase !== 'playing' || game.state !== 'playing') return;
  phase = 'paused';
  accumulator = 0;
  overview = false;
  window.clearTimeout(overviewTimer);
  hud.setPaused('Tạm dừng · P để tiếp tục');
  pauseScreen.hidden = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function closePause(): void {
  if (phase !== 'paused') return;
  pauseScreen.hidden = true;
  hud.setPaused(null);
  phase = 'playing';
  lastFrame = performance.now();
  accumulator = 0;
  requestPointerLock();
}

function openSettings(from: 'menu' | 'pause'): void {
  settingsReturn = from;
  settings.show();
  if (from === 'menu') menuScreen.hidden = true;
  if (from === 'pause') pauseScreen.hidden = true;
}

settings.onClose = () => {
  if (settingsReturn === 'menu') menuScreen.hidden = false;
  else {
    pauseScreen.hidden = false;
    phase = 'paused';
  }
};

function flash(): void {
  shake = 0.5;
  flashEl.classList.add('on');
  window.setTimeout(() => flashEl.classList.remove('on'), 70);
}

function nearestUnlit(): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number; d: number } | null = null;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const d = Math.hypot(lantern.x - game.px, lantern.y - game.py, lantern.z - game.pz);
    if (!best || d < best.d) best = { x: lantern.x, y: lantern.y, z: lantern.z, d };
  }
  return best;
}

const projected = new THREE.Vector3();

function updateArrow(): void {
  const target = nearestUnlit();
  if (!target) {
    hud.setArrow(null, 0);
    return;
  }
  projected.set(target.x, target.y + 3.6, target.z).project(camera);
  const inside = projected.z < 1 && Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92;
  if (inside) {
    hud.setArrow(null, 0);
    return;
  }
  let angle = (Math.atan2(projected.x, projected.y) * 180) / Math.PI;
  if (projected.z > 1) angle = 180;
  hud.setArrow(angle, Math.hypot(target.x - game.px, target.z - game.pz));
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
        world.pulse(game.px, game.py + 0.8, game.pz, TUNING.pulse_radius);
        audio.pulse();
        break;
      case 'dash':
        audio.dash();
        break;
      case 'charm_picked':
        audio.charm();
        break;
      case 'drifter_steal':
        audio.steal();
        break;
      case 'drifter_drop':
        audio.charm();
        break;
      case 'player_hit':
        audio.hit();
        flash();
        break;
      case 'shade_spawned':
        audio.shadeSpawn();
        break;
      case 'game_over':
        audio.result(event.data.result === 'won');
        break;
      case 'night_start':
      case 'paused':
      case 'resumed':
        break;
    }
  }
}

function updateCamera(dt: number): void {
  const smoothing = 1 - Math.pow(0.0008, dt);
  lookTarget.set(game.px, game.py + 1.55, game.pz);

  if (overview) {
    overviewLook.set(game.px, game.py, game.pz);
    overviewEye.set(game.px, game.py + 40, game.pz + 10);
    camPos.lerp(overviewEye, smoothing);
    camera.position.copy(camPos);
    camera.lookAt(overviewLook);
    return;
  }
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const distance = 9.6;
  const horizontal = Math.cos(pitch) * distance;
  const desired = new THREE.Vector3(
    lookTarget.x - Math.sin(yaw) * horizontal,
    lookTarget.y + Math.sin(pitch) * distance + 0.4,
    lookTarget.z - Math.cos(yaw) * horizontal,
  );

  // Keep the camera out of terrain and pull it in when a wall blocks the line of sight.
  const toCamera = desired.clone().sub(lookTarget);
  const maxDist = toCamera.length();
  const dir = toCamera.normalize();
  let allowed = maxDist;
  for (let d = 0.8; d <= maxDist; d += 0.35) {
    const sx = lookTarget.x + dir.x * d;
    const sy = lookTarget.y + dir.y * d;
    const sz = lookTarget.z + dir.z * d;
    const g = groundHeight(game.night, sx, sz);
    if ((g !== null && sy < g + 0.55) || isSolid(game.night, sx, sy, sz)) {
      allowed = Math.max(1.2, d - 0.55);
      break;
    }
  }
  desired.copy(lookTarget).addScaledVector(dir, allowed);
  const camGround = groundHeight(game.night, desired.x, desired.z);
  if (camGround !== null && desired.y < camGround + 0.55) desired.y = camGround + 0.55;
  camPos.lerp(desired, phase === 'intro' || phase === 'menu' ? 1 : smoothing);
  camera.position.copy(camPos);
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= 0.86;
  }
  camera.lookAt(lookTarget);
}

function scheduleResult(): void {
  if (resultScheduled) return;
  resultScheduled = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  window.setTimeout(() => {
    if (phase !== 'playing') return;
    phase = 'result';
    hud.setPaused(null);
    const won = game.state === 'won';
    nightScores[currentNight] = won ? game.score : 0;
    totalScore = nightScores[1] + nightScores[2] + nightScores[3];
    hud.showResult(game, currentNight, totalScore, won && currentNight === 3);
  }, 900);
}

function frame(now: number): void {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (phase === 'playing' && game.state === 'playing' && !overview) {
    elapsed += dt;
    accumulator += dt;
    let guard = 0;
    while (accumulator >= DT && guard < 6) {
      game.step(readInput());
      accumulator -= DT;
      guard += 1;
    }
    if (accumulator > DT * 6) accumulator = 0;
  } else {
    accumulator = 0;
    jumpQueued = false;
    interactQueued = false;
    pulseQueued = false;
    dashQueued = false;
  }

  handleEvents();
  world.update(game, elapsed);
  if (phase === 'playing' || phase === 'paused' || phase === 'result') {
    hud.update(game);
  }
  if ((game.wind.active || game.windWarning) && !windWasActive && !windWarned) audio.wind();
  if (game.windWarning) windWarned = true;
  if (game.wind.active) {
    windWasActive = true;
    windWarned = false;
  } else if (!game.windWarning) {
    windWasActive = false;
    windWarned = false;
  }
  if (phase === 'playing') {
    const second = Math.ceil(game.timeLeft());
    if (second <= 10 && second > 0 && second !== lastCountdownSecond) {
      lastCountdownSecond = second;
      audio.countdown();
    }
  }
  updateCamera(dt);
  if (phase === 'playing' || phase === 'paused') {
    minimap.update(game, yawDeg);
    updateArrow();
  }
  renderer.render(scene, camera);

  if (phase === 'playing' && game.state !== 'playing') scheduleResult();
}

// --- Keyboard / mouse ---

window.addEventListener('keydown', (event) => {
  if (['Space', 'KeyE', 'KeyQ', 'KeyF', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.repeat) return;
  keys.add(event.code);

  if (event.code === 'KeyQ' && phase === 'playing' && game.state === 'playing') {
    window.clearTimeout(overviewTimer);
    overviewTimer = window.setTimeout(() => {
      if (!keys.has('KeyQ') || phase !== 'playing' || game.state !== 'playing') return;
      overview = true;
      accumulator = 0;
      hud.setPaused('Nhìn từ trên cao · thả Q để tiếp tục');
    }, OVERVIEW_HOLD_MS);
    return;
  }

  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (!document.querySelector<HTMLDivElement>('#settings')!.hidden) {
      settings.hide();
      return;
    }
    if (phase === 'paused') {
      closePause();
      return;
    }
    if (phase === 'playing') {
      openPause();
      return;
    }
    if (event.code === 'Escape' && document.pointerLockElement === canvas) document.exitPointerLock();
    return;
  }

  if (event.code === 'KeyM') {
    settings.toggleSound();
    return;
  }

  if (phase !== 'playing') return;
  if (event.code === 'Space') {
    jumpQueued = true;
    audio.jump();
  }
  if (event.code === 'KeyE') interactQueued = true;
  if (event.code === 'KeyF') pulseQueued = true;
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') dashQueued = true;
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'KeyQ') {
    window.clearTimeout(overviewTimer);
    if (overview) {
      overview = false;
      if (phase === 'playing') hud.setPaused(null);
      lastFrame = performance.now();
      accumulator = 0;
    }
  }
});
window.addEventListener('blur', () => {
  keys.clear();
  window.clearTimeout(overviewTimer);
  if (overview) {
    overview = false;
    if (phase === 'playing') hud.setPaused(null);
  }
});

canvas.addEventListener('click', () => {
  requestPointerLock();
});

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || overview) return;
  const sensitivity = settings.values.sensitivity;
  yawDeg += event.movementX * sensitivity;
  pitch = THREE.MathUtils.clamp(pitch + event.movementY * sensitivity * 0.01, -0.05, 1.05);
});

// --- Buttons / campaign ---

document.querySelector<HTMLButtonElement>('#campaign-btn')!.addEventListener('click', () => startCampaign());
document.querySelector<HTMLButtonElement>('#menu-settings-btn')!.addEventListener('click', () => openSettings('menu'));
document.querySelector<HTMLButtonElement>('#intro-btn')!.addEventListener('click', () => beginPlay());
document.querySelector<HTMLButtonElement>('#resume-btn')!.addEventListener('click', () => closePause());
document.querySelector<HTMLButtonElement>('#retry-night-btn')!.addEventListener('click', () => retryNight());
document.querySelector<HTMLButtonElement>('#pause-settings-btn')!.addEventListener('click', () => openSettings('pause'));
document.querySelector<HTMLButtonElement>('#pause-menu-btn')!.addEventListener('click', () => toMenu());

document.querySelector<HTMLButtonElement>('#continue-btn')!.addEventListener('click', () => {
  if (currentNight === 3) {
    phase = 'sunrise';
    hud.showSunrise(totalScore);
    audio.stopMusic();
  } else {
    showIntro((currentNight + 1) as NightId);
  }
});
document.querySelector<HTMLButtonElement>('#retry-btn')!.addEventListener('click', () => retryNight());
document.querySelector<HTMLButtonElement>('#to-menu-btn')!.addEventListener('click', () => toMenu());

window.requestAnimationFrame(frame);

// Dev hook: lets evidence scripts pose visual states (never used by gameplay).
(window as unknown as { __dao?: unknown }).__dao = {
  game: () => game,
  phase: () => phase,
  settings,
  hud,
  sunrise: (score: number) => {
    phase = 'sunrise';
    hud.showSunrise(score);
  },
  setView: (yaw: number, nextPitch = 0.42) => {
    yawDeg = yaw;
    pitch = nextPitch;
  },
  startNight: (night: NightId) => {
    totalScore = 0;
    nightScores[1] = 0;
    nightScores[2] = 0;
    nightScores[3] = 0;
    showIntro(night);
    beginPlay();
  },
  startCampaign,
  beginPlay,
  toMenu,
};

if (requestedNight === 1 || requestedNight === 2 || requestedNight === 3) {
  window.setTimeout(() => {
    showIntro(requestedNight as NightId);
    beginPlay();
  }, 120);
}

