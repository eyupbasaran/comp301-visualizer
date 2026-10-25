// The AST as an indented tree, one node per line:
//
//   a-program
//   └─ let-exp
//      ├─ x                 a binder: a plain name, not a var-exp
//      ├─ const-exp 200     a lone identifier or number folds into its node
//      └─ let-exp …
//
// Nodes are named by their EOPL variant. The outline fits any program size and
// only grows downwards, unlike a top-down tree that nested lets push sideways.

import type { AstNode, FieldValue, Program } from '../core/ast';
import { fieldsOf } from '../core/ast';
import type { StateAt } from '../core/state';
import type { Trace } from '../core/trace';

export type AstState = 'current' | 'open' | 'evaluated' | 'never';

export interface AstRow {
  readonly key: string;
  /** Connector characters drawn before the label: "│  ├─ ". */
  readonly guide: string;
  /** The AST node, or null for a binder. */
  readonly node: AstNode | null;
  readonly label: string;
  readonly state: AstState | null;
}

function leafText(value: FieldValue): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  return null;
}

function spread(value: FieldValue, key: string): (readonly [string, FieldValue])[] {
  if (!Array.isArray(value)) return [[key, value]];
  return (value as readonly FieldValue[]).flatMap((v, i) => spread(v, `${key}.${i}`));
}

const evaluatedCache = new WeakMap<Trace, Set<number>>();

/** Ids of the nodes some step evaluated. */
function evaluated(trace: Trace): Set<number> {
  let ids = evaluatedCache.get(trace);
  if (!ids) {
    ids = new Set(trace.steps.flatMap((s) => (s.kind === 'apply-cont' ? [] : [s.exp.id])));
    evaluatedCache.set(trace, ids);
  }
  return ids;
}

export function layoutAst(program: Program, trace: Trace, state: StateAt): AstRow[] {
  const step = state.step;
  const currentId = step && step.kind !== 'apply-cont' ? step.exp.id : null;
  const open = new Set(state.stack.map((s) => s.exp.id));
  const done = evaluated(trace);
  const stateOf = (node: AstNode): AstState => {
    if (node.id === currentId) return 'current';
    if (open.has(node.id)) return 'open';
    // a-program is never passed to value-of; it is not "skipped".
    return done.has(node.id) || node.kind === 'a-program' ? 'evaluated' : 'never';
  };

  const rows: AstRow[] = [];
  // `prefix` continues the lines of the ancestors; `branch` is this row's own connector.
  const visit = (value: FieldValue, key: string, prefix: string, branch: string, childPrefix: string) => {
    const text = leafText(value);
    if (text !== null) {
      rows.push({ key, guide: prefix + branch, node: null, label: text, state: null });
      return;
    }
    const node = value as AstNode;
    const fields = fieldsOf(node);
    const only = fields.length === 1 ? leafText(fields[0][1]) : null;
    rows.push({
      key: `n${node.id}`,
      guide: prefix + branch,
      node,
      label: only === null ? node.kind : `${node.kind} ${only}`,
      state: stateOf(node),
    });
    if (only !== null) return;
    // Lists (from arbno) are spread into their elements, so count what will actually be drawn.
    const children = fields.flatMap(([name, v]) => spread(v, `${node.id}.${name}`));
    children.forEach(([childKey, child], i) => {
      const last = i === children.length - 1;
      visit(child, childKey, prefix + childPrefix, last ? '└─ ' : '├─ ', last ? '   ' : '│  ');
    });
  };
  visit(program.root, 'root', '', '', '');
  return rows;
}

/** Where clicking a node takes the slider: its next evaluation after `position`, else its first. */
export function stepOfNode(trace: Trace, nodeId: number, position: number): number | null {
  let first: number | null = null;
  for (const step of trace.steps) {
    if (step.kind === 'apply-cont' || step.exp.id !== nodeId) continue;
    if (first === null) first = step.index;
    if (step.index > position) return step.index;
  }
  return first;
}
