/**
 * Records the Phase 4 demo (docs/demo/demo.mp4) with Playwright + ffmpeg.
 *
 * Usage: npm run build && node scripts/demo.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const TMP = resolve('.demo-tmp');
const OUT_DIR = resolve('docs/demo');
const OUT = join(OUT_DIR, 'demo.mp4');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html missing: run npm run build first');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
  let file = resolve(DIST, `.${pathname}`);
  if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }
  if (!existsSync(file) || pathname.endsWith('/')) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const cached = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const browser = await chromium.launch(existsSync(cached) ? { executablePath: cached } : {});

async function record(name, run) {
  const dir = join(TMP, name);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await run(page);
  await context.close();
  const file = readdirSync(dir).find((f) => f.endsWith('.webm'));
  if (!file) throw new Error(`no video recorded for ${name}`);
  return join(dir, file);
}

const CARD = (title, lines) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#0b1024;color:#f5f1e6;font-family:system-ui,sans-serif;display:grid;place-items:center}
  .wrap{max-width:900px;text-align:center}
  h1{font-size:56px;margin:0 0 18px;color:#ffb347}
  p{font-size:24px;line-height:1.6;margin:6px 0;color:#d8d4c8}
  .tag{letter-spacing:.28em;font-size:16px;color:#8f96b8;text-transform:uppercase}
</style></head><body><div class="wrap"><p class="tag">Đảo Đèn Lồng · Phase 4</p><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}</div></body></html>`;

const clips = [];

clips.push(
  await record('01-title', async (page) => {
    await page.setContent(
      CARD('Bình minh · v1.0.0', [
        '134 unit test · 35 kiểm tra contract',
        'benchmark 217.95 fps · soak 10 Đêm, 0 crash',
        'đổi phím · phụ đề · chữ lớn · bảng xếp hạng',
      ]),
    );
    await page.waitForTimeout(3000);
  }),
);

clips.push(
  await record('02-play', async (page) => {
    await page.goto(`${BASE}/?seed=7`);
    await page.waitForTimeout(1200);
    await page.click('#menu-settings-btn');
    await page.waitForTimeout(900);
    await page.locator('#keybind-list').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.click('#settings-back');
    await page.waitForTimeout(400);
    await page.click('#leaderboard-btn');
    await page.waitForTimeout(1400);
    await page.click('#leaderboard-back');
    await page.waitForTimeout(300);
    await page.click('#campaign-btn');
    await page.waitForTimeout(900);
    await page.click('#intro-btn');
    await page.waitForTimeout(900);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1800);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('ShiftLeft');
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const game = window.__dao.game();
      game.windWarning = true;
      const lantern = game.lanterns[3];
      lantern.lit = true;
      lantern.everLit = true;
      lantern.fuel60 = 600;
    });
    await page.waitForTimeout(1600);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(1200);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(800);
  }),
);

clips.push(
  await record('03-bench', async (page) => {
    await page.setContent(CARD('Cảnh benchmark', ['1280×720 · seed 42 · 200 Bóng Mực · 100 đom đóm', 'camera quỹ đạo 30 m · 15 s/vòng']));
    await page.waitForTimeout(1800);
    await page.goto(`${BASE}/bench.html?seed=42&duration=20`);
    await page.waitForTimeout(9000);
  }),
);

clips.push(
  await record('04-end', async (page) => {
    await page.setContent(
      CARD('Cảm ơn đã chơi', ['npm test · npm run verify · npm run bench · npm run soak', 'docs/demo/demo.mp4 · MIT License']),
    );
    await page.waitForTimeout(2600);
  }),
);

await browser.close();
server.close();

const args = ['-y'];
for (const clip of clips) args.push('-i', clip);
args.push(
  '-filter_complex',
  clips.map((_, i) => `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`).join(';') +
    ';' +
    clips.map((_, i) => `[v${i}]`).join('') +
    `concat=n=${clips.length}:v=1:a=0[v]`,
  '-map',
  '[v]',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-preset',
  'medium',
  '-crf',
  '22',
  '-movflags',
  '+faststart',
  OUT,
);
execFileSync(FFMPEG, args, { stdio: 'inherit' });
rmSync(TMP, { recursive: true, force: true });
console.log(`wrote ${OUT}`);
