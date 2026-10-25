// Port of chapter3/let-lang/interp.scm. Same clauses, same evaluation order.
// Each value-of call is one step: rec.valueOf when it starts, rec.returns when it returns.

import type { Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { record, type RunOptions, type Trace } from '../../core/trace';
import { boolVal, expvalToBool, expvalToNum, numVal, type ExpVal } from '../../core/values';
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
          return applyEnv(env, exp.var);

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
      }
    }

    return valueOf(pgm.root.exp1, initEnv(rec));
  });
}
