import { startApp } from './app';
import { exportLeaderboard } from './leaderboard-file';

const USAGE = `Usage: node dist-node/app.js [options]

  --port <n>                  port to listen on (default 4173)
  --no-open                   do not open a browser
  --data <file>               leaderboard file (default data/leaderboard.json)
  --root <dir>                built UI directory (default dist)
  --export-leaderboard <file> write {"entries":[...]} and exit
  --help`;

interface Options {
  port: number;
  open: boolean;
  dataFile: string;
  root: string;
  exportPath?: string;
}

function parse(argv: string[]): Options {
  const options: Options = { port: 4173, open: true, dataFile: 'data/leaderboard.json', root: 'dist' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (flag === '--help' || flag === '-h') {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (flag === '--no-open') {
      options.open = false;
    } else if (flag === '--port') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) throw new Error('--port: expected a non-negative integer');
      options.port = value;
    } else if (flag === '--data') {
      const value = argv[++i];
      if (!value) throw new Error('--data: missing value');
      options.dataFile = value;
    } else if (flag === '--root') {
      const value = argv[++i];
      if (!value) throw new Error('--root: missing value');
      options.root = value;
    } else if (flag === '--export-leaderboard') {
      const value = argv[++i];
      if (!value) throw new Error('--export-leaderboard: missing value');
      options.exportPath = value;
    } else {
      throw new Error(`unknown argument "${flag}"\n${USAGE}`);
    }
  }
  return options;
}

async function main(): Promise<number> {
  let options: Options;
  try {
    options = parse(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }

  if (options.exportPath) {
    exportLeaderboard(options.dataFile, options.exportPath);
    process.stdout.write(`leaderboard exported to ${options.exportPath}\n`);
    return 0;
  }

  try {
    const app = await startApp(options);
    process.stdout.write(`Đảo Đèn Lồng at ${app.url} (data: ${options.dataFile})\n`);
    const shutdown = (): void => {
      void app.close().then(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return 0;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}

process.exitCode = await main();
