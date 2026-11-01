// Port of chapter4/call-by-need/lang.scm: the grammar, and the datatypes SLLGEN builds from it.

import type { AstNode } from '../../core/ast';
import { arbno, expression, Grammar, identifier, number } from '../../core/grammar';

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

  [
    'expression',
    [
      'letrec',
      arbno(identifier('pNames'), '(', identifier('bVars'), ')', '=', expression('pBodies')),
      'in',
      expression('letrecBody'),
    ],
    'letrec-exp',
  ],

  ['expression', ['begin', expression('exp1'), arbno(';', expression('exps')), 'end'], 'begin-exp'],

  // new for implicit-refs

  ['expression', ['set', identifier('var'), '=', expression('exp1')], 'assign-exp'],

  // new for mutable-pairs

  ['expression', ['newpair', '(', expression('exp1'), ',', expression('exp2'), ')'], 'newpair-exp'],

  ['expression', ['left', '(', expression('exp1'), ')'], 'left-exp'],

  ['expression', ['setleft', expression('exp1'), '=', expression('exp2')], 'setleft-exp'],

  ['expression', ['right', '(', expression('exp1'), ')'], 'right-exp'],

  ['expression', ['setright', expression('exp1'), '=', expression('exp2')], 'setright-exp'],
]);

export interface AProgram extends AstNode {
  readonly kind: 'a-program';
  readonly exp1: Expression;
}

export type Expression =
  | ConstExp
  | DiffExp
  | ZeroExp
  | IfExp
  | VarExp
  | LetExp
  | ProcExp
  | CallExp
  | LetrecExp
  | BeginExp
  | AssignExp
  | NewpairExp
  | LeftExp
  | SetleftExp
  | RightExp
  | SetrightExp;

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

export interface LetrecExp extends AstNode {
  readonly kind: 'letrec-exp';
  readonly pNames: readonly string[];
  readonly bVars: readonly string[];
  readonly pBodies: readonly Expression[];
  readonly letrecBody: Expression;
}

export interface BeginExp extends AstNode {
  readonly kind: 'begin-exp';
  readonly exp1: Expression;
  readonly exps: readonly Expression[];
}

export interface AssignExp extends AstNode {
  readonly kind: 'assign-exp';
  readonly var: string;
  readonly exp1: Expression;
}

export interface NewpairExp extends AstNode {
  readonly kind: 'newpair-exp';
  readonly exp1: Expression;
  readonly exp2: Expression;
}

export interface LeftExp extends AstNode {
  readonly kind: 'left-exp';
  readonly exp1: Expression;
}

export interface SetleftExp extends AstNode {
  readonly kind: 'setleft-exp';
  readonly exp1: Expression;
  readonly exp2: Expression;
}

export interface RightExp extends AstNode {
  readonly kind: 'right-exp';
  readonly exp1: Expression;
}

export interface SetrightExp extends AstNode {
  readonly kind: 'setright-exp';
  readonly exp1: Expression;
  readonly exp2: Expression;
}
