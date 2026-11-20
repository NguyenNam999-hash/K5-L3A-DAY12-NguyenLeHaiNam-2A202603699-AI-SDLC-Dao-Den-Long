import * as THREE from 'three';
import type { Game } from '../core/game';
import { groundHeight, MAP_LIMITS } from '../core/terrain';
import { PHYSICS, TUNING } from '../core/tuning';
import type { NightId } from '../core/types';

const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lit: 0xffb347,
  core: 0xffe9b0,
  off: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shade: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  robe: 0xe8e2d0,
  scarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
  danger: 0xff5a5f,
  text: 0xf5f1e6,
};

const SKY_DARK = new THREE.Color(PALETTE.sky);
const SKY_WARM = new THREE.Color(0x2a2140);
const FOG_DARK = new THREE.Color(PALETTE.fog);
const FOG_WARM = new THREE.Color(0x3a2a44);

function makeGlowTexture(inner: string, mid: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.3, mid);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowSprite(texture: THREE.Texture, color: number, scale: number, opacity: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LanternFx {
  group: THREE.Group;
  orb: THREE.Mesh;
  orbMaterial: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  halo: THREE.Sprite;
  offHalo: THREE.Sprite;
  beam: THREE.Mesh;
  aura: THREE.Mesh;
  phase: number;
}

interface MoteFx {
  group: THREE.Group;
  halo: THREE.Sprite;
  phase: number;
}

interface ShadeFx {
  group: THREE.Group;
  core: THREE.MeshStandardMaterial;
  wisps: THREE.Mesh[];
  eyes: THREE.Mesh[];
  lastX: number;
  lastZ: number;
  facing: number;
}

interface DrifterFx {
  group: THREE.Group;
  body: THREE.MeshBasicMaterial;
  tail: THREE.Mesh[];
  lastX: number;
  lastZ: number;
  facing: number;
}

interface PulseFx {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
}

export interface World {
  update(game: Game, elapsed: number): void;
  pulse(x: number, y: number, z: number, radius: number): void;
  dispose(): void;
}

export function createWorld(scene: THREE.Scene, night: NightId): World {
  const root = new THREE.Group();
  scene.add(root);

  const rng = mulberry32(20261120 + night * 97);
  const glowWarm = makeGlowTexture('rgba(255,245,210,1)', 'rgba(255,170,80,0.55)');
  const glowViolet = makeGlowTexture('rgba(220,180,255,0.95)', 'rgba(120,60,200,0.45)');
  const glowPale = makeGlowTexture('rgba(240,244,255,0.9)', 'rgba(150,170,255,0.35)');
  const glowSea = makeGlowTexture('rgba(80,170,200,0.5)', 'rgba(40,100,130,0.22)');

  scene.background = SKY_DARK.clone();
  scene.fog = new THREE.FogExp2(FOG_DARK.getHex(), 0.009);

  const ambient = new THREE.AmbientLight(PALETTE.text, 0.3);
  root.add(ambient);
  const hemi = new THREE.HemisphereLight(0xaea8ee, 0x1a2430, 1.05);
  root.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xc6d0ff, 0.85);
  moonLight.position.set(-40, 70, -35);
  root.add(moonLight);

  // --- Sky ---
  const stars: THREE.Points[] = [];
  for (const layer of [
    { count: 560, radius: 210, size: 0.9, opacity: 0.72 },
    { count: 260, radius: 165, size: 1.4, opacity: 0.4 },
  ]) {
    const positions = new Float32Array(layer.count * 3);
    for (let i = 0; i < layer.count; i += 1) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.92);
      const r = layer.radius;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r + 20;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd6dcff,
      size: layer.size,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    root.add(points);
    stars.push(points);
  }

  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 18), new THREE.MeshBasicMaterial({ color: 0xf2f0ff }));
  moon.position.set(-95, 74, -150);
  root.add(moon);
  const moonHalo = glowSprite(glowPale, 0xffffff, 90, 0.28);
  moonHalo.position.copy(moon.position);
  root.add(moonHalo);

  // --- Terrain ---
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x2b3d48, emissive: 0x050a0d, emissiveIntensity: 0.6, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, emissive: 0x0a1814, emissiveIntensity: 0.8, roughness: 1 });
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });

  const addDisc = (x: number, z: number, radius: number, depth: number): void => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 2.5, depth, 72), soilMat);
    base.position.set(x, -depth / 2, z);
    root.add(base);
    const top = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.4, 72), grassMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, 0.012, z);
    root.add(top);
    const shore = new THREE.Mesh(new THREE.RingGeometry(radius - 1.6, radius, 72), sandMat);
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(x, 0.02, z);
    root.add(shore);
  };

  const addTrees = (cx: number, cz: number, radius: number, count: number, keepOut: number[][] = []): void => {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const r = 3 + rng() * (radius - 6);
      const x = cx + Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r;
      if (keepOut.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 3.4)) continue;
      const trunkHeight = 1.1 + rng() * 0.7;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, trunkHeight, 6), woodMat);
      trunk.position.y = trunkHeight / 2;
      tree.add(trunk);
      const foliageColor = new THREE.Color().setHSL(0.43 + rng() * 0.08, 0.34, 0.22 + rng() * 0.06);
      for (let layer = 0; layer < 3; layer += 1) {
        const size = 1.5 - layer * 0.35;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(size, 1.7, 7),
          new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 1, flatShading: true }),
        );
        cone.position.y = trunkHeight + layer * 0.85;
        tree.add(cone);
      }
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.55 + rng() * 0.35);
      root.add(tree);
    }
  };

  const addRocks = (cx: number, cz: number, radius: number, count: number): void => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.05;
      const r = radius - 0.4 + rng() * 1.4;
      const height = 0.6 + rng() * 2.1;
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(0.7 + rng() * 1.3, height, 5),
        new THREE.MeshStandardMaterial({ color: 0x324a57, roughness: 1, flatShading: true }),
      );
      rock.position.set(cx + Math.cos(angle) * r, height / 2 - 0.2, cz + Math.sin(angle) * r);
      rock.rotation.y = rng() * Math.PI;
      root.add(rock);
    }
  };

  const jumpPads: Array<{ x: number; y: number; z: number }> = [];
  const addJumpPad = (x: number, y: number, z: number): void => {
    jumpPads.push({ x, y, z });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1, 40),
      new THREE.MeshBasicMaterial({
        color: PALETTE.gold,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.06, z);
    root.add(ring);
    const glow = glowSprite(glowWarm, PALETTE.gold, 3.2, 0.5);
    glow.position.set(x, y + 0.5, z);
    root.add(glow);
  };

  if (night === 1) {
    addDisc(0, 0, MAP_LIMITS.night1Radius, 7);
    addRocks(0, 0, MAP_LIMITS.night1Radius, 64);
    addTrees(0, 0, MAP_LIMITS.night1Radius - 2, 34, [[0, 0], [0, 15], [14, 5], [-14, 5], [9, -12], [-9, -12]]);
  } else if (night === 2) {
    addDisc(0, 0, MAP_LIMITS.night2IslandRadius, 6);
    addDisc(MAP_LIMITS.night2IslandBCenterX, 0, MAP_LIMITS.night2IslandRadius, 6);
    addRocks(0, 0, MAP_LIMITS.night2IslandRadius, 46);
    addRocks(MAP_LIMITS.night2IslandBCenterX, 0, MAP_LIMITS.night2IslandRadius, 46);
    addTrees(0, 0, MAP_LIMITS.night2IslandRadius - 2, 24, [[0, 20], [17, -10], [-17, -10], [20, 18], [35, 0]]);
    addTrees(MAP_LIMITS.night2IslandBCenterX, 0, MAP_LIMITS.night2IslandRadius - 2, 24, [
      [70, 20],
      [87, -10],
      [53, -10],
      [50, -18],
      [35, 0],
    ]);

    // Bamboo bridge deck (no railings, per spec).
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.36, 4), woodMat);
    deck.position.set(35, -0.18, 0);
    root.add(deck);
    for (let i = 0; i < 18; i += 1) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.1, 4),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x7a5636 : 0x654329, roughness: 0.95 }),
      );
      slat.position.set(26.6 + i, 0.02, 0);
      root.add(slat);
    }
    addJumpPad(20, 0, 18);
    addJumpPad(50, 0, -18);
  } else {
    addDisc(0, 0, MAP_LIMITS.night3Radius, 7);
    addTrees(0, 0, MAP_LIMITS.night3Radius - 3, 42, [
      [0, 0], [0, 6], [18, 10], [-18, 10], [35, -10], [-35, -10], [20, -35], [-20, -35], [0, 13], [30, 25], [-30, 25],
    ]);
    addRocks(0, 0, MAP_LIMITS.night3Radius, 70);

    // Tier 1: half annulus on z > 0.
    const tierMat = new THREE.MeshStandardMaterial({ color: 0x3a6457, emissive: 0x0b1c17, emissiveIntensity: 0.9, roughness: 1 });
    const tierTop = new THREE.Mesh(new THREE.RingGeometry(12, 24, 96, 1, Math.PI, Math.PI), tierMat);
    tierTop.rotation.x = -Math.PI / 2;
    tierTop.position.y = 3.01;
    root.add(tierTop);
    const tierSideMat = new THREE.MeshStandardMaterial({ color: 0x3c6055, roughness: 1, side: THREE.DoubleSide });
    const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 3, 96, 1, true, -Math.PI / 2, Math.PI), tierSideMat);
    outerWall.position.y = 1.5;
    root.add(outerWall);
    const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 3, 64, 1, true, -Math.PI / 2, Math.PI), tierSideMat);
    innerWall.position.y = 1.5;
    root.add(innerWall);

    // Tier 2: central disc.
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 64), tierMat);
    tier2.position.y = 3;
    root.add(tier2);
    const tier2Top = new THREE.Mesh(new THREE.CircleGeometry(7.8, 64), new THREE.MeshStandardMaterial({ color: 0x2d554b, roughness: 1 }));
    tier2Top.rotation.x = -Math.PI / 2;
    tier2Top.position.y = 6.02;
    root.add(tier2Top);

    // Ramps at 30 and 150 degrees, 3 m wide, rising from r=30 to r=24.
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const group = new THREE.Group();
      group.position.set(Math.cos(a) * 27, 1.5, Math.sin(a) * 27);
      group.rotation.y = Math.PI / 2 - a;
      group.rotation.x = Math.atan(0.5);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 6.1), new THREE.MeshStandardMaterial({ color: 0x4a7060, roughness: 1 }));
      group.add(ramp);
      root.add(group);
    }

    // Bell tower.
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.3, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x9a7b58, roughness: 0.85 }),
    );
    tower.position.y = 10;
    root.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.7, 28), new THREE.MeshStandardMaterial({ color: 0x8a4a38, roughness: 0.8 }));
    roof.position.y = 14.6;
    root.add(roof);

    addJumpPad(0, 3, 13);
  }

  // --- Sea of clouds ---
  const cloudGroup = new THREE.Group();
  const cloudTexture = makeGlowTexture('rgba(170,198,225,0.5)', 'rgba(70,110,140,0.2)');
  const cloudRing = night === 2 ? 70 : 52;
  for (let i = 0; i < 100; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = cloudRing + rng() * 70;
    const sprite = glowSprite(cloudTexture, PALETTE.cloudSea, 22 + rng() * 30, 0.18 + rng() * 0.12);
    sprite.position.set(Math.cos(angle) * radius, -5 - rng() * 9, Math.sin(angle) * radius);
    cloudGroup.add(sprite);
  }
  if (night === 2) {
    for (let i = 0; i < 40; i += 1) {
      const sprite = glowSprite(glowSea, PALETTE.cloudSea, 16 + rng() * 22, 0.16);
      sprite.position.set(34 + (rng() - 0.5) * 26, -4 - rng() * 5, (rng() - 0.5) * 22);
      cloudGroup.add(sprite);
    }
  }
  root.add(cloudGroup);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshBasicMaterial({ color: PALETTE.cloudSea, transparent: true, opacity: 0.9 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = night === 2 ? -6.4 : -7.4;
  root.add(sea);

  // --- Player ---
  const player = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: PALETTE.robe, roughness: 0.85 });
  const robe = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.62, 6, 14), robeMat);
  robe.position.y = 0.86;
  player.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf1d4b2, roughness: 0.9 }));
  head.position.y = 1.43;
  player.add(head);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x2a1d18 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), faceMat);
    eye.position.set(side * 0.1, 1.45, 0.245);
    player.add(eye);
  }
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.66, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9b571, roughness: 0.95, flatShading: true }),
  );
  hat.position.y = 1.72;
  player.add(hat);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 18), new THREE.MeshStandardMaterial({ color: PALETTE.scarf, roughness: 0.9 }));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.26;
  player.add(scarf);
  const handLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.core, emissive: PALETTE.lit, emissiveIntensity: 2.4, roughness: 0.35 }),
  );
  handLantern.position.set(0.46, 1.06, 0.18);
  player.add(handLantern);
  const handGlow = glowSprite(glowWarm, PALETTE.lit, 1.9, 0.85);
  handGlow.position.copy(handLantern.position);
  player.add(handGlow);
  const playerLight = new THREE.PointLight(PALETTE.lit, 4.2, 10, 1.4);
  playerLight.position.set(0.5, 1.65, 0.55);
  player.add(playerLight);
  const playerFill = new THREE.PointLight(0xaab8ff, 2.4, 8, 1.6);
  playerFill.position.set(0, 1.9, -0.9);
  player.add(playerFill);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  player.add(shadow);
  root.add(player);

  // --- Dynamic entity containers ---
  const lanternFx = new Map<string, LanternFx>();
  const moteFx = new Map<string, MoteFx>();
  const shadeFx = new Map<string, ShadeFx>();
  const drifterFx = new Map<string, DrifterFx>();
  const charmFx = new Map<string, THREE.Group>();
  const moteGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const moteMat = new THREE.MeshStandardMaterial({
    color: PALETTE.moteCore,
    emissive: PALETTE.moteHalo,
    emissiveIntensity: 3.1,
    roughness: 0.3,
  });
  const shadeRoot = new THREE.Group();
  const drifterRoot = new THREE.Group();
  const charmRoot = new THREE.Group();
  root.add(shadeRoot, drifterRoot, charmRoot);
  const pulses: PulseFx[] = [];
  const pulseGeo = new THREE.RingGeometry(0.86, 1, 64);

  const buildLantern = (id: string, x: number, y: number, z: number, phase: number): void => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.1, 10), woodMat);
    pole.position.y = 2.05;
    group.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 12), woodMat);
    base.position.y = 0.15;
    group.add(base);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 12), woodMat);
    cap.position.y = 4.35;
    group.add(cap);
    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.9, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.7, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    cage.position.y = 3.75;
    group.add(cage);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.off,
      emissive: 0x2a2113,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), orbMaterial);
    orb.position.y = 3.75;
    group.add(orb);
    const light = new THREE.PointLight(PALETTE.lit, 0, 20, 2);
    light.position.y = 3.7;
    group.add(light);
    const halo = glowSprite(glowWarm, PALETTE.lit, 5.4, 0);
    halo.position.y = 3.75;
    group.add(halo);
    const offHalo = glowSprite(glowPale, 0x9aa4c8, 2.1, 0.32);
    offHalo.position.y = 3.75;
    group.add(offHalo);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 3.4, 15, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: PALETTE.lit,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 9;
    group.add(beam);
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.28, TUNING.safe_radius, 64),
      new THREE.MeshBasicMaterial({
        color: PALETTE.lit,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    group.add(aura);
    root.add(group);
    lanternFx.set(id, { group, orb, orbMaterial, light, halo, offHalo, beam, aura, phase });
  };

  // --- Wind leaves ---
  const windGroup = new THREE.Group();
  const leafMat = new THREE.MeshBasicMaterial({ color: 0xb9c79a, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 70; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), leafMat);
    leaf.userData.seed = [rng(), rng(), rng()];
    windGroup.add(leaf);
    leaves.push(leaf);
  }
  windGroup.visible = false;
  root.add(windGroup);

  let lastX = 0;
  let lastZ = 0;
  let facing = 0;
  let built = false;

  const syncLanterns = (game: Game): void => {
    for (const lantern of game.lanterns) {
      if (!lanternFx.has(lantern.id)) {
        buildLantern(lantern.id, lantern.x, lantern.y, lantern.z, rng() * Math.PI * 2);
      }
    }
  };

  return {
    update(game: Game, elapsed: number): void {
      syncLanterns(game);
      built = true;

      const litCount = game.lanterns.filter((l) => l.lit).length;
      const ratio = litCount / Math.max(1, game.lanterns.length);
      (scene.background as THREE.Color).copy(SKY_DARK).lerp(SKY_WARM, ratio);
      scene.fog!.color.copy(FOG_DARK).lerp(FOG_WARM, ratio);
      ambient.intensity = 0.15 + 0.55 * ratio;
      hemi.intensity = 1.0 + ratio * 0.4;
      moonLight.intensity = 0.8 + ratio * 0.35;

      // Player.
      player.position.set(game.px, game.py, game.pz);
      const dx = game.px - lastX;
      const dz = game.pz - lastZ;
      if (dx * dx + dz * dz > 1e-6) facing += shortestAngle(facing, Math.atan2(dx, dz)) * 0.25;
      lastX = game.px;
      lastZ = game.pz;
      player.rotation.y = facing;
      robe.position.y = 0.86 + Math.sin(elapsed * 9) * 0.025;
      handGlow.scale.setScalar(2.2 + Math.sin(elapsed * 6.3) * 0.2);
      playerLight.intensity = 4.2 + Math.sin(elapsed * 6.1) * 0.7;
      player.visible = game.invulnTicks > 0 ? Math.sin(elapsed * 40) > -0.2 || game.invulnTicks > 30 : true;

      // Lanterns + safe discs.
      for (const lantern of game.lanterns) {
        const fx = lanternFx.get(lantern.id);
        if (!fx) continue;
        const target = lantern.lit ? 1 : 0;
        fx.halo.material.opacity += (target * 0.95 - fx.halo.material.opacity) * 0.06;
        fx.offHalo.material.opacity += ((1 - target) * 0.28 - fx.offHalo.material.opacity) * 0.06;
        fx.halo.scale.setScalar(5.4 + Math.sin(elapsed * 3 + fx.phase) * 0.3 * target);
        fx.light.intensity += (target * (26 + Math.sin(elapsed * 2.6 + fx.phase) * 2.4) - fx.light.intensity) * 0.05;
        (fx.beam.material as THREE.MeshBasicMaterial).opacity += (target * 0.022 - (fx.beam.material as THREE.MeshBasicMaterial).opacity) * 0.05;
        (fx.aura.material as THREE.MeshBasicMaterial).opacity += (target * 0.55 - (fx.aura.material as THREE.MeshBasicMaterial).opacity) * 0.05;
        fx.orbMaterial.emissive.setHex(lantern.lit ? PALETTE.lit : 0x2a2113);
        fx.orbMaterial.emissiveIntensity += ((lantern.lit ? 3.4 : 0.3) - fx.orbMaterial.emissiveIntensity) * 0.06;
      }

      // Motes.
      const seen = new Set<string>();
      for (const mote of game.motes) {
        seen.add(mote.id);
        let fx = moteFx.get(mote.id);
        if (!fx) {
          const group = new THREE.Group();
          const core = new THREE.Mesh(moteGeo, moteMat);
          group.add(core);
          const halo = glowSprite(glowWarm, mote.kind === 'dropped' ? 0xc7e7ff : PALETTE.moteHalo, 1.5, 0.9);
          group.add(halo);
          root.add(group);
          fx = { group, halo, phase: (Number(mote.id.slice(1)) || 0) * 1.7 };
          moteFx.set(mote.id, fx);
        }
        const bob = mote.y + 0.85 + Math.sin(elapsed * 1.9 + fx.phase) * 0.16;
        fx.group.position.set(mote.x, bob, mote.z);
        fx.group.rotation.y = elapsed * 1.4 + fx.phase;
        fx.halo.scale.setScalar(mote.kind === 'dropped' ? 1.15 : 1.5);
      }
      for (const [id, fx] of moteFx) {
        if (seen.has(id)) continue;
        root.remove(fx.group);
        moteFx.delete(id);
      }

      // Shades.
      const shadeSeen = new Set<string>();
      for (const shade of game.shades) {
        shadeSeen.add(shade.id);
        let fx = shadeFx.get(shade.id);
        if (!fx) {
          const group = new THREE.Group();
          const coreMat = new THREE.MeshStandardMaterial({
            color: PALETTE.shade,
            emissive: PALETTE.shadeRim,
            emissiveIntensity: 0.55,
            roughness: 0.65,
            transparent: true,
            opacity: 0.94,
          });
          const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), coreMat);
          core.scale.y = 0.8;
          group.add(core);
          group.add(glowSprite(glowViolet, PALETTE.shadeRim, 3.2, 0.5));
          const eyes: THREE.Mesh[] = [];
          const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8a6ff });
          for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
            eye.position.set(side * 0.18, 0.12, 0.5);
            group.add(eye);
            eyes.push(eye);
          }
          const wisps: THREE.Mesh[] = [];
          const wispMat = new THREE.MeshBasicMaterial({
            color: PALETTE.shadeRim,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          for (let i = 0; i < 4; i += 1) {
            const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), wispMat);
            group.add(wisp);
            wisps.push(wisp);
          }
          shadeRoot.add(group);
          fx = { group, core: coreMat, wisps, eyes, lastX: shade.x, lastZ: shade.z, facing: 0 };
          shadeFx.set(shade.id, fx);
        }
        const stunned = shade.state === 'stunned';
        const spawning = shade.state === 'spawning';
        const phase = Number(shade.id.slice(1)) || 0;
        const bob = Math.sin(elapsed * 2.4 + phase) * 0.12;
        fx.group.position.set(shade.x, shade.y + bob, shade.z);
        const mx = shade.x - fx.lastX;
        const mz = shade.z - fx.lastZ;
        if (mx * mx + mz * mz > 1e-6) fx.facing += shortestAngle(fx.facing, Math.atan2(mx, mz)) * 0.2;
        fx.group.rotation.y = fx.facing;
        fx.lastX = shade.x;
        fx.lastZ = shade.z;
        fx.core.emissive.setHex(stunned ? PALETTE.shadeStun : PALETTE.shadeRim);
        fx.core.opacity = spawning ? 0.35 : stunned ? 0.6 : 0.94;
        fx.group.scale.setScalar(spawning ? 0.5 + 0.5 * (1 - shade.stateTicksLeft / PHYSICS.shade_spawning_ticks) : stunned ? 0.86 : 1);
        fx.eyes.forEach((eye) => {
          (eye.material as THREE.MeshBasicMaterial).opacity = spawning ? 0.2 : 1;
        });
        fx.wisps.forEach((wisp, i) => {
          const angle = elapsed * (stunned ? 0.6 : 2.1) + (i / fx!.wisps.length) * Math.PI * 2;
          const radius = stunned ? 0.55 : 0.95;
          wisp.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.35, Math.sin(angle) * radius);
        });
      }
      for (const [id, fx] of shadeFx) {
        if (shadeSeen.has(id)) continue;
        shadeRoot.remove(fx.group);
        shadeFx.delete(id);
      }

      // Drifters.
      const drifterSeen = new Set<string>();
      for (const drifter of game.drifters) {
        drifterSeen.add(drifter.id);
        let fx = drifterFx.get(drifter.id);
        if (!fx) {
          const group = new THREE.Group();
          const body = new THREE.MeshBasicMaterial({
            color: PALETTE.drifter,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
          });
          const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), body);
          ribbon.rotation.x = -Math.PI / 2;
          group.add(ribbon);
          const tail: THREE.Mesh[] = [];
          const tailMat = new THREE.MeshBasicMaterial({
            color: PALETTE.drifter,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          });
          for (let i = 0; i < 3; i += 1) {
            const piece = new THREE.Mesh(new THREE.PlaneGeometry(1.1 - i * 0.2, 0.3), tailMat);
            piece.rotation.x = -Math.PI / 2;
            group.add(piece);
            tail.push(piece);
          }
          group.add(glowSprite(glowPale, PALETTE.drifter, 2.4, 0.4));
          drifterRoot.add(group);
          fx = { group, body, tail, lastX: drifter.x, lastZ: drifter.z, facing: 0 };
          drifterFx.set(drifter.id, fx);
        }
        const mx = drifter.x - fx.lastX;
        const mz = drifter.z - fx.lastZ;
        if (mx * mx + mz * mz > 1e-6) fx.facing += shortestAngle(fx.facing, Math.atan2(mx, mz)) * 0.25;
        fx.lastX = drifter.x;
        fx.lastZ = drifter.z;
        fx.group.position.set(drifter.x, drifter.y + Math.sin(elapsed * 3 + 1) * 0.12, drifter.z);
        fx.group.rotation.y = fx.facing;
        const visible = drifter.state !== 'removed';
        fx.group.visible = visible;
        fx.body.opacity = drifter.state === 'flee' ? 0.45 : 0.8;
        fx.tail.forEach((piece, i) => {
          piece.position.set(0, -0.05 - i * 0.05, 0.8 + i * 0.5);
          piece.rotation.z = Math.sin(elapsed * 4 + i) * 0.25;
        });
      }
      for (const [id, fx] of drifterFx) {
        if (drifterSeen.has(id)) continue;
        drifterRoot.remove(fx.group);
        drifterFx.delete(id);
      }

      // Charms.
      const charmSeen = new Set<string>();
      for (const charm of game.charms) {
        charmSeen.add(charm.id);
        let group = charmFx.get(charm.id);
        if (!group) {
          group = new THREE.Group();
          const paper = new THREE.Mesh(
            new THREE.PlaneGeometry(0.55, 0.8),
            new THREE.MeshBasicMaterial({ color: PALETTE.scarf, side: THREE.DoubleSide }),
          );
          group.add(paper);
          const border = new THREE.Mesh(
            new THREE.PlaneGeometry(0.65, 0.9),
            new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide }),
          );
          border.position.z = -0.01;
          group.add(border);
          group.add(glowSprite(glowWarm, PALETTE.gold, 2.2, 0.55));
          charmRoot.add(group);
          charmFx.set(charm.id, group);
        }
        group.visible = charm.available;
        group.position.set(charm.x, charm.y + 1 + Math.sin(elapsed * 2.2) * 0.12, charm.z);
        group.rotation.y = elapsed * 1.1;
      }
      for (const [id, group] of charmFx) {
        if (charmSeen.has(id)) continue;
        charmRoot.remove(group);
        charmFx.delete(id);
      }

      // Wind (leaves also warn two seconds before a gust).
      windGroup.visible = game.wind.active || game.windWarning;
      leafMat.opacity = game.wind.active ? 0.75 : 0.3;
      if (game.wind.active || game.windWarning) {
        const speed = game.wind.active ? 4.5 : 1.2;
        const dir = (game.wind.dirDeg * Math.PI) / 180;
        const vx = Math.cos(dir);
        const vz = Math.sin(dir);
        leaves.forEach((leaf) => {
          const [sx, sy, sz] = leaf.userData.seed as [number, number, number];
          const travel = (elapsed * (speed + sy * 3) + sx * 60) % 60;
          const side = (sy - 0.5) * 30;
          leaf.position.set(
            game.px - vx * 30 + vx * travel - vz * side,
            game.py + 1 + sy * 5 + Math.sin(elapsed * 3 + sx * 8) * 0.6,
            game.pz - vz * 30 + vz * travel + vx * side,
          );
          leaf.rotation.set(elapsed * 4 + sx * 6, elapsed * 3 + sy * 4, sz * Math.PI);
        });
      }

      // Pulse rings.
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const pulse = pulses[i]!;
        pulse.age += 1 / 60;
        const life = 0.55;
        const t = pulse.age / life;
        if (t >= 1) {
          root.remove(pulse.mesh);
          pulse.mesh.geometry.dispose();
          pulse.material.dispose();
          pulses.splice(i, 1);
          continue;
        }
        pulse.mesh.scale.setScalar(0.6 + t * 10);
        pulse.material.opacity = 0.85 * (1 - t);
      }

      // Jump pad pulse.
      void jumpPads;

      cloudGroup.rotation.y = elapsed * 0.006;
      for (const points of stars) points.rotation.y = elapsed * 0.002;
      void built;
    },

    pulse(x: number, y: number, z: number, radius: number): void {
      const material = new THREE.MeshBasicMaterial({
        color: PALETTE.lit,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(pulseGeo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(radius / 5);
      root.add(mesh);
      pulses.push({ mesh, material, age: 0 });
    },

    dispose(): void {
      scene.remove(root);
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      glowWarm.dispose();
      glowViolet.dispose();
      glowPale.dispose();
      glowSea.dispose();
      cloudTexture.dispose();
      if (scene.background instanceof THREE.Color) scene.background = null;
      scene.fog = null;
    },
  };
}
