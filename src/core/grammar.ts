// An SLLGEN-style parser. A language writes its grammar the way lang.scm does:
//
//   (expression ("-" "(" expression "," expression ")") diff-exp)
//
// becomes
//
//   ['expression', ['-', '(', expression('exp1'), ',', expression('exp2'), ')'], 'diff-exp']
//
// Plain strings are literals. Items that carry a value also name the field it
// goes into (the names the official interp.scm uses in its `cases`). Like
// SLLGEN, the grammar must be LL(1); conflicts are reported when the Grammar
// is built, so a broken grammar fails its first test instead of parsing wrong.

import type { AstNode, Program, Span } from './ast';
import { ParseError } from './errors';
import { isIdentifierShaped, scan, type Token } from './scanner';

export type Item = string | NonterminalItem | IdentifierItem | NumberItem | ArbnoItem | SeparatedListItem;

export interface NonterminalItem {
  readonly type: 'nonterminal';
  readonly name: string;
  readonly field: string;
}
export interface IdentifierItem {
  readonly type: 'identifier';
  readonly field: string;
}
export interface NumberItem {
  readonly type: 'number';
  readonly field: string;
}
/** (arbno ...): zero or more times. Each field inside becomes a list. */
export interface ArbnoItem {
  readonly type: 'arbno';
  readonly items: readonly Item[];
}
/** (separated-list ... sep): zero or more times, separated by `separator`. Each field inside becomes a list. */
export interface SeparatedListItem {
  readonly type: 'separated-list';
  readonly items: readonly Item[];
  readonly separator: string;
}

/** One entry of the-grammar: (lhs (rhs ...) variant). */
export type Production = readonly [lhs: string, rhs: readonly Item[], variant: string];

export const nonterminal = (name: string, field: string): NonterminalItem => ({ type: 'nonterminal', name, field });
export const expression = (field: string): NonterminalItem => nonterminal('expression', field);
export const identifier = (field: string): IdentifierItem => ({ type: 'identifier', field });
export const number = (field: string): NumberItem => ({ type: 'number', field });
export const arbno = (...items: Item[]): ArbnoItem => ({ type: 'arbno', items });
export const separatedList = (items: Item[], separator: string): SeparatedListItem => ({
  type: 'separated-list',
  items,
  separator,
});

export class GrammarError extends Error {}

// Lookahead keys: a literal is "'text"; token classes are "#identifier", "#number", "#eof".
const literalKey = (text: string) => `'${text}`;
const keyOf = (token: Token) => (token.kind === 'literal' ? literalKey(token.text) : `#${token.kind}`);

export class Grammar {
  /** Every literal string in the grammar: keywords ("let", "zero?") and punctuation ("-", "("). */
  readonly literals: ReadonlySet<string>;
  /** The literals that look like identifiers. They are reserved: a program can't use them as names. */
  readonly keywords: readonly string[];

  private readonly first = new Map<string, Set<string>>();
  private readonly table = new Map<string, Map<string, Production>>();
  private readonly seqFirst = new WeakMap<readonly Item[], Set<string>>();

  constructor(
    readonly start: string,
    readonly productions: readonly Production[],
  ) {
    const literals = new Set<string>();
    const visit = (items: readonly Item[]) => {
      for (const item of items) {
        if (typeof item === 'string') literals.add(item);
        else if (item.type === 'arbno') visit(item.items);
        else if (item.type === 'separated-list') {
          literals.add(item.separator);
          visit(item.items);
        }
      }
    };
    for (const [, rhs] of productions) visit(rhs);
    this.literals = literals;
    this.keywords = [...literals].filter(isIdentifierShaped);

    this.check();
    this.computeFirstSets();
    this.buildTable();
  }

  /** Parses a whole program. Throws ParseError. */
  parse(source: string): Program {
    try {
      return new Parser(this, source).parseProgram();
    } catch (e) {
      // The parser is recursive; thousands of nested expressions overflow the JS stack.
      if (e instanceof RangeError || (e instanceof Error && e.name === 'InternalError')) {
        throw new ParseError('The program is nested too deeply to parse', source, 0);
      }
      throw e;
    }
  }

  /** The production for `nonterminal` when the next token has `key`, if any. */
  predict(nonterminal: string, key: string): Production | undefined {
    return this.table.get(nonterminal)?.get(key);
  }

  /** "an expression" for error messages. A wrapper like program -> expression is described by what it wraps. */
  describe(nonterminal: string, seen = new Set<string>()): string {
    const productions = this.productions.filter(([lhs]) => lhs === nonterminal);
    const first = productions.length === 1 ? productions[0][1][0] : undefined;
    if (typeof first === 'object' && first.type === 'nonterminal' && !seen.has(nonterminal)) {
      return this.describe(first.name, seen.add(nonterminal));
    }
    return (/^[aeiou]/.test(nonterminal) ? 'an ' : 'a ') + nonterminal;
  }

  /** Lookahead keys that can start `items`. */
  firstOf(items: readonly Item[]): Set<string> {
    let keys = this.seqFirst.get(items);
    if (!keys) {
      keys = this.firstOfSequence(items).keys;
      this.seqFirst.set(items, keys);
    }
    return keys;
  }

  private check(): void {
    const defined = new Set(this.productions.map(([lhs]) => lhs));
    if (!defined.has(this.start)) throw new GrammarError(`No production for the start symbol ${this.start}`);
    for (const [lhs, rhs, variant] of this.productions) {
      const fields = new Set<string>();
      const visit = (items: readonly Item[]) => {
        for (const item of items) {
          if (typeof item === 'string') continue;
          if (item.type === 'arbno' || item.type === 'separated-list') {
            visit(item.items);
            continue;
          }
          if (item.type === 'nonterminal' && !defined.has(item.name)) {
            throw new GrammarError(`${variant}: no production for <${item.name}>`);
          }
          if (fields.has(item.field)) throw new GrammarError(`${variant}: field ${item.field} appears twice`);
          fields.add(item.field);
        }
      };
      visit(rhs);
      if (rhs.length === 0) throw new GrammarError(`${variant}: empty right-hand side for <${lhs}>`);
    }
  }

  private computeFirstSets(): void {
    for (const [lhs] of this.productions) this.first.set(lhs, new Set());
    for (let changed = true; changed; ) {
      changed = false;
      for (const [lhs, rhs] of this.productions) {
        const set = this.first.get(lhs)!;
        const before = set.size;
        for (const key of this.firstOfSequence(rhs).keys) set.add(key);
        if (set.size !== before) changed = true;
      }
    }
  }

  // First keys of a sequence, and whether it can match no tokens at all.
  private firstOfSequence(items: readonly Item[]): { keys: Set<string>; empty: boolean } {
    const keys = new Set<string>();
    for (const item of items) {
      if (typeof item === 'string') {
        keys.add(literalKey(item));
        return { keys, empty: false };
      }
      switch (item.type) {
        case 'identifier':
        case 'number':
          keys.add(`#${item.type}`);
          return { keys, empty: false };
        case 'nonterminal':
          // Nonterminals never match nothing (checked in buildTable).
          for (const key of this.first.get(item.name) ?? []) keys.add(key);
          return { keys, empty: false };
        case 'arbno':
        case 'separated-list':
          // May match nothing, so whatever follows can start the sequence too.
          for (const key of this.firstOfSequence(item.items).keys) keys.add(key);
          break;
      }
    }
    return { keys, empty: true };
  }

  private buildTable(): void {
    const checkRepeats = (items: readonly Item[], variant: string) => {
      for (const item of items) {
        if (typeof item === 'string' || (item.type !== 'arbno' && item.type !== 'separated-list')) continue;
        if (this.firstOfSequence(item.items).empty) {
          throw new GrammarError(`${variant}: the body of ${item.type} can match nothing`);
        }
        checkRepeats(item.items, variant);
      }
    };

    for (const production of this.productions) {
      const [lhs, rhs, variant] = production;
      const { keys, empty } = this.firstOfSequence(rhs);
      if (empty) throw new GrammarError(`${variant}: can match nothing, which this parser doesn't support`);
      checkRepeats(rhs, variant);
      let row = this.table.get(lhs);
      if (!row) this.table.set(lhs, (row = new Map()));
      for (const key of keys) {
        const other = row.get(key);
        if (other) {
          throw new GrammarError(`Not LL(1): ${key.slice(1)} can start both ${other[2]} and ${variant} in <${lhs}>`);
        }
        row.set(key, production);
      }
    }
  }
}

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  /** End offset of the last token consumed. */
  private lastEnd = 0;
  private readonly nodes: AstNode[] = [];
  private readonly identifierSpans = new Map<number, Span[]>();
  /** Ids of the nodes being built, innermost last. */
  private readonly building: number[] = [];

  constructor(
    private readonly grammar: Grammar,
    private readonly source: string,
  ) {
    this.tokens = scan(source, grammar.literals);
  }

  parseProgram(): Program {
    const root = this.parseNonterminal(this.grammar.start);
    const next = this.peek();
    if (next.kind !== 'eof') throw this.error(`Expected the end of the program but found ${this.describe(next)}`, next);
    return { source: this.source, root, nodes: this.nodes, identifierSpans: this.identifierSpans };
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos++];
    this.lastEnd = token.to;
    return token;
  }

  private parseNonterminal(name: string): AstNode {
    const next = this.peek();
    const production = this.grammar.predict(name, keyOf(next));
    if (!production) throw this.error(`Expected ${this.grammar.describe(name)} but found ${this.describe(next)}`, next);
    const [, rhs, variant] = production;
    // Built field by field so the property order is the grammar order; span goes in third and is set last.
    const id = this.nodes.length;
    const node: Record<string, unknown> = { id, kind: variant, span: null };
    this.nodes.push(node as unknown as AstNode);
    this.building.push(id);
    this.parseItems(rhs, node);
    this.building.pop();
    node.span = { from: next.from, to: this.lastEnd };
    return node as unknown as AstNode;
  }

  private parseItems(items: readonly Item[], into: Record<string, unknown>): void {
    for (const item of items) {
      if (typeof item === 'string') {
        this.expectLiteral(item);
        continue;
      }
      switch (item.type) {
        case 'nonterminal':
          into[item.field] = this.parseNonterminal(item.name);
          break;
        case 'identifier': {
          const token = this.expect('identifier', 'an identifier');
          into[item.field] = token.text;
          const owner = this.building[this.building.length - 1];
          const spans = this.identifierSpans.get(owner) ?? [];
          spans.push({ from: token.from, to: token.to });
          this.identifierSpans.set(owner, spans);
          break;
        }
        case 'number':
          into[item.field] = this.expect('number', 'a number').value;
          break;
        case 'arbno':
          this.parseRepeated(item.items, null, into);
          break;
        case 'separated-list':
          this.parseRepeated(item.items, item.separator, into);
          break;
      }
    }
  }

  private parseRepeated(items: readonly Item[], separator: string | null, into: Record<string, unknown>): void {
    const fields = fieldNames(items);
    const lists = fields.map((field) => (into[field] = []) as unknown[]);
    const starts = this.grammar.firstOf(items);
    if (!starts.has(keyOf(this.peek()))) return;
    for (;;) {
      const one: Record<string, unknown> = {};
      this.parseItems(items, one);
      fields.forEach((field, i) => lists[i].push(one[field]));
      if (separator === null) {
        if (!starts.has(keyOf(this.peek()))) return;
      } else {
        const next = this.peek();
        if (next.kind !== 'literal' || next.text !== separator) return;
        this.advance();
      }
    }
  }

  private expectLiteral(text: string): void {
    const next = this.peek();
    if (next.kind !== 'literal' || next.text !== text) {
      throw this.error(`Expected '${text}' but found ${this.describe(next)}`, next);
    }
    this.advance();
  }

  private expect<K extends 'identifier' | 'number'>(kind: K, what: string): Extract<Token, { kind: K }> {
    const next = this.peek();
    if (next.kind !== kind) throw this.error(`Expected ${what} but found ${this.describe(next)}`, next);
    return this.advance() as Extract<Token, { kind: K }>;
  }

  private describe(token: Token): string {
    if (token.kind === 'eof') return 'the end of the program';
    if (token.kind === 'literal' && isIdentifierShaped(token.text)) return `the keyword '${token.text}'`;
    return `'${token.text}'`;
  }

  private error(message: string, token: Token): ParseError {
    return new ParseError(message, this.source, token.from, token.to);
  }
}

/** Fields that items fill in, including ones nested in repeats. */
function fieldNames(items: readonly Item[]): string[] {
  return items.flatMap((item) => {
    if (typeof item === 'string') return [];
    if (item.type === 'arbno' || item.type === 'separated-list') return fieldNames(item.items);
    return [item.field];
  });
}
