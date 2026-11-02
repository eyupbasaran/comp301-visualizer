// Compare mode renders every comparison, with its notes, and only the sections it has.

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { comparisonFor, COMPARISONS } from '../../src/compare/comparisons';
import type { LanguageId } from '../../src/core/language';
import { LANGUAGES } from '../../src/languages';
import ComparePage from '../../src/ui/compare/ComparePage';

const render = (initial: LanguageId) => renderToString(createElement(ComparePage, { initial, onOpen: () => {} }));

it('opens on the comparison that leads to each language, with its notes and only the sections it has', () => {
  for (const entry of LANGUAGES) {
    const html = render(entry.id);
    const c = comparisonFor(entry.id);
    for (let i = 1; i <= c.notes.length; i++) expect(html).toContain(`class="note-num">${i}<`);
    expect(html.includes('>Run in both</h2>')).toBe(Boolean(c.runBoth));
    expect(html.includes('>Same idea, two ways</h2>')).toBe(Boolean(c.twoWays));
  }
});

it('lists every comparison in the picker, and only those', () => {
  const html = render('let');
  expect(html.match(/<option /g)!.length).toBe(COMPARISONS.length);
});

it('LET → PROC opens interp.scm, marks the proc-exp clause and lists the new productions', () => {
  const html = render('proc');
  expect(html).toContain('+ (expression (&quot;proc&quot; &quot;(&quot; identifier &quot;)&quot; expression) proc-exp)');
  expect(html).toContain('aria-pressed="true">interp.scm');
  expect(html).toMatch(/note-num">1<\/span><\/td>.*?\(proc-exp \(var body\)/);
});

it('dims comments and leaves out files with no code change', () => {
  const html = render('proc');
  expect(html).toContain('class="diff-comment"');
  expect(html).not.toContain('>environments.scm');
});
