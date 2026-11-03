// A base language plus one new production: the language an Extend exercise asks for.

import { commentStart } from '../compare/diff';
import { Grammar, type Production } from '../core/grammar';
import type { Example, LanguageModule } from '../core/language';

/** Throws GrammarError when the production does not fit the base grammar (e.g. not LL(1)). */
export function extendGrammar(base: LanguageModule, production: Production): Grammar {
  return new Grammar(base.grammar.start, [...base.grammar.productions, production]);
}

export function extendLanguage(
  base: LanguageModule,
  production: Production,
  run: LanguageModule['run'],
  examples: readonly Example[],
): LanguageModule {
  const grammar = extendGrammar(base, production);
  return {
    ...base,
    variant: { id: production[2], description: `${base.name} extended with ${production[2]} (Extend mode)` },
    grammar,
    examples,
    parse: (source) => grammar.parse(source),
    run,
  };
}

/**
 * The `cases` clause for `variant` in an interp.scm, e.g. the whole (let-exp (var exp1 body) …),
 * dedented. Found by matching parentheses; strings, characters and comments don't count.
 */
export function clauseOf(scheme: string, variant: string): string | null {
  const text = scheme.split('\n').map(expandTabs).join('\n');
  const pattern = new RegExp(`\\(${variant.replace(/[?*]/g, '\\$&')} \\(`, 'g');
  for (const m of text.matchAll(pattern)) {
    const start = m.index;
    const lineStart = text.lastIndexOf('\n', start) + 1;
    const cut = commentStart(text.slice(lineStart, start + 1), 'scheme');
    if (cut !== -1) continue; // commented out
    const end = closingParen(text, start);
    if (end === -1) return null;
    const indent = start - lineStart;
    return text
      .slice(start, end + 1)
      .split('\n')
      .map((l, n) => (n === 0 ? l : l.slice(Math.min(indent, l.length - l.trimStart().length))))
      .join('\n');
  }
  return null;
}

/** The ) that closes the ( at `start`; strings, characters and comments don't count. */
function closingParen(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const lineEnd = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i);
    const line = text.slice(i, lineEnd);
    const cut = commentStart(line, 'scheme');
    const code = cut === -1 ? line : line.slice(0, cut);
    let inString = false;
    for (let k = 0; k < code.length; k++) {
      const c = code[k];
      if (inString) {
        if (c === '\\') k++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '#' && code[k + 1] === '\\') k += 2;
      else if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return i + k;
    }
    i = lineEnd + 1;
  }
  return -1;
}

/** Racket's files indent with tabs at every 8 columns. */
function expandTabs(line: string): string {
  let out = '';
  for (const c of line) out += c === '\t' ? ' '.repeat(8 - (out.length % 8)) : c;
  return out;
}
