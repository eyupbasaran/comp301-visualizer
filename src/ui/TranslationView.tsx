// NAMELESS: the student's program next to its translation, the current
// expression marked in both, and the static environment (senv) at that point.

import type { ReactNode } from 'react';
import type { Program, Span } from '../core/ast';
import { originSpan } from '../core/ast';
import type { Step, Trace } from '../core/trace';
import { analyzeScopes, INIT_NAMES } from './contours';

function Marked({ text, span }: { text: string; span: Span | null }): ReactNode {
  if (!span) return text;
  return (
    <>
      {text.slice(0, span.from)}
      <mark>{text.slice(span.from, span.to)}</mark>
      {text.slice(span.to)}
    </>
  );
}

/** The senv translation-of had for the expression at `span`: the names declared around it, innermost first, then (i v x). */
export function senvAt(student: Program, span: Span): string[] {
  const { contours } = analyzeScopes(student);
  const around = contours
    .filter((c) => c.region.from <= span.from && span.to <= c.region.to)
    .sort((a, b) => b.level - a.level);
  return [...around.flatMap((c) => c.binders.map((b) => b.name)), ...INIT_NAMES];
}

interface Props {
  student: Program;
  trace: Trace;
  step: Step | null;
}

export function TranslationView({ student, trace, step }: Props) {
  const translated = trace.program.originSpans ? trace.program : null;
  if (!translated) {
    return (
      <p className="step-note">
        The translator stopped before value-of could run.
        {trace.outcome.kind === 'error' && <span className="error"> {trace.outcome.message}</span>}
      </p>
    );
  }
  const exp = step && step.kind !== 'apply-cont' ? step.exp : null;
  const from = exp ? originSpan(translated, exp) : null;
  return (
    <div className="translation">
      <div className="translation-columns">
        <figure>
          <figcaption className="label">Your program</figcaption>
          <pre>
            <Marked text={student.source} span={from} />
          </pre>
        </figure>
        <figure>
          <figcaption className="label">After translation-of</figcaption>
          <pre>
            <Marked text={translated.source} span={exp ? exp.span : null} />
          </pre>
        </figure>
      </div>
      {from && (
        <p className="step-note">
          senv here: <code>({senvAt(student, from).join(' ')})</code>. A variable becomes <code>%lexref n</code>, where n is its
          position in this list.
        </p>
      )}
    </div>
  );
}
