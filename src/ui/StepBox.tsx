// "Step 15 of 21": the current step as an equation, what it does, and the calls it runs inside.

import type { StateAt } from '../core/state';
import type { Outcome, Trace } from '../core/trace';
import { bookValue, equation, explain, snippet } from './format';

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case 'value':
      return <div className="step-equation">Program value {bookValue(outcome.value)}</div>;
    case 'error':
      return <div className="step-equation error">{outcome.message}</div>;
    case 'limit':
      return <p className="step-note">{outcome.message}</p>;
    case 'crash':
      return <p className="step-note error">Visualizer bug: {outcome.message}. Please report this program.</p>;
  }
}

export function StepBox({ trace, state }: { trace: Trace; state: StateAt }) {
  const count = trace.steps.length;
  const step = state.step;

  if (!step) {
    return (
      <div className="stepbox">
        <div className="label">End of run · {count} steps</div>
        <OutcomeLine outcome={trace.outcome} />
      </div>
    );
  }

  const { call, result } = equation(trace, step, 40);
  const note = explain(trace, step);
  const stack = state.stack;
  const shown = stack.slice(-4);
  return (
    <>
      <div className="stepbox">
        <div className="label">
          Step {state.position + 1} of {count}
        </div>
        <div className="step-equation">
          {call}
          {result ? ` = ${result}` : ''}
        </div>
        {note && <p className="step-note">{note}</p>}
      </div>
      {stack.length > 1 && (
        <div className="running">
          <div className="label">Running</div>
          <div className="running-path">
            {stack.length > shown.length && '… › '}
            {shown.map((s, i) => (
              <span key={s.index}>
                {i > 0 && ' › '}
                {i === shown.length - 1 ? <b>{snippet(trace, s, 24)}</b> : snippet(trace, s, 24)}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
