// Port of chapter3/let-lang/environments.scm.

import type { Env } from '../../core/env';
import { EoplError } from '../../core/errors';
import type { Recorder } from '../../core/trace';
import { numVal, type ExpVal } from '../../core/values';

// init-env : () -> Env
// usage: (init-env) = [i=1, v=5, x=10]
export function initEnv(rec: Recorder): Env {
  return rec.extendEnv('i', numVal(1n), rec.extendEnv('v', numVal(5n), rec.extendEnv('x', numVal(10n), rec.emptyEnv())));
}

export function applyEnv(env: Env, searchSym: string): ExpVal {
  if (env.kind === 'empty-env') throw new EoplError('apply-env', `No binding for ${searchSym}`);
  if (env.kind !== 'extend-env') throw new Error(`apply-env: LET has no ${env.kind} frames`);
  // In LET every bound value is an ExpVal; a Ref (number) can't get here.
  return env.bvar === searchSym ? (env.bval as ExpVal) : applyEnv(env.savedEnv, searchSym);
}
