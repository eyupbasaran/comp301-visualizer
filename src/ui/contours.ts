// Scope analysis for the contour diagram. Static: it needs only the AST, not a run.
//
// A contour is the region where a declaration is in effect:
//   let x = e1 in body            x covers body (not e1)
//   proc (x) body                 x covers body
//   letrec p(x) = pbody in body   p covers pbody and body; x covers pbody
// The lexical depth of a variable is the number of contours between it and
// the contour that declares it, which is also its %lexref number after the
// nameless translation. Variables declared nowhere come from init-env
// (i v x), counted after every contour around them, as init-senv does.

import type { AstNode, FieldValue, Program, Span } from '../core/ast';
import { fieldsOf, isAstNode } from '../core/ast';

export interface Binder {
  readonly name: string;
  /** Where the name is written; null if the parser did not record it. */
  readonly span: Span | null;
}

export interface Contour {
  readonly id: number;
  /** The node that declares the names: let-exp, proc-exp, letrec-exp. */
  readonly owner: AstNode;
  readonly binders: readonly Binder[];
  readonly region: Span;
  /** 0 for an outermost contour. */
  readonly level: number;
  readonly parent: number | null;
}

export type Resolution =
  | { readonly kind: 'contour'; readonly contour: number; readonly binder: number }
  | { readonly kind: 'init'; readonly index: number }
  | { readonly kind: 'unbound' };

export interface Reference {
  /** The var-exp (or assign-exp) node. */
  readonly node: AstNode;
  readonly name: string;
  readonly span: Span;
  readonly resolution: Resolution;
  /** Contours between the reference and its declaration; null when unbound. */
  readonly depth: number | null;
  /** Ids of the contours it crosses on the way to its declaration, innermost first. */
  readonly crossed: readonly number[];
}

export interface Scopes {
  readonly contours: readonly Contour[];
  readonly references: readonly Reference[];
}

export const INIT_NAMES = ['i', 'v', 'x'];

interface Rule {
  readonly binders: readonly string[];
  readonly regions: readonly AstNode[];
}

type Fields = Record<string, unknown>;

/** The contours a node opens, outermost first. */
function rulesOf(node: AstNode): Rule[] {
  const f = node as unknown as Fields;
  switch (node.kind) {
    case 'let-exp':
    case 'proc-exp':
      return [{ binders: [f.var as string], regions: [f.body as AstNode] }];
    case 'letrec-exp': {
      if (Array.isArray(f.pNames)) {
        const bodies = f.pBodies as AstNode[];
        const bVars = f.bVars as string[];
        return [
          { binders: f.pNames as string[], regions: [...bodies, f.letrecBody as AstNode] },
          ...bodies.map((body, i) => ({ binders: [bVars[i]], regions: [body] })),
        ];
      }
      return [
        { binders: [f.pName as string], regions: [f.pBody as AstNode, f.letrecBody as AstNode] },
        { binders: [f.bVar as string], regions: [f.pBody as AstNode] },
      ];
    }
    default:
      return [];
  }
}

function contains(outer: Span, inner: Span): boolean {
  return outer.from <= inner.from && inner.to <= outer.to;
}

export function analyzeScopes(program: Program): Scopes {
  const nodes: AstNode[] = [];
  const walk = (value: FieldValue) => {
    if (Array.isArray(value)) (value as readonly FieldValue[]).forEach(walk);
    else if (isAstNode(value)) {
      nodes.push(value);
      fieldsOf(value).forEach(([, v]) => walk(v));
    }
  };
  walk(program.root);

  // Contours, with each binder matched to where it is written (in source order).
  const raw: Omit<Contour, 'level' | 'parent'>[] = [];
  for (const node of nodes) {
    const spans = [...(program.identifierSpans?.get(node.id) ?? [])];
    const spanFor = (name: string): Span | null => {
      const i = spans.findIndex((s) => program.source.slice(s.from, s.to) === name);
      return i === -1 ? null : spans.splice(i, 1)[0];
    };
    for (const rule of rulesOf(node)) {
      const from = Math.min(...rule.regions.map((r) => r.span.from));
      const to = Math.max(...rule.regions.map((r) => r.span.to));
      raw.push({ id: raw.length, owner: node, binders: rule.binders.map((name) => ({ name, span: spanFor(name) })), region: { from, to } });
    }
  }

  // Nesting: a contour's parent is the smallest earlier one around it.
  const contours: Contour[] = [];
  for (const c of raw) {
    let parent: Contour | null = null;
    for (const other of contours) {
      if (contains(other.region, c.region) && (!parent || contains(parent.region, other.region))) parent = other;
    }
    contours.push({ ...c, level: parent ? parent.level + 1 : 0, parent: parent ? parent.id : null });
  }

  const references: Reference[] = [];
  for (const node of nodes) {
    if (node.kind !== 'var-exp' && node.kind !== 'assign-exp') continue;
    const name = (node as unknown as Fields).var as string;
    const span = node.kind === 'var-exp' ? node.span : (program.identifierSpans?.get(node.id)?.[0] ?? node.span);
    // Contours around the reference, innermost first.
    const around = contours.filter((c) => contains(c.region, span)).sort((a, b) => b.level - a.level);
    const crossed: number[] = [];
    let resolution: Resolution = { kind: 'unbound' };
    let depth: number | null = null;
    for (const c of around) {
      const binder = c.binders.findIndex((b) => b.name === name);
      if (binder !== -1) {
        resolution = { kind: 'contour', contour: c.id, binder };
        depth = crossed.length;
        break;
      }
      crossed.push(c.id);
    }
    if (resolution.kind === 'unbound' && INIT_NAMES.includes(name)) {
      resolution = { kind: 'init', index: INIT_NAMES.indexOf(name) };
      depth = crossed.length + INIT_NAMES.indexOf(name);
    }
    references.push({ node, name, span, resolution, depth, crossed });
  }

  return { contours, references };
}

// ---- geometry ----

export const CHAR = 8.4;
export const LINE = 34;
export const TEXT_H = 20;
export const PAD_X = 24;
export const PAD_Y = 22;

export interface LineInfo {
  readonly start: number;
  readonly text: string;
}

export function linesOf(source: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let start = 0;
  for (const text of source.split('\n')) {
    lines.push({ start, text });
    start += text.length + 1;
  }
  return lines;
}

export function position(lines: readonly LineInfo[], offset: number): { line: number; col: number } {
  let line = 0;
  while (line + 1 < lines.length && lines[line + 1].start <= offset) line++;
  return { line, col: offset - lines[line].start };
}

export const textTop = (line: number) => PAD_Y + line * LINE;
export const colX = (col: number) => PAD_X + col * CHAR;

/**
 * The outline of a contour: one band per source line, from where the region
 * starts on that line to where it ends, joined into one staircase polygon.
 * Outer contours get more padding so nested ones sit inside them.
 */
export function contourPath(lines: readonly LineInfo[], region: Span, level: number, maxLevel: number): string {
  const rows = contourRows(lines, region, level, maxLevel);
  const right = rows.flatMap((r) => [`${r.right} ${r.top}`, `${r.right} ${r.bottom}`]);
  const left = [...rows].reverse().flatMap((r) => [`${r.left} ${r.bottom}`, `${r.left} ${r.top}`]);
  return `M ${[...right, ...left].join(' L ')} Z`;
}

export interface ContourRow {
  readonly line: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The band of a contour on each source line it covers. */
export function contourRows(lines: readonly LineInfo[], region: Span, level: number, maxLevel: number): ContourRow[] {
  const a = position(lines, region.from);
  const b = position(lines, region.to);
  // Outer contours sit a little further out, but never more than about one
  // character: a region starts right after "in " or "(", and the box must not
  // cut through the text before it.
  const grow = Math.min(maxLevel - level, 3);
  const px = 2 + grow * 2;
  const py = 2 + grow;
  const rows: ContourRow[] = [];
  for (let l = a.line; l <= b.line; l++) {
    const text = lines[l].text;
    const indent = text.length - text.trimStart().length;
    const startCol = l === a.line ? a.col : indent;
    const endCol = l === b.line ? b.col : text.trimEnd().length;
    // A blank line inside the region keeps the width of the line above it.
    const blank = endCol <= startCol && l !== a.line && l !== b.line;
    const previous = rows[rows.length - 1];
    rows.push({
      line: l,
      left: blank && previous ? previous.left : colX(startCol) - px,
      right: blank && previous ? previous.right : colX(endCol) + px,
      top: l === a.line ? textTop(l) - 4 - py : textTop(l) - 3,
      bottom: l === b.line ? textTop(l) + TEXT_H + 9 + py : textTop(l + 1) - 3,
    });
  }
  return rows;
}
