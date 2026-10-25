// Text forms of run-time values, for tests, error messages and plain-text views.

import { astToSExp } from './ast';
import type { Env } from './env';
import { framesOf } from './env';
import type { Outcome } from './trace';
import type { DenVal, ExpVal, StoreVal } from './values';

/** "(num-val 3)", or "error: apply-env: No binding for foo". */
export function outcomeToString(outcome: Outcome): string {
  return outcome.kind === 'value' ? valueToSExp(outcome.value) : `${outcome.kind}: ${outcome.message}`;
}

/**
 * EOPL form: (num-val 3), (bool-val #t), (ref-val 2),
 * (proc-val (procedure x (diff-exp (var-exp x) (var-exp a)) ((a (num-val 5)) (i (num-val 1)) ...))).
 */
export function valueToSExp(v: StoreVal): string {
  if ('kind' in v) return `(a-thunk ${astToSExp(v.exp1)} ${envToList(v.env)})`;
  switch (v.tag) {
    case 'num-val':
      return `(num-val ${v.num})`;
    case 'bool-val':
      return `(bool-val ${v.bool ? '#t' : '#f'})`;
    case 'proc-val': {
      const { bvar, body, savedEnv } = v.proc;
      const parts = ['procedure', ...(bvar === null ? [] : [bvar]), astToSExp(body), envToList(savedEnv)];
      return `(proc-val (${parts.join(' ')}))`;
    }
    case 'ref-val':
      return `(ref-val ${v.ref})`;
    case 'mutpair-val':
      return `(mutpair-val (a-pair ${v.p.leftLoc} ${v.p.rightLoc}))`;
  }
}

/** A denoted value: an ExpVal, or a Ref, which prints as the bare location number. */
export function denValToSExp(d: DenVal): string {
  return typeof d === 'number' ? String(d) : valueToSExp(d);
}

/**
 * The environment as a list, newest binding first, like env->list in the
 * official code: ((f 3) (i 0) (v 1) (x 2)). A letrec frame shows as
 * (letrec (even odd) ...), so recursive closures don't print forever.
 */
export function envToList(env: Env): string {
  const entries = framesOf(env).map((frame) => {
    switch (frame.kind) {
      case 'extend-env':
        return `(${frame.bvar} ${denValToSExp(frame.bval)})`;
      case 'extend-env-rec':
        return `(letrec (${frame.pName}) ...)`;
      case 'extend-env-rec*':
        return `(letrec (${frame.pNames.join(' ')}) ...)`;
      case 'extend-nameless-env':
        return valueToSExp(frame.val);
    }
  });
  return `(${entries.join(' ')})`;
}

/**
 * How DrRacket's ~s prints a value inside an eopl:error message:
 * #(struct:bool-val #t). Procedures are cut short.
 */
export function writeValue(v: ExpVal): string {
  switch (v.tag) {
    case 'num-val':
      return `#(struct:num-val ${v.num})`;
    case 'bool-val':
      return `#(struct:bool-val ${v.bool ? '#t' : '#f'})`;
    case 'proc-val': {
      const bvar = v.proc.bvar === null ? '' : `${v.proc.bvar} `;
      return `#(struct:proc-val #(struct:procedure ${bvar}...))`;
    }
    case 'ref-val':
      return `#(struct:ref-val ${v.ref})`;
    case 'mutpair-val':
      return `#(struct:mutpair-val #(struct:a-pair ${v.p.leftLoc} ${v.p.rightLoc}))`;
  }
}

/** Short form for the UI: 3, #t, (procedure x ...), (ref-val 2). */
export function showValue(v: StoreVal): string {
  if ('kind' in v) return '(a-thunk ...)';
  switch (v.tag) {
    case 'num-val':
      return v.num.toString();
    case 'bool-val':
      return v.bool ? '#t' : '#f';
    case 'proc-val':
      return v.proc.bvar === null ? '(procedure ...)' : `(procedure ${v.proc.bvar} ...)`;
    case 'ref-val':
      return `(ref-val ${v.ref})`;
    case 'mutpair-val':
      return `(mutpair-val ${v.p.leftLoc} ${v.p.rightLoc})`;
  }
}
