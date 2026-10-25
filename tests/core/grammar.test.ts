import { describe, expect, it } from 'vitest';
import { astToSExp, fieldsOf, sourceOf } from '../../src/core/ast';
import { ParseError } from '../../src/core/errors';
import { arbno, expression, Grammar, GrammarError, identifier, number, separatedList } from '../../src/core/grammar';
import { theGrammar } from '../../src/languages/let/lang';

const ast = (source: string, grammar = theGrammar) => astToSExp(grammar.parse(source).root);

function parseError(source: string): ParseError {
  try {
    theGrammar.parse(source);
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
  throw new Error(`parsed without an error: ${source}`);
}

describe('grammar', () => {
  it('builds the AST SLLGEN builds', () => {
    expect(ast('-(55, -(x,11))')).toBe('(a-program (diff-exp (const-exp 55) (diff-exp (var-exp x) (const-exp 11))))');
    expect(ast('let x = 3 in -(x,1)')).toBe('(a-program (let-exp x (const-exp 3) (diff-exp (var-exp x) (const-exp 1))))');
    expect(ast('if zero?(0) then 3 else 4')).toBe('(a-program (if-exp (zero?-exp (const-exp 0)) (const-exp 3) (const-exp 4)))');
  });

  it('numbers nodes parent-first and records their source spans', () => {
    const program = theGrammar.parse('let y = 2 in -(y, 1)');
    expect(program.nodes.map((n) => n.kind)).toEqual(['a-program', 'let-exp', 'const-exp', 'diff-exp', 'var-exp', 'const-exp']);
    expect(program.nodes.map((n) => n.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(program.nodes.map((n) => sourceOf(program, n))).toEqual([
      'let y = 2 in -(y, 1)',
      'let y = 2 in -(y, 1)',
      '2',
      '-(y, 1)',
      'y',
      '1',
    ]);
  });

  it('keeps fields in grammar order', () => {
    const letExp = theGrammar.parse('let y = 2 in y').nodes[1];
    expect(fieldsOf(letExp).map(([name]) => name)).toEqual(['var', 'exp1', 'body']);
  });

  it('lists the keywords', () => {
    expect([...theGrammar.keywords].sort()).toEqual(['else', 'if', 'in', 'let', 'then', 'zero?']);
  });

  it('turns fields under arbno and separated-list into lists', () => {
    const grammar = new Grammar('program', [
      ['program', [expression('exp1')], 'a-program'],
      ['expression', [number('num')], 'const-exp'],
      ['expression', [identifier('var')], 'var-exp'],
      [
        'expression',
        ['letrec', arbno(identifier('pNames'), '(', identifier('bVars'), ')', '=', expression('pBodies')), 'in', expression('letrecBody')],
        'letrec-exp',
      ],
      ['expression', ['begin', expression('exp1'), arbno(';', expression('exps')), 'end'], 'begin-exp'],
      ['expression', ['proc', '(', separatedList([identifier('vars')], ','), ')', expression('body')], 'proc-exp'],
    ]);
    expect(ast('letrec f(x) = x g(y) = 1 in begin 1; 2; 3 end', grammar)).toBe(
      '(a-program (letrec-exp (f g) (x y) ((var-exp x) (const-exp 1)) (begin-exp (const-exp 1) ((const-exp 2) (const-exp 3)))))',
    );
    expect(ast('begin 1 end', grammar)).toBe('(a-program (begin-exp (const-exp 1) ()))');
    expect(ast('proc () 1', grammar)).toBe('(a-program (proc-exp () (const-exp 1)))');
    expect(ast('proc (a, b, c) a', grammar)).toBe('(a-program (proc-exp (a b c) (var-exp a)))');
  });

  it('rejects a grammar that is not LL(1)', () => {
    expect(
      () =>
        new Grammar('program', [
          ['program', [expression('exp1')], 'a-program'],
          ['expression', [identifier('var')], 'var-exp'],
          ['expression', [identifier('rator'), '(', expression('rand'), ')'], 'call-exp'],
        ]),
    ).toThrow(GrammarError);
  });

  it('rejects a grammar that uses an undefined nonterminal', () => {
    expect(() => new Grammar('program', [['program', [expression('exp1')], 'a-program']])).toThrow(GrammarError);
  });

  it('reports parse errors with what it expected and where', () => {
    expect(parseError('-(1, )')).toMatchObject({ line: 1, column: 6, detail: "Expected an expression but found ')'" });
    expect(parseError('let in = 5 in in').detail).toBe("Expected an identifier but found the keyword 'in'");
    expect(parseError('5 6').detail).toBe("Expected the end of the program but found '6'");
    expect(parseError('-(1,\n2').detail).toBe("Expected ')' but found the end of the program");
    expect(parseError('-(1,\n2')).toMatchObject({ line: 2, column: 2 });
    expect(parseError('').detail).toBe('Expected an expression but found the end of the program');
  });

  it('reports a program nested too deeply as a parse error, not a crash', () => {
    const n = 50_000;
    expect(parseError('-('.repeat(n) + '1' + ',1)'.repeat(n)).detail).toBe('The program is nested too deeply to parse');
  });
});
