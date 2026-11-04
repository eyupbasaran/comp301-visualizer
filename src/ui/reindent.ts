// The program laid out the way the book writes it, for the contour diagram:
//
//   let x = 37
//   in proc (y)
//        let z = -(y,x)
//        in -(x,y)
//
// Every expression that takes more than one line keeps its later lines at or to
// the right of its first column, so every contour's region is a rectangle,
// whatever layout the student typed. Built from the grammar, so it works for
// every language: a keyword after the first starts a new line (in, then, else,
// end), and the rest stays on one line when it fits.

import { astToSExp, fieldsOf, type AstNode, type FieldValue, type Program } from '../core/ast';
import { isIdentifierShaped } from '../core/scanner';
import type { Item, Production } from '../core/grammar';
import type { LanguageModule } from '../core/language';

const WIDTH = 72;

type Piece =
  | { readonly t: 'lit'; readonly text: string; readonly group: boolean; readonly binder: boolean }
  | { readonly t: 'tok'; readonly text: string }
  | { readonly t: 'exp'; readonly node: AstNode; readonly firstInGroup: boolean }
  /** The start of a repetition of {…}*. */
  | { readonly t: 'rep'; readonly first: boolean };

class Layout {
  private readonly byVariant = new Map<string, Production>();

  constructor(productions: readonly Production[]) {
    for (const p of productions) this.byVariant.set(p[2], p);
  }

  /** What the node is made of, in order: its production's items with its field values. */
  pieces(node: AstNode): Piece[] {
    const production = this.byVariant.get(node.kind);
    if (!production) throw new Error(`No production for ${node.kind}`);
    const values = new Map(fieldsOf(node));
    const out: Piece[] = [];
    let expsInGroup = 0;
    const walk = (items: readonly Item[], index: number | null, top: boolean) => {
      items.forEach((item, i) => {
        if (typeof item === 'string') {
          const group = top && out.length > 0 && isIdentifierShaped(item);
          if (group) expsInGroup = 0;
          const next = items[i + 1];
          const binder = item === '(' && typeof next === 'object' && next.type === 'identifier';
          out.push({ t: 'lit', text: item, group, binder });
          return;
        }
        if (item.type === 'arbno' || item.type === 'separated-list') {
          const n = Math.max(0, ...fieldNamesOf(item.items).map((f) => (values.get(f) as unknown[] | undefined)?.length ?? 0));
          for (let k = 0; k < n; k++) {
            if (k > 0 && item.type === 'separated-list') out.push({ t: 'lit', text: item.separator, group: false, binder: false });
            out.push({ t: 'rep', first: k === 0 });
            expsInGroup = 0;
            walk(item.items, k, false);
          }
          return;
        }
        const raw = values.get(item.field);
        const value = (index === null ? raw : (raw as FieldValue[])[index]) as FieldValue;
        if (item.type === 'nonterminal') out.push({ t: 'exp', node: value as AstNode, firstInGroup: expsInGroup++ === 0 });
        else out.push({ t: 'tok', text: String(value) });
      });
    };
    walk(production[1], null, true);
    return out;
  }

  /** Whether the node must take more than one line: it, or something in it, has a keyword after its first. */
  breaks(node: AstNode): boolean {
    return this.pieces(node).some((p) => (p.t === 'lit' && p.group) || (p.t === 'exp' && this.breaks(p.node)));
  }

  flat(node: AstNode): string {
    let text = '';
    let prev: Piece | null = null;
    for (const p of this.pieces(node)) {
      if (p.t === 'rep') continue;
      text += (prev && space(prev, p) ? ' ' : '') + (p.t === 'exp' ? this.flat(p.node) : p.text);
      prev = p;
    }
    return text;
  }

  /** Appends the node to `out`, a list of lines, starting where the last line ends. */
  render(node: AstNode, out: string[]): void {
    const column = () => out[out.length - 1].length;
    const blank = () => out[out.length - 1].trim() === '';
    const newline = (indent: number) => out.push(' '.repeat(indent));
    const col = column();
    if (!this.breaks(node)) {
      const flat = this.flat(node);
      if (col + flat.length <= WIDTH) {
        out[out.length - 1] += flat;
        return;
      }
    }
    let prev: Piece | null = null;
    let align = col; // where the group's first expression starts
    let repAlign = col; // where the first repetition of {…}* starts
    let rep: 'first' | 'later' | null = null;
    let afterSeparator = false;
    for (const p of this.pieces(node)) {
      if (p.t === 'rep') {
        rep = p.first ? 'first' : 'later';
        continue;
      }
      const punctuation = p.t === 'lit' && !isIdentifierShaped(p.text);
      if (p.t === 'lit' && p.group) newline(col); // in, then, else, end
      if (rep && punctuation) afterSeparator = true; // `; e`: e goes under the first one
      else if (rep === 'later') newline(repAlign); // letrec's second p(x) = body
      const gap = prev !== null && space(prev, p) && !blank() ? 1 : 0;
      if (rep === 'first' && !punctuation) repAlign = column() + gap;
      rep = null;
      if (p.t !== 'exp') {
        out[out.length - 1] += (gap ? ' ' : '') + p.text;
        prev = p;
        continue;
      }
      if (afterSeparator || !p.firstInGroup) {
        newline(align);
        afterSeparator = false;
      } else if (prev?.t === 'lit' && prev.text === ')' && (this.breaks(p.node) || column() + gap + this.flat(p.node).length > WIDTH)) {
        newline(col + 2); // proc (x) and a long body: the body on the next line
      } else {
        out[out.length - 1] += gap ? ' ' : '';
      }
      if (p.firstInGroup) align = column();
      this.render(p.node, out);
      prev = p;
    }
  }
}

function fieldNamesOf(items: readonly Item[]): string[] {
  return items.flatMap((item) =>
    typeof item === 'string' ? [] : item.type === 'arbno' || item.type === 'separated-list' ? fieldNamesOf(item.items) : [item.field],
  );
}

/** A space between two pieces, as the book writes them: -(y,x), proc (y), even(dummy), (f x). */
function space(prev: Piece, next: Piece): boolean {
  const prevText = prev.t === 'exp' || prev.t === 'rep' ? null : prev.text;
  const nextText = next.t === 'exp' || next.t === 'rep' ? null : next.text;
  if (prevText === '(' || prevText === ',') return false;
  if (nextText === ')' || nextText === ',' || nextText === ';') return false;
  if (nextText === '(') return next.t === 'lit' && next.binder && prev.t === 'lit' && isIdentifierShaped(prev.text);
  return true;
}

/**
 * The program re-indented, parsed again so every node has its place in the new
 * text. Null when the result would not parse to the same tree; the caller then
 * keeps the program as typed.
 */
export function reindent(language: LanguageModule, program: Program): Program | null {
  try {
    const layout = new Layout(language.grammar.productions);
    const out = [''];
    layout.render(program.root, out);
    const text = out.map((l) => l.trimEnd()).join('\n');
    const again = language.parse(text);
    return astToSExp(again.root) === astToSExp(program.root) ? again : null;
  } catch {
    return null;
  }
}
