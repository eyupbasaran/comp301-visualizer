// The "extend the language" exercises of Extend mode, with model answers for all five parts.
// The model's production is read from answer.grammar and answer.abstract by the same reader
// the student's answers go through, and its `model` hook is the TypeScript twin of
// answer.implementation. tests/extend/exercises.test.ts runs every example against both.

import type { AstNode } from '../core/ast';
import { EoplError } from '../core/errors';
import type { LanguageId, LanguageModule } from '../core/language';
import type { Cont } from '../core/trace';
import { expvalToBool, expvalToNum, numVal } from '../core/values';
import { valueOfProgram as callByReference } from '../languages/call-by-reference/interp';
import { valueOfProgram as cps } from '../languages/cps/interp';
import { valueOfProgram as letLang } from '../languages/let/interp';
import { languageById } from '../languages';
import { extendLanguage } from './extend';
import { readAbstract, readEntry, toProduction } from './grammarText';

export interface ExerciseExample {
  readonly source: string;
  /** The value, or 'error' when the program must stop with an error. */
  readonly value: number | 'error';
  readonly note?: string;
}

export interface Exercise {
  readonly id: string;
  readonly title: string;
  readonly base: LanguageId;
  readonly question: string;
  readonly examples: readonly ExerciseExample[];
  readonly answer: {
    /** The book's notation. */
    readonly grammar: string;
    readonly abstract: string;
    readonly datatype: string;
    readonly spec: string;
    readonly implementation: string;
  };
  /** Variants of the base interp.scm whose clauses the implementation is closest to. */
  readonly related: readonly string[];
  /** What a full answer to (d) and (e) has to decide. */
  readonly checklist: readonly string[];
  /** The model implementation, run against the base interpreter. */
  readonly run: LanguageModule['run'];
}

// The fields of a node (or continuation) of the new variant, by the names in the answer.
const fields = (x: AstNode | Cont) => x as unknown as Record<string, never>;
type Frame = Cont & Record<string, unknown>;
const lists = (x: AstNode) => x as unknown as Record<string, never[]>;

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'let-if',
    title: 'let-if',
    base: 'let',
    question:
      'Consider a new expression let-if that combines the semantics of let and if: the variable is bound to one of two values, and one of two bodies is evaluated, based on the outcome of a test. For example,\n\n  let-if x = 5 or 10 based-on zero?(0)\n  in -(x,2) or -(x,4)\n\nreturns 3, and\n\n  let-if x = 5 or 10 based-on z\n  in -(x,2) or -(x,4)\n\nreturns 6 if z is false.',
    examples: [
      { source: 'let-if x = 5 or 10 based-on zero?(0)\nin -(x,2) or -(x,4)', value: 3 },
      { source: 'let z = zero?(1)\nin let-if x = 5 or 10 based-on z\n   in -(x,2) or -(x,4)', value: 6, note: 'z is false' },
      {
        source: 'let-if x = x or -(x,1) based-on zero?(-(x,10))\nin -(x,1) or x',
        value: 9,
        note: 'the right-hand x is the outer x = 10: the values and the test are evaluated in the outer env',
      },
    ],
    answer: {
      grammar: 'Expression ::= let-if Identifier = Expression or Expression based-on Expression in Expression or Expression',
      abstract: 'let-if-exp (var exp1 exp2 exp3 body1 body2)',
      datatype:
        '(let-if-exp\n  (var identifier?)\n  (exp1 expression?)\n  (exp2 expression?)\n  (exp3 expression?)\n  (body1 expression?)\n  (body2 expression?))',
      spec:
        '(value-of (let-if-exp var exp1 exp2 exp3 body1 body2) ρ)\n' +
        '  = (value-of body1 [var = (value-of exp1 ρ)]ρ)   if (expval->bool (value-of exp3 ρ)) = #t\n' +
        '  = (value-of body2 [var = (value-of exp2 ρ)]ρ)   if (expval->bool (value-of exp3 ρ)) = #f',
      implementation:
        '(let-if-exp (var exp1 exp2 exp3 body1 body2)\n' +
        '  (let ((val (value-of exp3 env)))\n' +
        '    (if (expval->bool val)\n' +
        '        (value-of body1 (extend-env var (value-of exp1 env) env))\n' +
        '        (value-of body2 (extend-env var (value-of exp2 env) env)))))',
    },
    related: ['let-exp', 'if-exp'],
    checklist: [
      'The test is evaluated first, in ρ.',
      'Only the chosen value is evaluated (exp1 or exp2), not both, and in ρ, not in the new env.',
      'var is in scope in both bodies, and only there: not in exp1, exp2 or exp3.',
      'The test must be a boolean: expval->bool reports an error otherwise.',
    ],
    run: (program, options) =>
      letLang(program as never, options, (exp, env, { valueOf, rec }) => {
        const f = fields(exp);
        const val = valueOf(f.exp3, env);
        return expvalToBool(val)
          ? valueOf(f.body1, rec.extendEnv(f.var, valueOf(f.exp1, env), env))
          : valueOf(f.body2, rec.extendEnv(f.var, valueOf(f.exp2, env), env));
      }),
  },
  {
    id: 'minus',
    title: 'Book Ex. 3.6: minus',
    base: 'let',
    question:
      'Extend the language by adding a new operator minus that takes one argument, n, and returns −n. For example, the value of minus(-(minus(5),9)) should be 14.',
    examples: [
      { source: 'minus(-(minus(5),9))', value: 14 },
      { source: 'let y = minus(x)\nin -(y,1)', value: -11, note: 'x is 10 in the init-env' },
      { source: 'minus(zero?(0))', value: 'error', note: 'minus needs a number' },
    ],
    answer: {
      grammar: 'Expression ::= minus (Expression)',
      abstract: 'minus-exp (exp1)',
      datatype: '(minus-exp\n  (exp1 expression?))',
      spec: '(value-of (minus-exp exp1) ρ) = ⌈− ⌊(value-of exp1 ρ)⌋⌉',
      implementation: '(minus-exp (exp1)\n  (let ((num1 (expval->num (value-of exp1 env))))\n    (num-val (- num1))))',
    },
    related: ['zero?-exp', 'diff-exp'],
    checklist: [
      'The operand is evaluated in ρ.',
      'Its value is an ExpVal: take the number out with expval->num (⌊ ⌋), and put the result back with num-val (⌈ ⌉).',
      'A non-number operand is an error, reported by expval->num.',
    ],
    run: (program, options) =>
      letLang(program as never, options, (exp, env, { valueOf }) => numVal(-expvalToNum(valueOf(fields(exp).exp1, env)))),
  },
  {
    id: 'cond',
    title: 'Book Ex. 3.12: cond',
    base: 'let',
    question:
      'Add to the defined language a facility that adds a cond expression. Use the grammar\n\n  Expression ::= cond {Expression ==> Expression}* end\n\nIn this expression, the expressions on the left-hand sides of the ==>\'s are evaluated in order until one of them returns a true value. Then the value of the entire expression is the value of the corresponding right-hand expression. If none of the tests succeeds, the expression should report an error.',
    examples: [
      { source: 'cond zero?(1) ==> 1\n     zero?(0) ==> 2\nend', value: 2 },
      { source: 'let x = 0\nin cond zero?(-(x,1)) ==> 10\n        zero?(x) ==> 20\n   end', value: 20 },
      {
        source: 'cond zero?(0) ==> 1\n     zero?(-(zero?(0),1)) ==> 2\nend',
        value: 1,
        note: 'the second test would be an error, but it is never evaluated',
      },
      { source: 'cond zero?(1) ==> 1\nend', value: 'error', note: 'no test succeeds' },
    ],
    answer: {
      grammar: 'Expression ::= cond {Expression ==> Expression}* end',
      abstract: 'cond-exp (conds acts)',
      datatype: '(cond-exp\n  (conds (list-of expression?))\n  (acts (list-of expression?)))',
      spec:
        '(value-of (cond-exp (test1 … testn) (act1 … actn)) ρ)\n' +
        '  = (value-of acti ρ)\n' +
        '      where i is the first index with (expval->bool (value-of testi ρ)) = #t,\n' +
        '      after test1 … testi have been evaluated in order\n' +
        '  = error, if there is no such i',
      implementation:
        '(cond-exp (conds acts)\n' +
        '  (value-of-cond conds acts env))\n\n' +
        ';; value-of-cond : Listof(Exp) * Listof(Exp) * Env -> ExpVal\n' +
        '(define value-of-cond\n' +
        '  (lambda (conds acts env)\n' +
        '    (cond\n' +
        '      ((null? conds)\n' +
        '       (eopl:error \'value-of-cond "No condition got satisfied"))\n' +
        '      ((expval->bool (value-of (car conds) env))\n' +
        '       (value-of (car acts) env))\n' +
        '      (else (value-of-cond (cdr conds) (cdr acts) env)))))',
    },
    related: ['if-exp'],
    checklist: [
      '{Expression ==> Expression}* gives two fields, each a list: all the tests, and all the right-hand sides.',
      'The tests are evaluated in order, and evaluation stops at the first true one: later tests are never evaluated.',
      'Only the right-hand side of that test is evaluated.',
      'No true test is an error, not a default value.',
      'A list needs a helper that walks it: value-of-cond.',
    ],
    run: (program, options) =>
      letLang(program as never, options, (exp, env, { valueOf }) => {
        const { conds, acts } = lists(exp);
        for (let i = 0; i < conds.length; i++) if (expvalToBool(valueOf(conds[i], env))) return valueOf(acts[i], env);
        throw new EoplError('value-of-cond', 'No condition got satisfied');
      }),
  },
  {
    id: 'let*',
    title: 'Book Ex. 3.17: let*',
    base: 'let',
    question:
      "Extend the language with a let* expression that works like Scheme's let*, so that\n\n  let x = 30\n  in let* x = -(x,1) y = -(x,2)\n     in -(x,y)\n\nshould evaluate to 2.",
    examples: [
      { source: 'let x = 30\nin let* x = -(x,1) y = -(x,2)\n   in -(x,y)', value: 2, note: 'y sees the new x, 29' },
      { source: 'let x = 30\nin let* y = -(x,2) x = -(x,1)\n   in -(x,y)', value: 1, note: 'the order matters' },
      { source: 'let* in -(x,1)', value: 9, note: 'no bindings at all: the body runs in ρ' },
    ],
    answer: {
      grammar: 'Expression ::= let* {Identifier = Expression}* in Expression',
      abstract: 'let*-exp (vars exps body)',
      datatype: '(let*-exp\n  (vars (list-of identifier?))\n  (exps (list-of expression?))\n  (body expression?))',
      spec:
        '(value-of (let*-exp (x1 … xn) (e1 … en) body) ρ0) = (value-of body ρn)\n' +
        '  where ρi = [xi = (value-of ei ρi−1)]ρi−1',
      implementation:
        '(let*-exp (vars exps body)\n' +
        '  (value-of body (let*-env vars exps env)))\n\n' +
        ';; let*-env : Listof(Var) * Listof(Exp) * Env -> Env\n' +
        '(define let*-env\n' +
        '  (lambda (vars exps env)\n' +
        '    (if (null? vars)\n' +
        '        env\n' +
        '        (let*-env (cdr vars) (cdr exps)\n' +
        '                  (extend-env (car vars) (value-of (car exps) env) env)))))',
    },
    related: ['let-exp'],
    checklist: [
      '{Identifier = Expression}* gives two lists: the variables and their expressions.',
      'Each expression is evaluated in the env that already has the bindings before it, unlike a let with many bindings.',
      'One new frame per binding, so a later x shadows an earlier one.',
      'Zero bindings is allowed: the body runs in ρ.',
    ],
    run: (program, options) =>
      letLang(program as never, options, (exp, env, { valueOf, rec }) => {
        const { vars, exps } = lists(exp);
        const { body } = fields(exp);
        let e = env;
        for (let i = 0; i < vars.length; i++) e = rec.extendEnv(vars[i], valueOf(exps[i], e), e);
        return valueOf(body, e);
      }),
  },
  {
    id: 'letref',
    title: 'Book Ex. 4.34: letref',
    base: 'call-by-reference',
    question:
      'Add a call-by-reference version of let, called letref, to the language CALL-BY-REFERENCE. Write the specification and implement it. (In this language let stays call-by-value: it always makes a new location.)',
    examples: [
      { source: 'let a = 3\nin letref b = a\n   in begin set b = 4; a end', value: 4, note: 'b is bound to a\'s location' },
      { source: 'let a = 3\nin let b = a\n   in begin set b = 4; a end', value: 3, note: 'plain let: b gets a new location' },
      { source: 'letref b = -(5,1)\nin begin set b = 7; b end', value: 7, note: 'not a variable: a new location, as in a call' },
    ],
    answer: {
      grammar: 'Expression ::= letref Identifier = Expression in Expression',
      abstract: 'letref-exp (var exp1 body)',
      datatype: '(letref-exp\n  (var identifier?)\n  (exp1 expression?)\n  (body expression?))',
      spec:
        '(value-of (letref-exp var exp1 body) ρ σ0) = (value-of body [var = l]ρ σ1)\n' +
        '  where, if exp1 is a variable y:  l = ρ(y) and σ1 = σ0\n' +
        '        otherwise:                (value-of exp1 ρ σ0) = (val, σ), l is a new location, σ1 = [l = val]σ',
      implementation: '(letref-exp (var exp1 body)\n  (value-of body\n    (extend-env var (value-of-operand exp1 env) env)))',
    },
    related: ['let-exp', 'call-exp'],
    checklist: [
      'Decide what var is bound to: a reference (DenVal = Ref(ExpVal)), never a value.',
      'A variable on the right passes its own location, so set on one name is seen through the other.',
      'Anything else gets a new location holding its value, exactly as an operand of a call does.',
      'value-of-operand already makes this decision: reuse it.',
    ],
    run: (program, options) =>
      callByReference(program as never, options, (exp, env, { valueOf, valueOfOperand, rec }) => {
        const f = fields(exp);
        return valueOf(f.body, rec.extendEnv(f.var, valueOfOperand(f.exp1, env), env));
      }),
  },
  {
    id: 'let2',
    title: 'Book Ex. 5.3: let2 in CPS',
    base: 'cps',
    question:
      'Add let2 to the continuation-passing interpreter. A let2 expression is like a let expression, except that it defines exactly two variables:\n\n  let2 x = 1 y = 2 in -(x,y)\n\nBoth right-hand sides are evaluated in the outer environment, the first one first.',
    examples: [
      { source: 'let2 x = 1 y = 2\nin -(x,y)', value: -1 },
      { source: 'let x = 7\nin let2 x = 1 y = x\n   in -(x,y)', value: -6, note: 'y = x sees the outer x, 7' },
      { source: 'let2 x = 3 y = 4\nin let2 x = y y = x\n   in -(x,y)', value: 1, note: 'a swap: both use the old values' },
    ],
    answer: {
      grammar: 'Expression ::= let2 Identifier = Expression Identifier = Expression in Expression',
      abstract: 'let2-exp (var1 exp1 var2 exp2 body)',
      datatype:
        '(let2-exp\n  (var1 identifier?)\n  (exp1 expression?)\n  (var2 identifier?)\n  (exp2 expression?)\n  (body expression?))',
      spec:
        '(value-of (let2-exp var1 exp1 var2 exp2 body) ρ)\n' +
        '  = (value-of body [var2 = (value-of exp2 ρ)][var1 = (value-of exp1 ρ)]ρ)\n' +
        '  with exp1 evaluated before exp2',
      implementation:
        ';; in value-of/k\n' +
        '(let2-exp (var1 exp1 var2 exp2 body)\n' +
        '  (value-of/k exp1 env\n' +
        '    (let2-exp1-cont var1 var2 exp2 body env cont)))\n\n' +
        ';; in apply-cont\n' +
        '(let2-exp1-cont (var1 var2 exp2 body saved-env saved-cont)\n' +
        '  (value-of/k exp2 saved-env\n' +
        '    (let2-exp2-cont var1 val var2 body saved-env saved-cont)))\n' +
        '(let2-exp2-cont (var1 val1 var2 body saved-env saved-cont)\n' +
        '  (value-of/k body\n' +
        '    (extend-env var2 val (extend-env var1 val1 saved-env))\n' +
        '    saved-cont))\n\n' +
        ';; two new continuations\n' +
        '(let2-exp1-cont\n' +
        '  (var1 identifier?) (var2 identifier?) (exp2 expression?) (body expression?)\n' +
        '  (saved-env environment?) (saved-cont continuation?))\n' +
        '(let2-exp2-cont\n' +
        '  (var1 identifier?) (val1 expval?) (var2 identifier?) (body expression?)\n' +
        '  (saved-env environment?) (saved-cont continuation?))',
    },
    related: ['let-exp', 'let-exp-cont'],
    checklist: [
      'Every call stays a tail call: no value-of/k inside an operand position.',
      'One continuation per value that is awaited: one waits for exp1, one for exp2.',
      'The first continuation must remember everything still needed: var1, var2, exp2, body, env and cont.',
      'The second also remembers val1, the value it was given, because the env is only extended at the end.',
      'exp2 is evaluated in the saved env, not in one that already has var1.',
    ],
    run: (program, options) =>
      cps(program as never, options, {
        valueOfK: (exp, env, cont, { valueOfK, rec }) => {
          const f = fields(exp);
          return valueOfK(f.exp1, env, rec.cont<Frame>({ kind: 'let2-exp1-cont', var1: f.var1, var2: f.var2, exp2: f.exp2, body: f.body, savedEnv: env, savedCont: cont }));
        },
        applyCont: (cont, val, { valueOfK, rec }) => {
          const k = fields(cont);
          if (cont.kind === 'let2-exp1-cont') {
            return valueOfK(k.exp2, k.savedEnv, rec.cont<Frame>({ kind: 'let2-exp2-cont', var1: k.var1, val1: val, var2: k.var2, body: k.body, savedEnv: k.savedEnv, savedCont: k.savedCont }));
          }
          return valueOfK(k.body, rec.extendEnv(k.var2, val, rec.extendEnv(k.var1, k.val1, k.savedEnv)), k.savedCont);
        },
      }),
  },
];

export function baseOf(exercise: Exercise): LanguageModule {
  return languageById(exercise.base)!.module!;
}

/** The base language extended with the model answer: what "Run it" runs. */
export function modelLanguage(exercise: Exercise): LanguageModule {
  const production = toProduction(readEntry(exercise.answer.grammar), readAbstract(exercise.answer.abstract));
  return extendLanguage(
    baseOf(exercise),
    production,
    exercise.run,
    exercise.examples.map((e, i) => ({ title: `Example ${i + 1}`, source: e.source })),
  );
}
