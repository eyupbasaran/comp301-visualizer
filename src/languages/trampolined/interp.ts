// TRAMPOLINED has no folder in the official code. This is the trampolined
// interpreter of the book (section 5.2) and Lecture 26: the CPS interpreter of
// chapter5/letrec-lang, except that apply-procedure/k returns a bounce, a
// procedure of no arguments that goes on with the computation, and
// value-of-program runs everything through the trampoline.
//
//   Bounce = ExpVal ∪ (() → Bounce)
//
// value-of/k and apply-cont call each other directly here, so the JavaScript
// stack grows until apply-procedure/k returns a bounce and the trampoline
// starts again from an empty stack. Each value-of/k and apply-cont call is one
// step; the step right after a bounce is marked (rec.bounce).

import type { Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { record, type Recorder, type RunOptions, type Trace } from '../../core/trace';
import { boolVal, expvalToBool, expvalToNum, expvalToProc, numVal, procVal, type ExpVal, type Proc } from '../../core/values';
import type {
  Continuation,
  Diff1Cont,
  Diff2Cont,
  EndCont,
  IfTestCont,
  LetExpCont,
  RandCont,
  RatorCont,
  Zero1Cont,
} from '../cps/continuations';
import { applyEnv, initEnv } from './environments';
import type { AProgram, Expression } from './lang';

type Bounce = ExpVal | (() => Bounce);

// value-of-program : Program -> FinalAnswer
export function valueOfProgram(pgm: Program<AProgram>, options?: RunOptions): Trace {
  return record(pgm, options, (rec) => {
    // value-of/k : Exp * Env * Cont -> Bounce
    function valueOfK(exp: Expression, env: Env, cont: Continuation): Bounce {
      rec.valueOfK(exp, env, cont);
      switch (exp.kind) {
        case 'const-exp':
          return applyCont(cont, numVal(exp.num));
        case 'var-exp':
          return applyCont(cont, applyEnv(rec, env, exp.var));
        case 'proc-exp':
          return applyCont(cont, procVal(rec.procedure(exp.var, exp.body, env)));
        case 'letrec-exp':
          return valueOfK(exp.letrecBody, rec.extendEnvRec(exp.pName, exp.bVar, exp.pBody, env), cont);
        case 'zero?-exp':
          return valueOfK(exp.exp1, env, rec.cont<Zero1Cont>({ kind: 'zero1-cont', savedCont: cont }));
        case 'let-exp':
          return valueOfK(
            exp.exp1,
            env,
            rec.cont<LetExpCont>({ kind: 'let-exp-cont', var: exp.var, body: exp.body, savedEnv: env, savedCont: cont }),
          );
        case 'if-exp':
          return valueOfK(
            exp.exp1,
            env,
            rec.cont<IfTestCont>({ kind: 'if-test-cont', exp2: exp.exp2, exp3: exp.exp3, savedEnv: env, savedCont: cont }),
          );
        case 'diff-exp':
          return valueOfK(exp.exp1, env, rec.cont<Diff1Cont>({ kind: 'diff1-cont', exp2: exp.exp2, savedEnv: env, savedCont: cont }));
        case 'call-exp':
          return valueOfK(exp.rator, env, rec.cont<RatorCont>({ kind: 'rator-cont', rand: exp.rand, savedEnv: env, savedCont: cont }));
      }
    }

    // apply-cont : Cont * ExpVal -> Bounce
    function applyCont(cont: Continuation, val: ExpVal): Bounce {
      rec.applyCont(cont, val);
      switch (cont.kind) {
        case 'end-cont':
          rec.print('End of computation.');
          return val;
        case 'zero1-cont':
          return applyCont(cont.savedCont, boolVal(expvalToNum(val) === 0n));
        case 'let-exp-cont':
          return valueOfK(cont.body, rec.extendEnv(cont.var, val, cont.savedEnv), cont.savedCont);
        case 'if-test-cont':
          return expvalToBool(val) ? valueOfK(cont.exp2, cont.savedEnv, cont.savedCont) : valueOfK(cont.exp3, cont.savedEnv, cont.savedCont);
        case 'diff1-cont':
          return valueOfK(cont.exp2, cont.savedEnv, rec.cont<Diff2Cont>({ kind: 'diff2-cont', val1: val, savedCont: cont.savedCont }));
        case 'diff2-cont': {
          const num1 = expvalToNum(cont.val1);
          const num2 = expvalToNum(val);
          return applyCont(cont.savedCont, numVal(num1 - num2));
        }
        case 'rator-cont':
          return valueOfK(cont.rand, cont.savedEnv, rec.cont<RandCont>({ kind: 'rand-cont', val1: val, savedCont: cont.savedCont }));
        case 'rand-cont': {
          const proc = expvalToProc(cont.val1);
          return applyProcedureK(proc, val, cont.savedCont);
        }
      }
    }

    // apply-procedure/k : Proc * ExpVal * Cont -> Bounce
    // It does not call value-of/k: it returns a procedure that will.
    function applyProcedureK(proc1: Proc, val: ExpVal, cont: Continuation): Bounce {
      return () => valueOfK(proc1.body as Expression, rec.extendEnv(proc1.bvar!, val, proc1.savedEnv), cont);
    }

    return trampoline(rec, valueOfK(pgm.root.exp1, initEnv(rec), rec.cont<EndCont>({ kind: 'end-cont' })));
  });
}

// trampoline : Bounce -> FinalAnswer
function trampoline(rec: Recorder, bounce: Bounce): ExpVal {
  while (typeof bounce === 'function') {
    rec.bounce();
    bounce = bounce();
  }
  return bounce;
}
