/**
 * Captures Phase 2 UI screenshots with Playwright against the Vite dev server.
 *
 * Usage: npx vite --port 5173   (in one terminal)
 *        node scripts/shots.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir = join('evidence', 'phase-2', 'ui');
mkdirSync(outDir, { recursive: true });

const cached = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const browser = await chromium.launch(existsSync(cached) ? { executablePath: cached } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

await page.goto('http://localhost:5173/?seed=7', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '01-menu.png') });

await page.click('#campaign-btn');
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '02-intro-night1.png') });

await page.click('#intro-btn');
await page.waitForTimeout(900);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve(Math.round((frames * 1000) / (performance.now() - start)));
      };
      requestAnimationFrame(tick);
    }),
);
writeFileSync(
  join(outDir, 'fps.txt'),
  `measured requestAnimationFrame rate: ~${fps} fps (1280x720, Chromium headless)\n`,
);
console.log(`fps: ${fps}`);

await page.keyboard.down('w');
await page.waitForTimeout(1600);
await page.keyboard.up('w');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '03-night1.png') });

// Pose a mid-night state: three lanterns lit, Mây carrying light, a shade nearby.
await page.evaluate(() => {
  const game = window.__dao.game();
  for (const lantern of game.lanterns) {
    if (['L1', 'L2', 'L3'].includes(lantern.id)) {
      lantern.lit = true;
      lantern.deposited = 10;
    }
  }
  game.carried = 7;
  game.flames = 2;
  game.score = 640;
  game.invulnTicks = 0;
  game.motes = [
    { id: 'M901', x: game.px + 2.5, y: game.py, z: game.pz + 1.4, kind: 'random', ttlTicks: null, pickupDelayTicks: 0 },
    { id: 'M902', x: game.px - 3.4, y: game.py, z: game.pz - 1.1, kind: 'dropped', ttlTicks: 480, pickupDelayTicks: 0 },
  ];
  game.shades = [
    {
      id: 'S9',
      x: game.px + 5.5,
      y: game.py + 1,
      z: game.pz + 4,
      state: 'chase',
      stateTicksLeft: 0,
      safeTicks: 0,
      vx: 0,
      vz: 0,
      pushTicksLeft: 0,
    },
  ];
  game.drifters = [];
});
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '04-night1-lit.png') });

// Pause freezes tick, then settings.
await page.keyboard.press('p');
await page.waitForTimeout(350);
await page.screenshot({ path: join(outDir, '05-pause.png') });
const tickBefore = await page.evaluate(() => window.__dao.game().tick);
await page.waitForTimeout(600);
const tickAfter = await page.evaluate(() => window.__dao.game().tick);
console.log(`pause: ticks ${tickBefore} -> ${tickAfter} (should be equal)`);
await page.click('#pause-settings-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '06-settings.png') });
await page.click('[data-difficulty="hard"]');
await page.waitForTimeout(250);
await page.screenshot({ path: join(outDir, '07-settings-hard.png') });
await page.click('#settings-back');
await page.waitForTimeout(250);
await page.click('#resume-btn');
await page.waitForTimeout(350);

// Night 2, bridge and jump pad.
await page.evaluate(() => window.__dao.startNight(2));
await page.waitForTimeout(700);
await page.evaluate(() => {
  const game = window.__dao.game();
  game.px = 30;
  game.py = 0;
  game.pz = 0;
  game.carried = 6;
  game.flames = 3;
  game.lanterns[3].lit = true;
  game.lanterns[4].lit = true;
  game.drifters = [
    { id: 'D1', x: 37, y: 1.6, z: 2.5, state: 'chase', stolen: 0, stateTicksLeft: 0, vx: 0, vz: 0 },
  ];
  window.__dao.setView(90, 0.34);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '08-night2-bridge.png') });

await page.evaluate(() => {
  const game = window.__dao.game();
  game.px = 20;
  game.py = 0;
  game.pz = 18;
  window.__dao.setView(200, 0.5);
});
await page.waitForTimeout(900);
await page.screenshot({ path: join(outDir, '08b-night2-pad.png') });

// Night 3, tiers, tower and wind.
await page.evaluate(() => window.__dao.startNight(3));
await page.waitForTimeout(700);
await page.evaluate(() => {
  const game = window.__dao.game();
  game.px = 0;
  game.py = 0;
  game.pz = 34;
  game.carried = 8;
  game.charmTicks = 420;
  game.lanterns[0].lit = true;
  game.lanterns[1].lit = true;
  game.lanterns[3].lit = true;
  game.wind = { active: true, dirDeg: 120 };
  window.__dao.setView(180, 0.3);
  game.shades = [
    {
      id: 'S3',
      x: 5,
      y: 1,
      z: 22,
      state: 'stunned',
      stateTicksLeft: 100,
      safeTicks: 0,
      vx: 0,
      vz: 0,
      pushTicksLeft: 0,
    },
  ];
});
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '09-night3.png') });

await page.evaluate(() => window.__dao.sunrise(2860));
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, '10-sunrise.png') });

console.log(errors.length === 0 ? 'SHOTS OK, no page errors' : `page errors:\n${errors.join('\n')}`);
await browser.close();
if (errors.length > 0) process.exit(1);
