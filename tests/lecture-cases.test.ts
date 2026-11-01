// The programs from the slides (docs/01-lecture-analysis.md, section 6).
// Cases for languages that aren't implemented yet show up as todo.

import { describe, expect, it } from 'vitest';
import { runSource } from '../src/core/language';
import { outcomeToString, valueToSExp } from '../src/core/print';
import { languageById } from '../src/languages';
import cases from './lecture-cases.json';

interface LectureCase {
  id: string;
  lang: string;
  program: string;
  from: string;
  /** Not on the slides; worked out by hand, then checked against the official code in Racket. */
  computed?: boolean;
  value?: string;
  error?: string;
  /** value-of calls (value-of/k and apply-cont calls in CPS), the same count as the official code in Racket. */
  steps?: number;
  diverges?: boolean;
  translation?: string;
}

describe('lecture examples', () => {
  it('only name languages the picker knows', () => {
    for (const c of cases as LectureCase[]) expect(languageById(c.lang), `${c.id}: ${c.lang}`).toBeDefined();
  });

  for (const c of cases as LectureCase[]) {
    const title = `${c.id} ${c.lang} (${c.from})${c.computed ? ' [computed]' : ''}`;
    const language = languageById(c.lang)?.module;
    if (!language) {
      it.todo(title);
      continue;
    }
    it(title, () => {
      const result = runSource(language, c.program);
      if (!result.ok) throw result.error;
      const { outcome, steps } = result.trace;
      if (c.value !== undefined) {
        expect(outcome.kind, outcomeToString(outcome)).toBe('value');
        if (outcome.kind === 'value') expect(valueToSExp(outcome.value)).toBe(c.value);
      }
      if (c.error !== undefined) expect(outcome).toEqual({ kind: 'error', message: c.error });
      if (c.diverges) expect(outcome.kind).toBe('limit');
      if (c.steps !== undefined) expect(steps.length).toBe(c.steps);
      if (c.translation !== undefined) {
        // The translated text keeps the student's line breaks and spacing, so compare without whitespace.
        const squash = (s: string) => s.replace(/\s+/g, '');
        expect(squash(result.trace.program.source)).toBe(squash(c.translation));
      }
    });
  }
});
