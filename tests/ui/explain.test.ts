// The step box sentences, with the values taken from each step's own sub-steps.

import { describe, expect, it } from 'vitest';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { letLanguage } from '../../src/languages/let';
import { procLanguage } from '../../src/languages/proc';
import { explain } from '../../src/ui/format';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const MAKEADDER = 'let makeadder = proc (a) proc (b) -(a, -(0, b))\nin let add3 = (makeadder 3)\n   in if zero?(-((add3 4), 7)) then (add3 10) else 0';

describe('step explanations', () => {
  const trace = run(procLanguage, MAKEADDER);
  // Step numbers as the slider shows them (1-based).
  const say = (step: number) => explain(trace, trace.steps[step - 1]);

  it('names the new frame a let makes', () => {
    expect(say(1)).toBe('makeadder = (procedure a …) goes into a new frame ρ1 on top of ρ0; the body runs there.');
  });

  it("says where a call's body runs, and that it is not the caller's env", () => {
    expect(say(4)).toBe(
      "Calls (procedure a …) with a = ⌈3⌉. The body runs in a new frame ρ2 on top of the closure's saved env ρ0, not the caller's ρ1.",
    );
    expect(say(11)).toBe(
      "Calls (procedure b …) with b = ⌈4⌉. The body runs in a new frame ρ4 on top of the closure's saved env ρ2, not the caller's ρ3.",
    );
  });

  it('quotes the operands, the test and the branch taken', () => {
    expect(say(10)).toBe('Both operands first: ⌈7⌉ and ⌈7⌉; their difference is ⌈0⌉.');
    expect(say(9)).toBe('The operand is ⌈0⌉, which is zero, so #t.');
    expect(say(8)).toBe('The test gave #t, so only the then branch runs; its value ⌈13⌉ is the value of the if.');
    expect(say(7)).toBe('Makes a closure (procedure b …) that remembers ρ2, the env it was made in.');
    expect(say(6)).toBe('A constant: its value is ⌈3⌉.');
  });

  it('writes a procedure found by a lookup out in words', () => {
    expect(say(5)).toBe('makeadder is bound in ρ1: makeadder = (procedure a …).');
    expect(say(15)).toBe('a is not bound in ρ4, so the lookup goes on to ρ2, where a = 3.');
  });

  it('falls back to a general sentence when the run stopped inside the step', () => {
    const stopped = run(letLanguage, '-(1, foo)');
    expect(explain(stopped, stopped.steps[0])).toBe('Both operands are evaluated first, then subtracted.');
  });
});
