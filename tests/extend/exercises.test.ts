import { describe, expect, it } from 'vitest';
import { schemeFiles } from '../../src/compare/sources';
import { runSource } from '../../src/core/language';
import { clauseOf } from '../../src/extend/extend';
import { baseOf, EXERCISES, modelLanguage } from '../../src/extend/exercises';
import { checkAbstract, checkDatatype, readAbstract, readDatatype, readEntry } from '../../src/extend/grammarText';
import { bookValue } from '../../src/ui/format';

describe('extend exercises', () => {
  it('have unique ids', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  for (const ex of EXERCISES) {
    describe(ex.title, () => {
      const entry = readEntry(ex.answer.grammar);
      const abstract = readAbstract(ex.answer.abstract);

      it('model (b) and (c) pass the checkers', () => {
        expect(checkAbstract(entry, abstract)).toEqual([]);
        expect(checkDatatype(entry, abstract, readDatatype(ex.answer.datatype))).toEqual([]);
      });

      it('the model grammar fits the base (LL(1)) and the base still parses its own examples', () => {
        const lang = modelLanguage(ex);
        for (const e of baseOf(ex).examples) expect(() => lang.parse(e.source)).not.toThrow();
      });

      for (const example of ex.examples) {
        it(`runs ${JSON.stringify(example.source.split('\n')[0])} to ${example.value}`, () => {
          const r = runSource(modelLanguage(ex), example.source);
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          const o = r.trace.outcome;
          if (example.value === 'error') expect(o.kind).toBe('error');
          else expect(o.kind === 'value' ? bookValue(o.value) : o).toBe(`⌈${example.value}⌉`);
        });
      }

      it('every related clause is in the official interp.scm', () => {
        const interp = schemeFiles(baseOf(ex)).get('interp.scm')!;
        for (const variant of ex.related) {
          const clause = clauseOf(interp, variant);
          expect(clause).not.toBeNull();
          expect(clause!.startsWith(`(${variant} (`)).toBe(true);
          expect(clause!.split('(').length).toBe(clause!.split(')').length);
        }
      });
    });
  }

  it('the new language leaves the base untouched', () => {
    for (const ex of EXERCISES) {
      expect(() => baseOf(ex).parse(ex.examples[0].source)).toThrow();
    }
  });
});
