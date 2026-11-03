// Extend mode: the page in its states, and the Explore panels on the extended languages.

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { runSource } from '../../src/core/language';
import { positionCount, stateAt } from '../../src/core/state';
import { EXERCISES, modelLanguage } from '../../src/extend/exercises';
import { layoutAst } from '../../src/ui/astLayout';
import { layoutCont } from '../../src/ui/contLayout';
import { analyzeScopes } from '../../src/ui/contours';
import { layoutEnv } from '../../src/ui/envLayout';
import ExtendPage from '../../src/ui/extend/ExtendPage';
import { equation, explain } from '../../src/ui/format';

const stored = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) },
};
afterEach(() => stored.clear());

const render = (exercise: string, answers: Record<string, string> = {}) => {
  stored.set('comp301.extend.exercise', exercise);
  for (const [part, text] of Object.entries(answers)) stored.set(`comp301.extend.${exercise}.${part}`, text);
  return renderToString(createElement(ExtendPage, { onOpen: () => {} }))
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>');
};

describe('the Extend page', () => {
  it('renders every exercise, with its question and all five parts', () => {
    for (const ex of EXERCISES) {
      const html = render(ex.id);
      expect(html).toContain(ex.title);
      for (const letter of 'abcde') expect(html).toContain(`(${letter}) `);
      expect(html).toContain('>Run it</h2>');
    }
  });

  it('tries (a) live: fits the grammar, parses the examples, shows the fields', () => {
    const html = render('let-if', {
      a: 'Expression ::= let-if Identifier = Expression or Expression based-on Expression in Expression or Expression',
      b: 'let-if-exp (var exp1 exp2 exp3 body1 body2)',
    });
    expect(html).toContain("✓ Fits LET's grammar (still LL(1))");
    expect(html).toContain('(expression ("let-if" identifier "=" expression "or" expression "based-on" expression "in" expression "or" expression) let-if-exp)');
    expect(html.match(/✓ parses/g)!.length).toBe(3);
    expect(html).toContain('your field names');
    expect(html).toMatch(/field-name">body2<\/span> =\s*-\(x,4\)/);
  });

  it('shows why (a) does not fit: an LL(1) conflict, or a read error with a caret', () => {
    const clash = render('let-if', { a: 'Expression ::= let Identifier = Expression or Expression based-on Expression in Expression or Expression' });
    expect(clash).toContain("It does not fit LET's grammar: Not LL(1): let can start both let-exp and new-exp");
    const broken = render('let-if', { a: 'Expression ::= let-if {Identifier' });
    expect(broken).toContain('This { is never closed with }*');
    expect(broken).toContain('^');
  });

  it('marks an example that the grammar does not parse', () => {
    const html = render('let-if', { a: 'Expression ::= let-if Identifier = Expression or Expression based-on Expression in Expression' });
    expect(html).toContain("✗ Line 2, column 11: Expected the end of the program but found the keyword 'or'");
  });
});

describe('Explore on an extended language', () => {
  for (const ex of EXERCISES) {
    it(`${ex.title}: every panel draws every step`, () => {
      const lang = modelLanguage(ex);
      for (const example of ex.examples) {
        const r = runSource(lang, example.source);
        if (!r.ok) throw r.error;
        const { program, trace } = r;
        analyzeScopes(program);
        for (const step of trace.steps) {
          equation(trace, step);
          explain(trace, step);
        }
        for (let p = 0; p < positionCount(trace); p++) {
          layoutAst(program, trace, stateAt(trace, p));
          layoutEnv(trace, p);
          if (ex.base === 'cps') layoutCont(trace, p);
        }
      }
    });
  }

  it('shows the new continuations of let2 in the continuation panel', () => {
    const r = runSource(modelLanguage(EXERCISES.find((e) => e.id === 'let2')!), 'let2 x = 1 y = 2\nin -(x,y)');
    if (!r.ok) throw r.error;
    const kinds = new Set(Array.from({ length: positionCount(r.trace) }, (_, p) => layoutCont(r.trace, p)?.frames.map((f) => f.kind) ?? []).flat());
    expect(kinds).toContain('let2-exp1-cont');
    expect(kinds).toContain('let2-exp2-cont');
  });
});
