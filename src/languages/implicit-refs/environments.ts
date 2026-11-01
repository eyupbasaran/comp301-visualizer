// Port of chapter4/implicit-refs/environments.scm. DenVal = Ref(ExpVal): the
// environment binds each name to a store location.

import type { Env } from '../../core/env';
import { EoplError } from '../../core/errors';
import type { Recorder } from '../../core/trace';
import { numVal, procVal, type Ref } from '../../core/values';

// init-env : () -> Env
// i, v and x are bound to locations holding 1, 5 and 10. Racket evaluates the
// arguments left to right, and so does JavaScript: i gets location 0, v 1, x 2.
export function initEnv(rec: Recorder): Env {
  return rec.extendEnv(
    'i',
    rec.store.newref(numVal(1n)),
    rec.extendEnv('v', rec.store.newref(numVal(5n)), rec.extendEnv('x', rec.store.newref(numVal(10n)), rec.emptyEnv())),
  );
}

export function applyEnv(rec: Recorder, env: Env, searchVar: string): Ref {
  switch (env.kind) {
    case 'empty-env':
      throw new EoplError('apply-env', `No binding for ${searchVar}`);
    case 'extend-env':
      return env.bvar === searchVar ? (env.bval as Ref) : applyEnv(rec, env.savedEnv, searchVar);
    case 'extend-env-rec*': {
      // (location search-var p-names): the first procedure with that name.
      const n = env.pNames.indexOf(searchVar);
      // Every lookup puts a new closure into a new location.
      return n !== -1
        ? rec.store.newref(procVal(rec.procedure(env.bVars[n], env.pBodies[n], env)))
        : applyEnv(rec, env.savedEnv, searchVar);
    }
    default:
      throw new Error(`apply-env: IMPLICIT-REFS has no ${env.kind} frames`);
  }
}
