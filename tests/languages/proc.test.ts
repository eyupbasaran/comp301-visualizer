// PROC beyond the official test list: steps through procedure calls, closures, evaluation order.

import { describe, expect, it } from 'vitest';
import { sourceOf } from '../../src/core/ast';
import { runSource } from '../../src/core/language';
import { envToList, showValue } from '../../src/core/print';
import type { Trace, ValueOfStep } from '../../src/core/trace';
import { procLanguage } from '../../src/languages/proc';

function run(source: string): Trace {
  const result = runSource(procLanguage, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const valueOfSteps = (trace: Trace) => trace.steps as ValueOfStep[];

describe('PROC', () => {
  it('steps into the procedure body; apply-procedure itself is not a step', () => {
    const trace = run('let f = proc (x) -(x,11) in (f (f 77))');
    const steps = valueOfSteps(trace);
    expect(steps.map((s) => sourceOf(trace.program, s.exp))).toEqual([
      'let f = proc (x) -(x,11) in (f (f 77))',
      'proc (x) -(x,11)',
      '(f (f 77))',
      'f',
      '(f 77)',
      'f',
      '77',
      '-(x,11)',
      'x',
      '11',
      '-(x,11)',
      'x',
      '11',
    ]);
    expect(steps.map((s) => s.result && showValue(s.result))).toEqual([
      '55',
      '(procedure x ...)',
      '55',
      '(procedure x ...)',
      '66',
      '(procedure x ...)',
      '77',
      '66',
      '77',
      '11',
      '55',
      '66',
      '11',
    ]);
    // The body runs inside the call-exp that applied the procedure.
    expect(steps[7].parent).toBe(4);
    expect(steps[10].parent).toBe(2);
  });

  it('evaluates the body in the saved env extended with the argument, not the caller env', () => {
    const trace = run('let f = proc (x) -(x,11) in (f (f 77))');
    const body = valueOfSteps(trace)[7];
    expect(envToList(body.env)).toBe('((x (num-val 77)) (i (num-val 1)) (v (num-val 5)) (x (num-val 10)))');
  });

  it('makes a new closure each time a proc expression is evaluated', () => {
    const trace = run('let mk = proc (a) proc (b) a in -(((mk 1) 0), ((mk 2) 0))');
    const closures = valueOfSteps(trace).flatMap((s) =>
      s.exp.kind === 'proc-exp' && s.result?.tag === 'proc-val' ? [s.result.proc] : [],
    );
    expect(closures.map((p) => p.bvar)).toEqual(['a', 'b', 'b']);
    expect(new Set(closures.map((p) => p.id)).size).toBe(3);
    expect(trace.outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: -1n } });
  });

  it('checks the rator is a procedure before evaluating the rand', () => {
    const trace = run('(1 foo)');
    expect(trace.outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a proc, found #(struct:num-val 1)',
    });
    expect(trace.steps).toHaveLength(2);
  });

  it('reports a procedure where a number was expected', () => {
    expect(run('-(proc (x) x, 1)').outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a num, found #(struct:proc-val #(struct:procedure x ...))',
    });
  });
});
