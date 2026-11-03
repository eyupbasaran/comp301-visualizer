// Port of chapter5/letrec-lang/interp.scm, the continuation-passing interpreter
// with data-structure continuations. Same clauses, same evaluation order.
// Each value-of/k call and each apply-cont call is one step; apply-procedure/k
// is not a step.
//
// Every call in this interpreter is a tail call. Racket makes a tail call
// without growing its stack; JavaScript does not. So instead of calling each
// other, value-of/k and apply-cont return the call they would make next, and
// the loop at the end makes it. The calls, their order and their arguments are
// those of the official code.

import type { AstNode, Program } from '../../core/ast';
import type { Env } from '../../core/env';
import { record, type Cont, type Recorder, type RunOptions, type Trace } from '../../core/trace';
import { boolVal, expvalToBool, expvalToNum, expvalToProc, numVal, procVal, type ExpVal, type Proc } from '../../core/values';
import type { Continuation, Diff1Cont, Diff2Cont, EndCont, IfTestCont, LetExpCont, RandCont, RatorCont, Zero1Cont } from './continuations';
import { applyEnv, initEnv } from './environments';
import type { AProgram, Expression } from './lang';

/** The tail call to make next, or the final answer. */
export type Next =
  | { readonly kind: 'value-of/k'; readonly exp: Expression; readonly env: Env; readonly cont: Continuation }
  | { readonly kind: 'apply-cont'; readonly cont: Continuation; readonly val: ExpVal }
  | { readonly kind: 'done'; readonly val: ExpVal };

const valueOfK = (exp: Expression, env: Env, cont: Continuation): Next => ({ kind: 'value-of/k', exp, env, cont });
const applyCont = (cont: Continuation, val: ExpVal): Next => ({ kind: 'apply-cont', cont, val });

interface ExtensionOps {
  valueOfK(exp: AstNode, env: Env, cont: Cont): Next;
  applyCont(cont: Cont, val: ExpVal): Next;
  rec: Recorder;
}

/** Clauses for an expression this language does not have, and its continuations: an Extend exercise's model answer. */
export interface Extension {
  valueOfK(exp: AstNode, env: Env, cont: Cont, ops: ExtensionOps): Next;
  applyCont(cont: Cont, val: ExpVal, ops: ExtensionOps): Next;
}

// value-of-program : Program -> FinalAnswer
export function valueOfProgram(pgm: Program<AProgram>, options?: RunOptions, extension?: Extension): Trace {
  return record(pgm, options, (rec) => {
    const ops: ExtensionOps = {
      valueOfK: (exp, env, cont) => valueOfK(exp as Expression, env, cont as Continuation),
      applyCont: (cont, val) => applyCont(cont as Continuation, val),
      rec,
    };

    // value-of/k : Exp * Env * Cont -> FinalAnswer
    function stepValueOfK(exp: Expression, env: Env, cont: Continuation): Next {
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
        default:
          return extension!.valueOfK(exp as AstNode, env, cont, ops);
      }
    }

    // apply-cont : Cont * ExpVal -> FinalAnswer
    function stepApplyCont(cont: Continuation, val: ExpVal): Next {
      rec.applyCont(cont, val);
      switch (cont.kind) {
        case 'end-cont':
          rec.print('End of computation.');
          return { kind: 'done', val };
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
        default:
          return extension!.applyCont(cont as Cont, val, ops);
      }
    }

    // apply-procedure/k : Proc * ExpVal * Cont -> FinalAnswer
    function applyProcedureK(proc1: Proc, arg: ExpVal, cont: Continuation): Next {
      return valueOfK(proc1.body as Expression, rec.extendEnv(proc1.bvar!, arg, proc1.savedEnv), cont);
    }

    let next = valueOfK(pgm.root.exp1, initEnv(rec), rec.cont<EndCont>({ kind: 'end-cont' }));
    for (;;) {
      if (next.kind === 'value-of/k') next = stepValueOfK(next.exp, next.env, next.cont);
      else if (next.kind === 'apply-cont') next = stepApplyCont(next.cont, next.val);
      else return next.val;
    }
  });
}
