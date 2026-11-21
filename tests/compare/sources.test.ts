import { describe, expect, it } from 'vitest';
import { changedLines, diffLines } from '../../src/compare/diff';
import { schemeFiles, sourcesFor } from '../../src/compare/sources';
import { LANGUAGES, languageById } from '../../src/languages';

describe('vendored official code', () => {
  for (const entry of LANGUAGES) {
    const module = entry.module!;
    if (['call-by-name', 'trampolined'].includes(entry.id)) continue;
    it(`${entry.name} has lang.scm and interp.scm in ${module.origin}`, () => {
      const files = schemeFiles(module);
      expect(files.has('lang.scm')).toBe(true);
      expect(files.has('interp.scm')).toBe(true);
    });
  }
});

describe('sourcesFor', () => {
  it('uses Scheme when both languages have an official folder', () => {
    const s = sourcesFor(languageById('let')!.module!, languageById('proc')!.module!);
    expect(s.kind).toBe('scheme');
    expect(s.files.map((f) => f.name).slice(0, 2)).toEqual(['lang.scm', 'interp.scm']);
  });

  it('uses the TS ports on both sides when one has no official folder', () => {
    const s = sourcesFor(languageById('call-by-name')!.module!, languageById('call-by-need')!.module!);
    expect(s.kind).toBe('ts');
    expect(s.files.every((f) => f.name.endsWith('.ts'))).toBe(true);
    expect(s.files.some((f) => f.name === 'index.ts')).toBe(false);
  });

  it("leaves Extend mode's hooks out of the ports it compares", () => {
    for (const [a, b] of [
      ['call-by-reference', 'call-by-name'],
      ['cps', 'trampolined'],
    ] as const) {
      const s = sourcesFor(languageById(a)!.module!, languageById(b)!.module!);
      const changed = s.files.flatMap((f) => changedLines(diffLines(f.a ?? '', f.b ?? '', s.kind)));
      expect(changed.filter((line) => /extension|Extension|#region|#endregion/.test(line))).toEqual([]);
    }
  });

  it('counts a file a port imports from another language as its own: TRAMPOLINED uses CPS continuations', () => {
    const s = sourcesFor(languageById('cps')!.module!, languageById('trampolined')!.module!);
    const continuations = s.files.find((f) => f.name === 'continuations.ts')!;
    expect(continuations.b).toBe(continuations.a);
    // Only interp.ts differs: the environments differ in nothing but comments.
    expect(s.files.filter((f) => changedLines(diffLines(f.a ?? '', f.b ?? '', s.kind)).length > 0).map((f) => f.name)).toEqual(['interp.ts']);
  });

  it('compares only the pair files of two implementations of one language', () => {
    const [p1, p2] = languageById('mutable-pairs')!.variants!.modules;
    expect(sourcesFor(p1, p2).files.map((f) => f.name)).toEqual(['pairval1.scm → pairval2.scm']);
  });
});
