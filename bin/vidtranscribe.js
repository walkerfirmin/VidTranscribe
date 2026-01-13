#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
