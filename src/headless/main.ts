#!/usr/bin/env node
import { runHeadless } from './run';

process.exit(runHeadless(process.argv.slice(2)));
