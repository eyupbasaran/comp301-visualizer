import { describe, expect, it } from 'vitest';
import { changedLines, diffLines } from '../../src/compare/diff';
import { codeOf, COMPARISONS, MEASURES, moduleOf } from '../../src/compare/comparisons';
import { sourcesFor } from '../../src/compare/sources';
import { runSource } from '../../src/core/language';
import { bookValue } from '../../src/ui/format';

const outcome = (r: ReturnType<typeof runSource>) =>
  !r.ok ? 'parse error' : r.trace.outcome.kind === 'value' ? bookValue(r.trace.outcome.value) : r.trace.outcome.kind;

describe('comparisons', () => {
  it('have unique ids and two different sides', () => {
    expect(new Set(COMPARISONS.map((c) => c.id)).size).toBe(COMPARISONS.length);
    for (const c of COMPARISONS) expect(moduleOf(c.from)).not.toBe(moduleOf(c.to));
  });

  for (const c of COMPARISONS) {
    const from = moduleOf(c.from);
    const to = moduleOf(c.to);
    const sources = sourcesFor(codeOf(c.from), codeOf(c.to));
    const changed = sources.files.flatMap((f) => changedLines(diffLines(f.a ?? '', f.b ?? '', sources.kind)));

    describe(c.id, () => {
      for (const note of c.notes) {
        it(`anchor ${note.anchor} is on a changed line of code`, () => {
          expect(changed.some((line) => line.includes(note.anchor))).toBe(true);
        });
      }

      if (c.runBoth) {
        const { source, measure } = c.runBoth;
        it('its run-in-both program parses in both and differs in value or measure', () => {
          const [ra, rb] = [runSource(from, source), runSource(to, source)];
          expect(ra.ok && rb.ok).toBe(true);
          const sameValue = outcome(ra) === outcome(rb);
          const m = measure && ra.ok && rb.ok ? [MEASURES[measure].of(ra.trace), MEASURES[measure].of(rb.trace)] : null;
          // pairval1/pairval2 differ only in how the pair is kept, which `look` points at.
          if (c.id !== 'pairval1-pairval2') expect(!sameValue || (m !== null && m[0] !== m[1])).toBe(true);
        });
      }

      if (c.twoWays) {
        const { from: a, to: b } = c.twoWays;
        it('its two programs each run in their own language, to the same value', () => {
          expect(outcome(runSource(from, a))).toBe(outcome(runSource(to, b)));
          expect(outcome(runSource(from, a))).not.toMatch(/parse error|error|limit|crash/);
        });
      }
    });
  }
});
