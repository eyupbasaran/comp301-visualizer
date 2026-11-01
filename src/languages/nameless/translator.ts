// Port of chapter3/lexaddr-lang/translator.scm: translation-of and the static
// environment (senv). Not a step: the translation happens before value-of.
//
// Besides the nameless AST, this builds its text for the UI by rewriting the
// student's source in place, so line breaks stay where they were:
//   let x = e in b  ->  %let e in b
//   proc (x) b      ->  %lexproc b
//   x               ->  %lexref n
// (The slides write %lexref; the official code writes %nameless-var.)

import type { AstNode, Program, Span } from '../../core/ast';
import { EoplError } from '../../core/errors';
import type { AProgram, Expression, Nameless, NamelessProgram } from './lang';

// Senv = Listof(Sym); the newest variable first.
type Senv = readonly string[];

// empty-senv : () -> Senv
const emptySenv = (): Senv => [];

// extend-senv : Var * Senv -> Senv
const extendSenv = (v: string, senv: Senv): Senv => [v, ...senv];

// apply-senv : Senv * Var -> Lexaddr
function applySenv(senv: Senv, v: string): bigint {
  if (senv.length === 0) throw new EoplError('translation-of', `unbound variable in code: ${v}`);
  if (v === senv[0]) return 0n;
  return 1n + applySenv(senv.slice(1), v);
}

// init-senv : () -> Senv
const initSenv = (): Senv => extendSenv('i', extendSenv('v', extendSenv('x', emptySenv())));

// translation-of-program : Program -> Nameless-program
export function translationOfProgram(pgm: Program<AProgram>): Program<NamelessProgram> {
  const nodes: Record<string, unknown>[] = [];
  const origin = new Map<number, AstNode>();

  // A nameless node made from the source node `from`. The id is taken before
  // the children are translated, so parents get smaller ids, as in the parser.
  function make<T extends Nameless | NamelessProgram>(from: AstNode, kind: T['kind'], fields: () => object): T {
    const id = nodes.length;
    const node: Record<string, unknown> = { id, kind, span: from.span };
    nodes.push(node);
    origin.set(id, from);
    Object.assign(node, fields());
    return node as unknown as T;
  }

  // translation-of : Exp * Senv -> Nameless-exp
  function translationOf(exp: Expression, senv: Senv): Nameless {
    switch (exp.kind) {
      case 'const-exp':
        return make(exp, 'const-exp', () => ({ num: exp.num }));
      case 'diff-exp':
        return make(exp, 'diff-exp', () => ({ exp1: translationOf(exp.exp1, senv), exp2: translationOf(exp.exp2, senv) }));
      case 'zero?-exp':
        return make(exp, 'zero?-exp', () => ({ exp1: translationOf(exp.exp1, senv) }));
      case 'if-exp':
        return make(exp, 'if-exp', () => ({
          exp1: translationOf(exp.exp1, senv),
          exp2: translationOf(exp.exp2, senv),
          exp3: translationOf(exp.exp3, senv),
        }));
      case 'var-exp':
        return make(exp, 'nameless-var-exp', () => ({ n: applySenv(senv, exp.var) }));
      case 'let-exp':
        return make(exp, 'nameless-let-exp', () => ({
          exp1: translationOf(exp.exp1, senv),
          body: translationOf(exp.body, extendSenv(exp.var, senv)),
        }));
      case 'proc-exp':
        return make(exp, 'nameless-proc-exp', () => ({ body: translationOf(exp.body, extendSenv(exp.var, senv)) }));
      case 'call-exp':
        return make(exp, 'call-exp', () => ({ rator: translationOf(exp.rator, senv), rand: translationOf(exp.rand, senv) }));
    }
  }

  const root = make<NamelessProgram>(pgm.root, 'a-program', () => ({ exp1: translationOf(pgm.root.exp1, initSenv()) }));
  return withText(pgm.source, nodes as unknown as AstNode[], origin, root);
}

// The translated text, and every node's span in it.
function withText(
  source: string,
  nodes: AstNode[],
  origin: ReadonlyMap<number, AstNode>,
  root: NamelessProgram,
): Program<NamelessProgram> {
  const edits: { from: number; to: number; text: string }[] = [];
  // "let x =" or "proc (x)", without the spaces or line break after it, which stay as they were.
  const prefix = (from: number, to: number, text: string) => {
    const kept = source.slice(from, to).replace(/\s+$/, '');
    edits.push({ from, to: from + kept.length, text });
  };
  for (const node of nodes) {
    const from = origin.get(node.id)! as unknown as Record<string, unknown> & AstNode;
    if (node.kind === 'nameless-let-exp') {
      prefix(from.span.from, (from.exp1 as AstNode).span.from, '%let');
    } else if (node.kind === 'nameless-proc-exp') {
      prefix(from.span.from, (from.body as AstNode).span.from, '%lexproc');
    } else if (node.kind === 'nameless-var-exp') {
      edits.push({ from: from.span.from, to: from.span.to, text: `%lexref ${(node as unknown as { n: bigint }).n}` });
    }
  }
  edits.sort((a, b) => a.from - b.from);

  let text = '';
  let at = 0;
  for (const e of edits) {
    text += source.slice(at, e.from) + e.text;
    at = e.to;
  }
  text += source.slice(at);

  // An offset in the source, moved by the edits that end at or before it.
  const moved = (offset: number) =>
    offset + edits.filter((e) => e.to <= offset).reduce((sum, e) => sum + e.text.length - (e.to - e.from), 0);
  const originSpans = new Map<number, Span>();
  for (const node of nodes) {
    const span = origin.get(node.id)!.span;
    originSpans.set(node.id, span);
    (node as unknown as { span: Span }).span = { from: moved(span.from), to: moved(span.to) };
  }

  return { source: text, root, nodes, originSpans };
}
