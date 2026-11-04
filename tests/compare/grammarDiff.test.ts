import { expect, it } from 'vitest';
import { grammarDiff } from '../../src/compare/grammarDiff';
import { letLanguage } from '../../src/languages/let';
import { procLanguage } from '../../src/languages/proc';

it('LET → PROC adds proc-exp and call-exp, nothing else', () => {
  expect(grammarDiff(letLanguage.grammar, procLanguage.grammar)).toEqual([
    { kind: 'add', variant: 'proc-exp', b: '(expression ("proc" "(" identifier ")" expression) proc-exp)' },
    { kind: 'add', variant: 'call-exp', b: '(expression ("(" expression expression ")") call-exp)' },
  ]);
});

it('PROC → LET removes them', () => {
  expect(grammarDiff(procLanguage.grammar, letLanguage.grammar).map((c) => [c.kind, c.variant])).toEqual([
    ['del', 'proc-exp'],
    ['del', 'call-exp'],
  ]);
});
