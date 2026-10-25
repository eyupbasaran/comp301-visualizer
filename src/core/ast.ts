// The shape every AST node has, whatever the language.
//
// Each language declares its own node types in its folder (the official code
// has one lang.scm per language too), but all of them follow this shape, so
// panels can walk any AST without knowing which language it came from.

/** Half-open range [from, to) of UTF-16 offsets into the source text. */
export interface Span {
  readonly from: number;
  readonly to: number;
}

/**
 * `kind` is the EOPL variant name: "const-exp", "zero?-exp", "a-program", ...
 * The other own properties are the variant's fields, in grammar order, with
 * camelCase names ("p-name" becomes `pName`). A field holds a subexpression,
 * an identifier (string), a number (bigint) or, under `arbno`, a list of them.
 */
export interface AstNode {
  /** Unique within one parse; parents get smaller ids than their children. */
  readonly id: number;
  readonly kind: string;
  readonly span: Span;
}

export type FieldValue = AstNode | string | bigint | readonly FieldValue[];

export interface Program<Root extends AstNode = AstNode> {
  readonly source: string;
  /** The `a-program` node. */
  readonly root: Root;
  /** Every node, indexed by id. */
  readonly nodes: readonly AstNode[];
}

const NOT_FIELDS = new Set(['id', 'kind', 'span']);

/** The node's fields as [name, value] pairs, in grammar order. */
export function fieldsOf(node: AstNode): [string, FieldValue][] {
  return Object.entries(node).filter(([key]) => !NOT_FIELDS.has(key)) as [string, FieldValue][];
}

export function isAstNode(x: unknown): x is AstNode {
  return typeof x === 'object' && x !== null && 'id' in x && 'kind' in x && 'span' in x;
}

/** Field name as EOPL writes it: `pName` -> "p-name", `letrecBody` -> "letrec-body". */
export function eoplName(field: string): string {
  return field.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/** The AST as an s-expression, the way the slides write it: (diff-exp (var-exp x) (const-exp 3)). */
export function astToSExp(value: FieldValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (isAstNode(value)) {
    return '(' + [value.kind, ...fieldsOf(value).map(([, v]) => astToSExp(v))].join(' ') + ')';
  }
  return '(' + value.map(astToSExp).join(' ') + ')';
}

/** The source text a node was parsed from. */
export function sourceOf(program: Program, node: AstNode): string {
  return program.source.slice(node.span.from, node.span.to);
}
