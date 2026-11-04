import { describe, expect, it } from 'vitest';
import { GrammarError } from '../../src/core/grammar';
import { extendGrammar } from '../../src/extend/extend';
import {
  checkAbstract,
  checkDatatype,
  defaultNames,
  printBnf,
  readAbstract,
  readDatatype,
  readEntry,
  ReadError,
  slotsOf,
  toProduction,
} from '../../src/extend/grammarText';
import { printProduction } from '../../src/compare/grammarDiff';
import { letLanguage } from '../../src/languages/let';

const LET_IF_BNF = 'Expression ::= let-if Identifier = Expression or Expression based-on Expression in Expression or Expression';
const LET_IF_SLLGEN =
  '(expression ("let-if" identifier "=" expression "or" expression "based-on" expression "in" expression "or" expression) let-if-exp)';

describe('readEntry', () => {
  it('reads the book notation and SLLGEN to the same production', () => {
    const abs = readAbstract('let-if-exp (var exp1 exp2 exp3 body1 body2)');
    expect(printProduction(toProduction(readEntry(LET_IF_BNF), abs))).toBe(printProduction(toProduction(readEntry(LET_IF_SLLGEN))));
    expect(printBnf(readEntry(LET_IF_SLLGEN))).toBe(LET_IF_BNF);
  });

  it('reads {…}* as a repeat whose fields are lists, and keeps let* and ==> whole', () => {
    const cond = readEntry('Expression ::= cond {Expression ==> Expression}* end');
    expect(slotsOf(cond)).toEqual([
      { kind: 'expression', list: true },
      { kind: 'expression', list: true },
    ]);
    expect(printProduction(toProduction(cond, readAbstract('cond-exp (conds acts)')))).toBe(
      '(expression ("cond" (arbno expression "==>" expression) "end") cond-exp)',
    );
    const letStar = readEntry('Expression ::= let* {Identifier = Expression}* in Expression');
    expect(printBnf(letStar)).toBe('Expression ::= let* {Identifier = Expression}* in Expression');
  });

  it('splits ( ) and , off words, as the book writes -(Expression , Expression)', () => {
    expect(printBnf(readEntry('Expression ::= minus(Expression)'))).toBe('Expression ::= minus ( Expression )');
    expect(printBnf(readEntry('Expression ::= list ({Expression}*(,))'))).toBe('Expression ::= list ( {Expression}*(,) )');
  });

  it('names fields var, exp1, exp2, … until (b) names them', () => {
    expect(defaultNames(slotsOf(readEntry(LET_IF_BNF)))).toEqual(['var', 'exp1', 'exp2', 'exp3', 'exp4', 'exp5']);
  });

  it('reports where an entry is wrong', () => {
    const at = (text: string) => {
      try {
        readEntry(text);
      } catch (e) {
        return [(e as ReadError).at, (e as ReadError).message];
      }
      return null;
    };
    expect(at('let-if Identifier')![1]).toMatch(/Expression ::=/);
    expect(at('Expression ::= cond {Expression ==> Expression end')).toEqual([20, 'This { is never closed with }*']);
    expect(at('(expression ("minus" "(" expression ")") minus-exp')![1]).toMatch(/never closed/);
  });

  it('rejects an unknown nonterminal', () => {
    expect(() => readEntry('Expression ::= foo Bool-exp')).toThrow(/Unknown nonterminal Bool-exp/);
  });

  it('fits the base grammar only when it is LL(1) with it', () => {
    expect(() => extendGrammar(letLanguage, toProduction(readEntry(LET_IF_BNF)))).not.toThrow();
    const clash = toProduction(readEntry('Expression ::= let Identifier = Expression or Expression based-on Expression in Expression or Expression'));
    expect(() => extendGrammar(letLanguage, clash)).toThrow(GrammarError);
    expect(() => extendGrammar(letLanguage, clash)).toThrow(/let can start both let-exp and new-exp/);
  });
});

describe('checkAbstract and checkDatatype', () => {
  const entry = readEntry(LET_IF_BNF);
  const abs = readAbstract('let-if-exp (var exp1 exp2 exp3 body1 body2)');

  it('accept a right answer, with identifier? or symbol?', () => {
    expect(checkAbstract(entry, abs)).toEqual([]);
    const dt = '(let-if-exp (var symbol?) (exp1 expression?) (exp2 expression?) (exp3 expression?) (body1 expression?) (body2 expression?))';
    expect(checkDatatype(entry, abs, readDatatype(dt))).toEqual([]);
  });

  it('count the fields (never a keyword)', () => {
    expect(checkAbstract(entry, readAbstract('let-if-exp (var exp1 exp2 test body)'))[0]).toMatch(/has 6 fields .* You wrote 5/);
  });

  it('catch a wrong order, a wrong name and a wrong predicate', () => {
    const dt = readDatatype('(let-if-exp (var identifier?) (exp1 expression?) (exp2 expression?) (exp3 identifier?) (body2 expression?) (body1 expression?))');
    const problems = checkDatatype(entry, abs, dt);
    expect(problems).toContain('exp3: the predicate is expression?, because it comes from Expression; you wrote identifier?.');
    expect(problems).toContain('Field 5 is body1 in your (b), not body2.');
  });

  it('want (list-of …) for a field inside {…}*', () => {
    const cond = readEntry('Expression ::= cond {Expression ==> Expression}* end');
    const p = checkDatatype(cond, null, readDatatype('(cond-exp (conds expression?) (acts (list-of expression?)))'));
    expect(p).toEqual(['conds: the predicate is (list-of expression?), because it is inside {…}*, so it holds a list; you wrote expression?.']);
  });

  it('take the variant from SLLGEN (a)', () => {
    expect(checkAbstract(readEntry(LET_IF_SLLGEN), readAbstract('letif-exp (var exp1 exp2 exp3 body1 body2)'))[0]).toMatch(/let-if-exp in your \(a\)/);
  });
});
