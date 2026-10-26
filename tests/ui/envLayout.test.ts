// The environment diagram and step text for the Lecture 13 static scoping example.

import { describe, expect, it } from 'vitest';
import { runSource } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { procLanguage } from '../../src/languages/proc';
import { layoutEnv } from '../../src/ui/envLayout';
import { equation, explain, frameNames } from '../../src/ui/format';

const SOURCE = 'let x = 200\nin let f = proc (z) -(z,x)\n   in let x = 100\n      in let g = proc (z) -(z,x)\n         in -((f 1), (g 1))';

function run(): Trace {
  const result = runSource(procLanguage, SOURCE);
  if (!result.ok) throw result.error;
  return result.trace;
}

describe('environment diagram', () => {
  const trace = run();
  // Step 15 (index 14): the x in f's body, looked up in f's call frame.
  const X_IN_F = 14;

  it('names init-env ρ0 and the other frames in the order they were made', () => {
    const { names } = frameNames(trace);
    expect([...new Set(names.values())]).toEqual(['ρ0', 'ρ1', 'ρ2', 'ρ3', 'ρ4', 'ρ5', 'ρ6']);
  });

  it('writes the step as an equation and explains the lookup', () => {
    const step = trace.steps[X_IN_F];
    expect(equation(trace, step)).toEqual({ call: '(value-of «x» ρ5)', result: '⌈200⌉' });
    expect(explain(trace, step)).toBe('x is not bound in ρ5, so the lookup goes on to ρ1, where x = 200.');
    expect(explain(trace, trace.steps[X_IN_F - 1])).toBe('z is bound in ρ5: z = 1.');
  });

  it("draws this step's chain, the caller's chain and both closures", () => {
    const { cards } = layoutEnv(trace, X_IN_F);
    const frames = cards.filter((c) => c.kind === 'frame');
    expect(frames.map((c) => `${c.name} ${c.emphasis}`).sort()).toEqual([
      'ρ0 chain',
      'ρ1 chain',
      'ρ2 muted',
      'ρ3 muted',
      'ρ4 muted',
      'ρ5 current',
    ]);
    expect(frames.find((c) => c.name === 'ρ5')?.caption).toBe('env of this step');
    expect(frames.find((c) => c.name === 'ρ1')?.parts).toEqual([{ text: 'x = 200', mark: true }]);
    expect(frames.find((c) => c.name === 'ρ0')?.parts.map((p) => p.text).join('')).toBe('i=1  v=5  x=10');

    const closures = cards.filter((c) => c.kind === 'closure');
    expect(closures.map((c) => `${c.parts[0].text} ${c.caption ?? ''}`.trim()).sort()).toEqual([
      'procedure z -(z,x)',
      'procedure z -(z,x) running',
    ]);
  });

  it('labels each closure arrow "saved env", clear of every box', () => {
    const { cards, labels } = layoutEnv(trace, X_IN_F);
    expect(labels.map((l) => `${l.text} ${l.emphasis}`).sort()).toEqual(['saved env chain', 'saved env muted']);
    for (const label of labels) {
      const w = label.text.length * 7;
      for (const c of cards) {
        const overlap = label.x < c.x + c.w && c.x < label.x + w && label.y < c.y + c.h && c.y < label.y + 16;
        expect(overlap, `label at ${label.x},${label.y} overlaps ${c.key}`).toBe(false);
      }
    }
  });

  it('keeps cards from overlapping', () => {
    for (const position of [0, 8, X_IN_F, 18]) {
      const { cards } = layoutEnv(trace, position);
      for (const a of cards)
        for (const b of cards) {
          if (a === b) continue;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.key} overlaps ${b.key} at step ${position}`).toBe(false);
        }
    }
  });

  it('draws nothing at the end of the run', () => {
    expect(layoutEnv(trace, trace.steps.length).cards).toEqual([]);
  });
});
