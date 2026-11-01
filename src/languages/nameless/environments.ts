// Port of chapter3/lexaddr-lang/environments.scm and the nameless environment
// of data-structures.scm. A nameless environment is a list of values: extend
// is cons, and a lexical address n is list-ref n. Each cons is a frame here.

import type { Env } from '../../core/env';
import type { Recorder } from '../../core/trace';
import { numVal, type ExpVal } from '../../core/values';

// init-nameless-env : () -> Nameless-env
// The values of i, v and x, in the order of init-senv.
export function initNamelessEnv(rec: Recorder): Env {
  return rec.extendNamelessEnv(
    numVal(1n), // was i
    rec.extendNamelessEnv(
      numVal(5n), // was v
      rec.extendNamelessEnv(
        numVal(10n), // was x
        rec.emptyEnv(),
      ),
    ),
  );
}

// apply-nameless-env : Nameless-env * Lexaddr -> ExpVal
export function applyNamelessEnv(namelessEnv: Env, n: bigint): ExpVal {
  let env = namelessEnv;
  for (let i = 0n; i < n && env.kind !== 'empty-env'; i++) env = env.savedEnv;
  // In Racket this is a list-ref error; the translator never makes an address past the end.
  if (env.kind !== 'extend-nameless-env') throw new Error(`list-ref: index ${n} too large for list`);
  return env.val;
}
