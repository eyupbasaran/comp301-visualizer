// Every value-of call as an equation, indented by nesting, in a scrolling list.
// Only the rows in view are drawn, so a 100,000-step run stays fast. The
// highlight is one bar that slides to the current row; clicking a row moves
// the slider there.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Outcome, Trace } from '../core/trace';
import { bookValue, equation } from './format';

const ROW = 28;
const OVERSCAN = 12;
const INDENT = 16;
const MAX_INDENT = 320;

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

interface Props {
  trace: Trace;
  position: number;
  /** Scroll smoothly: the last move was a single step. */
  smooth: boolean;
  onPick(position: number): void;
}

export function TracePanel({ trace, position, smooth, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 300 });
  const count = trace.steps.length;
  const rows = count + 1; // every step, then the end of the run

  // Keep the current row in the middle of the list.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = Math.max(0, position * ROW - (el.clientHeight - ROW) / 2);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }, [position, smooth, trace]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(view.top / ROW) - OVERSCAN);
  const last = Math.min(rows, Math.ceil((view.top + view.height) / ROW) + OVERSCAN);
  const shown = [];
  for (let i = first; i < last; i++) shown.push(i);

  return (
    <div className="trace" ref={box} onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}>
      <div className="trace-track" style={{ height: rows * ROW }}>
        <div className="trace-cursor" style={{ transform: `translateY(${position * ROW}px)` }} aria-hidden="true" />
        <ol className="trace-rows" aria-label="Trace" style={{ transform: `translateY(${first * ROW}px)` }}>
          {shown.map((i) => {
            const current = i === position;
            if (i === count) {
              return (
                <li key="end">
                  <button
                    type="button"
                    className={current ? 'trace-row current' : 'trace-row'}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => onPick(count)}
                  >
                    <span className="trace-num" />
                    <span className="trace-call trace-end">end of run</span>
                    <span className="trace-result">{endResult(trace.outcome)}</span>
                  </button>
                </li>
              );
            }
            const step = trace.steps[i];
            const { call, result } = equation(trace, step);
            return (
              <li key={i}>
                <button
                  type="button"
                  className={current ? 'trace-row current' : 'trace-row'}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${call}${result ? ` = ${result}` : ''}`}
                  onClick={() => onPick(i)}
                >
                  <span className="trace-num">{i + 1}</span>
                  <span className="trace-call" style={{ paddingLeft: Math.min(MAX_INDENT, step.depth * INDENT) }}>
                    {call}
                  </span>
                  <span className="trace-result">{result ? `= ${result}` : ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
