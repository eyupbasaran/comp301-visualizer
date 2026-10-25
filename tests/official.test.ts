// The official EOPL3 test lists (tests.scm), converted with scripts/official-tests.mjs.
// tests/official/<language id>.json is run against that language.

import { describe, expect, it } from 'vitest';
import { runSource } from '../src/core/language';
import { outcomeToString } from '../src/core/print';
import { languageById } from '../src/languages';

interface OfficialTests {
  origin: string;
  tests: { name: string; program: string; expected: unknown }[];
}

const files = import.meta.glob<OfficialTests>('./official/*.json', { eager: true, import: 'default' });

for (const [path, { origin, tests }] of Object.entries(files)) {
  const id = path.replace('./official/', '').replace('.json', '');

  describe(`${id}: ${origin}`, () => {
    const language = languageById(id)?.module;
    if (!language) {
      it.todo(`${id} is not implemented yet`);
      return;
    }
    for (const { name, program, expected } of tests) {
      it(name, () => {
        const result = runSource(language, program);
        if (!result.ok) throw result.error;
        const { outcome } = result.trace;
        if (expected === 'error') {
          expect(outcome.kind, outcomeToString(outcome)).toBe('error');
        } else if (typeof expected === 'number') {
          expect(outcome).toEqual({ kind: 'value', value: { tag: 'num-val', num: BigInt(expected) } });
        } else if (typeof expected === 'boolean') {
          expect(outcome).toEqual({ kind: 'value', value: { tag: 'bool-val', bool: expected } });
        } else {
          throw new Error(`Don't know how to check ${JSON.stringify(expected)} yet: extend tests/official.test.ts`);
        }
      });
    }
  });
}
