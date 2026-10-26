// The "?" next to the Environment panel: how to read the diagram.
// The examples are real runs drawn by the same code as the main diagram, so
// the guide can never show something the tool would not.

import { useMemo, useRef, useState } from 'react';
import { runSource } from '../core/language';
import type { Step, Trace } from '../core/trace';
import { procLanguage } from '../languages/proc';
import { EnvDiagram } from './EnvDiagram';
import { EMPTY_DIAGRAM, layoutEnv, type Diagram } from './envLayout';
import { equation, explain } from './format';

interface Example {
  readonly source: string;
  /** The step to draw. */
  readonly pick: (step: Step, trace: Trace) => boolean;
}

/** The first lookup of `name`. */
const isVar = (name: string) => (step: Step, trace: Trace) =>
  step.kind === 'value-of' && step.exp.kind === 'var-exp' && trace.program.source.slice(step.exp.span.from, step.exp.span.to) === name;

export const LOOKUP_EXAMPLE: Example = { source: 'let x = 3\nin let y = 4\n   in -(x, y)', pick: isVar('x') };
export const CALL_EXAMPLE: Example = { source: 'let a = 5\nin let f = proc (z) -(z, a)\n   in (f 1)', pick: isVar('a') };

export function draw(example: Example): { diagram: Diagram; call: string; note: string | null } {
  const result = runSource(procLanguage, example.source);
  if (!result.ok) return { diagram: EMPTY_DIAGRAM, call: '', note: null };
  const index = result.trace.steps.findIndex((s) => example.pick(s, result.trace));
  const step = result.trace.steps[index];
  const { call, result: value } = equation(result.trace, step);
  return { diagram: layoutEnv(result.trace, index), call: `${call} = ${value}`, note: explain(result.trace, step) };
}

function ExampleFigure({ example, title }: { example: Example; title: string }) {
  const { diagram, call, note } = useMemo(() => draw(example), [example]);
  return (
    <figure className="help-example">
      <pre className="help-program">{example.source}</pre>
      <figcaption>
        {title}: <code>{call}</code>
        {note && <span className="help-note"> {note}</span>}
      </figcaption>
      <EnvDiagram diagram={diagram} />
    </figure>
  );
}

export function EnvHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  // The examples are run and drawn only while the dialog is open.
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label="How to read the environment diagram"
        title="How to read the environment diagram"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        ?
      </button>
      <dialog
        ref={dialog}
        className="help-dialog"
        aria-labelledby="env-help-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A click on the backdrop (outside the sheet) closes it.
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="help-sheet">
          <header className="help-head">
            <h2 id="env-help-title">Reading the environment diagram</h2>
            <button type="button" className="help-close" aria-label="Close" onClick={() => dialog.current?.close()}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 3 L13 13 M13 3 L3 13" />
              </svg>
            </button>
          </header>

          <section>
            <h3>Frames</h3>
            <p>
              Each box is a frame: the binding a <code>let</code>, a procedure call or a <code>letrec</code> added. <i>ρ0</i> is
              init-env (<code>i</code>, <code>v</code>, <code>x</code>); the others are numbered in the order they were made. An
              arrow points from a frame to the older env it extends, so the newest frame is on top.
            </p>
          </section>

          <section>
            <h3>The env of this step</h3>
            <p>
              The bold boxes, from the blue one down to <i>ρ0</i>, are the environment passed to <code>value-of</code> at this
              step. A variable is looked up the way <code>apply-env</code> does it: walk this chain from the top and stop at the
              first frame that binds the name. That binding is highlighted.
            </p>
            {open && <ExampleFigure example={LOOKUP_EXAMPLE} title="At the x in -(x, y)" />}
          </section>

          <section>
            <h3>Closures and saved env</h3>
            <p>
              A dashed box is a closure, <code>(procedure z body ρ)</code>: the value <code>proc</code> makes. Its
              <i> saved env</i> arrow points to the env that was current when <code>proc</code> was evaluated. A frame that
              shows <code>f = ●</code> holds that closure.
            </p>
            <p>
              Calling a closure adds one frame for its parameter on top of its saved env, not on top of the caller's env. That
              is static scoping. <i>running</i> marks the closure whose body is being evaluated.
            </p>
            {open && <ExampleFigure example={CALL_EXAMPLE} title="Inside the call (f 1), at the a in -(z, a)" />}
          </section>

          <section>
            <h3>Grey boxes</h3>
            <p>
              Frames of the caller that are not on this step's chain. Nothing evaluated at this step can see them; they are
              drawn so you can see where the call came from. In the second example, <code>f = ●</code> is grey: the body of
              <code> f</code> runs in <i>ρ3 → ρ1 → ρ0</i>, which skips it.
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
