// Port of chapter3/lexaddr-lang/interp.scm. Same clauses, same evaluation order.
// Each value-of call is one step: rec.valueOf when it starts, rec.returns when it returns.
//
// Unlike LET and PROC, diff-exp here checks each operand is a number right
// after evaluating it, before it evaluates the next one.

import type { Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { record, type RunOptions, type Trace } from '../../core/trace';
import { boolVal, expvalToBool, expvalToNum, expvalToProc, numVal, procVal, type ExpVal, type Proc } from '../../core/values';
import { applyNamelessEnv, initNamelessEnv } from './environments';
import type { Nameless, NamelessProgram } from './lang';

// value-of-translation : Nameless-program -> ExpVal
export function valueOfTranslation(pgm: Program<NamelessProgram>, options?: RunOptions): Trace {
  return record(pgm, options, (rec) => {
    // value-of : Nameless-exp * Nameless-env -> ExpVal
    function valueOf(exp: Nameless, namelessEnv: Env): ExpVal {
      const step = rec.valueOf(exp, namelessEnv);
      return rec.returns(step, cases(exp, namelessEnv));
    }

    function cases(exp: Nameless, namelessEnv: Env): ExpVal {
      switch (exp.kind) {
        case 'const-exp':
          return numVal(exp.num);

        case 'diff-exp': {
          const val1 = expvalToNum(valueOf(exp.exp1, namelessEnv));
          const val2 = expvalToNum(valueOf(exp.exp2, namelessEnv));
          return numVal(val1 - val2);
        }

        case 'zero?-exp': {
          const val1 = expvalToNum(valueOf(exp.exp1, namelessEnv));
          return val1 === 0n ? boolVal(true) : boolVal(false);
        }

        case 'if-exp':
          return expvalToBool(valueOf(exp.exp1, namelessEnv)) ? valueOf(exp.exp2, namelessEnv) : valueOf(exp.exp3, namelessEnv);

        case 'call-exp': {
          const proc = expvalToProc(valueOf(exp.rator, namelessEnv));
          const arg = valueOf(exp.rand, namelessEnv);
          return applyProcedure(proc, arg);
        }

        case 'nameless-var-exp':
          return applyNamelessEnv(namelessEnv, exp.n);

        case 'nameless-let-exp': {
          const val = valueOf(exp.exp1, namelessEnv);
          return valueOf(exp.body, rec.extendNamelessEnv(val, namelessEnv));
        }

        case 'nameless-proc-exp':
          return procVal(rec.procedure(null, exp.body, namelessEnv));
      }
    }

    // apply-procedure : Proc * ExpVal -> ExpVal
    function applyProcedure(proc1: Proc, arg: ExpVal): ExpVal {
      return valueOf(proc1.body as Nameless, rec.extendNamelessEnv(arg, proc1.savedEnv));
    }

    return valueOf(pgm.root.exp1, initNamelessEnv(rec));
  });
}
