// What the panels show for CPS and TRAMPOLINED.

import { describe, expect, it } from 'vitest';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { cpsLanguage } from '../../src/languages/cps';
import { trampolinedLanguage } from '../../src/languages/trampolined';
import { layoutCont } from '../../src/ui/contLayout';
import { layoutEnv } from '../../src/ui/envLayout';
import { equation, explain } from '../../src/ui/format';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

/** "⌈11⌉ → diff2-cont(val1 ⌈44⌉) / …"; * marks a frame the previous step made. */
const stack = (trace: Trace, position: number) => {
  const view = layoutCont(trace, position)!;
  const frames = view.frames.map((f) => `${f.fresh ? '*' : ''}${f.kind}(${f.fields.map((x) => `${x.name} ${x.text}`).join(', ')})`);
  return `${view.val ? `${view.val} → ` : ''}${frames.join(' / ')}`;
};

describe('CPS', () => {
  const nested = run(cpsLanguage, '-(-(44,11),3)');

  it('alternates value-of/k and apply-cont, and indents by the size of the continuation', () => {
    expect(nested.steps.map((s) => `${s.depth} ${equation(nested, s).call}`)).toEqual([
      '0 (value-of/k «-(-(44,11),3)» ρ0 end-cont)',
      '1 (value-of/k «-(44,11)» ρ0 diff1-cont)',
      '2 (value-of/k «44» ρ0 diff1-cont)',
      '2 (apply-cont diff1-cont ⌈44⌉)',
      '2 (value-of/k «11» ρ0 diff2-cont)',
      '2 (apply-cont diff2-cont ⌈11⌉)',
      '1 (apply-cont diff1-cont ⌈33⌉)',
      '1 (value-of/k «3» ρ0 diff2-cont)',
      '1 (apply-cont diff2-cont ⌈3⌉)',
      '0 (apply-cont end-cont ⌈30⌉)',
    ]);
    expect(nested.output).toEqual(['End of computation.']);
  });

  it('shows the continuation as a stack, with the frame made by the previous step marked', () => {
    expect(stack(nested, 2)).toBe('*diff1-cont(exp2 «11», saved-env ρ0) / diff1-cont(exp2 «3», saved-env ρ0) / end-cont()');
    expect(stack(nested, 5)).toBe('⌈11⌉ → diff2-cont(val1 ⌈44⌉) / diff1-cont(exp2 «3», saved-env ρ0) / end-cont()');
  });

  it('explains what each step hands on', () => {
    const says = (i: number) => explain(nested, nested.steps[i]);
    expect(says(0)).toBe('Evaluates the first operand, with a new diff1-cont on top that remembers the second, «3», and ρ0.');
    expect(says(2)).toBe('A constant: ⌈44⌉ goes straight to the continuation, diff1-cont.');
    expect(says(3)).toBe('The first operand is ⌈44⌉. Now the second, «11», is evaluated in ρ0, with a diff2-cont that remembers ⌈44⌉.');
    expect(says(5)).toBe('Both operands are known: ⌈44⌉ − ⌈11⌉ = ⌈33⌉, which goes to diff1-cont.');
    expect(says(9)).toBe('end-cont: the computation is over. It prints "End of computation.", and ⌈30⌉ is the value of the program.');
  });

  it('draws the env a continuation frame saved at apply-cont, and nothing when it saved none', () => {
    expect(layoutEnv(nested, 3).cards.map((c) => `${c.name} ${c.caption}`)).toEqual(['ρ0 env saved in diff1-cont']);
    expect(layoutEnv(nested, 5).cards).toEqual([]);
  });
});

describe('TRAMPOLINED', () => {
  const SOURCE = 'letrec double(x) = if zero?(x) then 0 else -((double -(x,1)), -2) in (double 1)';
  const double = run(trampolinedLanguage, SOURCE);

  it('bounces once per procedure call, right before the body', () => {
    const bounced = double.steps.filter((s) => s.kind === 'value-of/k' && s.bounced).map((s) => equation(double, s, 20).call);
    // The inner call is the first operand of -(…, -2), so its body runs with a diff1-cont.
    expect(bounced).toEqual(['(value-of/k «if zero?(x) then 0 …» ρ2 end-cont)', '(value-of/k «if zero?(x) then 0 …» ρ3 diff1-cont)']);
    expect(explain(double, double.steps[5])).toBe(
      "The operand is ⌈1⌉. apply-procedure/k does not run the body of (procedure x …) itself: it returns a bounce, a procedure of no arguments. The trampoline calls it, and the body runs in a new frame ρ2 on top of the closure's saved env ρ1, with the saved continuation.",
    );
  });

  it('counts the steps since the last bounce', () => {
    expect(layoutCont(double, 4)).toMatchObject({ bounced: false, sinceBounce: 5, bouncedBefore: false });
    expect(layoutCont(double, 6)).toMatchObject({ bounced: true });
    expect(layoutCont(double, 8)).toMatchObject({ bounced: false, sinceBounce: 3, bouncedBefore: true });
  });

  it('takes the same steps as CPS', () => {
    const cps = run(cpsLanguage, SOURCE);
    expect(double.steps.map((s) => equation(double, s).call)).toEqual(cps.steps.map((s) => equation(cps, s).call));
    expect(double.outcome).toEqual(cps.outcome);
  });
});
