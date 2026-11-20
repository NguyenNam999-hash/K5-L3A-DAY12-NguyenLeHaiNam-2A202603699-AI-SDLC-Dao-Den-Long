#!/usr/bin/env node
/**
 * Contract verification for Phase 1. Runs the built headless CLI on fixed scenarios
 * and checks the output shape, the rules and determinism.
 *
 * Usage: npm run build && node scripts/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'evidence/phase-1/headless');
mkdirSync(outDir, { recursive: true });

const CLI = 'dist-node/headless/main.js';
const cases = [];
const failures = [];

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

function check(condition, label, message) {
  if (!condition) fail(label, message);
}

function runCase(testCase) {
  const out = join(outDir, `${testCase.name}.jsonl`);
  const args = [
    CLI,
    '--seed', String(testCase.seed ?? 1),
    '--night', '1',
    '--ticks', String(testCase.ticks),
    '--out', out,
    '--snapshot-every', String(testCase.snapshotEvery ?? 10),
  ];
  if (testCase.scenario) args.push('--scenario', join(root, 'tests/scenarios', testCase.scenario));
  if (testCase.inputs) args.push('--inputs', join(root, 'tests/scenarios', testCase.inputs));

  const proc = spawnSync('node', args, { encoding: 'utf8' });
  if (proc.status !== (testCase.exitCode ?? 0)) {
    fail(testCase.name, `exit ${proc.status}, expected ${testCase.exitCode ?? 0}. stderr=${proc.stderr.trim()}`);
    return null;
  }
  if ((testCase.exitCode ?? 0) !== 0) return { name: testCase.name, records: [], out };

  const records = readFileSync(out, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
  return { name: testCase.name, records, out, args };
}

function round3(value) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

function validateShape(testCase, records) {
  const label = testCase.name;
  check(records.length >= 2, label, 'needs at least one snapshot and one end record');
  const first = records[0];
  const last = records.at(-1);
  check(first.type === 'snapshot' && first.tick === 0, label, 'first record must be snapshot tick 0');
  check(last.type === 'end', label, 'last record must be type end');
  check(['playing', 'won', 'lost'].includes(last.state), label, `bad end state ${last.state}`);
  check(Number.isInteger(last.score), label, 'end score must be an integer');
  check(last.ticks <= testCase.ticks, label, 'end.ticks must not exceed --ticks');

  const every = testCase.snapshotEvery ?? 10;
  const snapshots = records.filter((record) => record.type === 'snapshot');
  for (const snap of snapshots) {
    check(snap.tick % every === 0, label, `snapshot tick ${snap.tick} is not a multiple of ${every}`);
    check(snap.sim_tick === snap.tick, label, 'sim_tick must equal tick in Phase 1');
    check(snap.state === last.state || snap.state === 'playing', label, 'unexpected snapshot state');
    check(Number.isInteger(snap.score), label, 'snapshot score must be an integer');
    check(snap.time_left_s >= 0, label, 'time_left_s must be >= 0');
    check(snap.lanterns.length === 5, label, 'night 1 must expose 5 lanterns');
    check(snap.motes_active === snap.motes.length, label, 'motes_active must match the motes array');
    const positions = [
      snap.player.pos,
      ...snap.lanterns.map((lantern) => lantern.pos),
      ...snap.shades.map((shade) => shade.pos),
      ...snap.motes.map((mote) => mote.pos),
    ];
    for (const position of positions) {
      check(position.length === 3, label, 'positions must be [x, y, z]');
      check(position.every(round3), label, `position not rounded to 3 decimals: ${position}`);
    }
    for (const shade of snap.shades) {
      check(typeof shade.state === 'string' && shade.state.length > 0, label, 'shade needs a state');
    }
  }

  const events = records.filter((record) => record.type === 'event');
  for (const event of events) {
    check(Number.isInteger(event.tick) && event.tick >= 1, label, 'event tick must be an integer >= 1');
    check(event.tick <= last.ticks, label, `event tick ${event.tick} after the end (${last.ticks})`);
  }
  check(
    events.filter((event) => event.name === 'game_over').length <= 1,
    label,
    'at most one game_over event',
  );
  if (last.state !== 'playing') {
    check(
      events.some((event) => event.name === 'game_over'),
      label,
      'a finished game must emit game_over',
    );
  }
  return { snapshots, events };
}

const definitions = [
  {
    name: '01-movement',
    scenario: '01-move.json',
    inputs: '01-move.inputs.json',
    ticks: 60,
    snapshotEvery: 10,
    verify({ snapshots }) {
      const last = snapshots.at(-1);
      check(Math.abs(last.player.pos[0]) < 1e-6, '01-movement', 'x must stay 0');
      check(Math.abs(last.player.pos[2] - 6) < 1e-3, '01-movement', `z must be 6, got ${last.player.pos[2]}`);
    },
  },
  {
    name: '02-pickup',
    scenario: '02-pickup.json',
    inputs: '02-pickup.inputs.json',
    ticks: 120,
    snapshotEvery: 10,
    verify({ events, snapshots }) {
      const picked = events.find((event) => event.name === 'mote_picked');
      check(Boolean(picked), '02-pickup', 'mote_picked event missing');
      if (picked) {
        check(picked.tick === 35, '02-pickup', `pickup tick must be 35, got ${picked.tick}`);
        check(picked.data.carried === 1, '02-pickup', 'carried must be 1');
      }
      check(snapshots.at(-1).motes_active === 0, '02-pickup', 'mote must be removed');
      check(snapshots.at(-1).score === 10, '02-pickup', 'score must add per_mote');
    },
  },
  {
    name: '03-deposit',
    scenario: '03-deposit.json',
    inputs: '03-deposit.inputs.json',
    ticks: 5,
    snapshotEvery: 5,
    verify({ events, snapshots }) {
      const names = events.map((event) => event.name);
      check(names.join(',') === 'deposit,lantern_lit', '03-deposit', `events: ${names.join(',')}`);
      const deposit = events[0];
      check(deposit.tick === 1, '03-deposit', 'deposit must happen at tick 1');
      check(deposit.data.lantern_id === 'L1' && deposit.data.amount === 3 && deposit.data.deposited === 3, '03-deposit', 'deposit payload wrong');
      check(snapshots.at(-1).lanterns[0].lit === true, '03-deposit', 'L1 must be lit');
      check(snapshots.at(-1).player.carried === 0, '03-deposit', 'carried must be spent');
    },
  },
  {
    name: '04-pulse',
    scenario: '04-pulse.json',
    inputs: '04-pulse.inputs.json',
    ticks: 3,
    snapshotEvery: 3,
    verify({ events, snapshots }) {
      const pulse = events.find((event) => event.name === 'pulse');
      check(Boolean(pulse), '04-pulse', 'pulse event missing');
      if (pulse) check(JSON.stringify(pulse.data.stunned_ids) === '["S1"]', '04-pulse', 'stunned_ids wrong');
      const snap = snapshots.at(-1);
      check(snap.player.carried === 2, '04-pulse', `pulse must cost 2 light, carried=${snap.player.carried}`);
      check(snap.shades[0].state === 'stunned', '04-pulse', 'shade must be stunned');
      check(Math.abs(snap.shades[0].pos[0] - 9) < 1e-3, '04-pulse', `push must be 4 m, x=${snap.shades[0].pos[0]}`);
      check(snap.score === 25, '04-pulse', 'stun must add per_stun');
    },
  },
  {
    name: '05-hit',
    scenario: '05-hit.json',
    ticks: 30,
    snapshotEvery: 30,
    verify({ events, snapshots }) {
      const hit = events.find((event) => event.name === 'player_hit');
      check(Boolean(hit), '05-hit', 'player_hit event missing');
      if (hit) {
        check(hit.tick === 1, '05-hit', `hit tick must be 1, got ${hit.tick}`);
        check(hit.data.by === 'shade' && hit.data.flames === 2 && hit.data.dropped === 2, '05-hit', 'hit payload wrong');
      }
      check(snapshots.at(-1).player.carried === 0, '05-hit', 'all carried light must drop');
    },
  },
  {
    name: '06-win',
    scenario: '06-win.json',
    inputs: '06-win.inputs.json',
    ticks: 5,
    snapshotEvery: 5,
    verify({ events, records }) {
      const end = records.at(-1);
      check(end.state === 'won', '06-win', `state must be won, got ${end.state}`);
      check(end.score === 1750, '06-win', `score must be 1750, got ${end.score}`);
      const over = events.find((event) => event.name === 'game_over');
      check(over && over.data.result === 'won' && over.data.reason === 'all_lit', '06-win', 'game_over payload wrong');
    },
  },
  {
    name: '07-dawn',
    scenario: '07-dawn.json',
    ticks: 120,
    snapshotEvery: 10,
    verify({ events, records }) {
      const end = records.at(-1);
      check(end.state === 'lost', '07-dawn', `state must be lost, got ${end.state}`);
      check(end.ticks === 60, '07-dawn', `must stop at tick 60, got ${end.ticks}`);
      check(end.score === 150, '07-dawn', `score must be 3 * per_flame_left = 150, got ${end.score}`);
      const over = events.find((event) => event.name === 'game_over');
      check(over && over.data.reason === 'dawn', '07-dawn', 'reason must be dawn');
    },
  },
  {
    name: '08-invalid-inputs',
    inputs: '08-invalid.inputs.json',
    ticks: 1,
    exitCode: 2,
    verify() {},
  },
];

const results = [];
for (const testCase of definitions) {
  const result = runCase(testCase);
  if (!result) continue;
  results.push({ ...testCase, ...result });
  if ((testCase.exitCode ?? 0) !== 0) {
    console.log(`PASS ${testCase.name} (exit ${testCase.exitCode})`);
    continue;
  }
  const parsed = validateShape(testCase, result.records);
  try {
    testCase.verify({ ...result, ...parsed });
  } catch (error) {
    fail(testCase.name, error.message);
  }
  console.log(failures.some((line) => line.startsWith(`${testCase.name}:`)) ? `FAIL ${testCase.name}` : `PASS ${testCase.name}`);
}

// Determinism: same seed, scenario-less full night, two runs, byte-identical.
const detA = join(outDir, '09-determinism-a.jsonl');
const detB = join(outDir, '09-determinism-b.jsonl');
for (const out of [detA, detB]) {
  const proc = spawnSync('node', [CLI, '--seed', '424242', '--night', '1', '--ticks', '4800', '--out', out], {
    encoding: 'utf8',
  });
  check(proc.status === 0, '09-determinism', `exit ${proc.status}: ${proc.stderr}`);
}
const same = readFileSync(detA, 'utf8') === readFileSync(detB, 'utf8');
check(same, '09-determinism', 'two runs with the same seed differ');
console.log(same ? 'PASS 09-determinism' : 'FAIL 09-determinism');

// Idle player must not drift.
const idle = join(outDir, '10-idle.jsonl');
spawnSync('node', [CLI, '--seed', '3', '--night', '1', '--ticks', '600', '--out', idle, '--snapshot-every', '100'], {
  encoding: 'utf8',
});
const idleSnaps = readFileSync(idle, 'utf8')
  .trimEnd()
  .split('\n')
  .map((line) => JSON.parse(line))
  .filter((record) => record.type === 'snapshot');
const noDrift = idleSnaps.every((snap) => snap.player.pos[0] === 0 && snap.player.pos[2] === 0);
check(noDrift, '10-idle', 'player moved without input');
console.log(noDrift ? 'PASS 10-idle' : 'FAIL 10-idle');

const report = [
  'Dao Den Long - Phase 1 headless verification',
  `date: ${new Date().toISOString()}`,
  `node: ${process.version}`,
  '',
  ...definitions.map((testCase) => `${testCase.name}: ${testCase.ticks} ticks`),
  '',
  failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES (${failures.length})`,
  ...failures,
].join('\n');
writeFileSync(join(outDir, 'verify-report.txt'), `${report}\n`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const line of failures) console.error(` - ${line}`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
