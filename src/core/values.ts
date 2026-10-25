// Expressed values and the other run-time data of chapters 3-5
// (data-structures.scm in the official code).

import type { AstNode } from './ast';
import type { Env } from './env';
import { EoplError } from './errors';
import { writeValue } from './print';

/** Numbers are bigint because Racket integers never overflow. */
export type ExpVal =
  | { readonly tag: 'num-val'; readonly num: bigint }
  | { readonly tag: 'bool-val'; readonly bool: boolean }
  | { readonly tag: 'proc-val'; readonly proc: Proc }
  | { readonly tag: 'ref-val'; readonly ref: Ref }
  | { readonly tag: 'mutpair-val'; readonly p: MutPair };

/** A store location. As in store.scm, reference? is integer?. */
export type Ref = number;

/** (procedure bvar body saved-env). `bvar` is null in the nameless language. */
export interface Proc {
  readonly id: number;
  readonly kind: 'procedure';
  readonly bvar: string | null;
  readonly body: AstNode;
  readonly savedEnv: Env;
}

/** (a-pair left-loc right-loc), from mutable-pairs. */
export interface MutPair {
  readonly kind: 'a-pair';
  readonly leftLoc: Ref;
  readonly rightLoc: Ref;
}

/** (a-thunk exp1 env), from call-by-name and call-by-need. Only ever stored in the store. */
export interface Thunk {
  readonly id: number;
  readonly kind: 'a-thunk';
  readonly exp1: AstNode;
  readonly env: Env;
}

/** What a store location holds. */
export type StoreVal = ExpVal | Thunk;

/**
 * What an environment binds a name to. In LET, PROC, LETREC, NAMELESS and
 * EXPLICIT-REFS that is an ExpVal; from IMPLICIT-REFS on it is a Ref.
 */
export type DenVal = ExpVal | Ref;

export const numVal = (num: bigint): ExpVal => ({ tag: 'num-val', num });
export const boolVal = (bool: boolean): ExpVal => ({ tag: 'bool-val', bool });
export const procVal = (proc: Proc): ExpVal => ({ tag: 'proc-val', proc });
export const refVal = (ref: Ref): ExpVal => ({ tag: 'ref-val', ref });
export const mutpairVal = (p: MutPair): ExpVal => ({ tag: 'mutpair-val', p });

export function isThunk(v: StoreVal): v is Thunk {
  return 'kind' in v && v.kind === 'a-thunk';
}

// Extractors. On a mismatch they fail the way expval-extractor-error does.

export function expvalToNum(v: ExpVal): bigint {
  if (v.tag === 'num-val') return v.num;
  return extractorError('num', v);
}

export function expvalToBool(v: ExpVal): boolean {
  if (v.tag === 'bool-val') return v.bool;
  return extractorError('bool', v);
}

export function expvalToProc(v: ExpVal): Proc {
  if (v.tag === 'proc-val') return v.proc;
  return extractorError('proc', v);
}

export function expvalToRef(v: ExpVal): Ref {
  if (v.tag === 'ref-val') return v.ref;
  return extractorError('ref', v);
}

export function expvalToMutpair(v: ExpVal): MutPair {
  if (v.tag === 'mutpair-val') return v.p;
  return extractorError('mutpair', v);
}

// (eopl:error 'expval-extractors "Looking for a ~s, found ~s" variant value)
function extractorError(variant: string, value: ExpVal): never {
  throw new EoplError('expval-extractors', `Looking for a ${variant}, found ${writeValue(value)}`);
}
