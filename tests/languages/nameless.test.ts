// NAMELESS beyond the official test list: the translation, and where value-of differs from PROC.

import { describe, expect, it } from 'vitest';
import { astToSExp, originSpan, sourceOf } from '../../src/core/ast';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace, ValueOfStep } from '../../src/core/trace';
import { namelessLanguage } from '../../src/languages/nameless';
import { procLanguage } from '../../src/languages/proc';

function run(source: string, language: LanguageModule = namelessLanguage): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

describe('NAMELESS', () => {
  it('translates to lexical addresses, keeping the line breaks', () => {
    const trace = run('let x = 37\nin proc (y)\n     let z = -(y,x)\n     in -(x,y)');
    expect(trace.program.source).toBe('%let 37\nin %lexproc\n     %let -(%lexref 0,%lexref 1)\n     in -(%lexref 2,%lexref 1)');
    expect(astToSExp(trace.program.root)).toBe(
      '(a-program (nameless-let-exp (const-exp 37) (nameless-proc-exp (nameless-let-exp (diff-exp (nameless-var-exp 0) (nameless-var-exp 1)) (diff-exp (nameless-var-exp 2) (nameless-var-exp 1))))))',
    );
  });

  it('counts init-env as init-senv (i v x)', () => {
    expect(run('-(x, i)').program.source).toBe('-(%lexref 2, %lexref 0)');
    expect(run('-(x, i)').outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: 9n } });
  });

  it("keeps each translated node's text and its place in the source", () => {
    const source = 'let a = 5 in -(a, 1)';
    const trace = run(source);
    const texts = (trace.steps as ValueOfStep[]).map((s) => [sourceOf(trace.program, s.exp), source.slice(originSpan(trace.program, s.exp).from, originSpan(trace.program, s.exp).to)]);
    expect(texts).toEqual([
      ['%let 5 in -(%lexref 0, 1)', 'let a = 5 in -(a, 1)'],
      ['5', '5'],
      ['-(%lexref 0, 1)', '-(a, 1)'],
      ['%lexref 0', 'a'],
      ['1', '1'],
    ]);
  });

  it('reports an unbound variable in the translator, before any step', () => {
    const trace = run('-(1, foo)');
    expect(trace.outcome).toEqual({ kind: 'error', message: 'translation-of: unbound variable in code: foo' });
    expect(trace.steps).toHaveLength(0);
  });

  it('checks a diff operand is a number before evaluating the next one, unlike PROC', () => {
    const source = '-(zero?(0), (proc (y) y 3))';
    const error = 'expval-extractors: Looking for a num, found #(struct:bool-val #t)';
    // NAMELESS stops right after the first operand: diff, zero?, 0.
    expect(run(source).outcome).toEqual({ kind: 'error', message: error });
    expect(run(source).steps).toHaveLength(3);
    // PROC evaluates the second operand first: call, proc, 3, then the body y.
    expect(run(source, procLanguage).outcome).toEqual({ kind: 'error', message: error });
    expect(run(source, procLanguage).steps).toHaveLength(7);
  });

  it('gives the same values as PROC on the lecture examples', () => {
    for (const example of namelessLanguage.examples) {
      expect(run(example.source).outcome.kind, example.title).toBe(run(example.source, procLanguage).outcome.kind);
    }
    const scoping = namelessLanguage.examples[2].source;
    expect(run(scoping).outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: -100n } });
  });
});
