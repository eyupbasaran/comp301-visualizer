// The contour diagram's own layout of the program: book style, every contour a box.

import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../src/languages';
import { implicitRefsLanguage } from '../../src/languages/implicit-refs';
import { procLanguage } from '../../src/languages/proc';
import { analyzeScopes, contourBox, linesOf, position } from '../../src/ui/contours';
import { reindent } from '../../src/ui/reindent';

const MODULES = LANGUAGES.flatMap((e) => e.variants?.modules ?? [e.module!]);

describe('reindent', () => {
  it('lays a program out the way the book does, whatever the student typed', () => {
    for (const typed of [
      'let x = 37 in proc (y)  \n  let z = -(y,x)\n     in -(x,y)',
      'let x = 37\n  in proc (y)  \n    let z = -(y,x)\n      in -(x,y)',
      'let x = 37 in proc (y) let z = -(y,x) in -(x,y) % a comment',
    ]) {
      expect(reindent(procLanguage, procLanguage.parse(typed))!.source).toBe('let x = 37\nin proc (y)\n     let z = -(y,x)\n     in -(x,y)');
    }
  });

  it('puts in, then, else and end on lines of their own, and letrec procedures one under the other', () => {
    const typed = 'let x = 0 in letrec even(dummy) = if zero?(x) then 1 else begin set x = -(x,1); (odd 888) end odd(dummy) = if zero?(x) then 0 else begin set x = -(x,1); (even 888) end in begin set x = 13; (odd -888) end';
    expect(reindent(implicitRefsLanguage, implicitRefsLanguage.parse(typed))!.source).toBe(
      [
        'let x = 0',
        'in letrec even(dummy) = if zero?(x)',
        '                        then 1',
        '                        else begin set x = -(x,1);',
        '                                   (odd 888)',
        '                             end',
        '          odd(dummy) = if zero?(x)',
        '                       then 0',
        '                       else begin set x = -(x,1);',
        '                                  (even 888)',
        '                            end',
        '   in begin set x = 13;',
        '            (odd -888)',
        '      end',
      ].join('\n'),
    );
  });

  for (const m of MODULES) {
    it(`${m.name}${m.variant ? ` (${m.variant.id})` : ''}: every example keeps its tree and its node ids, and every contour is a box`, () => {
      for (const ex of m.examples) {
        const typed = m.parse(ex.source);
        const r = reindent(m, typed);
        expect(r, ex.title).not.toBeNull();
        expect(r!.nodes.map((n) => `${n.id} ${n.kind}`)).toEqual(typed.nodes.map((n) => `${n.id} ${n.kind}`));
        if (!m.panels.includes('contour')) continue;
        const { contours } = analyzeScopes(r!);
        const max = Math.max(0, ...contours.map((c) => c.level));
        for (const c of contours) expect(contourBox(linesOf(r!.source), c.region, c.owner, c.level, max), ex.title).not.toBeNull();
      }
    });
  }

  it('keeps every later line of an expression at or right of its first column', () => {
    for (const m of MODULES) {
      for (const ex of m.examples) {
        const r = reindent(m, m.parse(ex.source))!;
        const lines = linesOf(r.source);
        for (const node of r.nodes) {
          const a = position(lines, node.span.from);
          const b = position(lines, node.span.to);
          for (let l = a.line + 1; l <= b.line; l++) {
            const indent = lines[l].text.length - lines[l].text.trimStart().length;
            expect(indent, `${ex.title}: ${node.kind} on line ${l + 1}`).toBeGreaterThanOrEqual(a.col);
          }
        }
      }
    }
  });
});
