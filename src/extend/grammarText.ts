// Reads what a student writes for an "extend the language" question:
//   (a) the grammar entry, in the book's notation or as SLLGEN,
//         Expression ::= minus (Expression)
//         (expression ("minus" "(" expression ")") minus-exp)
//   (b) the abstract syntax,          minus-exp (exp1)
//   (c) the define-datatype entry,    (minus-exp (exp1 expression?))
// and checks (b) and (c) against (a): they follow from it mechanically.

import { arbno, expression, identifier, number, separatedList, type Item, type Production } from '../core/grammar';

export type Kind = 'identifier' | 'number' | 'expression';

export type EntryItem =
  | { readonly type: 'literal'; readonly text: string }
  | { readonly type: Kind }
  | { readonly type: 'arbno'; readonly items: readonly EntryItem[] }
  | { readonly type: 'separated-list'; readonly items: readonly EntryItem[]; readonly separator: string };

export interface Entry {
  readonly items: readonly EntryItem[];
  /** SLLGEN names the variant; the book's notation leaves it to the abstract syntax. */
  readonly variant: string | null;
}

/** A field of the variant, in grammar order. Inside {…}* it holds a list. */
export interface FieldSlot {
  readonly kind: Kind;
  readonly list: boolean;
}

export interface Abstract {
  readonly variant: string;
  readonly fields: readonly string[];
}

export interface Datatype {
  readonly variant: string;
  readonly fields: readonly (readonly [name: string, predicate: string])[];
}

export class ReadError extends Error {
  constructor(
    message: string,
    /** Offset in the text where the problem is. */
    readonly at: number,
  ) {
    super(message);
  }
}

const CLASSES: Record<string, Kind> = { Expression: 'expression', Identifier: 'identifier', Number: 'number' };

/** (a), in either notation: SLLGEN when it starts with "(". */
export function readEntry(text: string): Entry {
  return text.trimStart().startsWith('(') ? readSllgen(text) : readBnf(text);
}

// ---- The book's notation ----

type BnfToken =
  | { readonly t: 'word'; readonly text: string; readonly at: number }
  | { readonly t: 'open'; readonly at: number }
  | { readonly t: 'close'; readonly separator: string | null; readonly at: number };

function bnfTokens(text: string): BnfToken[] {
  const tokens: BnfToken[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) i++;
    else if (c === '{') tokens.push({ t: 'open', at: i++ });
    else if (c === '}') {
      const at = i++;
      if (text[i] !== '*') throw new ReadError('A } must be followed by * : {…}* means zero or more times', at);
      i++;
      let separator: string | null = null;
      // {…}*(,) : a separated list.
      if (text[i] === '(' && text.indexOf(')', i + 2) !== -1) {
        const end = text.indexOf(')', i + 2);
        separator = text.slice(i + 1, end).trim();
        i = end + 1;
      }
      tokens.push({ t: 'close', separator, at });
    } else if (c === '(' || c === ')' || c === ',') tokens.push({ t: 'word', text: c, at: i++ });
    else {
      const at = i;
      while (i < text.length && !/[\s(){},]/.test(text[i])) i++;
      tokens.push({ t: 'word', text: text.slice(at, i), at });
    }
  }
  return tokens;
}

function readBnf(text: string): Entry {
  const tokens = bnfTokens(text);
  const [lhs, arrow] = tokens;
  if (!lhs || lhs.t !== 'word' || lhs.text !== 'Expression' || !arrow || arrow.t !== 'word' || arrow.text !== '::=') {
    throw new ReadError('Start with "Expression ::=", then the new expression', lhs?.at ?? 0);
  }
  let pos = 2;
  const items = (inside: BnfToken | null): EntryItem[] => {
    const out: EntryItem[] = [];
    for (;;) {
      const token = tokens[pos];
      if (!token) {
        if (inside) throw new ReadError('This { is never closed with }*', inside.at);
        return out;
      }
      pos++;
      if (token.t === 'close') {
        if (!inside) throw new ReadError('This }* has no { before it', token.at);
        if (out.length === 0) throw new ReadError('Nothing between { and }*', inside.at);
        return token.separator === null
          ? [{ type: 'arbno', items: out }]
          : [{ type: 'separated-list', items: out, separator: token.separator }];
      }
      if (token.t === 'open') out.push(...items(token));
      else if (token.text === '::=') throw new ReadError('Write one entry: a second ::= is not allowed', token.at);
      else if (CLASSES[token.text]) out.push({ type: CLASSES[token.text] });
      else if (/^[A-Z][a-z]/.test(token.text)) {
        throw new ReadError(`Unknown nonterminal ${token.text}: use Expression, Identifier or Number`, token.at);
      } else out.push({ type: 'literal', text: token.text });
    }
  };
  const all = items(null);
  if (all.length === 0) throw new ReadError('The new expression is missing after ::=', arrow.at);
  return { items: all, variant: null };
}

// ---- SLLGEN ----

type SExp =
  | { readonly s: 'string'; readonly text: string; readonly at: number }
  | { readonly s: 'symbol'; readonly text: string; readonly at: number }
  | { readonly s: 'list'; readonly items: SExp[]; readonly at: number };

function readSExp(text: string): SExp {
  let i = 0;
  const skip = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const one = (): SExp => {
    skip();
    const at = i;
    if (i >= text.length) throw new ReadError('The entry ends too early: a ) is missing', text.length);
    if (text[i] === '(') {
      i++;
      const items: SExp[] = [];
      for (;;) {
        skip();
        if (i >= text.length) throw new ReadError('This ( is never closed', at);
        if (text[i] === ')') {
          i++;
          return { s: 'list', items, at };
        }
        items.push(one());
      }
    }
    if (text[i] === ')') throw new ReadError('This ) has no ( before it', at);
    if (text[i] === '"') {
      const end = text.indexOf('"', i + 1);
      if (end === -1) throw new ReadError('This string is never closed with "', at);
      i = end + 1;
      return { s: 'string', text: text.slice(at + 1, end), at };
    }
    while (i < text.length && !/[\s()"]/.test(text[i])) i++;
    return { s: 'symbol', text: text.slice(at, i), at };
  };
  const result = one();
  skip();
  if (i < text.length) throw new ReadError('Write one entry: there is text after it', i);
  return result;
}

function readSllgen(text: string): Entry {
  const top = readSExp(text);
  if (top.s !== 'list' || top.items.length !== 3) {
    throw new ReadError('An SLLGEN entry has three parts: (expression (…) variant-name)', top.at);
  }
  const [lhs, rhs, variant] = top.items;
  if (lhs.s !== 'symbol' || lhs.text !== 'expression') throw new ReadError('The entry must be for expression', lhs.at);
  if (rhs.s !== 'list') throw new ReadError('The right-hand side must be a list: ("keyword" expression …)', rhs.at);
  if (variant.s !== 'symbol') throw new ReadError('The last part is the variant name, e.g. minus-exp', variant.at);
  const items = (list: SExp[]): EntryItem[] =>
    list.map((x): EntryItem => {
      if (x.s === 'string') return { type: 'literal', text: x.text };
      if (x.s === 'symbol') {
        if (x.text === 'expression' || x.text === 'identifier' || x.text === 'number') return { type: x.text };
        throw new ReadError(`Unknown item ${x.text}: use "…" for a keyword, or expression, identifier, number`, x.at);
      }
      const [head, ...rest] = x.items;
      if (head?.s === 'symbol' && head.text === 'arbno' && rest.length > 0) return { type: 'arbno', items: items(rest) };
      if (head?.s === 'symbol' && head.text === 'separated-list' && rest.length > 1) {
        const sep = rest[rest.length - 1];
        if (sep.s !== 'string') throw new ReadError('The separator of separated-list is a string, e.g. ","', sep.at);
        return { type: 'separated-list', items: items(rest.slice(0, -1)), separator: sep.text };
      }
      throw new ReadError('Only (arbno …) and (separated-list … "sep") can be nested', x.at);
    });
  const all = items(rhs.items);
  if (all.length === 0) throw new ReadError('The right-hand side is empty', rhs.at);
  return { items: all, variant: variant.text };
}

// ---- Fields ----

export function slotsOf(entry: Entry): FieldSlot[] {
  const walk = (items: readonly EntryItem[], list: boolean): FieldSlot[] =>
    items.flatMap((item) =>
      item.type === 'literal' ? [] : item.type === 'arbno' || item.type === 'separated-list' ? walk(item.items, true) : [{ kind: item.type, list }],
    );
  return walk(entry.items, false);
}

/** var, exp1, exp2, …: the names a field gets before the student names it in (b). */
export function defaultNames(slots: readonly FieldSlot[]): string[] {
  const count = (kind: Kind) => slots.filter((s) => s.kind === kind).length;
  const seen: Record<Kind, number> = { identifier: 0, number: 0, expression: 0 };
  const base: Record<Kind, string> = { identifier: 'var', number: 'num', expression: 'exp' };
  return slots.map((s) => {
    seen[s.kind]++;
    if (s.kind === 'expression' || count(s.kind) > 1) return `${base[s.kind]}${seen[s.kind]}`;
    return base[s.kind];
  });
}

/** "identifier, expression, list of expression" */
export function describeSlots(slots: readonly FieldSlot[]): string {
  return slots.map((s) => (s.list ? `list of ${s.kind}` : s.kind)).join(', ');
}

const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** The production the parser uses: field names from (b) when given, else the defaults. */
export function toProduction(entry: Entry, abstract?: Abstract | null): Production {
  const slots = slotsOf(entry);
  const names = (abstract && abstract.fields.length === slots.length ? abstract.fields : defaultNames(slots)).map(camel);
  let n = 0;
  const convert = (items: readonly EntryItem[]): Item[] =>
    items.map((item) => {
      switch (item.type) {
        case 'literal':
          return item.text;
        case 'identifier':
          return identifier(names[n++]);
        case 'number':
          return number(names[n++]);
        case 'expression':
          return expression(names[n++]);
        case 'arbno':
          return arbno(...convert(item.items));
        case 'separated-list':
          return separatedList(convert(item.items), item.separator);
      }
    });
  return ['expression', convert(entry.items), entry.variant ?? abstract?.variant ?? 'new-exp'];
}

// ---- (b) and (c) ----

const NAME = /^[A-Za-z][A-Za-z0-9_\-?*]*$/;

/** let-exp (var exp1 body) */
export function readAbstract(text: string): Abstract {
  const m = /^\s*([^\s()]+)\s*\(([^()]*)\)\s*$/.exec(text);
  if (!m) throw new ReadError('Write the variant, then its fields in parentheses: let-exp (var exp1 body)', 0);
  return { variant: m[1], fields: m[2].split(/\s+/).filter(Boolean) };
}

/** (let-exp (var identifier?) (exp1 expression?) (body expression?)) */
export function readDatatype(text: string): Datatype {
  const top = readSExp(text);
  if (top.s !== 'list' || top.items[0]?.s !== 'symbol') {
    throw new ReadError('Write one variant: (let-exp (var identifier?) (exp1 expression?) …)', top.at);
  }
  const fields = top.items.slice(1).map((f) => {
    if (f.s !== 'list' || f.items.length !== 2 || f.items[0].s !== 'symbol') {
      throw new ReadError('Each field is (name predicate?), e.g. (exp1 expression?)', f.at);
    }
    return [f.items[0].text, printSExp(f.items[1])] as const;
  });
  return { variant: (top.items[0] as { text: string }).text, fields };
}

function printSExp(x: SExp): string {
  return x.s === 'list' ? `(${x.items.map(printSExp).join(' ')})` : x.s === 'string' ? `"${x.text}"` : x.text;
}

/** What (b) gets wrong against (a). Empty when it is right. */
export function checkAbstract(entry: Entry, abstract: Abstract): string[] {
  const slots = slotsOf(entry);
  const problems: string[] = [];
  if (entry.variant && abstract.variant !== entry.variant) problems.push(`The variant is ${entry.variant} in your (a), not ${abstract.variant}.`);
  if (!abstract.variant.endsWith('-exp')) problems.push(`By convention an expression variant ends in -exp, e.g. ${abstract.variant}-exp.`);
  if (abstract.fields.length !== slots.length) {
    problems.push(
      `(a) has ${slots.length} field${slots.length === 1 ? '' : 's'} (${describeSlots(slots) || 'none'}): one for each Expression, Identifier and Number, never for a keyword. You wrote ${abstract.fields.length}.`,
    );
  }
  const bad = abstract.fields.filter((f) => !NAME.test(f));
  if (bad.length) problems.push(`Not a field name: ${bad.join(', ')}.`);
  const dup = abstract.fields.filter((f, i) => abstract.fields.indexOf(f) !== i);
  if (dup.length) problems.push(`Each field needs its own name: ${[...new Set(dup)].join(', ')} appears twice.`);
  return problems;
}

const PREDICATES: Record<Kind, readonly string[]> = {
  identifier: ['identifier?', 'symbol?'],
  number: ['number?'],
  expression: ['expression?'],
};

function predicateFits(slot: FieldSlot, predicate: string): boolean {
  if (!slot.list) return PREDICATES[slot.kind].includes(predicate);
  const m = /^\(list-of ([^\s()]+)\)$/.exec(predicate);
  return m !== null && PREDICATES[slot.kind].includes(m[1]);
}

/** The predicate the datatype needs for a field. */
export function predicateOf(slot: FieldSlot): string {
  const p = PREDICATES[slot.kind][0];
  return slot.list ? `(list-of ${p})` : p;
}

/** What (c) gets wrong against (a), and (b) when it is given. Empty when it is right. */
export function checkDatatype(entry: Entry, abstract: Abstract | null, datatype: Datatype): string[] {
  const slots = slotsOf(entry);
  const problems: string[] = [];
  const variant = abstract?.variant ?? entry.variant;
  if (variant && datatype.variant !== variant) problems.push(`The variant is ${variant}, as in your ${abstract ? '(b)' : '(a)'}.`);
  if (datatype.fields.length !== slots.length) {
    problems.push(`(a) has ${slots.length} field${slots.length === 1 ? '' : 's'} (${describeSlots(slots) || 'none'}); you wrote ${datatype.fields.length}.`);
    return problems;
  }
  datatype.fields.forEach(([name, predicate], i) => {
    const slot = slots[i];
    if (abstract && abstract.fields.length === slots.length && name !== abstract.fields[i]) {
      problems.push(`Field ${i + 1} is ${abstract.fields[i]} in your (b), not ${name}.`);
    }
    if (!predicateFits(slot, predicate)) {
      const why = slot.list ? `it is inside {…}*, so it holds a list` : `it comes from ${slot.kind[0].toUpperCase() + slot.kind.slice(1)}`;
      problems.push(`${name}: the predicate is ${predicateOf(slot)}, because ${why}; you wrote ${predicate}.`);
    }
  });
  return problems;
}

// ---- Printing the generated answers ----

export function printAbstract(variant: string, names: readonly string[]): string {
  return `${variant} (${names.join(' ')})`;
}

export function printDatatype(variant: string, names: readonly string[], slots: readonly FieldSlot[]): string {
  return `(${variant}\n${names.map((n, i) => `  (${n} ${predicateOf(slots[i])})`).join('\n')})`;
}

export function printBnf(entry: Entry): string {
  const items = (list: readonly EntryItem[]): string =>
    list
      .map((item) => {
        switch (item.type) {
          case 'literal':
            return item.text;
          case 'arbno':
            return `{${items(item.items)}}*`;
          case 'separated-list':
            return `{${items(item.items)}}*(${item.separator})`;
          default:
            return item.type[0].toUpperCase() + item.type.slice(1);
        }
      })
      .join(' ');
  return `Expression ::= ${items(entry.items)}`;
}
