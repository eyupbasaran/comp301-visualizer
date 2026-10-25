// The program text with its contours drawn around it, and the lexical depth
// under every variable. Selecting a variable shows the contour that declares it.

import type { ReactNode } from 'react';
import type { Program } from '../core/ast';
import {
  CHAR,
  LINE,
  PAD_X,
  PAD_Y,
  TEXT_H,
  colX,
  contourPath,
  linesOf,
  position,
  textTop,
  type Contour,
  type Reference,
  type Scopes,
} from './contours';

const OWNER: Record<string, string> = { 'let-exp': 'let', 'proc-exp': 'proc', 'letrec-exp': 'letrec' };
const TOKEN = /\p{Alphabetic}[\p{Alphabetic}0-9_\-?]*/gu;

function describeContour(c: Contour): string {
  return `${OWNER[c.owner.kind] ?? c.owner.kind} ${c.binders.map((b) => b.name).join(', ')}`;
}

/** One sentence about where a variable is declared and what its depth means. */
export function describeReference(program: Program, scopes: Scopes, ref: Reference): string {
  const lines = linesOf(program.source);
  const at = `${ref.name} (line ${position(lines, ref.span.from).line + 1})`;
  const crossed = ref.crossed.map((id) => describeContour(scopes.contours[id]));
  const across = crossed.length === 0 ? 'no contours in between' : `crossing ${crossed.join(', then ')}`;
  switch (ref.resolution.kind) {
    case 'contour': {
      const c = scopes.contours[ref.resolution.contour];
      const line = position(lines, c.owner.span.from).line + 1;
      return `${at} is declared by ${describeContour(c)} on line ${line}. Lexical depth ${ref.depth}: ${across}.`;
    }
    case 'init':
      return `${at} is not declared in the program; it comes from init-env (i v x). After the nameless translation it is %lexref ${ref.depth}: ${ref.crossed.length} contour(s), then position ${ref.resolution.index} in (i v x).`;
    case 'unbound':
      return `${at} is not declared anywhere, so evaluating it ends in "apply-env: No binding for ${ref.name}".`;
  }
}

interface Props {
  program: Program;
  scopes: Scopes;
  keywords: readonly string[];
  selected: number | null;
  onSelect(nodeId: number): void;
}

export function ContourView({ program, scopes, keywords, selected, onSelect }: Props) {
  const lines = linesOf(program.source);
  const keywordSet = new Set(keywords);
  const maxLevel = Math.max(0, ...scopes.contours.map((c) => c.level));
  const width = colX(Math.max(...lines.map((l) => l.text.length))) + PAD_X + 8 + maxLevel * 4;
  const height = textTop(lines.length - 1) + LINE + PAD_Y;

  const ref = scopes.references.find((r) => r.node.id === selected) ?? null;
  const binding = ref?.resolution.kind === 'contour' ? scopes.contours[ref.resolution.contour] : null;
  const binderSpan = binding && ref?.resolution.kind === 'contour' ? binding.binders[ref.resolution.binder].span : null;
  const crossed = new Set(ref?.crossed ?? []);

  const band = (from: number, to: number, className: string, key: string) => {
    const p = position(lines, from);
    return (
      <div
        key={key}
        className={className}
        style={{ left: colX(p.col) - 2, top: textTop(p.line) - 1, width: (to - from) * CHAR + 4, height: TEXT_H + 2 }}
      />
    );
  };

  return (
    <div className="contour-wrap">
      <div className="contour-scroll">
        <div className="contour-host" style={{ width, height }}>
          {ref && band(ref.span.from, ref.span.to, 'contour-mark', 'ref')}
          {binderSpan && band(binderSpan.from, binderSpan.to, 'contour-mark', 'binder')}

          <svg className="contour-lines" width={width} height={height} aria-hidden="true">
            {scopes.contours.map((c) => (
              <path
                key={c.id}
                d={contourPath(lines, c.region, c.level, maxLevel)}
                className={c === binding ? 'contour binding' : crossed.has(c.id) ? 'contour crossed' : 'contour'}
              />
            ))}
          </svg>

          {lines.map((line, i) => {
            const parts: ReactNode[] = [];
            let last = 0;
            for (const m of line.text.matchAll(TOKEN)) {
              if (!keywordSet.has(m[0])) continue;
              parts.push(line.text.slice(last, m.index), <b key={m.index}>{m[0]}</b>);
              last = m.index + m[0].length;
            }
            parts.push(line.text.slice(last));
            return (
              <div key={i} className="contour-line" style={{ left: PAD_X, top: textTop(i) }}>
                {parts}
              </div>
            );
          })}

          {scopes.references.map((r) => {
            const p = position(lines, r.span.from);
            const label = r.depth === null ? '?' : String(r.depth);
            const kind = r.resolution.kind;
            return (
              <button
                key={r.node.id}
                type="button"
                className={`contour-ref ${kind}${r.node.id === selected ? ' selected' : ''}`}
                style={{ left: colX(p.col), top: textTop(p.line), width: Math.max(CHAR, (r.span.to - r.span.from) * CHAR) }}
                aria-label={`${r.name}: lexical depth ${label}`}
                onClick={() => onSelect(r.node.id)}
              >
                <span className="contour-depth">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="step-note contour-note">
        {ref ? describeReference(program, scopes, ref) : 'Click a variable to see the contour that declares it.'}
      </p>
    </div>
  );
}
