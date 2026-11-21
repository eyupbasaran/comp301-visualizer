// Which grammar productions one language adds, drops or changes compared with another,
// matched by variant name and printed the way lang.scm writes them.

import type { Grammar, Item, Production } from '../core/grammar';

export interface GrammarChange {
  readonly kind: 'add' | 'del' | 'change';
  readonly variant: string;
  /** As in lang.scm: (expression ("proc" "(" identifier ")" expression) proc-exp). */
  readonly a?: string;
  readonly b?: string;
}

function item(i: Item): string {
  if (typeof i === 'string') return JSON.stringify(i);
  switch (i.type) {
    case 'nonterminal':
      return i.name;
    case 'identifier':
    case 'number':
      return i.type;
    case 'arbno':
      return `(arbno ${i.items.map(item).join(' ')})`;
    case 'separated-list':
      return `(separated-list ${i.items.map(item).join(' ')} ${JSON.stringify(i.separator)})`;
  }
}

export function printProduction([lhs, rhs, variant]: Production): string {
  return `(${lhs} (${rhs.map(item).join(' ')}) ${variant})`;
}

export function grammarDiff(a: Grammar, b: Grammar): GrammarChange[] {
  const before = new Map(a.productions.map((p) => [p[2], printProduction(p)]));
  const after = new Map(b.productions.map((p) => [p[2], printProduction(p)]));
  const changes: GrammarChange[] = [];
  for (const [variant, text] of before) {
    if (!after.has(variant)) changes.push({ kind: 'del', variant, a: text });
    else if (after.get(variant) !== text) changes.push({ kind: 'change', variant, a: text, b: after.get(variant) });
  }
  for (const [variant, text] of after) if (!before.has(variant)) changes.push({ kind: 'add', variant, b: text });
  return changes;
}
