import { runSoak } from './soak';

process.exitCode = runSoak(process.argv.slice(2));
