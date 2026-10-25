import { describe, expect, it } from 'vitest';
import { runSource, type LanguageModule } from '../../src/core/language';
import { stateAt } from '../../src/core/state';
import type { Trace } from '../../src/core/trace';
import { letLanguage } from '../../src/languages/let';
import { procLanguage } from '../../src/languages/proc';
import { layoutAst, stepOfNode } from '../../src/ui/astLayout';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const outline = (trace: Trace, position = 0) => layoutAst(trace.program, trace, stateAt(trace, position));

describe('AST outline', () => {
  it('names nodes by EOPL variant and folds a lone identifier or number into its node', () => {
    const rows = outline(run(letLanguage, '-(-(x,3), -(v,i))'));
    expect(rows.map((r) => r.guide + r.label)).toEqual([
      'a-program',
      '└─ diff-exp',
      '   ├─ diff-exp',
      '   │  ├─ var-exp x',
      '   │  └─ const-exp 3',
      '   └─ diff-exp',
      '      ├─ var-exp v',
      '      └─ var-exp i',
    ]);
  });

  it('draws binders as plain names, not var-exp nodes', () => {
    const rows = outline(run(letLanguage, 'let x = 3 in x'));
    expect(rows.map((r) => `${r.label}${r.node ? '' : ' (binder)'}`)).toEqual([
      'a-program',
      'let-exp',
      'x (binder)',
      'const-exp 3',
      'var-exp x',
    ]);
  });

  it('marks the current node, the running ones and the ones never evaluated', () => {
    const trace = run(letLanguage, 'if zero?(-(x,10)) then 1 else 2');
    // Step 3 (index 2) evaluates -(x,10), inside zero?(...), inside the if.
    const states = Object.fromEntries(outline(trace, 2).filter((r) => r.node).map((r) => [r.label, r.state]));
    expect(states).toMatchObject({
      'if-exp': 'open',
      'zero?-exp': 'open',
      'diff-exp': 'current',
      'const-exp 1': 'evaluated',
      'const-exp 2': 'never',
    });
  });

  it('sends a click to the next step that evaluates the node, wrapping to the first', () => {
    const trace = run(procLanguage, 'let f = proc (x) -(x,11) in (f (f 77))');
    // The body -(x,11) runs at steps 8 and 11 (indexes 7 and 10).
    const body = trace.program.nodes.find((n) => n.kind === 'diff-exp')!;
    expect(stepOfNode(trace, body.id, 0)).toBe(7);
    expect(stepOfNode(trace, body.id, 7)).toBe(10);
    expect(stepOfNode(trace, body.id, 12)).toBe(7);
  });
});
