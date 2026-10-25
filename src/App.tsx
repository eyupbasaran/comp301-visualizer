// Temporary dev page: runs a program and dumps the raw state at each slider
// position, so interpreters can be checked by eye. The real UI replaces it.

import { useMemo, useState } from 'react';
import { sourceOf } from './core/ast';
import { runSource, type RunResult } from './core/language';
import { envToList, outcomeToString, showValue } from './core/print';
import { positionCount, stateAt } from './core/state';
import { LANGUAGES } from './languages';

const mono = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 };

export default function App() {
  const [languageId, setLanguageId] = useState('let');
  const language = LANGUAGES.find((entry) => entry.id === languageId)?.module ?? null;
  const [source, setSource] = useState(language?.examples[0]?.source ?? '');
  const [result, setResult] = useState<RunResult | null>(null);
  const [position, setPosition] = useState(0);

  const trace = result?.ok ? result.trace : null;
  const state = useMemo(() => (trace ? stateAt(trace, position) : null), [trace, position]);
  const exp = state?.step && state.step.kind !== 'apply-cont' ? state.step.exp : null;

  function run() {
    if (!language) return;
    setResult(runSource(language, source));
    setPosition(0);
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 1100 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={languageId} onChange={(e) => setLanguageId(e.target.value)}>
          {LANGUAGES.map((entry) => (
            <option key={entry.id} value={entry.id} disabled={!entry.module}>
              {entry.name}
            </option>
          ))}
        </select>
        <select value="" onChange={(e) => e.target.value && setSource(e.target.value)}>
          <option value="">Examples…</option>
          {language?.examples.map((example) => (
            <option key={example.title} value={example.source}>
              {example.title}
            </option>
          ))}
        </select>
        <button onClick={run}>Run</button>
      </div>

      <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={6} style={mono} spellCheck={false} />

      {result && !result.ok && <div style={{ ...mono, color: 'crimson' }}>{result.error.message}</div>}

      {trace && state && (
        <>
          <div>
            <input
              type="range"
              min={0}
              max={positionCount(trace) - 1}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={mono}>
              {state.step ? `step ${position + 1} of ${trace.steps.length}: ${state.step.kind}` : `end of run (${trace.steps.length} steps)`}
            </div>
          </div>

          <pre style={{ ...mono, margin: 0, whiteSpace: 'pre-wrap' }}>
            {exp ? (
              <>
                {trace.program.source.slice(0, exp.span.from)}
                <mark>{sourceOf(trace.program, exp)}</mark>
                {trace.program.source.slice(exp.span.to)}
              </>
            ) : (
              trace.program.source
            )}
          </pre>

          <pre style={{ ...mono, margin: 0, whiteSpace: 'pre-wrap' }}>
            {state.step?.kind === 'value-of' &&
              `returns ${state.step.result ? showValue(state.step.result) : '(never returned)'}\n`}
            {state.step && state.step.kind !== 'apply-cont' && `env   ${envToList(state.step.env)}\n`}
            {`store ${state.store.length ? state.store.map((v, loc) => `${loc}: ${showValue(v)}`).join(', ') : '(empty)'}\n`}
            {`stack ${state.stack.map((s) => sourceOf(trace.program, s.exp)).join('  ->  ') || '(empty)'}\n`}
            {!state.step && `outcome ${outcomeToString(trace.outcome)}\n`}
            {trace.output.length > 0 && `output ${trace.output.join('')}`}
          </pre>
        </>
      )}
    </div>
  );
}
