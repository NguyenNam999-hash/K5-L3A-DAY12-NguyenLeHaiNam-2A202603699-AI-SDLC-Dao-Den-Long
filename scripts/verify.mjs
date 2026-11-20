#!/usr/bin/env node
/**
 * Contract verification for Phase 4 (Contract v1.3). Runs the built headless CLI,
 * soak runner, leaderboard export and asset checks.
 *
 * Usage: npm run build && node scripts/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'evidence/phase-4/headless');
mkdirSync(outDir, { recursive: true });

const CLI = 'dist-node/headless/main.js';
const failures = [];
let checks = 0;

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

function check(condition, label, message) {
  checks += 1;
  if (!condition) fail(label, message);
}

function runCase(testCase) {
  const out = join(outDir, `${testCase.name}.jsonl`);
  const args = [
    CLI,
    '--seed', String(testCase.seed ?? 1),
    '--night', String(testCase.night ?? 1),
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
  if ((testCase.exitCode ?? 0) !== 0) return { name: testCase.name, records: [], out, args };

  const records = readFileSync(out, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
  return { name: testCase.name, records, out, args };
}

function round3(value) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];
const STATE_NAMES = ['playing', 'paused', 'won', 'lost'];
const LANTERNS = { 1: 5, 2: 6, 3: 7 };

function validateShape(testCase, records) {
  const label = testCase.name;
  const night = testCase.night ?? 1;
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
    check(snap.sim_tick <= snap.tick, label, 'sim_tick must not exceed tick');
    check(snap.night === night, label, `snapshot night ${snap.night} != ${night}`);
    check(STATE_NAMES.includes(snap.state), label, `bad snapshot state ${snap.state}`);
    check(Number.isInteger(snap.score), label, 'snapshot score must be an integer');
    check(snap.time_left_s >= 0, label, 'time_left_s must be >= 0');
    check(snap.lanterns.length === LANTERNS[night], label, `night ${night} must expose ${LANTERNS[night]} lanterns`);
    check(snap.motes_active === snap.motes.length, label, 'motes_active must match the motes array');
    check(Array.isArray(snap.drifters), label, 'drifters must be an array');
    check(Array.isArray(snap.charms), label, 'charms must be an array');
    check(snap.wind && typeof snap.wind.active === 'boolean', label, 'wind.active missing');
    check(Number.isFinite(snap.wind.dir_deg), label, 'wind.dir_deg missing');
    for (const key of ['pos', 'vel']) {
      check(Array.isArray(snap.player[key]) && snap.player[key].length === 3, label, `player.${key} must be xyz`);
    }
    check(typeof snap.player.grounded === 'boolean', label, 'player.grounded missing');
    check(Number.isInteger(snap.player.capacity) && snap.player.capacity >= 10 && snap.player.capacity <= 20, label, 'player.capacity out of range');
    for (const key of ['invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) {
      check(typeof snap.player[key] === 'number', label, `player.${key} missing`);
    }
    for (const lantern of snap.lanterns) {
      check(typeof lantern.fuel === 'number' && lantern.fuel >= 0 && lantern.fuel <= 100, label, `bad lantern fuel ${lantern.fuel}`);
      check(Math.abs(lantern.fuel * 10 - Math.round(lantern.fuel * 10)) < 1e-6, label, `fuel not rounded to 1 decimal: ${lantern.fuel}`);
      check(typeof lantern.ever_lit === 'boolean', label, 'lantern.ever_lit missing');
      check(Number.isInteger(lantern.relit_count) && lantern.relit_count >= 0, label, 'lantern.relit_count missing');
      check(lantern.lit || lantern.fuel === 0, label, 'an unlit lantern must expose fuel 0');
    }
    const positions = [
      snap.player.pos,
      ...snap.lanterns.map((lantern) => lantern.pos),
      ...snap.shades.map((shade) => shade.pos),
      ...snap.motes.map((mote) => mote.pos),
      ...snap.drifters.map((drifter) => drifter.pos),
    ];
    for (const position of positions) {
      check(position.length === 3, label, 'positions must be [x, y, z]');
      check(position.every(round3), label, `position not rounded to 3 decimals: ${position}`);
    }
    for (const shade of snap.shades) {
      check(SHADE_STATES.includes(shade.state), label, `bad shade state ${shade.state}`);
    }
    for (const drifter of snap.drifters) {
      check(DRIFTER_STATES.includes(drifter.state), label, `bad drifter state ${drifter.state}`);
      check(Number.isInteger(drifter.stolen), label, 'drifter.stolen must be an integer');
    }
    for (const mote of snap.motes) {
      check(['random', 'dropped'].includes(mote.kind), label, `bad mote kind ${mote.kind}`);
      check(typeof mote.ttl_s === 'number', label, 'mote.ttl_s missing');
    }
    for (const charm of snap.charms) {
      check(typeof charm.available === 'boolean', label, 'charm.available missing');
      check(typeof charm.respawn_s === 'number', label, 'charm.respawn_s missing');
    }
  }

  const events = records.filter((record) => record.type === 'event');
  for (const event of events) {
    check(Number.isInteger(event.tick) && event.tick >= 1, label, 'event tick must be an integer >= 1');
    check(event.tick <= last.ticks, label, `event tick ${event.tick} after the end (${last.ticks})`);
  }
  if (testCase.ticks > 0) {
    check(events.filter((event) => event.name === 'night_start').length === 1, label, 'night_start must fire once');
  }
  check(
    events.filter((event) => event.name === 'game_over').length <= 1,
    label,
    'at most one game_over event',
  );
  if (last.state !== 'playing') {
    check(events.some((event) => event.name === 'game_over'), label, 'a finished game must emit game_over');
  }
  return { snapshots, events };
}

const definitions = [
  { name: '01-movement', scenario: '01-move.json', inputs: '01-move.inputs.json', ticks: 60, verify({ snapshots }) {
    const last = snapshots.at(-1);
    check(Math.abs(last.player.pos[0]) < 1e-6, '01-movement', 'x must stay 0');
    check(Math.abs(last.player.pos[2] - 5.75) < 0.02, '01-movement', `z must be ~5.75, got ${last.player.pos[2]}`);
    check(last.player.vel[2] === 6, '01-movement', 'speed must reach 6 m/s');
  } },
  { name: '02-pickup', scenario: '02-pickup.json', inputs: '02-pickup.inputs.json', ticks: 60, verify({ events, snapshots }) {
    const picked = events.find((event) => event.name === 'mote_picked');
    check(Boolean(picked), '02-pickup', 'mote_picked missing');
    check(snapshots.at(-1).player.carried === 1, '02-pickup', 'carried must be 1');
    check(snapshots.at(-1).score === 0, '02-pickup', 'v1.1 scores on deposit, not pickup');
  } },
  { name: '03-deposit', scenario: '03-deposit.json', inputs: '03-deposit.inputs.json', ticks: 3, snapshotEvery: 3, verify({ events, snapshots }) {
    const deposit = events.find((event) => event.name === 'deposit');
    check(deposit && deposit.tick === 1, '03-deposit', 'deposit must happen at tick 1');
    check(deposit.data.amount === 10 && deposit.data.deposited === 10, '03-deposit', 'deposit payload wrong');
    check(snapshots.at(-1).lanterns[0].lit === true, '03-deposit', 'L1 must be lit');
    check(snapshots.at(-1).lanterns[0].fuel === 100, '03-deposit', 'a new light must start at fuel 100');
    check(snapshots.at(-1).score === 150, '03-deposit', '10 motes + first light must score 150');
  } },
  { name: '04-pulse', scenario: '04-pulse.json', inputs: '04-pulse.inputs.json', ticks: 3, snapshotEvery: 3, verify({ events, snapshots }) {
    const pulse = events.find((event) => event.name === 'pulse');
    check(Boolean(pulse), '04-pulse', 'pulse event missing');
    if (pulse) check(JSON.stringify(pulse.data.stunned_ids) === '["S1"]', '04-pulse', 'stunned_ids wrong');
    check(snapshots.at(-1).player.carried === 0, '04-pulse', 'pulse must cost 3');
    check(snapshots.at(-1).shades[0].state === 'stunned', '04-pulse', 'shade must be stunned');
    check(snapshots.at(-1).score === 5, '04-pulse', 'stun must add per_stun 5');
  } },
  { name: '05-hit', scenario: '05-hit.json', ticks: 2, snapshotEvery: 2, verify({ events, snapshots }) {
    const hit = events.find((event) => event.name === 'player_hit');
    check(Boolean(hit), '05-hit', 'player_hit missing');
    if (hit) check(hit.data.by === 'shade' && hit.data.flames === 2 && hit.data.dropped === 5, '05-hit', 'hit payload wrong');
    check(snapshots.at(-1).player.carried === 5, '05-hit', 'must drop floor(10/2)');
    check(snapshots.at(-1).motes.filter((m) => m.kind === 'dropped').length === 5, '05-hit', 'dropped motes missing');
  } },
  { name: '06-win', scenario: '06-win.json', ticks: 120, snapshotEvery: 60, verify({ events, records }) {
    const end = records.at(-1);
    check(end.state === 'won', '06-win', `state must be won, got ${end.state}`);
    check(end.score === 597, '06-win', `score must be 597, got ${end.score}`);
    const over = events.find((event) => event.name === 'game_over');
    check(over && over.data.reason === 'dawn_survived', '06-win', 'game_over reason must be dawn_survived');
  } },
  { name: '07-dawn', scenario: '07-dawn.json', ticks: 120, verify({ events, records }) {
    const end = records.at(-1);
    check(end.state === 'lost', '07-dawn', `state must be lost, got ${end.state}`);
    check(end.ticks === 60, '07-dawn', `must stop at tick 60, got ${end.ticks}`);
    check(end.score === 0, '07-dawn', `dawn must score 0, got ${end.score}`);
    check(events.find((event) => event.name === 'game_over').data.reason === 'dawn', '07-dawn', 'reason must be dawn');
  } },
  { name: '08-invalid-inputs', inputs: '08-invalid.inputs.json', ticks: 1, exitCode: 2, verify() {} },
  { name: '09-pause', scenario: '09-pause.json', inputs: '09-pause.inputs.json', ticks: 30, snapshotEvery: 5, verify({ events, snapshots }) {
    check(events.find((event) => event.name === 'paused').tick === 6, '09-pause', 'paused tick wrong');
    check(events.find((event) => event.name === 'resumed').tick === 21, '09-pause', 'resumed tick wrong');
    const paused = snapshots.find((snap) => snap.tick === 15);
    check(paused.state === 'paused' && paused.sim_tick === 5, '09-pause', 'pause must freeze sim_tick');
  } },
  { name: '10-dash', scenario: '10-dash.json', inputs: '10-dash.inputs.json', ticks: 12, snapshotEvery: 12, verify({ events, snapshots }) {
    check(events.find((event) => event.name === 'dash').tick === 1, '10-dash', 'dash event missing');
    check(Math.abs(snapshots.at(-1).player.pos[2] - 2.8) < 1e-6, '10-dash', `dash must cover 2.8 m, got ${snapshots.at(-1).player.pos[2]}`);
  } },
  { name: '11-charm', night: 2, scenario: '11-charm.json', inputs: '11-charm.inputs.json', ticks: 30, snapshotEvery: 20, verify({ events, snapshots }) {
    check(events.find((event) => event.name === 'charm_picked').data.charm_ticks === 600, '11-charm', 'charm event wrong');
    check(Math.abs(snapshots.at(-1).player.vel[2] - 7.2) < 1e-6, '11-charm', 'charm speed must be 7.2');
  } },
  { name: '12-drifter-steal', night: 2, scenario: '12-drifter-steal.json', ticks: 120, snapshotEvery: 30, verify({ events, snapshots }) {
    const steal = events.find((event) => event.name === 'drifter_steal');
    check(Boolean(steal), '12-drifter-steal', 'drifter_steal missing');
    if (steal) check(steal.data.amount === 3, '12-drifter-steal', 'must steal min(3, carried)');
    check(snapshots.at(-1).player.carried === 2, '12-drifter-steal', 'carried must drop to 2');
    check(snapshots.at(-1).drifters[0].state === 'flee', '12-drifter-steal', 'drifter must flee');
  } },
  { name: '13-drifter-drop', night: 2, scenario: '13-drifter-drop.json', inputs: '13-drifter-drop.inputs.json', ticks: 3, snapshotEvery: 3, verify({ events, snapshots }) {
    const drop = events.find((event) => event.name === 'drifter_drop');
    check(Boolean(drop) && drop.data.amount === 3, '13-drifter-drop', 'drifter_drop missing');
    check(snapshots.at(-1).motes.filter((mote) => mote.kind === 'dropped').length === 3, '13-drifter-drop', 'dropped motes missing');
  } },
  { name: '14-wind', night: 3, scenario: '14-wind.json', ticks: 2100, snapshotEvery: 300, verify({ snapshots }) {
    const at = (tick) => snapshots.find((snap) => snap.tick === tick);
    check(at(1500).wind.active === false, '14-wind', 'wind must be calm before 30 s');
    check(at(1800).wind.active === true, '14-wind', 'wind must start at 30 s');
    check(at(2100).wind.active === false, '14-wind', 'wind must end after 5 s');
  } },
  { name: '15-fall', scenario: '15-fall.json', inputs: '15-fall.inputs.json', ticks: 200, snapshotEvery: 50, verify({ events }) {
    const fall = events.find((event) => event.name === 'player_hit' && event.data.by === 'fall');
    check(Boolean(fall), '15-fall', 'fall hit missing');
    if (fall) check(fall.data.flames === 2, '15-fall', 'fall must cost one flame');
  } },
  { name: '16-jump-pad', night: 2, scenario: '16-jump-pad.json', ticks: 120, snapshotEvery: 60, verify({ snapshots }) {
    const last = snapshots.at(-1);
    check(last.player.grounded === true, '16-jump-pad', 'must land');
    check(last.player.pos[0] > 44, '16-jump-pad', 'must reach island B');
    check(last.player.pos[1] === 0, '16-jump-pad', 'must land at y=0');
  } },
  { name: '17-night3-ramp', night: 3, scenario: '17-night3-ramp.json', inputs: '17-night3-ramp.inputs.json', ticks: 90, snapshotEvery: 90, verify({ snapshots }) {
    check(snapshots.at(-1).player.pos[1] === 3, '17-night3-ramp', 'ramp must reach tier 1');
  } },
  { name: '18-dropped-mote', scenario: '18-dropped-mote.json', ticks: 12, snapshotEvery: 3, verify({ snapshots }) {
    check(snapshots.find((snap) => snap.tick === 9).motes.length === 1, '18-dropped-mote', 'mote must exist before TTL');
    check(snapshots.at(-1).motes.length === 0, '18-dropped-mote', 'mote must expire after TTL');
  } },
  { name: '19-night2', night: 2, scenario: '19-night2.json', ticks: 1, snapshotEvery: 1, verify({ snapshots }) {
    const snap = snapshots.at(-1);
    check(snap.lanterns.length === 6, '19-night2', 'six lanterns');
    check(snap.motes.length === 20, '19-night2', '20 initial motes');
    check(snap.charms.length === 1, '19-night2', 'one charm');
  } },
  { name: '20-night3', night: 3, scenario: '20-night3.json', ticks: 1, snapshotEvery: 1, verify({ snapshots }) {
    const snap = snapshots.at(-1);
    check(snap.lanterns.length === 7, '20-night3', 'seven lanterns');
    check(snap.motes.length === 20, '20-night3', '20 initial motes');
    check(snap.charms.length === 2, '20-night3', 'two charms');
  } },
  { name: '21-night3-pad', night: 3, scenario: '21-night3-pad.json', ticks: 80, snapshotEvery: 40, verify({ snapshots }) {
    const last = snapshots.at(-1);
    check(last.player.grounded === true && last.player.pos[1] === 6, '21-night3-pad', 'pad must land on tier 2');
  } },
  { name: '25-refuel', scenario: '25-refuel.json', inputs: '25-refuel.inputs.json', ticks: 3, snapshotEvery: 3, verify({ events, snapshots }) {
    const refuel = events.find((event) => event.name === 'refuel');
    check(Boolean(refuel), '25-refuel', 'refuel event missing');
    if (refuel) check(refuel.data.amount === 6 && refuel.data.fuel === 100, '25-refuel', 'refuel payload wrong');
    check(snapshots.at(-1).player.carried === 4, '25-refuel', 'carried must drop by 6');
    check(snapshots.at(-1).score === 30, '25-refuel', '6 motes must score 30');
    check(snapshots.at(-1).lanterns[0].fuel === 100, '25-refuel', 'fuel must cap at 100');
  } },
  { name: '26-lantern-out', scenario: '26-lantern-out.json', ticks: 120, snapshotEvery: 30, verify({ events, snapshots }) {
    const out = events.find((event) => event.name === 'lantern_out');
    check(Boolean(out), '26-lantern-out', 'lantern_out missing');
    if (out) check(out.data.lantern_id === 'L1' && out.tick === 90, '26-lantern-out', `lantern_out payload/tick wrong: ${JSON.stringify(out)}`);
    const last = snapshots.at(-1).lanterns[0];
    check(last.lit === false && last.fuel === 0 && last.ever_lit === true, '26-lantern-out', 'lantern must be off, empty and remembered');
  } },
  { name: '27-drain', scenario: '27-drain.json', ticks: 180, snapshotEvery: 60, verify({ events, snapshots }) {
    const drains = events.filter((event) => event.name === 'fuel_drain');
    check(drains.length === 3, '27-drain', `must log every 60 ticks, got ${drains.length}`);
    if (drains[0]) check(drains[0].data.lantern_id === 'L1' && drains[0].data.shade_id === 'S1', '27-drain', 'fuel_drain payload wrong');
    const last = snapshots.at(-1);
    check(last.shades[0].state === 'drain', '27-drain', 'shade must be draining');
    check(last.lanterns[0].fuel < 15, '27-drain', `weak lantern must lose fuel fast, got ${last.lanterns[0].fuel}`);
    check(last.lanterns[1].fuel > 75, '27-drain', 'healthy lantern must only lose 1/s');
  } },
  { name: '28-relight', scenario: '28-relight.json', inputs: '28-relight.inputs.json', ticks: 3, snapshotEvery: 3, verify({ events, snapshots }) {
    const lit = events.find((event) => event.name === 'lantern_lit');
    check(Boolean(lit) && lit.data.relight === true, '28-relight', 'lantern_lit must carry relight:true');
    check(events.find((event) => event.name === 'deposit').data.amount === 5, '28-relight', 'a relight costs 5 motes');
    check(snapshots.at(-1).score === 65, '28-relight', `relight must score 65, got ${snapshots.at(-1).score}`);
    check(snapshots.at(-1).lanterns[0].relit_count === 1, '28-relight', 'relit_count must be 1');
  } },
  { name: '29-capacity', scenario: '29-capacity.json', ticks: 1, snapshotEvery: 1, verify({ snapshots }) {
    check(snapshots.at(-1).player.capacity === 20, '29-capacity', 'capacity must cap at 20');
    check(snapshots.at(-1).player.carried === 19, '29-capacity', '19 carried must fit in 20');
  } },
];

for (const testCase of definitions) {
  const result = runCase(testCase);
  if (!result) continue;
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
  console.log(
    failures.some((line) => line.startsWith(`${testCase.name}:`)) ? `FAIL ${testCase.name}` : `PASS ${testCase.name}`,
  );
}

// Determinism: same seed, scenario-less night 2, two runs, byte-identical.
const detA = join(outDir, '22-determinism-a.jsonl');
const detB = join(outDir, '22-determinism-b.jsonl');
for (const out of [detA, detB]) {
  const proc = spawnSync('node', [CLI, '--seed', '424242', '--night', '2', '--ticks', '4800', '--out', out], {
    encoding: 'utf8',
  });
  check(proc.status === 0, '22-determinism', `exit ${proc.status}: ${proc.stderr}`);
}
const same = readFileSync(detA, 'utf8') === readFileSync(detB, 'utf8');
check(same, '22-determinism', 'two runs with the same seed differ');
console.log(same ? 'PASS 22-determinism' : 'FAIL 22-determinism');

// Idle player must not drift.
const idle = join(outDir, '23-idle.jsonl');
spawnSync('node', [CLI, '--seed', '3', '--night', '1', '--ticks', '600', '--out', idle, '--snapshot-every', '100'], {
  encoding: 'utf8',
});
const idleSnaps = readFileSync(idle, 'utf8')
  .trimEnd()
  .split('\n')
  .map((line) => JSON.parse(line))
  .filter((record) => record.type === 'snapshot');
const noDrift = idleSnaps.every((snap) => snap.player.pos[0] === 0 && snap.player.pos[2] === 0);
check(noDrift, '23-idle', 'player moved without input');
console.log(noDrift ? 'PASS 23-idle' : 'FAIL 23-idle');

// Performance: a full Night 3 (18 000 ticks) must finish in <= 30 s.
const perfOut = join(outDir, '24-full-night3.jsonl');
const startedAt = Date.now();
const perf = spawnSync('node', [CLI, '--seed', '5', '--night', '3', '--ticks', '18000', '--out', perfOut], {
  encoding: 'utf8',
});
const elapsedMs = Date.now() - startedAt;
check(perf.status === 0, '24-performance', `exit ${perf.status}: ${perf.stderr}`);
check(elapsedMs <= 30000, '24-performance', `full night took ${elapsedMs} ms`);
console.log(elapsedMs <= 30000 ? `PASS 24-performance (${elapsedMs} ms)` : `FAIL 24-performance (${elapsedMs} ms)`);

// ---------------------------------------------------------------- Phase 4

// 25: contract v1.3 and the new commands.
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const contractOk =
  contract.contract_version === '1.3' &&
  typeof contract.bench_cmd === 'string' &&
  contract.bench_cmd.includes('bench') &&
  typeof contract.soak_cmd === 'string' &&
  contract.soak_cmd.includes('soak') &&
  typeof contract.run_cmd === 'string' &&
  contract.run_cmd.includes('app.js');
check(contractOk, '30-contract-v1.3', 'contract_version/bench_cmd/soak_cmd/run_cmd mismatch');
console.log(contractOk ? 'PASS 25-contract-v1.3' : 'FAIL 25-contract-v1.3');

// 26: soak smoke run (2 nights) has the documented shape and no crash.
const soakOut = join(root, 'evidence/phase-4/soak-smoke.json');
const soak = spawnSync('node', ['dist-node/headless/soak.js', '--seed', '7', '--nights', '2', '--out', soakOut], {
  encoding: 'utf8',
});
let soakReport = null;
try {
  soakReport = JSON.parse(readFileSync(soakOut, 'utf8'));
} catch {
  soakReport = null;
}
const soakKeys = ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s'];
const soakOk =
  soak.status === 0 &&
  soakReport !== null &&
  soakKeys.every((key) => key in soakReport) &&
  soakReport.nights === 2 &&
  soakReport.results.length === 2 &&
  soakReport.crashes === 0 &&
  soakReport.mem_end_mb <= soakReport.mem_start_mb * 1.2;
check(soakOk, '31-soak', `exit ${soak.status}, report ${JSON.stringify(soakReport)}`);
console.log(soakOk ? 'PASS 26-soak' : 'FAIL 26-soak');

// 27: leaderboard export writes the exact shape in score order.
const lbInput = join(root, 'evidence/phase-4/leaderboard-input.json');
const lbOut = join(root, 'evidence/phase-4/leaderboard-export.json');
writeFileSync(
  lbInput,
  JSON.stringify({
    entries: [
      { name: 'Low_01', score: 100, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 7 },
      { name: 'High_01', score: 900, nights_won: 3, achieved_at: '2026-11-20T11:00:00+07:00', seed: 7 },
    ],
  }),
);
const exported = spawnSync('node', ['dist-node/app.js', '--export-leaderboard', lbOut, '--data', lbInput], {
  encoding: 'utf8',
});
let exportJson = null;
try {
  exportJson = JSON.parse(readFileSync(lbOut, 'utf8'));
} catch {
  exportJson = null;
}
const exportOk =
  exported.status === 0 &&
  exportJson !== null &&
  Array.isArray(exportJson.entries) &&
  exportJson.entries.length === 2 &&
  exportJson.entries[0].name === 'High_01' &&
  exportJson.entries[1].name === 'Low_01';
check(exportOk, '32-leaderboard-export', `exit ${exported.status}, file ${JSON.stringify(exportJson)}`);
console.log(exportOk ? 'PASS 27-leaderboard-export' : 'FAIL 27-leaderboard-export');

// 28: a corrupt leaderboard file exports as an empty list, never crashes.
const corruptInput = join(root, 'evidence/phase-4/leaderboard-corrupt.json');
const corruptOut = join(root, 'evidence/phase-4/leaderboard-corrupt-export.json');
writeFileSync(corruptInput, '{ not json');
const corruptRun = spawnSync('node', ['dist-node/app.js', '--export-leaderboard', corruptOut, '--data', corruptInput], {
  encoding: 'utf8',
});
let corruptJson = null;
try {
  corruptJson = JSON.parse(readFileSync(corruptOut, 'utf8'));
} catch {
  corruptJson = null;
}
const corruptOk = corruptRun.status === 0 && corruptJson !== null && Array.isArray(corruptJson.entries) && corruptJson.entries.length === 0;
check(corruptOk, '33-leaderboard-corrupt', `exit ${corruptRun.status}, file ${JSON.stringify(corruptJson)}`);
console.log(corruptOk ? 'PASS 28-leaderboard-corrupt' : 'FAIL 28-leaderboard-corrupt');

// 29: release assets and benchmark page exist after a build.
const assets = ['dist/bench.html', 'dist/index.html', 'scripts/bench.mjs', 'scripts/bench-stats.mjs', 'LICENSE', 'CHANGELOG.md', 'docs/demo/demo.mp4'];
const missing = assets.filter((file) => !existsSync(join(root, file)));
check(missing.length === 0, '34-release-assets', `missing ${missing.join(', ')}`);
console.log(missing.length === 0 ? 'PASS 29-release-assets' : `FAIL 29-release-assets (${missing.join(', ')})`);

// 30: committed benchmark report has the contract schema and meets thresholds.
let bench = null;
try {
  bench = JSON.parse(readFileSync(join(root, 'bench.json'), 'utf8'));
} catch {
  bench = null;
}
const benchKeys = [
  'contract_version', 'avg_fps', 'p1_low_fps', 'frame_ms_p95', 'frames', 'load_ms', 'peak_mem_mb', 'vsync_off', 'renderer', 'os',
];
const benchOk =
  bench !== null &&
  benchKeys.every((key) => key in bench) &&
  bench.contract_version === '1.3' &&
  bench.avg_fps >= 60 &&
  bench.p1_low_fps >= 30 &&
  bench.load_ms <= 10000;
check(benchOk, '35-bench-report', `bench.json ${JSON.stringify(bench)}`);
console.log(benchOk ? 'PASS 30-bench-report' : 'FAIL 30-bench-report');

const report = [
  'Dao Den Long - Phase 4 headless verification (Contract v1.3)',
  `date: ${new Date().toISOString()}`,
  `node: ${process.version}`,
  `checks: ${checks}`,
  `full-night-3: ${elapsedMs} ms`,
  '',
  ...definitions.map((testCase) => `${testCase.name}: night ${testCase.night ?? 1}, ${testCase.ticks} ticks`),
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
