// Port of chapter4/mutable-pairs/interp.scm. The pairs are those of
// pairval1.scm ((a-pair left-loc right-loc), the representation the lectures
// teach first) or of pairval2.scm (two consecutive locations, the one the
// official pairvals.scm picks), whichever the caller asks for.
// Same clauses, same evaluation order. Each value-of call is one step.
// apply-procedure is not a step; the value-of on the procedure body is.
//
// The cases in this interp.scm name some fields differently (if-exp has exp0
// exp1 exp2, assign-exp has x e); the AST keeps the names the other languages
// use, so a node looks the same in every language.

import type { Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { pairOps, type PairVal } from '../../core/pairvals';
import { record, type RunOptions, type Trace } from '../../core/trace';
import {
  boolVal,
  expvalToBool,
  expvalToMutpair,
  expvalToNum,
  expvalToProc,
  mutpairVal,
  numVal,
  procVal,
  type ExpVal,
  type Proc,
} from '../../core/values';
import { applyEnv, initEnv } from './environments';
import type { AProgram, Expression } from './lang';

// value-of-program : Program -> ExpVal
export function valueOfProgram(pgm: Program<AProgram>, options?: RunOptions, pairval: PairVal = 'pairval1'): Trace {
  return record(pgm, options, (rec) => {
    // Only ExpVals are ever stored in this language.
    const deref = (ref: number) => rec.store.deref(ref) as ExpVal;

    // pairvals.scm: the pairs of pairval1.scm or of pairval2.scm.
    const { makePair, left, right, setleft, setright } = pairOps(pairval, rec.store);

    // value-of : Exp * Env -> ExpVal
    function valueOf(exp: Expression, env: Env): ExpVal {
      const step = rec.valueOf(exp, env);
      return rec.returns(step, cases(exp, env));
    }

    function cases(exp: Expression, env: Env): ExpVal {
      switch (exp.kind) {
        case 'const-exp':
          return numVal(exp.num);

        case 'var-exp':
          return deref(applyEnv(rec, env, exp.var));

        case 'diff-exp': {
          // Unlike IMPLICIT-REFS, each operand is checked to be a number right
          // after it is evaluated, so a bad first operand stops the run before
          // the second one is evaluated.
          const val1 = expvalToNum(valueOf(exp.exp1, env));
          const val2 = expvalToNum(valueOf(exp.exp2, env));
          return numVal(val1 - val2);
        }

        case 'zero?-exp': {
          const val1 = expvalToNum(valueOf(exp.exp1, env));
          return val1 === 0n ? boolVal(true) : boolVal(false);
        }

        case 'if-exp':
          return expvalToBool(valueOf(exp.exp1, env)) ? valueOf(exp.exp2, env) : valueOf(exp.exp3, env);

        case 'let-exp': {
          const val = valueOf(exp.exp1, env);
          return valueOf(exp.body, rec.extendEnv(exp.var, rec.store.newref(val), env));
        }

        case 'proc-exp':
          return procVal(rec.procedure(exp.var, exp.body, env));

        case 'call-exp': {
          // The rator is checked to be a procedure before the rand is evaluated.
          const proc = expvalToProc(valueOf(exp.rator, env));
          const arg = valueOf(exp.rand, env);
          return applyProcedure(proc, arg);
        }

        case 'letrec-exp':
          return valueOf(exp.letrecBody, rec.extendEnvRecStar(exp.pNames, exp.bVars, exp.pBodies, env));

        case 'begin-exp': {
          // value-of-begins: each expression in order; the value of the last one is the value.
          let v1 = valueOf(exp.exp1, env);
          for (const e of exp.exps) v1 = valueOf(e, env);
          return v1;
        }

        case 'assign-exp': {
          // (setref! (apply-env env x) (value-of e env)): the lookup comes first.
          const ref = applyEnv(rec, env, exp.var);
          rec.store.setref(ref, valueOf(exp.exp1, env));
          return numVal(27n);
        }

        case 'newpair-exp': {
          const v1 = valueOf(exp.exp1, env);
          const v2 = valueOf(exp.exp2, env);
          return mutpairVal(makePair(v1, v2));
        }

        case 'left-exp': {
          const v1 = valueOf(exp.exp1, env);
          const p1 = expvalToMutpair(v1);
          return left(p1);
        }

        case 'right-exp': {
          const v1 = valueOf(exp.exp1, env);
          const p1 = expvalToMutpair(v1);
          return right(p1);
        }

        case 'setleft-exp': {
          // Both operands are evaluated before the first is checked to be a pair.
          const v1 = valueOf(exp.exp1, env);
          const v2 = valueOf(exp.exp2, env);
          const p = expvalToMutpair(v1);
          setleft(p, v2);
          return numVal(82n);
        }

        case 'setright-exp': {
          const v1 = valueOf(exp.exp1, env);
          const v2 = valueOf(exp.exp2, env);
          const p = expvalToMutpair(v1);
          setright(p, v2);
          return numVal(83n);
        }
      }
    }

    // apply-procedure : Proc * ExpVal -> ExpVal
    function applyProcedure(proc1: Proc, arg: ExpVal): ExpVal {
      const r = rec.store.newref(arg);
      return valueOf(proc1.body as Expression, rec.extendEnv(proc1.bvar!, r, proc1.savedEnv));
    }

    return valueOf(pgm.root.exp1, initEnv(rec));
  });
}
