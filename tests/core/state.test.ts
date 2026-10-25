import { describe, expect, it } from 'vitest';
import { EoplError } from '../../src/core/errors';
import { valueToSExp } from '../../src/core/print';
import { positionCount, stateAt } from '../../src/core/state';
import { record } from '../../src/core/trace';
import { numVal, type StoreVal } from '../../src/core/values';
import { theGrammar } from '../../src/languages/let/lang';

// A hand-written "interpreter" that exercises the recorder and the store directly.
const program = theGrammar.parse('-(1, 2)');
const [, outer, inner] = program.nodes;

function run() {
  return record(program, undefined, (rec) => {
    const env = rec.emptyEnv();
    const a = rec.store.newref(numVal(1n)); // before any step
    const s0 = rec.valueOf(outer, env);
    rec.store.setref(a, numVal(2n));
    const s1 = rec.valueOf(inner, env);
    rec.store.newref(numVal(3n));
    rec.returns(s1, numVal(10n));
    rec.store.deref(a);
    return rec.returns(s0, numVal(20n));
  });
}

const show = (store: readonly StoreVal[]) => store.map(valueToSExp);

describe('stateAt', () => {
  const trace = run();

  it('has one position per step plus the end', () => {
    expect(trace.steps).toHaveLength(2);
    expect(positionCount(trace)).toBe(3);
    expect(trace.outcome).toEqual({ kind: 'value', value: numVal(20n) });
  });

  it('records results, nesting and the extent of each call', () => {
    expect(trace.steps.map((s) => s.kind === 'value-of' && [s.parent, s.depth, s.last, s.result?.tag])).toEqual([
      [-1, 0, 1, 'num-val'],
      [0, 1, 1, 'num-val'],
    ]);
  });

  it('rebuilds the store at each position, in any order', () => {
    expect(show(stateAt(trace, 2).store)).toEqual(['(num-val 2)', '(num-val 3)']);
    expect(show(stateAt(trace, 0).store)).toEqual(['(num-val 1)']);
    expect(show(stateAt(trace, 1).store)).toEqual(['(num-val 2)']);
    expect(show(stateAt(trace, 2).store)).toEqual(['(num-val 2)', '(num-val 3)']);
    expect(show(stateAt(trace, 0).store)).toEqual(['(num-val 1)']);
  });

  it('reports what changed since the previous position', () => {
    expect(stateAt(trace, 0).changes.map((e) => e.kind)).toEqual(['newref']);
    expect(stateAt(trace, 1).changes.map((e) => e.kind)).toEqual(['setref']);
    expect(stateAt(trace, 2).changes.map((e) => e.kind)).toEqual(['newref', 'deref']);
  });

  it('gives the running value-of calls', () => {
    expect(stateAt(trace, 0).stack.map((s) => s.index)).toEqual([0]);
    expect(stateAt(trace, 1).stack.map((s) => s.index)).toEqual([0, 1]);
    expect(stateAt(trace, 2).stack).toEqual([]);
    expect(stateAt(trace, 2).step).toBeNull();
  });

  it('keeps the calls that never returned when a run fails', () => {
    const failed = record(program, undefined, (rec) => {
      const env = rec.emptyEnv();
      rec.valueOf(outer, env);
      rec.valueOf(inner, env);
      throw new EoplError('apply-env', 'No binding for foo');
    });
    expect(failed.outcome).toEqual({ kind: 'error', message: 'apply-env: No binding for foo' });
    expect(failed.openSteps).toEqual([0, 1]);
    expect(stateAt(failed, 2).stack.map((s) => s.index)).toEqual([0, 1]);
  });

  it('turns a bug into a crash outcome instead of throwing', () => {
    const crashed = record(program, undefined, () => {
      throw new TypeError('oops');
    });
    expect(crashed.outcome).toEqual({ kind: 'crash', message: 'oops' });
  });

  it('rejects positions outside the slider', () => {
    expect(() => stateAt(trace, 3)).toThrow(RangeError);
    expect(() => stateAt(trace, -1)).toThrow(RangeError);
  });
});
