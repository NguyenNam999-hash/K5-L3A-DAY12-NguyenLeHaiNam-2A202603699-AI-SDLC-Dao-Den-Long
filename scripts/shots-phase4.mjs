/**
 * Captures Phase 4 UI screenshots with Playwright.
 *
 * Usage: npx vite --port 5173   (in one terminal)
 *        node scripts/shots-phase4.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5173';
const outDir = join('evidence', 'phase-4', 'ui');
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
  if (message.type() !== 'error') return;
  // The dev server has no /api/leaderboard; the client falls back to localStorage by design.
  if (message.text().includes('Failed to load resource')) return;
  errors.push(message.text());
});

await page.goto(`${BASE}/?seed=7`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '01-menu.png') });

await page.click('#menu-settings-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '02-settings.png') });
await page.click('#large-text-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '03-settings-large-text.png') });
await page.click('#large-text-btn');

const jumpBtn = page.locator('button[aria-label="Đổi phím Nhảy"]');
await jumpBtn.click();
await page.keyboard.press('KeyW');
await page.waitForTimeout(150);
await page.screenshot({ path: join(outDir, '05-keybind-conflict.png') });
await jumpBtn.click();
await page.keyboard.press('KeyJ');
await page.waitForTimeout(150);
await page.screenshot({ path: join(outDir, '06-keybind-settings.png') });
await page.locator('#keybinds-reset').click();
await page.click('#settings-back');
await page.waitForTimeout(200);

await page.click('#leaderboard-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '07-leaderboard-empty.png') });
await page.click('#leaderboard-back');

await page.click('#campaign-btn');
await page.waitForTimeout(300);
await page.click('#intro-btn');
await page.waitForTimeout(700);
await page.evaluate(() => {
  const game = window.__dao.game();
  game.windWarning = true;
  const lantern = game.lanterns[3];
  lantern.lit = true;
  lantern.everLit = true;
  lantern.fuel60 = 600;
});
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '04-hud-alerts.png') });

await page.evaluate(() => {
  const game = window.__dao.game();
  game.flames = 0;
  game.state = 'lost';
});
await page.waitForTimeout(1300);
await page.fill('#player-name', 'May_01');
await page.click('#save-score-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '08-result-score-form.png') });

await page.click('#to-menu-btn');
await page.click('#leaderboard-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '09-leaderboard.png') });

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`captured 9 screenshots in ${outDir}`);
}
await browser.close();
