/**
 * Captures UI screenshots with Playwright against the Vite dev server.
 *
 * Usage: npm run dev   (in one terminal)
 *        node scripts/shots.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir = join('evidence', 'phase-1', 'ui');
mkdirSync(outDir, { recursive: true });

// Reuse a cached Chromium if the bundled revision is not downloaded (offline-friendly).
const cached = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const browser = await chromium.launch(existsSync(cached) ? { executablePath: cached } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

await page.goto('http://localhost:5173/?seed=7', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(outDir, '01-start.png') });

await page.click('#start-btn');
await page.waitForTimeout(500);
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
writeFileSync(join(outDir, 'fps.txt'), `measured requestAnimationFrame rate: ~${fps} fps (1440x900, Chromium headless)\n`);
console.log(`fps: ${fps}`);
await page.waitForTimeout(700);
await page.keyboard.down('w');
await page.waitForTimeout(2200);
await page.keyboard.up('w');
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '02-gameplay.png') });

// Pose a mid-night state: three lanterns lit, Mây carrying light, a shade nearby.
await page.evaluate(() => {
  const game = window.__dao.game();
  for (const lantern of game.lanterns) {
    if (['L1', 'L2', 'L3'].includes(lantern.id)) {
      lantern.lit = true;
      lantern.deposited = 3;
    }
  }
  game.carried = 4;
  game.flames = 2;
  game.score = 640;
  game.shades = [{ id: 'S9', x: game.px + 4.5, z: game.pz + 3, state: 'chase', stunTimer: 0 }];
});
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '03-lit-lanterns.png') });

// Pose the win overlay.
await page.evaluate(() => {
  const game = window.__dao.game();
  for (const lantern of game.lanterns) {
    lantern.lit = true;
    lantern.deposited = 3;
  }
  game.stats.lanterns = 5;
  game.stats.motes = 18;
  game.flames = 2;
  game.score = 1580;
  game.timeLeft = () => 96;
  game.finish('won', 'all_lit');
});
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '04-win-overlay.png') });

console.log(errors.length === 0 ? 'SHOTS OK, no page errors' : `page errors:\n${errors.join('\n')}`);
await browser.close();
if (errors.length > 0) process.exit(1);
