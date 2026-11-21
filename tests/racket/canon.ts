// What a step of our trace sees, printed the way scripts/racket-check/steps.rkt prints what
// the official interpreter sees: a define-datatype record as (variant field ...), a list as a
// list. Each official folder represents environments its own way, so this follows them:
//   list      LET and PROC (proc-lang/ds-rep): a list of (var val), newest first
//   nameless  NAMELESS: a list of values
//   datatype  everything else: (extend-env var val saved-env), (extend-env-rec ...), (empty-env)

import { astToSExp, isAstNode, type FieldValue } from '../../src/core/ast';
import type { Env } from '../../src/core/env';
import { framesOf } from '../../src/core/env';
import type { Cont } from '../../src/core/trace';
import type { DenVal, StoreVal } from '../../src/core/values';

export type EnvRep = 'list' | 'nameless' | 'datatype';

export function canonExp(exp: FieldValue): string {
  return astToSExp(exp);
}

export function canonVal(v: StoreVal, rep: EnvRep): string {
  if ('kind' in v) return `(a-thunk ${canonExp(v.exp1)} ${canonEnv(v.env, rep)})`;
  switch (v.tag) {
    case 'num-val':
      return `(num-val ${v.num})`;
    case 'bool-val':
      return `(bool-val ${v.bool ? '#t' : '#f'})`;
    case 'proc-val': {
      const { bvar, body, savedEnv } = v.proc;
      return `(proc-val (procedure ${bvar === null ? '' : `${bvar} `}${canonExp(body)} ${canonEnv(savedEnv, rep)}))`;
    }
    case 'ref-val':
      return `(ref-val ${v.ref})`;
    case 'mutpair-val':
      return typeof v.p === 'number' ? `(mutpair-val ${v.p})` : `(mutpair-val (a-pair ${v.p.leftLoc} ${v.p.rightLoc}))`;
  }
}

function canonDen(d: DenVal, rep: EnvRep): string {
  return typeof d === 'number' ? String(d) : canonVal(d, rep);
}

export function canonEnv(env: Env, rep: EnvRep): string {
  if (rep === 'list') {
    return `(${framesOf(env)
      .map((f) => {
        if (f.kind !== 'extend-env') throw new Error(`a ${f.kind} frame in a list environment`);
        return `(${f.bvar} ${canonDen(f.bval, rep)})`;
      })
      .join(' ')})`;
  }
  if (rep === 'nameless') {
    return `(${framesOf(env)
      .map((f) => {
        if (f.kind !== 'extend-nameless-env') throw new Error(`a ${f.kind} frame in a nameless environment`);
        return canonVal(f.val, rep);
      })
      .join(' ')})`;
  }
  switch (env.kind) {
    case 'empty-env':
      return '(empty-env)';
    case 'extend-env':
      return `(extend-env ${env.bvar} ${canonDen(env.bval, rep)} ${canonEnv(env.savedEnv, rep)})`;
    case 'extend-env-rec':
      return `(extend-env-rec ${env.pName} ${env.bVar} ${canonExp(env.pBody)} ${canonEnv(env.savedEnv, rep)})`;
    case 'extend-env-rec*':
      return `(extend-env-rec* (${env.pNames.join(' ')}) (${env.bVars.join(' ')}) (${env.pBodies.map(canonExp).join(' ')}) ${canonEnv(env.savedEnv, rep)})`;
    case 'extend-nameless-env':
      throw new Error('a nameless frame in a datatype environment');
  }
}

const ENV_KINDS = new Set(['empty-env', 'extend-env', 'extend-env-rec', 'extend-env-rec*', 'extend-nameless-env']);

/** (diff1-cont exp2 saved-env saved-cont): the fields other than id and kind, in the order they were made. */
export function canonCont(cont: Cont, rep: EnvRep): string {
  const fields = Object.entries(cont)
    .filter(([key]) => key !== 'id' && key !== 'kind')
    .map(([, value]) => canonField(value, rep));
  return `(${[cont.kind, ...fields].join(' ')})`;
}

function canonField(value: unknown, rep: EnvRep): string {
  if (typeof value === 'string') return value;
  if (isAstNode(value)) return canonExp(value);
  if (typeof value === 'object' && value !== null) {
    if ('tag' in value) return canonVal(value as StoreVal, rep);
    const kind = (value as { kind?: string }).kind ?? '';
    if (ENV_KINDS.has(kind)) return canonEnv(value as Env, rep);
    if (kind.endsWith('-cont')) return canonCont(value as Cont, rep);
  }
  throw new Error(`a continuation field this printer does not know: ${JSON.stringify(value)}`);
}

/** get-store-as-list: ((0 val) (1 val) ...), or #f in a language without a store. */
export function canonStore(store: readonly StoreVal[] | null, rep: EnvRep): string {
  return store === null ? '#f' : `(${store.map((v, i) => `(${i} ${canonVal(v, rep)})`).join(' ')})`;
}
