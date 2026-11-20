import * as THREE from 'three';
import type { Game } from '../core/game';
import { ISLAND_RADIUS, TUNING } from '../core/tuning';

const SKY_DARK = new THREE.Color(0x080714);
const SKY_WARM = new THREE.Color(0x1c1226);
const FOG_DARK = new THREE.Color(0x0b0a18);
const FOG_WARM = new THREE.Color(0x2a1b26);

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

interface LanternFx {
  group: THREE.Group;
  orb: THREE.Mesh;
  orbMaterial: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  halo: THREE.Sprite;
  beam: THREE.Mesh;
  aura: THREE.Mesh;
  phase: number;
}

interface MoteFx {
  group: THREE.Group;
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

interface PulseFx {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
}

export interface World {
  update(game: Game, elapsed: number): void;
  pulse(x: number, z: number): void;
}

export function createWorld(scene: THREE.Scene): World {
  const glowWarm = makeGlowTexture('rgba(255,245,210,1)', 'rgba(255,170,80,0.55)');
  const glowViolet = makeGlowTexture('rgba(220,180,255,0.95)', 'rgba(120,60,200,0.45)');
  const glowPale = makeGlowTexture('rgba(240,244,255,0.9)', 'rgba(150,170,255,0.35)');
  const rng = mulberry32(20261120);

  scene.background = SKY_DARK.clone();
  scene.fog = new THREE.FogExp2(FOG_DARK.getHex(), 0.0105);

  const hemi = new THREE.HemisphereLight(0xaea8ee, 0x10182a, 0.95);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xc6d0ff, 0.55);
  moonLight.position.set(-40, 70, -35);
  scene.add(moonLight);

  // --- Sky ---
  const stars: THREE.Points[] = [];
  for (const layer of [
    { count: 620, radius: 190, size: 0.85, opacity: 0.75 },
    { count: 300, radius: 150, size: 1.35, opacity: 0.45 },
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
    scene.add(points);
    stars.push(points);
  }

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xf2f0ff }),
  );
  moon.position.set(-95, 74, -150);
  scene.add(moon);
  const moonHalo = glowSprite(glowPale, 0xffffff, 90, 0.28);
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  // --- Island ---
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 3, 7, 72),
    new THREE.MeshStandardMaterial({ color: 0x1d2b34, roughness: 1, metalness: 0 }),
  );
  island.position.y = -3.5;
  scene.add(island);

  const meadow = new THREE.Mesh(
    new THREE.CircleGeometry(ISLAND_RADIUS - 0.6, 72),
    new THREE.MeshStandardMaterial({ color: 0x27403c, roughness: 1 }),
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = 0.01;
  scene.add(meadow);

  const pathRing = new THREE.Mesh(
    new THREE.RingGeometry(14.4, 15.9, 96),
    new THREE.MeshStandardMaterial({ color: 0x3d5247, roughness: 1, transparent: true, opacity: 0.85 }),
  );
  pathRing.rotation.x = -Math.PI / 2;
  pathRing.position.y = 0.02;
  scene.add(pathRing);

  // Rocks along the shore.
  for (let i = 0; i < 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2 + rng() * 0.05;
    const radius = ISLAND_RADIUS - 0.4 + rng() * 1.8;
    const height = 0.7 + rng() * 2.4;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(0.7 + rng() * 1.5, height, 5),
      new THREE.MeshStandardMaterial({ color: 0x22323b, roughness: 1, flatShading: true }),
    );
    rock.position.set(Math.cos(angle) * radius, height / 2 - 0.2, Math.sin(angle) * radius);
    rock.rotation.y = rng() * Math.PI;
    scene.add(rock);
  }

  // Pine-ish trees.
  for (let i = 0; i < 30; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 13 + rng() * 18;
    // Keep the lantern ring and the starting clearing walkable.
    if (radius > 13 && radius < 18.5) continue;
    const trunkHeight = 1.1 + rng() * 0.7;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, trunkHeight, 6),
      new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 1 }),
    );
    trunk.position.y = trunkHeight / 2;
    tree.add(trunk);
    const foliageColor = new THREE.Color().setHSL(0.45 + rng() * 0.08, 0.32, 0.17 + rng() * 0.06);
    for (let layer = 0; layer < 3; layer += 1) {
      const size = 1.5 - layer * 0.35;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(size, 1.7, 7),
        new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 1, flatShading: true }),
      );
      cone.position.y = trunkHeight + layer * 0.85;
      tree.add(cone);
    }
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.scale.setScalar(0.6 + rng() * 0.35);
    scene.add(tree);
  }

  // Sea of clouds below the island.
  const cloudGroup = new THREE.Group();
  const cloudTexture = makeGlowTexture('rgba(190,198,235,0.55)', 'rgba(120,130,190,0.22)');
  for (let i = 0; i < 90; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 32 + rng() * 70;
    const sprite = glowSprite(cloudTexture, 0x9aa4d8, 22 + rng() * 30, 0.14 + rng() * 0.12);
    sprite.position.set(Math.cos(angle) * radius, -4 - rng() * 9, Math.sin(angle) * radius);
    cloudGroup.add(sprite);
  }
  scene.add(cloudGroup);

  // --- Player: Mây with a conical hat and a tiny lantern ---
  const player = new THREE.Group();
  const robe = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.62, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0xf4e6cf, roughness: 0.85 }),
  );
  robe.position.y = 0.86;
  player.add(robe);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xf1d4b2, roughness: 0.9 }),
  );
  head.position.y = 1.43;
  player.add(head);
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.66, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9b571, roughness: 0.95, flatShading: true }),
  );
  hat.position.y = 1.72;
  player.add(hat);
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.07, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xc45c4a, roughness: 0.9 }),
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.26;
  player.add(scarf);

  const handLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffd9a0,
      emissive: 0xffa94d,
      emissiveIntensity: 2.4,
      roughness: 0.35,
    }),
  );
  handLantern.position.set(0.46, 1.06, 0.18);
  player.add(handLantern);
  const handGlow = glowSprite(glowWarm, 0xffb066, 1.9, 0.85);
  handGlow.position.copy(handLantern.position);
  player.add(handGlow);
  const playerLight = new THREE.PointLight(0xffc07a, 4.2, 10, 1.4);
  playerLight.position.set(0.5, 1.65, 0.55);
  player.add(playerLight);
  // Cool rim light so Mây reads against the dark ground from behind.
  const playerFill = new THREE.PointLight(0xaab8ff, 2.6, 8, 1.6);
  playerFill.position.set(0, 1.9, -0.9);
  player.add(playerFill);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  player.add(shadow);

  scene.add(player);

  // --- Lanterns ---
  const lanternFx = new Map<string, LanternFx>();
  const buildLantern = (id: string, x: number, z: number, phase: number): void => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2c33, roughness: 0.9 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 4.1, 10), wood);
    pole.position.y = 2.05;
    group.add(pole);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 12), wood);
    base.position.y = 0.15;
    group.add(base);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 12), wood);
    cap.position.y = 4.35;
    group.add(cap);

    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.9, 12, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x6b4a2c,
        roughness: 0.7,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    cage.position.y = 3.75;
    group.add(cage);

    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3226,
      emissive: 0x2a2113,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), orbMaterial);
    orb.position.y = 3.75;
    group.add(orb);

    const light = new THREE.PointLight(0xffb066, 0, 20, 2);
    light.position.y = 3.7;
    group.add(light);

    const halo = glowSprite(glowWarm, 0xffc07a, 5.4, 0);
    halo.position.y = 3.75;
    group.add(halo);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 3.4, 15, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffb066,
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
      new THREE.CircleGeometry(TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffb066,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    group.add(aura);

    scene.add(group);
    lanternFx.set(id, { group, orb, orbMaterial, light, halo, beam, aura, phase });
  };

  // Lanterns are created from the live game so the renderer and core never disagree.
  // The ids/positions come from the core at first update; see syncLanterns.

  // --- Motes ---
  const moteFx = new Map<string, MoteFx>();
  const moteGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const moteMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c8,
    emissive: 0xffd479,
    emissiveIntensity: 3.2,
    roughness: 0.3,
  });
  const moteGroupRoot = new THREE.Group();
  scene.add(moteGroupRoot);

  // --- Shades ---
  const shadeFx = new Map<string, ShadeFx>();
  const shadeRoot = new THREE.Group();
  scene.add(shadeRoot);

  // --- Pulse rings ---
  const pulses: PulseFx[] = [];
  const pulseGeo = new THREE.RingGeometry(0.86, 1, 64);

  const syncLanterns = (game: Game): void => {
    for (const lantern of game.lanterns) {
      if (!lanternFx.has(lantern.id)) buildLantern(lantern.id, lantern.x, lantern.z, rng() * Math.PI * 2);
    }
  };

  let lastX = 0;
  let lastZ = 0;
  let facing = 0;

  return {
    update(game: Game, elapsed: number): void {
      syncLanterns(game);

      const litCount = game.lanterns.filter((l) => l.lit).length;
      const ratio = litCount / Math.max(1, game.lanterns.length);

      (scene.background as THREE.Color).copy(SKY_DARK).lerp(SKY_WARM, ratio);
      scene.fog!.color.copy(FOG_DARK).lerp(FOG_WARM, ratio);
      hemi.intensity = 0.95 + ratio * 0.55;
      moonLight.intensity = 0.55 + ratio * 0.3;

      // Player.
      player.position.set(game.px, game.py, game.pz);
      const dx = game.px - lastX;
      const dz = game.pz - lastZ;
      if (dx * dx + dz * dz > 1e-6) {
        facing += shortestAngle(facing, Math.atan2(dx, dz)) * 0.25;
      }
      lastX = game.px;
      lastZ = game.pz;
      player.rotation.y = facing;
      robe.position.y = 0.86 + Math.sin(elapsed * 9) * 0.025;
      handGlow.scale.setScalar(2.2 + Math.sin(elapsed * 6.3) * 0.2);
      playerLight.intensity = 4.2 + Math.sin(elapsed * 6.1) * 0.7;

      if (game.invuln > 0) {
        const flicker = Math.sin(elapsed * 40) > 0 ? 0.45 : 1;
        player.visible = flicker > 0.5 || game.invuln < 0.5;
      } else {
        player.visible = true;
      }

      for (const lantern of game.lanterns) {
        const fx = lanternFx.get(lantern.id);
        if (!fx) continue;
        fx.group.position.set(lantern.x, 0, lantern.z);
        const target = lantern.lit ? 1 : 0;
        fx.halo.material.opacity += (target * 0.85 - fx.halo.material.opacity) * 0.06;
        fx.halo.scale.setScalar(5.4 + Math.sin(elapsed * 3 + fx.phase) * 0.3 * target);
        fx.light.intensity += (target * (26 + Math.sin(elapsed * 2.6 + fx.phase) * 2.4) - fx.light.intensity) * 0.05;
        (fx.beam.material as THREE.MeshBasicMaterial).opacity += (target * 0.022 - (fx.beam.material as THREE.MeshBasicMaterial).opacity) * 0.05;
        (fx.aura.material as THREE.MeshBasicMaterial).opacity += (target * 0.1 - (fx.aura.material as THREE.MeshBasicMaterial).opacity) * 0.05;
        fx.orbMaterial.emissive.setHex(lantern.lit ? 0xffb257 : 0x2a2113);
        fx.orbMaterial.emissiveIntensity += ((lantern.lit ? 3.4 : 0.3) - fx.orbMaterial.emissiveIntensity) * 0.06;
      }

      // Motes.
      const seen = new Set<string>();
      for (const mote of game.motes) {
        seen.add(mote.id);
        let fx = moteFx.get(mote.id);
        if (!fx) {
          const group = new THREE.Group();
          group.add(new THREE.Mesh(moteGeo, moteMat));
          const halo = glowSprite(glowWarm, 0xffd88a, 1.5, 0.9);
          group.add(halo);
          moteGroupRoot.add(group);
          fx = { group, phase: (Number(mote.id.slice(1)) || 0) * 1.7 };
          moteFx.set(mote.id, fx);
        }
        const bob = 0.95 + Math.sin(elapsed * 1.9 + fx.phase) * 0.16;
        fx.group.position.set(mote.x, bob, mote.z);
        fx.group.rotation.y = elapsed * 1.4 + fx.phase;
      }
      for (const [id, fx] of moteFx) {
        if (seen.has(id)) continue;
        moteGroupRoot.remove(fx.group);
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
            color: 0x150b22,
            emissive: 0x4a1f7a,
            emissiveIntensity: 0.55,
            roughness: 0.65,
            transparent: true,
            opacity: 0.94,
          });
          const core = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), coreMat);
          core.scale.y = 0.8;
          group.add(core);
          const halo = glowSprite(glowViolet, 0x9a5bff, 3.2, 0.5);
          group.add(halo);
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
            color: 0x9a5bff,
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
        const phase = Number(shade.id.slice(1)) || 0;
        const bob = Math.sin(elapsed * 2.4 + phase) * 0.12;
        fx.group.position.set(shade.x, 1 + bob, shade.z);
        const mx = shade.x - fx.lastX;
        const mz = shade.z - fx.lastZ;
        if (mx * mx + mz * mz > 1e-6) fx.facing += shortestAngle(fx.facing, Math.atan2(mx, mz)) * 0.2;
        fx.group.rotation.y = fx.facing;
        fx.lastX = shade.x;
        fx.lastZ = shade.z;
        fx.core.emissive.setHex(stunned ? 0x7a5ad6 : 0x4a1f7a);
        fx.core.opacity = stunned ? 0.6 : 0.94;
        fx.group.scale.setScalar(stunned ? 0.86 : 1);
        const wispsRef = fx.wisps;
        wispsRef.forEach((wisp, i) => {
          const angle = elapsed * (stunned ? 0.6 : 2.1) + (i / wispsRef.length) * Math.PI * 2;
          const radius = stunned ? 0.55 : 0.95;
          wisp.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.35, Math.sin(angle) * radius);
        });
      }
      for (const [id, fx] of shadeFx) {
        if (shadeSeen.has(id)) continue;
        shadeRoot.remove(fx.group);
        shadeFx.delete(id);
      }

      // Pulse rings.
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const pulse = pulses[i]!;
        pulse.age += 1 / 60;
        const life = 0.55;
        const t = pulse.age / life;
        if (t >= 1) {
          scene.remove(pulse.mesh);
          pulse.mesh.geometry.dispose();
          pulse.material.dispose();
          pulses.splice(i, 1);
          continue;
        }
        pulse.mesh.scale.setScalar(0.6 + t * TUNING.pulse_radius);
        pulse.material.opacity = 0.85 * (1 - t);
      }

      // Ambience.
      cloudGroup.rotation.y = elapsed * 0.006;
      for (const points of stars) points.rotation.y = elapsed * 0.002;
    },
    pulse(x: number, z: number): void {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffcf8a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(pulseGeo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.25, z);
      scene.add(mesh);
      pulses.push({ mesh, material, age: 0 });
    },
  };
}
