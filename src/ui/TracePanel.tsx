// The value-of calls around the current step, as equations, indented by nesting.
// Clicking a row moves the slider there.

import type { Outcome, Trace } from '../core/trace';
import { bookValue, equation } from './format';

const WINDOW = 9;

function endResult(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'value':
      return `= ${bookValue(outcome.value)}`;
    case 'error':
      return 'error';
    case 'limit':
      return 'stopped';
    case 'crash':
      return 'visualizer bug';
  }
}

export function TracePanel({ trace, position, onPick }: { trace: Trace; position: number; onPick(position: number): void }) {
  const count = trace.steps.length;
  const from = Math.max(0, Math.min(position - Math.floor(WINDOW / 2), count - WINDOW));
  const rows = trace.steps.slice(from, from + WINDOW);
  const base = Math.min(...rows.map((s) => s.depth));
  const atEnd = position === count;
  const showEnd = from + rows.length === count;

  return (
    <ol className="trace" aria-label="Trace">
      {rows.map((step) => {
        const { call, result } = equation(trace, step);
        const current = step.index === position;
        return (
          <li key={step.index}>
            <button
              type="button"
              className={current ? 'trace-row current' : 'trace-row'}
              aria-current={current ? 'step' : undefined}
              aria-label={`Step ${step.index + 1}: ${call}${result ? ` = ${result}` : ''}`}
              onClick={() => onPick(step.index)}
            >
              <span className="trace-num">{step.index + 1}</span>
              <span className="trace-call" style={{ paddingLeft: (step.depth - base) * 20 }}>
                {call}
              </span>
              <span className="trace-result">{result ? `= ${result}` : ''}</span>
            </button>
          </li>
        );
      })}
      {showEnd && (
        <li>
          <button
            type="button"
            className={atEnd ? 'trace-row current' : 'trace-row'}
            aria-current={atEnd ? 'step' : undefined}
            onClick={() => onPick(count)}
          >
            <span className="trace-num" />
            <span className="trace-call trace-end">end of run</span>
            <span className="trace-result">{endResult(trace.outcome)}</span>
          </button>
        </li>
      )}
    </ol>
  );
}
