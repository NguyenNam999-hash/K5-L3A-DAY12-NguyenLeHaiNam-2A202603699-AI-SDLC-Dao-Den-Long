import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { normalizeEntry } from '../core/leaderboard';
import { addLeaderboardEntry, readLeaderboardFile } from './leaderboard-file';

export interface AppOptions {
  port: number;
  root: string;
  dataFile: string;
  open: boolean;
}

export interface RunningApp {
  url: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(text);
}

function sendFile(response: import('node:http').ServerResponse, path: string): void {
  const type = CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, { 'content-type': type });
  createReadStream(path).pipe(response);
}

function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let data = '';
    request.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
      if (data.length > 64 * 1024) {
        reject(new Error('body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolveBody(data));
    request.on('error', reject);
  });
}

/** Serves the built UI plus the disk-backed leaderboard API. */
export async function startApp(options: AppOptions): Promise<RunningApp> {
  const root = resolve(options.root);
  if (!existsSync(root)) throw new Error(`web root not found: ${root} (run npm run build first)`);

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/leaderboard') {
      if (request.method === 'GET') {
        sendJson(response, 200, { entries: readLeaderboardFile(options.dataFile) });
        return;
      }
      if (request.method === 'POST') {
        void readBody(request)
          .then((body) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(body) as unknown;
            } catch {
              sendJson(response, 400, { error: 'invalid json' });
              return;
            }
            const entry = normalizeEntry(parsed);
            if (!entry) {
              sendJson(response, 400, { error: 'invalid entry' });
              return;
            }
            sendJson(response, 200, { entries: addLeaderboardEntry(options.dataFile, entry) });
          })
          .catch(() => sendJson(response, 400, { error: 'invalid body' }));
        return;
      }
      response.writeHead(405, { allow: 'GET, POST' });
      response.end();
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }

    let filePath = resolve(root, `.${pathname}`);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
    if (!existsSync(filePath)) {
      if (extname(pathname) === '') {
        sendFile(response, resolve(root, 'index.html'));
        return;
      }
      response.writeHead(404);
      response.end();
      return;
    }
    sendFile(response, filePath);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(options.port, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  const url = `http://127.0.0.1:${port}`;
  if (options.open) {
    const { spawn } = await import('node:child_process');
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    spawn(command, [url], { stdio: 'ignore', detached: true }).unref();
  }

  return {
    url,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((err) => (err ? rejectClose(err) : resolveClose()));
        server.closeAllConnections?.();
      }),
  };
}
