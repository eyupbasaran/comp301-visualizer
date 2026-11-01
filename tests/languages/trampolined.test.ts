// TRAMPOLINED has no official folder or tests. It is the CPS interpreter with a
// trampoline, so it must give exactly what CPS gives on every official CPS test:
// the same outcome and the same steps.

import { describe, expect, it } from 'vitest';
import { runSource } from '../../src/core/language';
import { cpsLanguage } from '../../src/languages/cps';
import { trampolinedLanguage } from '../../src/languages/trampolined';
import { equation } from '../../src/ui/format';
import official from '../official/cps.json';

describe('TRAMPOLINED gives what CPS gives', () => {
  for (const { name, program } of official.tests) {
    it(name, () => {
      const a = runSource(cpsLanguage, program);
      const b = runSource(trampolinedLanguage, program);
      if (!a.ok || !b.ok) throw new Error('parse error');
      expect(b.trace.outcome).toEqual(a.trace.outcome);
      expect(b.trace.steps.map((s) => equation(b.trace, s).call)).toEqual(a.trace.steps.map((s) => equation(a.trace, s).call));
    });
  }

  it('runs a long recursion without running out of stack', () => {
    const source = 'letrec loop(n) = if zero?(n) then 0 else (loop -(n,1)) in (loop 2000)';
    for (const language of [cpsLanguage, trampolinedLanguage]) {
      const result = runSource(language, source);
      if (!result.ok) throw result.error;
      expect(result.trace.outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: 0n } });
    }
  });
});
