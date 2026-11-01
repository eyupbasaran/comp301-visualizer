// The continuation datatype of chapter5/letrec-lang/data-structures.scm, with
// the official variant and field names (camelCase). Continuations are made
// through rec.cont, which gives each frame an id.

import type { Env } from '../../core/env';
import type { Cont } from '../../core/trace';
import type { ExpVal } from '../../core/values';
import type { Expression } from './lang';

export interface EndCont extends Cont {
  readonly kind: 'end-cont';
}

export interface Zero1Cont extends Cont {
  readonly kind: 'zero1-cont';
  readonly savedCont: Continuation;
}

export interface LetExpCont extends Cont {
  readonly kind: 'let-exp-cont';
  readonly var: string;
  readonly body: Expression;
  readonly savedEnv: Env;
  readonly savedCont: Continuation;
}

export interface IfTestCont extends Cont {
  readonly kind: 'if-test-cont';
  readonly exp2: Expression;
  readonly exp3: Expression;
  readonly savedEnv: Env;
  readonly savedCont: Continuation;
}

export interface Diff1Cont extends Cont {
  readonly kind: 'diff1-cont';
  readonly exp2: Expression;
  readonly savedEnv: Env;
  readonly savedCont: Continuation;
}

export interface Diff2Cont extends Cont {
  readonly kind: 'diff2-cont';
  readonly val1: ExpVal;
  readonly savedCont: Continuation;
}

export interface RatorCont extends Cont {
  readonly kind: 'rator-cont';
  readonly rand: Expression;
  readonly savedEnv: Env;
  readonly savedCont: Continuation;
}

export interface RandCont extends Cont {
  readonly kind: 'rand-cont';
  readonly val1: ExpVal;
  readonly savedCont: Continuation;
}

export type Continuation = EndCont | Zero1Cont | LetExpCont | IfTestCont | Diff1Cont | Diff2Cont | RatorCont | RandCont;
