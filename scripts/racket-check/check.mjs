// npm run racket-check: patch the official interpreters, then compare them with ours step by step
// (tests/racket/steps.test.ts). Needs Racket with the eopl package, and the official code in
// scripts/racket-check/.eopl3 (prepare.mjs says how to get it). The report is in
// scripts/racket-check/out/report.txt. With RACKET_CHECK_FULL=1 the steps are compared as text
// instead of hashes, so a difference can be read there.

import { spawnSync } from 'node:child_process';

const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(['scripts/racket-check/prepare.mjs']);
run(['node_modules/vitest/vitest.mjs', 'run', 'tests/racket'], { RACKET_CHECK: '1' });
