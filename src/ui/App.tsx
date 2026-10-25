import { useEffect, useMemo, useState } from 'react';
import { runSource, type LanguageModule, type RunResult } from '../core/language';
import { stateAt } from '../core/state';
import type { Outcome } from '../core/trace';
import { LANGUAGES } from '../languages';
import { Editor } from './Editor';
import { EnvDiagram } from './EnvDiagram';
import { layoutEnv } from './envLayout';
import { bookValue } from './format';
import { StepBar } from './StepBar';
import { StepBox } from './StepBox';
import { TracePanel } from './TracePanel';

const START = { language: 'proc', example: 2 };

function moduleById(id: string): LanguageModule {
  const module = LANGUAGES.find((entry) => entry.id === id)?.module;
  if (!module) throw new Error(`language ${id} is not implemented`);
  return module;
}

function summary(result: RunResult): string {
  if (!result.ok) return 'parse error';
  const steps = `${result.trace.steps.length} steps`;
  const outcome: Outcome = result.trace.outcome;
  return outcome.kind === 'value' ? `${steps} · value ${bookValue(outcome.value)}` : `${steps} · ${outcome.kind}`;
}

export default function App() {
  const [language, setLanguage] = useState(() => moduleById(START.language));
  const [source, setSource] = useState(language.examples[START.example].source);
  const [result, setResult] = useState<RunResult>(() => runSource(language, source));
  const [position, setPosition] = useState(0);

  const trace = result.ok ? result.trace : null;
  const stale = result.ok && result.program.source !== source;
  const count = trace ? trace.steps.length : 0;
  const state = useMemo(() => (trace ? stateAt(trace, position) : null), [trace, position]);
  const diagram = useMemo(() => (trace ? layoutEnv(trace, position) : null), [trace, position]);
  const step = state?.step;
  const current = !stale && step && step.kind !== 'apply-cont' ? step.exp.span : null;
  const parseError = result.ok ? null : { from: result.error.from, to: result.error.to };

  function run(module = language, text = source) {
    setResult(runSource(module, text));
    setPosition(0);
  }

  function pickLanguage(id: string) {
    const module = moduleById(id);
    const text = module.examples[0]?.source ?? '';
    setLanguage(module);
    setSource(text);
    run(module, text);
  }

  function pickExample(index: number) {
    const text = language.examples[index].source;
    setSource(text);
    run(language, text);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.cm-editor, input, select, textarea')) return;
      const moves: Record<string, (p: number) => number> = {
        ArrowLeft: (p) => p - 1,
        ArrowRight: (p) => p + 1,
        Home: () => 0,
        End: () => count,
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      setPosition((p) => Math.max(0, Math.min(count, move(p))));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const exampleIndex = language.examples.findIndex((example) => example.source === source);

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">COMP301 Visualizer</h1>
        <div className="field">
          <label htmlFor="language">Language</label>
          <select id="language" className="mono" value={language.id} onChange={(e) => pickLanguage(e.target.value)}>
            {LANGUAGES.map((entry) => (
              <option key={entry.id} value={entry.id} disabled={!entry.module}>
                {entry.module ? entry.name : `${entry.name} (soon)`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="example">Example</label>
          <select id="example" value={exampleIndex} onChange={(e) => pickExample(Number(e.target.value))}>
            {exampleIndex === -1 && <option value={-1}>Your program</option>}
            {language.examples.map((example, i) => (
              <option key={example.title} value={i}>
                {example.title}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="run" onClick={() => run()} title="Run (Ctrl+Enter)">
          Run
        </button>
        <div className="summary">{summary(result)}</div>
      </header>

      <main className="workspace">
        <section className="program">
          <h2 className="label">Program</h2>
          <Editor
            value={source}
            onChange={setSource}
            onRun={() => run()}
            keywords={language.grammar.keywords}
            current={current}
            error={parseError}
          />
          {!result.ok && (
            <div className="stepbox">
              <div className="label">Parse error</div>
              <div className="step-equation error">{result.error.message}</div>
            </div>
          )}
          {stale && <p className="step-note">The program changed. Run it again to update the steps.</p>}
          {trace && state && !stale && <StepBox trace={trace} state={state} />}
        </section>

        <section className={stale ? 'panels stale' : 'panels'}>
          {language.panels.includes('env') && (
            <div className="panel panel-env">
              <div className="panel-head">
                <h2>Environment</h2>
                <span className="label">newest frame first; bold boxes are the env of this step</span>
              </div>
              {diagram && diagram.cards.length > 0 ? (
                <EnvDiagram diagram={diagram} />
              ) : (
                <p className="step-note">{trace ? 'The run has ended.' : 'Fix the program to see its environment.'}</p>
              )}
            </div>
          )}
          {trace && language.panels.includes('trace') && (
            <div className="panel panel-trace">
              <div className="panel-head">
                <h2>Trace</h2>
              </div>
              <TracePanel trace={trace} position={position} onPick={setPosition} />
            </div>
          )}
        </section>
      </main>

      <StepBar position={position} count={count} enabled={trace !== null && !stale} onChange={setPosition} />
    </div>
  );
}
