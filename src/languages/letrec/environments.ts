// Port of chapter3/letrec-lang/environments.scm.

import type { Env } from '../../core/env';
import { EoplError } from '../../core/errors';
import type { Recorder } from '../../core/trace';
import { numVal, procVal, type ExpVal } from '../../core/values';

// init-env : () -> Env
// usage: (init-env) = [i=1, v=5, x=10]
export function initEnv(rec: Recorder): Env {
  return rec.extendEnv('i', numVal(1n), rec.extendEnv('v', numVal(5n), rec.extendEnv('x', numVal(10n), rec.emptyEnv())));
}

export function applyEnv(rec: Recorder, env: Env, searchSym: string): ExpVal {
  switch (env.kind) {
    case 'empty-env':
      throw new EoplError('apply-env', `No binding for ${searchSym}`);
    case 'extend-env':
      // In LETREC every bound value is an ExpVal; a Ref (number) can't get here.
      return env.bvar === searchSym ? (env.bval as ExpVal) : applyEnv(rec, env.savedEnv, searchSym);
    case 'extend-env-rec':
      // Every lookup of the procedure's name makes a new closure, whose saved
      // env is this frame itself: that is what makes the recursion work.
      return env.pName === searchSym ? procVal(rec.procedure(env.bVar, env.pBody, env)) : applyEnv(rec, env.savedEnv, searchSym);
    default:
      throw new Error(`apply-env: LETREC has no ${env.kind} frames`);
  }
}
