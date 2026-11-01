// Port of chapter3/lexaddr-lang/lang.scm.
//
// Students write PROC; the translator turns it into the nameless language.
// lang.scm also lists the nameless variants (%nameless-var, %let, %lexproc) so
// that SLLGEN defines their datatypes, but a program can never contain them:
// "%" starts a comment. Here they exist only as the types below, built by the
// translator.

import type { AstNode } from '../../core/ast';
import { expression, Grammar, identifier, number } from '../../core/grammar';

export const theGrammar = new Grammar('program', [
  ['program', [expression('exp1')], 'a-program'],

  ['expression', [number('num')], 'const-exp'],
  ['expression', ['-', '(', expression('exp1'), ',', expression('exp2'), ')'], 'diff-exp'],

  ['expression', ['zero?', '(', expression('exp1'), ')'], 'zero?-exp'],

  ['expression', ['if', expression('exp1'), 'then', expression('exp2'), 'else', expression('exp3')], 'if-exp'],

  ['expression', [identifier('var')], 'var-exp'],

  ['expression', ['let', identifier('var'), '=', expression('exp1'), 'in', expression('body')], 'let-exp'],

  ['expression', ['proc', '(', identifier('var'), ')', expression('body')], 'proc-exp'],

  ['expression', ['(', expression('rator'), expression('rand'), ')'], 'call-exp'],
]);

// ---- the source language (what the student writes) ----

export interface AProgram extends AstNode {
  readonly kind: 'a-program';
  readonly exp1: Expression;
}

export type Expression = ConstExp | DiffExp | ZeroExp | IfExp | VarExp | LetExp | ProcExp | CallExp;

export interface ConstExp extends AstNode {
  readonly kind: 'const-exp';
  readonly num: bigint;
}

export interface DiffExp extends AstNode {
  readonly kind: 'diff-exp';
  readonly exp1: Expression;
  readonly exp2: Expression;
}

export interface ZeroExp extends AstNode {
  readonly kind: 'zero?-exp';
  readonly exp1: Expression;
}

export interface IfExp extends AstNode {
  readonly kind: 'if-exp';
  readonly exp1: Expression;
  readonly exp2: Expression;
  readonly exp3: Expression;
}

export interface VarExp extends AstNode {
  readonly kind: 'var-exp';
  readonly var: string;
}

export interface LetExp extends AstNode {
  readonly kind: 'let-exp';
  readonly var: string;
  readonly exp1: Expression;
  readonly body: Expression;
}

export interface ProcExp extends AstNode {
  readonly kind: 'proc-exp';
  readonly var: string;
  readonly body: Expression;
}

export interface CallExp extends AstNode {
  readonly kind: 'call-exp';
  readonly rator: Expression;
  readonly rand: Expression;
}

// ---- the nameless language (what value-of runs) ----

export interface NamelessProgram extends AstNode {
  readonly kind: 'a-program';
  readonly exp1: Nameless;
}

export type Nameless =
  | NConstExp
  | NDiffExp
  | NZeroExp
  | NIfExp
  | NCallExp
  | NamelessVarExp
  | NamelessLetExp
  | NamelessProcExp;

export interface NConstExp extends AstNode {
  readonly kind: 'const-exp';
  readonly num: bigint;
}

export interface NDiffExp extends AstNode {
  readonly kind: 'diff-exp';
  readonly exp1: Nameless;
  readonly exp2: Nameless;
}

export interface NZeroExp extends AstNode {
  readonly kind: 'zero?-exp';
  readonly exp1: Nameless;
}

export interface NIfExp extends AstNode {
  readonly kind: 'if-exp';
  readonly exp1: Nameless;
  readonly exp2: Nameless;
  readonly exp3: Nameless;
}

export interface NCallExp extends AstNode {
  readonly kind: 'call-exp';
  readonly rator: Nameless;
  readonly rand: Nameless;
}

/** %lexref n: the lexical address of a variable. The official code writes it %nameless-var n. */
export interface NamelessVarExp extends AstNode {
  readonly kind: 'nameless-var-exp';
  readonly n: bigint;
}

/** %let exp1 in body */
export interface NamelessLetExp extends AstNode {
  readonly kind: 'nameless-let-exp';
  readonly exp1: Nameless;
  readonly body: Nameless;
}

/** %lexproc body */
export interface NamelessProcExp extends AstNode {
  readonly kind: 'nameless-proc-exp';
  readonly body: Nameless;
}
