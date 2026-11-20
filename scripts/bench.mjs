/**
 * Phase 4 benchmark driver (Contract v1.3).
 *
 * Usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
 *
 * Serves the built `dist/`, opens Chromium at 1280x720 with VSync/frame-limit
 * flags, lets `bench.html` run the standard scene, then writes the report.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, platform, release, arch } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { computeBenchStats } from './bench-stats.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const USAGE = 'Usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json';
const t0 = performance.now();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--seed') args.seed = Number(argv[++i]);
    else if (flag === '--duration') args.duration = Number(argv[++i]);
    else if (flag === '--out') args.out = argv[++i];
    else throw new Error(`unknown argument "${flag}"\n${USAGE}`);
  }
  if (!Number.isInteger(args.seed)) throw new Error(`--seed is required\n${USAGE}`);
  if (!Number.isInteger(args.duration) || args.duration < 1) throw new Error(`--duration is required\n${USAGE}`);
  if (!args.out) throw new Error(`--out is required\n${USAGE}`);
  return args;
}

function serve(root) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServe, rejectServe) => {
    server.once('error', rejectServe);
    server.listen(0, '127.0.0.1', () => resolveServe(server));
  });
}

/** RSS of this Node process and every descendant, in MB. */
function treeRssMb() {
  try {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n');
    const children = new Map();
    const rss = new Map();
    for (const row of rows) {
      const [pid, ppid, kb] = row.trim().split(/\s+/).map(Number);
      rss.set(pid, kb);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(pid);
    }
    let total = 0;
    const stack = [process.pid];
    const seen = new Set();
    while (stack.length) {
      const pid = stack.pop();
      if (seen.has(pid)) continue;
      seen.add(pid);
      total += rss.get(pid) ?? 0;
      for (const child of children.get(pid) ?? []) stack.push(child);
    }
    return Math.round(total / 1024);
  } catch {
    return null;
  }
}

const CANDIDATE_CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const LAUNCH_ARGS = [
  '--disable-gpu-vsync',
  '--disable-frame-rate-limit',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--window-size=1280,720',
];

async function launchBrowser() {
  const headless = process.env.BENCH_HEADLESS === '1' || (platform() === 'linux' && !process.env.DISPLAY);
  const attempts = [
    () => chromium.launch({ headless, args: LAUNCH_ARGS }),
    () =>
      existsSync(CANDIDATE_CHROME)
        ? chromium.launch({ headless, args: LAUNCH_ARGS, executablePath: CANDIDATE_CHROME })
        : Promise.reject(new Error('no cached Chrome for Testing')),
    () => chromium.launch({ headless, args: LAUNCH_ARGS, channel: 'chrome' }),
  ];
  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Benchmark needs a Chromium build. Run "npx playwright install chromium".\nLast error: ${lastError?.message ?? 'unknown'}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve('dist');
  if (!existsSync(join(root, 'bench.html'))) throw new Error('dist/bench.html missing: run npm run build first');

  const server = await serve(root);
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let peak = null;
  let sampler;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => console.error(`[bench page] ${error.message}`));

    await page.goto(`${url}/bench.html?seed=${args.seed}&duration=${args.duration}`, { waitUntil: 'load' });

    const waited = Date.now();
    let firstFrameAt = null;
    while (Date.now() - waited < 30000) {
      firstFrameAt = await page.evaluate(() => window.__benchFirstFrameAt ?? null);
      if (firstFrameAt) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    if (!firstFrameAt) throw new Error('benchmark scene never rendered');
    const loadMs = firstFrameAt - Math.round(performance.timeOrigin + t0);

    while ((await page.evaluate(() => window.__benchPhase)) !== 'measure') {
      await new Promise((r) => setTimeout(r, 50));
    }
    peak = treeRssMb();
    sampler = setInterval(() => {
      const value = treeRssMb();
      if (value !== null) peak = Math.max(peak ?? 0, value);
    }, 250);

    let result = null;
    const deadline = Date.now() + (args.duration + 90) * 1000;
    while (Date.now() < deadline) {
      result = await page.evaluate(() => window.__bench ?? null);
      if (result) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!result) throw new Error('benchmark did not finish in time');

    const stats = computeBenchStats(result.dts);
    const report = {
      contract_version: '1.3',
      avg_fps: stats.avg_fps,
      p1_low_fps: stats.p1_low_fps,
      frame_ms_p95: stats.frame_ms_p95,
      frames: stats.frames,
      load_ms: loadMs,
      peak_mem_mb: peak,
      vsync_off: true,
      renderer: result.renderer.replace('Chromium', `Chromium ${browser.version()}`),
      os: `${platform()} ${release()} (${arch()})`,
    };
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));

    if (report.avg_fps < 60 || report.p1_low_fps < 30 || report.load_ms > 10000) {
      console.error('benchmark below Phase 4 thresholds');
      return 1;
    }
    return 0;
  } finally {
    if (sampler) clearInterval(sampler);
    await browser?.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message ?? String(error));
    process.exitCode = 1;
  });
