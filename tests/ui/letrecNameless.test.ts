// What the panels show for LETREC and NAMELESS.

import { describe, expect, it } from 'vitest';
import { originSpan } from '../../src/core/ast';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { letrecLanguage } from '../../src/languages/letrec';
import { namelessLanguage } from '../../src/languages/nameless';
import { layoutEnv } from '../../src/ui/envLayout';
import { explain } from '../../src/ui/format';
import { senvAt } from '../../src/ui/TranslationView';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const frames = (trace: Trace, index: number) =>
  layoutEnv(trace, index)
    .cards.filter((c) => c.kind === 'frame')
    .map((c) => `${c.name} ${c.parts.map((p) => (p.mark ? `[${p.text}]` : p.text)).join('')} ${c.emphasis}`);

describe('LETREC', () => {
  const trace = run(letrecLanguage, 'letrec double(x) = if zero?(x) then 0 else -((double -(x,1)), -2) in (double 6)');

  it('explains the letrec frame and the new closure each lookup makes', () => {
    expect(explain(trace, trace.steps[0])).toBe(
      'double is bound recursively in a new frame ρ1 on top of ρ0; the body runs there. Each lookup of double makes a new closure whose saved env is ρ1 itself.',
    );
    expect(explain(trace, trace.steps[2])).toBe(
      'double is bound by letrec in ρ1. This lookup makes a new closure (procedure x …) whose saved env is ρ1.',
    );
  });

  it('marks the letrec closure as running inside its body, with its saved env pointing back to its own frame', () => {
    // Step 5 (index 4): the if-exp of the body, for x = 6.
    const diagram = layoutEnv(trace, 4);
    const closure = diagram.cards.find((c) => c.kind === 'closure');
    expect(closure?.caption).toBe('running');
    expect(diagram.labels.map((l) => `${l.text} ${l.emphasis}`)).toEqual(['saved env chain']);
    expect(frames(trace, 4)).toEqual(['ρ2 x = 6 current', 'ρ1 double = ● chain', 'ρ0 i=1  v=5  x=10 chain']);
  });
});

describe('NAMELESS', () => {
  const trace = run(namelessLanguage, 'let a = 5 in let f = proc (z) -(z, a) in (f 1)');

  it('shows each frame by its position in the env, and marks the one %lexref reads', () => {
    // Step 10 (index 9): %lexref 1, the a in -(z, a).
    expect(frames(trace, 9)).toEqual([
      'ρ3 #0 = 1 current',
      'ρ1 [#1 = 5] chain',
      'ρ0 #2 = 1  #3 = 5  #4 = 10 chain',
      'ρ2 ● muted',
    ]);
    expect(explain(trace, trace.steps[9])).toBe('%lexref 1 skips 1 frame (ρ3) and reads #1, in ρ1: 5.');
    expect(explain(trace, trace.steps[8])).toBe('%lexref 0 reads #0, the newest frame, ρ3: 1.');
  });

  it('explains %let and the call of a closure without a parameter name', () => {
    expect(explain(trace, trace.steps[0])).toBe('⌈5⌉ goes into a new frame ρ1 (#0) on top of ρ0; the body runs there.');
    expect(explain(trace, trace.steps[4])).toBe(
      "Calls (procedure …) with ⌈1⌉. The body runs in a new frame ρ3 on top of the closure's saved env ρ1, not the caller's ρ2.",
    );
  });

  it('gives the senv the translator had: the binders around the expression, then (i v x)', () => {
    const result = runSource(namelessLanguage, 'let a = 5 in let f = proc (z) -(z, a) in (f 1)');
    if (!result.ok) throw result.error;
    const a = result.trace.steps[9];
    if (a.kind === 'apply-cont') throw new Error('unexpected step');
    expect(senvAt(result.program, originSpan(result.trace.program, a.exp))).toEqual(['z', 'a', 'i', 'v', 'x']);
  });
});
