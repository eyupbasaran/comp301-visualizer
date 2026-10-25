import { describe, expect, it } from 'vitest';
import type { Program } from '../../src/core/ast';
import { letLanguage } from '../../src/languages/let';
import { procLanguage } from '../../src/languages/proc';
import { analyzeScopes, CHAR, colX, contourPath, contourRows, linesOf, position } from '../../src/ui/contours';
import { describeReference } from '../../src/ui/ContourView';

const depths = (program: Program) => analyzeScopes(program).references.map((r) => `${r.name}:${r.depth}`);

describe('contours', () => {
  it('gives the same numbers as the nameless translation (T11)', () => {
    // %let 37 in %lexproc %let -(%lexref 0, %lexref 1) in -(%lexref 2, %lexref 1)
    const program = procLanguage.parse('let x = 37 in proc (y) let z = -(y,x) in -(x,y)');
    expect(depths(program)).toEqual(['y:0', 'x:1', 'x:2', 'y:1']);
  });

  it('keeps a let right-hand side outside the contour of its own variable', () => {
    const program = letLanguage.parse('let x = 1 in let y = x in y');
    expect(depths(program)).toEqual(['x:0', 'y:0']);
    const [outer, inner] = analyzeScopes(program).contours;
    expect(program.source.slice(outer.region.from, outer.region.to)).toBe('let y = x in y');
    expect(program.source.slice(inner.region.from, inner.region.to)).toBe('y');
    expect([outer.level, inner.level, inner.parent]).toEqual([0, 1, outer.id]);
  });

  it('resolves a shadowed name to the innermost declaration', () => {
    const scopes = analyzeScopes(letLanguage.parse('let x = 1 in let x = 2 in x'));
    expect(scopes.references[0].resolution).toEqual({ kind: 'contour', contour: 1, binder: 0 });
    expect(scopes.references[0].depth).toBe(0);
  });

  it('counts init-env (i v x) after the contours, like init-senv', () => {
    const program = letLanguage.parse('let y = 1 in -(x, i)');
    expect(depths(program)).toEqual(['x:3', 'i:1']);
    const scopes = analyzeScopes(program);
    expect(describeReference(program, scopes, scopes.references[0])).toContain('%lexref 3');
  });

  it('marks a name declared nowhere as unbound', () => {
    const scopes = analyzeScopes(letLanguage.parse('-(foo, 1)'));
    expect(scopes.references[0]).toMatchObject({ name: 'foo', resolution: { kind: 'unbound' }, depth: null });
  });

  it('records where each binder is written', () => {
    const program = procLanguage.parse('let f = proc (z) z in f');
    const binders = analyzeScopes(program).contours.map((c) => c.binders[0]);
    expect(binders.map((b) => b.name)).toEqual(['f', 'z']);
    expect(binders.map((b) => b.span && program.source.slice(b.span.from, b.span.to))).toEqual(['f', 'z']);
  });

  it('describes a reference in words', () => {
    const program = procLanguage.parse('let x = 200\nin let f = proc (z) -(z,x)\n   in (f 1)');
    const scopes = analyzeScopes(program);
    const x = scopes.references.find((r) => r.name === 'x')!;
    expect(describeReference(program, scopes, x)).toBe(
      'x (line 2) is declared by let x on line 1. Lexical depth 1: crossing proc z.',
    );
  });

  it('keeps contour edges off the text around the region', () => {
    const sources = [
      'let x = 200\nin let f = proc (z) -(z,x)\n   in let x = 100\n      in let g = proc (z) -(z,x)\n         in -((f 1), (g 1))',
      'let f = proc (x) proc (y) -(x,y) in ((f 1) 2)',
      'let x = 1 in let y = 2 in let z = 3 in -(x, -(y,z))',
    ];
    for (const source of sources) {
      const program = procLanguage.parse(source);
      const lines = linesOf(source);
      const { contours } = analyzeScopes(program);
      const maxLevel = Math.max(...contours.map((c) => c.level));
      for (const c of contours) {
        for (const row of contourRows(lines, c.region, c.level, maxLevel)) {
          // Characters the padding reaches into, left of the first column the box covers.
          const text = lines[row.line].text;
          const firstCovered = Math.floor((row.left - colX(0)) / CHAR + 0.25);
          const start = row.line === position(lines, c.region.from).line ? position(lines, c.region.from).col : firstCovered;
          expect(text.slice(Math.max(0, firstCovered), start).trim(), `left edge of ${c.owner.kind} on line ${row.line + 1}`).toBe('');
        }
      }
    }
  });

  it('draws a contour as one closed outline that follows the lines', () => {
    const source = 'let x = 1 in -(x,\n  2)';
    const region = { from: source.indexOf('-('), to: source.length };
    const d = contourPath(linesOf(source), region, 0, 0);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    // Two lines: four points on the right side, four on the left.
    expect(d.split(' L ').length).toBe(8);
  });
});
