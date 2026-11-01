// Port of chapter4/explicit-refs/environments.scm.

import type { Env } from '../../core/env';
import { EoplError } from '../../core/errors';
import type { Recorder } from '../../core/trace';
import { numVal, procVal, type ExpVal } from '../../core/values';

// init-env : () -> Env
// usage: (init-env) = [i=1, v=5, x=10]
// Nothing goes into the store: in EXPLICIT-REFS only newref allocates.
export function initEnv(rec: Recorder): Env {
  return rec.extendEnv('i', numVal(1n), rec.extendEnv('v', numVal(5n), rec.extendEnv('x', numVal(10n), rec.emptyEnv())));
}

export function applyEnv(rec: Recorder, env: Env, searchSym: string): ExpVal {
  switch (env.kind) {
    case 'empty-env':
      throw new EoplError('apply-env', `No binding for ${searchSym}`);
    case 'extend-env':
      // DenVal = ExpVal here; a Ref (number) can't get here.
      return env.bvar === searchSym ? (env.bval as ExpVal) : applyEnv(rec, env.savedEnv, searchSym);
    case 'extend-env-rec*': {
      // (location search-sym p-names): the first procedure with that name.
      const n = env.pNames.indexOf(searchSym);
      // A new closure on every lookup, whose saved env is this frame itself.
      return n !== -1 ? procVal(rec.procedure(env.bVars[n], env.pBodies[n], env)) : applyEnv(rec, env.savedEnv, searchSym);
    }
    default:
      throw new Error(`apply-env: EXPLICIT-REFS has no ${env.kind} frames`);
  }
}
