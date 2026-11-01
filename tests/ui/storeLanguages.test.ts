// What the panels show for EXPLICIT-REFS, IMPLICIT-REFS and MUTABLE-PAIRS:
// the step sentences, the Store panel, and locations in the env diagram.

import { describe, expect, it } from 'vitest';
import { runSource, type LanguageModule } from '../../src/core/language';
import type { Trace } from '../../src/core/trace';
import { explicitRefsLanguage } from '../../src/languages/explicit-refs';
import { implicitRefsLanguage } from '../../src/languages/implicit-refs';
import { mutablePairsLanguage, mutablePairsPairval2Language } from '../../src/languages/mutable-pairs';
import { draw, LOCATION_EXAMPLE } from '../../src/ui/EnvHelp';
import { layoutEnv } from '../../src/ui/envLayout';
import { explain } from '../../src/ui/format';
import { layoutStore } from '../../src/ui/storeLayout';

function run(language: LanguageModule, source: string): Trace {
  const result = runSource(language, source);
  if (!result.ok) throw result.error;
  return result.trace;
}

const says = (trace: Trace, index: number) => explain(trace, trace.steps[index]);

/** "3:0 ←count [set] {writes 1}" per row; ghost rows end in "ghost", rows after a gap start with "⋮". */
const ledger = (trace: Trace, position: number) =>
  layoutStore(trace, position).map((r) =>
    [
      `${r.gapBefore ? '⋮ ' : ''}${r.loc}:${r.text}`,
      r.names.length > 0 ? `←${r.names.join(',')}` : '',
      r.changed ? `[${r.changed}]` : '',
      r.does.length > 0 ? `{${r.does.join(', ')}}` : '',
      r.ghost ? 'ghost' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

const cards = (trace: Trace, position: number, kind: 'frame' | 'closure') =>
  layoutEnv(trace, position)
    .cards.filter((c) => c.kind === kind)
    .map((c) => `${c.name ? `${c.name} ` : ''}${c.parts.map((p) => (p.mark ? `[${p.text}]` : p.text)).join('')} ${c.emphasis}`);

describe('IMPLICIT-REFS', () => {
  const counter = run(
    implicitRefsLanguage,
    'let g = let count = 0 in proc (dummy) begin set count = -(count,-1); count end in let a = (g 11) in let b = (g 11) in -(a,b)',
  );

  it('puts each let and each argument into a new location', () => {
    expect(says(counter, 1)).toBe(
      '⌈0⌉ goes into a new location, 3, and a new frame ρ1 binds count to it, on top of ρ0; the body runs there.',
    );
    expect(says(counter, 5)).toBe(
      "Calls (procedure dummy …) with ⌈11⌉, which goes into a new location, 5. The body runs in a new frame ρ3 (dummy → 5) on top of the closure's saved env ρ1, not the caller's ρ2.",
    );
  });

  it('reads a variable through its location, and set writes into it', () => {
    expect(says(counter, 6)).toBe('g is bound in ρ2 to location 4, which holds (procedure dummy …).');
    expect(says(counter, 9)).toBe('count is bound to location 3; set writes ⌈1⌉ there, replacing ⌈0⌉, and returns ⌈27⌉.');
    expect(says(counter, 11)).toBe('count is not bound in ρ3, so the lookup goes on to ρ1, where count → 3, which holds 0.');
  });

  it('lists the store with the names that point at each location, and what this step does', () => {
    // Step 1: the outer let will put the closure in location 4; location 3 comes first, from the inner let.
    expect(ledger(counter, 0)).toEqual(['0:1 ←i', '1:5 ←v', '2:10 ←x', '⋮ 4:(procedure dummy …) {makes} ghost']);
    expect(ledger(counter, 9)).toEqual([
      '0:1 ←i',
      '1:5 ←v',
      '2:10 ←x',
      '3:0 ←count {writes 1}',
      // g is not visible in the body, but its call is still running.
      '4:(procedure dummy …) ←g (ρ2)',
      '5:11 ←dummy',
    ]);
    // The write shows up as a change once it has happened.
    expect(ledger(counter, 10)).toContain('3:0 ←count');
    expect(ledger(counter, 11)).toContain('3:0 ←count {reads}');
  });

  it('draws locations in the frames, and the closure kept in a location next to its frame', () => {
    expect(cards(counter, 6, 'frame')).toEqual(['ρ2 [g → 4] current', 'ρ0 i→0  v→1  x→2 chain', 'ρ1 count → 3 muted']);
    expect(cards(counter, 6, 'closure')).toEqual(['4: procedure dummy begin set count = -(c… chain']);
  });

  const evenOdd = run(
    implicitRefsLanguage,
    'letrec even(d) = if zero?(d) then 1 else (odd -(d,1)) odd(d) = if zero?(d) then 0 else (even -(d,1)) in (odd 1)',
  );

  it('puts a new closure into a new location on every lookup of a letrec name', () => {
    expect(says(evenOdd, 0)).toBe(
      'even and odd are bound recursively in a new frame ρ1 on top of ρ0; the body runs there. Each lookup of them puts a new closure, whose saved env is ρ1 itself, into a new location.',
    );
    expect(says(evenOdd, 2)).toBe(
      'odd is bound by letrec in ρ1. This lookup puts a new closure (procedure d …), whose saved env is ρ1, into a new location, 3.',
    );
    expect(ledger(evenOdd, 2)).toContain('3:(procedure d …) {makes, reads} ghost');
  });

  it('draws one closure box per letrec frame, a line per procedure, with the running one marked', () => {
    expect(cards(evenOdd, 4, 'frame')).toEqual(['ρ2 d → 4 current', 'ρ1 even = ●  odd = ● chain', 'ρ0 i→0  v→1  x→2 chain']);
    expect(cards(evenOdd, 4, 'closure')).toEqual([
      'even: procedure d if zero?(d) then 1 el…\n[odd: procedure d if zero?(d) then 0 el…] current',
    ]);
    // The lookup of even marks only even in the frame.
    expect(cards(evenOdd, 8, 'frame')[1]).toBe('ρ1 [even = ●]  odd = ● chain');
  });

  it('explains locations in the help, with a real IMPLICIT-REFS run', () => {
    const { call, diagram } = draw(LOCATION_EXAMPLE);
    expect(call).toBe('(value-of «a» ρ3) = ⌈5⌉');
    const frames = diagram.cards.filter((c) => c.kind === 'frame').map((c) => `${c.name} ${c.parts.map((p) => p.text).join('')}`);
    expect(frames.sort()).toEqual(['ρ0 i→0  v→1  x→2', 'ρ1 a → 3', 'ρ2 f → 4', 'ρ3 z → 5']);
    expect(diagram.cards.find((c) => c.kind === 'closure')?.parts[0].text).toBe('4: procedure z -(z, a)');
  });
});

describe('EXPLICIT-REFS', () => {
  const chains = run(explicitRefsLanguage, 'let x = newref(newref(0)) in begin setref(deref(x), 11); deref(deref(x)) end');

  it('explains newref, deref, setref and begin with the locations they use', () => {
    expect(says(chains, 1)).toBe('(ref-val 0) goes into a new location, 1; newref returns (ref-val 1).');
    expect(says(chains, 2)).toBe('⌈0⌉ goes into a new location, 0; newref returns (ref-val 0).');
    expect(says(chains, 4)).toBe('The 2 expressions run in order; the value of the last one, ⌈11⌉, is the value of the begin.');
    expect(says(chains, 5)).toBe('Writes ⌈11⌉ into location 0, replacing ⌈0⌉; setref returns ⌈23⌉.');
    expect(says(chains, 6)).toBe('Reads location 1, which holds (ref-val 0).');
  });

  it('starts with an empty store, and marks a write once it has happened', () => {
    expect(ledger(chains, 0)).toEqual([]);
    expect(ledger(chains, 4)).toEqual(['0:0 [new]', '1:(ref-val 0) ←x [new]']);
    expect(ledger(chains, 9)).toEqual(['0:11 [set] {reads}', '1:(ref-val 0) ←x']);
  });
});

describe('MUTABLE-PAIRS', () => {
  const pairs = run(mutablePairsLanguage, 'let p = newpair(22,33) in begin setleft p = 77; left(p) end');
  const at = (kind: string) => pairs.steps.findIndex((s) => s.kind === 'value-of' && s.exp.kind === kind);

  it('explains how a pair uses two locations', () => {
    expect(says(pairs, 1)).toBe('⌈22⌉ and ⌈33⌉ go into two new locations, 3 and 4; the pair (a-pair 3 4) holds them.');
    expect(says(pairs, at('setleft-exp'))).toBe("Writes ⌈77⌉ into the pair's left location, 3, replacing ⌈22⌉; setleft returns ⌈82⌉.");
    expect(says(pairs, at('left-exp'))).toBe("Reads the pair's left location, 3, which holds ⌈77⌉.");
  });

  describe('with pairval2', () => {
    const source = 'let p = newpair(22,33) in begin setleft p = 77; setright p = 44; -(left(p), right(p)) end';
    const trace = run(mutablePairsPairval2Language, source);
    const step = (kind: string) => trace.steps.findIndex((s) => s.kind === 'value-of' && s.exp.kind === kind);

    it('explains that a pair is the location of its left element, with the right one next to it', () => {
      expect(says(trace, 1)).toBe('⌈22⌉ and ⌈33⌉ go into two new locations, 3 and 4; the pair is a reference to the first one: (mutpair-val 3).');
      expect(says(trace, step('setleft-exp'))).toBe('The pair is location 3; setleft writes ⌈77⌉ there, replacing ⌈22⌉, and returns ⌈82⌉.');
      expect(says(trace, step('setright-exp'))).toBe(
        'The pair is location 3; setright writes ⌈44⌉ into the next one, 3 + 1 = 4, replacing ⌈33⌉, and returns ⌈83⌉.',
      );
      expect(says(trace, step('left-exp'))).toBe('The pair is location 3, which holds its left element, ⌈77⌉.');
      expect(says(trace, step('right-exp'))).toBe('The pair is location 3; its right element is in the next one, 3 + 1 = 4, which holds ⌈44⌉.');
    });

    it('keeps the bare location in the store, and prints it the way Racket does', () => {
      expect(ledger(trace, 4)).toEqual(['0:1 ←i', '1:5 ←v', '2:10 ←x', '3:22 [new]', '4:33 [new]', '5:(mutpair-val 3) ←p [new]']);
      expect(run(mutablePairsPairval2Language, '-(newpair(1,2), 1)').outcome).toEqual({
        kind: 'error',
        message: 'expval-extractors: Looking for a num, found #(struct:mutpair-val 3)',
      });
    });

    it('takes the same steps to the same values as pairval1', () => {
      for (const { source } of mutablePairsLanguage.examples) {
        const one = run(mutablePairsLanguage, source);
        const two = run(mutablePairsPairval2Language, source);
        expect(two.steps.length).toBe(one.steps.length);
        expect(two.outcome).toEqual(one.outcome);
      }
    });
  });

  it('checks a diff operand right after evaluating it', () => {
    // The first operand is not a number, so the second, a call, is never evaluated.
    const trace = run(mutablePairsLanguage, '-(zero?(0), (proc (y) y 3))');
    expect(trace.steps).toHaveLength(3);
    expect(trace.outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a num, found #(struct:bool-val #t)',
    });
  });

  it('names the variant the way data-structures.scm does', () => {
    expect(run(mutablePairsLanguage, 'left(3)').outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a mutable-pair, found #(struct:num-val 3)',
    });
    expect(run(explicitRefsLanguage, 'deref(3)').outcome).toEqual({
      kind: 'error',
      message: 'expval-extractors: Looking for a reference, found #(struct:num-val 3)',
    });
  });
});
