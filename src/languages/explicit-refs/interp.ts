// Port of chapter4/explicit-refs/interp.scm. Same clauses, same evaluation order.
// Each value-of call is one step: rec.valueOf when it starts, rec.returns when it returns.
// apply-procedure is not a step; the value-of on the procedure body is.
// The store is rec.store, which starts empty (initialize-store!) for every run.

import type { Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { record, type RunOptions, type Trace } from '../../core/trace';
import {
  boolVal,
  expvalToBool,
  expvalToNum,
  expvalToProc,
  expvalToRef,
  numVal,
  procVal,
  refVal,
  type ExpVal,
  type Proc,
} from '../../core/values';
import { applyEnv, initEnv } from './environments';
import type { AProgram, Expression } from './lang';

// value-of-program : Program -> ExpVal
export function valueOfProgram(pgm: Program<AProgram>, options?: RunOptions): Trace {
  return record(pgm, options, (rec) => {
    // value-of : Exp * Env -> ExpVal
    function valueOf(exp: Expression, env: Env): ExpVal {
      const step = rec.valueOf(exp, env);
      return rec.returns(step, cases(exp, env));
    }

    function cases(exp: Expression, env: Env): ExpVal {
      switch (exp.kind) {
        // (value-of (const-exp n) ρ) = n
        case 'const-exp':
          return numVal(exp.num);

        // (value-of (var-exp x) ρ) = (apply-env ρ x)
        case 'var-exp':
          return applyEnv(rec, env, exp.var);

        case 'diff-exp': {
          const val1 = valueOf(exp.exp1, env);
          const val2 = valueOf(exp.exp2, env);
          const num1 = expvalToNum(val1);
          const num2 = expvalToNum(val2);
          return numVal(num1 - num2);
        }

        case 'zero?-exp': {
          const val1 = valueOf(exp.exp1, env);
          const num1 = expvalToNum(val1);
          return num1 === 0n ? boolVal(true) : boolVal(false);
        }

        case 'if-exp': {
          const val1 = valueOf(exp.exp1, env);
          return expvalToBool(val1) ? valueOf(exp.exp2, env) : valueOf(exp.exp3, env);
        }

        case 'let-exp': {
          const val1 = valueOf(exp.exp1, env);
          return valueOf(exp.body, rec.extendEnv(exp.var, val1, env));
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

        case 'newref-exp': {
          const v1 = valueOf(exp.exp1, env);
          return refVal(rec.store.newref(v1));
        }

        case 'deref-exp': {
          const v1 = valueOf(exp.exp1, env);
          const ref1 = expvalToRef(v1);
          // Only ExpVals are ever stored in this language.
          return rec.store.deref(ref1) as ExpVal;
        }

        case 'setref-exp': {
          // The first operand is checked to be a reference before the second is evaluated.
          const ref = expvalToRef(valueOf(exp.exp1, env));
          const v2 = valueOf(exp.exp2, env);
          rec.store.setref(ref, v2);
          return numVal(23n);
        }
      }
    }

    // apply-procedure : Proc * ExpVal -> ExpVal
    function applyProcedure(proc1: Proc, arg: ExpVal): ExpVal {
      return valueOf(proc1.body as Expression, rec.extendEnv(proc1.bvar!, arg, proc1.savedEnv));
    }

    return valueOf(pgm.root.exp1, initEnv(rec));
  });
}
