// What the panels show for CALL-BY-REFERENCE, CALL-BY-NAME and CALL-BY-NEED.

import { describe, expect, it } from 'vitest';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { callByNameLanguage } from '../../src/languages/call-by-name';
import { callByNeedLanguage } from '../../src/languages/call-by-need';
import { callByReferenceLanguage } from '../../src/languages/call-by-reference';
import { layoutEnv } from '../../src/ui/envLayout';
import { explain } from '../../src/ui/format';
import { layoutStore } from '../../src/ui/storeLayout';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const says = (trace: Trace, index: number) => explain(trace, trace.steps[index]);

/** Rows after init-env's three: "4:33 ←x,a (ρ2) {reads}". */
const ledger = (trace: Trace, position: number) =>
  layoutStore(trace, position)
    .slice(3)
    .map((r) => [`${r.loc}:${r.text}`, r.names.length > 0 ? `←${r.names.join(',')}` : '', r.does.length > 0 ? `{${r.does.join(', ')}}` : ''].filter(Boolean).join(' '));

const closures = (trace: Trace, position: number) =>
  layoutEnv(trace, position)
    .cards.filter((c) => c.kind === 'closure')
    .map((c) => `${c.parts.map((p) => p.text).join('')} ${c.emphasis}${c.caption ? ` ${c.caption}` : ''}`);

describe('CALL-BY-REFERENCE', () => {
  const swap = run(
    callByReferenceLanguage,
    'let swap = proc (x) proc (y) let temp = x in begin set x = y; set y = temp end in let a = 33 in let b = 44 in begin ((swap a) b); -(a,b) end',
  );

  it('passes a variable operand as its location, without evaluating it', () => {
    const call = swap.steps.findIndex((s) => s.kind === 'value-of' && s.exp.kind === 'call-exp');
    expect(says(swap, call)).toBe(
      "Calls (procedure y …) with the location of b, 5, not a copy of its value: y and b now share it. The body runs in a new frame ρ5 (y → 5) on top of the closure's saved env ρ4, not the caller's ρ3.",
    );
  });

  it("shows both names on a shared location, the caller's with its frame", () => {
    // Step 15: set x = y, inside swap.
    expect(ledger(swap, 14)).toEqual(['3:(procedure x …) ←swap (ρ1)', '4:33 ←x,a (ρ2) {writes 44}', '5:44 ←y,b (ρ3)', '6:33 ←temp']);
  });

  it('allocates a new location for any other operand', () => {
    const trace = run(callByReferenceLanguage, 'let f = proc (x) set x = 44 in (f -(5,1))');
    expect(says(trace, 2)).toBe(
      "Calls (procedure x …) with ⌈4⌉, which goes into a new location, 4. The body runs in a new frame ρ2 (x → 4) on top of the closure's saved env ρ0, not the caller's ρ1.",
    );
  });
});

describe('CALL-BY-NEED and CALL-BY-NAME', () => {
  const SOURCE = 'let f = proc (x) -(x, -(x,5)) in (f -(7,2))';
  const need = run(callByNeedLanguage, SOURCE);
  const name = run(callByNameLanguage, SOURCE);

  it('passes an operand as a thunk in a new location', () => {
    expect(says(need, 2)).toBe(
      "Calls (procedure x …) with a thunk for -(7,2), not its value: the thunk goes into a new location, 4, and runs only when x is looked up. The body runs in a new frame ρ2 (x → 4) on top of the closure's saved env ρ0, not the caller's ρ1.",
    );
    expect(ledger(need, 4)).toEqual(['3:(procedure x …) ←f (ρ1)', '4:(a-thunk «-(7,2)» ρ1) ←x']);
  });

  it('evaluates the thunk at the first lookup; call-by-need keeps the value, call-by-name does not', () => {
    expect(says(need, 5)).toBe(
      'x is bound in ρ2 to location 4, which holds a thunk. Its expression, -(7,2), runs now in the env the thunk saved, ρ1: ⌈5⌉. Call-by-need writes it back into location 4, so the next lookup will not evaluate it again.',
    );
    expect(ledger(need, 5)).toContain('4:(a-thunk «-(7,2)» ρ1) ←x {reads, writes 5}');
    expect(says(name, 5)).toBe(
      'x is bound in ρ2 to location 4, which holds a thunk. Its expression, -(7,2), runs now in the env the thunk saved, ρ1: ⌈5⌉. The thunk stays in location 4: the next lookup evaluates it again.',
    );
    // The second x: call-by-need reads the value; call-by-name runs -(7,2) again.
    expect(says(need, 10)).toBe('x is bound in ρ2 to location 4, which holds 5.');
    expect(need.steps).toHaveLength(12);
    expect(name.steps).toHaveLength(15);
  });

  it('draws a thunk like a closure: its expression and the env it saved, running while it is evaluated', () => {
    expect(closures(need, 4)).toEqual(['4: a-thunk -(7,2) chain', '3: procedure x -(x, -(x,5)) current running']);
    expect(closures(need, 6)).toEqual(['3: procedure x -(x, -(x,5)) chain', '4: a-thunk -(7,2) current running']);
  });

  it('never evaluates an operand nobody looks up', () => {
    const loop = run(callByNeedLanguage, 'letrec infinite-loop (x) = (infinite-loop -(x,-1)) in let f = proc (z) 11 in (f (infinite-loop 0))');
    expect(loop.steps).toHaveLength(6);
    expect(ledger(loop, 5)).toEqual(['3:(procedure z …) ←f (ρ2)', '4:(a-thunk «(infinite-loop 0)» ρ2) ←z']);
  });
});
