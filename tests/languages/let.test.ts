// LET beyond the official test list: the steps it records and the exact error messages.

import { describe, expect, it } from 'vitest';
import { sourceOf } from '../../src/core/ast';
import { runSource } from '../../src/core/language';
import { envToList, showValue } from '../../src/core/print';
import type { RunOptions, Trace, ValueOfStep } from '../../src/core/trace';
import { letLanguage } from '../../src/languages/let';

function run(source: string, options?: RunOptions): Trace {
  const result = runSource(letLanguage, source, options);
  if (!result.ok) throw result.error;
  return result.trace;
}

const valueOfSteps = (trace: Trace) => trace.steps as ValueOfStep[];

describe('LET', () => {
  it('records one step per value-of call, in call order', () => {
    const trace = run('-(-(x,3), -(v,i))');
    const steps = valueOfSteps(trace);
    expect(steps.map((s) => sourceOf(trace.program, s.exp))).toEqual(['-(-(x,3), -(v,i))', '-(x,3)', 'x', '3', '-(v,i)', 'v', 'i']);
    expect(steps.map((s) => s.result && showValue(s.result))).toEqual(['3', '7', '10', '3', '4', '5', '1']);
    expect(steps.map((s) => s.parent)).toEqual([-1, 0, 1, 1, 0, 4, 4]);
    expect(steps.map((s) => s.depth)).toEqual([0, 1, 2, 2, 1, 2, 2]);
    expect(steps.map((s) => s.last)).toEqual([6, 3, 2, 3, 6, 5, 6]);
  });

  it('starts from init-env [i=1, v=5, x=10], newest first', () => {
    const trace = run('x');
    expect(envToList(valueOfSteps(trace)[0].env)).toBe('((i (num-val 1)) (v (num-val 5)) (x (num-val 10)))');
  });

  it('evaluates a let body in the extended env, and the rhs in the old one', () => {
    const trace = run('let x = -(x,1) in x');
    const steps = valueOfSteps(trace);
    expect(steps.map((s) => sourceOf(trace.program, s.exp))).toEqual(['let x = -(x,1) in x', '-(x,1)', 'x', '1', 'x']);
    expect(envToList(steps[2].env)).toBe('((i (num-val 1)) (v (num-val 5)) (x (num-val 10)))');
    expect(envToList(steps[4].env)).toBe('((x (num-val 9)) (i (num-val 1)) (v (num-val 5)) (x (num-val 10)))');
    expect(steps[4].env).not.toBe(steps[2].env);
  });

  it('does not touch the store', () => {
    expect(run('let x = 3 in -(x,1)').events).toEqual([]);
  });

  it('words errors as the official interpreter does', () => {
    expect(run('foo').outcome).toEqual({ kind: 'error', message: 'apply-env: No binding for foo' });
    expect(run('-(zero?(0),1)').outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a num, found #(struct:bool-val #t)',
    });
    expect(run('if 1 then 2 else 3').outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a bool, found #(struct:num-val 1)',
    });
  });

  it('evaluates both operands of a diff before checking that they are numbers', () => {
    // val1 and val2 come before expval->num in interp.scm, so the unbound variable is reported first.
    expect(run('-(zero?(0), foo)').outcome).toEqual({ kind: 'error', message: 'apply-env: No binding for foo' });
  });

  it('keeps the steps up to the error', () => {
    const trace = run('-(x, foo)');
    expect(trace.steps).toHaveLength(3);
    expect(trace.openSteps).toEqual([0, 2]);
  });

  it('computes with exact integers', () => {
    const trace = run('-(0, -(99999999999999999999, -1))');
    expect(trace.outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: -100000000000000000000n } });
  });

  it('stops at the step limit and keeps the steps so far', () => {
    const trace = run('-(-(x,3), -(v,i))', { stepLimit: 4 });
    expect(trace.outcome.kind).toBe('limit');
    expect(trace.steps).toHaveLength(4);
  });

  it('stops at the depth limit', () => {
    // Four value-of calls are running at once when the innermost 1 is evaluated.
    expect(run('-(-(-(1,2),3),4)', { depthLimit: 3 }).outcome.kind).toBe('limit');
    expect(run('-(-(-(1,2),3),4)', { depthLimit: 4 }).outcome.kind).toBe('value');
  });
});
