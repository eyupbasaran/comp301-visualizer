import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { runSource, type LanguageModule, type RunResult } from '../core/language';
import { stateAt } from '../core/state';
import type { Outcome } from '../core/trace';
import { LANGUAGES } from '../languages';
import { layoutAst, stepOfNode } from './astLayout';
import { AstTree } from './AstTree';
import { analyzeScopes } from './contours';
import { ContourView } from './ContourView';
import { Editor } from './Editor';
import { EnvDiagram } from './EnvDiagram';
import { layoutEnv } from './envLayout';
import { bookValue } from './format';
import { StepBar } from './StepBar';
import { Splitter, useStoredSize } from './Splitter';
import { StepBox } from './StepBox';
import { TracePanel } from './TracePanel';

const START = { language: 'proc', example: 2 };
const PROGRAM_WIDTH = 460;
const LOWER_HEIGHT = 290;

// Views that share the lower right panel. The state panels (env, store, cont) are never tabs.
type LowerView = 'trace' | 'ast' | 'contour';
const LOWER_VIEWS: readonly { id: LowerView; title: string }[] = [
  { id: 'trace', title: 'Trace' },
  { id: 'ast', title: 'AST' },
  { id: 'contour', title: 'Contour' },
];

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
  const [lower, setLower] = useState<LowerView>('trace');
  // A variable picked in the contour view; it applies only at the step where it was picked.
  const [picked, setPicked] = useState<{ node: number; position: number } | null>(null);
  // Sizes the viewer set with the drag handles.
  const [programWidth, setProgramWidth] = useStoredSize('comp301.programWidth', PROGRAM_WIDTH);
  const [lowerHeight, setLowerHeight] = useStoredSize('comp301.lowerHeight', LOWER_HEIGHT);
  const workspace = useRef<HTMLElement>(null);
  const panels = useRef<HTMLElement>(null);
  const workspaceWidth = workspace.current?.clientWidth ?? 1440;
  const panelsHeight = panels.current?.clientHeight ?? 760;

  const trace = result.ok ? result.trace : null;
  const stale = result.ok && result.program.source !== source;
  const count = trace ? trace.steps.length : 0;
  const state = useMemo(() => (trace ? stateAt(trace, position) : null), [trace, position]);
  const diagram = useMemo(() => (trace ? layoutEnv(trace, position) : null), [trace, position]);
  const views = LOWER_VIEWS.filter((v) => language.panels.includes(v.id));
  const view = views.some((v) => v.id === lower) ? lower : (views[0]?.id ?? 'trace');
  const ast = useMemo(
    () => (trace && state && view === 'ast' ? layoutAst(trace.program, trace, state) : null),
    [trace, state, view],
  );
  const scopes = useMemo(() => (trace && view === 'contour' ? analyzeScopes(trace.program) : null), [trace, view]);
  const step = state?.step;
  const current = !stale && step && step.kind !== 'apply-cont' ? step.exp.span : null;
  const contourSelection =
    picked && picked.position === position
      ? picked.node
      : step && step.kind !== 'apply-cont' && step.exp.kind === 'var-exp'
        ? step.exp.id
        : null;
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
      if (target?.closest('.cm-editor, input, select, textarea, [role=separator]')) return;
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

      <main
        className="workspace"
        ref={workspace}
        style={{ '--program-width': `${programWidth}px`, '--lower-height': `${lowerHeight}px` } as CSSProperties}
      >
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

        <Splitter
          orientation="vertical"
          label="Program width"
          value={programWidth}
          min={280}
          max={Math.max(280, workspaceWidth - 420)}
          growKey="ArrowRight"
          onChange={setProgramWidth}
          toValue={(x) => x - (workspace.current?.getBoundingClientRect().left ?? 0)}
          onReset={() => setProgramWidth(PROGRAM_WIDTH)}
        />

        <section className={stale ? 'panels stale' : 'panels'} ref={panels}>
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
          {trace && views.length > 0 && language.panels.includes('env') && (
            <Splitter
              orientation="horizontal"
              label="Height of the lower panel"
              value={lowerHeight}
              min={120}
              max={Math.max(120, panelsHeight - 140)}
              growKey="ArrowUp"
              onChange={setLowerHeight}
              toValue={(_, y) => (panels.current?.getBoundingClientRect().bottom ?? 0) - y}
              onReset={() => setLowerHeight(LOWER_HEIGHT)}
            />
          )}
          {trace && views.length > 0 && (
            <div className={`panel panel-lower view-${view}`}>
              <div className="panel-head">
                <div className="tabs" role="group" aria-label="View">
                  {views.map((v) => (
                    <button key={v.id} type="button" className="tab" aria-pressed={view === v.id} onClick={() => setLower(v.id)}>
                      {v.title}
                    </button>
                  ))}
                </div>
                {view === 'ast' && <span className="label">click a node to go to its step · dashed: never evaluated</span>}
                {view === 'contour' && <span className="label">boxes: where each declaration holds · numbers: lexical depth</span>}
              </div>
              {view === 'trace' && <TracePanel trace={trace} position={position} onPick={setPosition} />}
              {view === 'contour' && scopes && (
                <ContourView
                  program={trace.program}
                  scopes={scopes}
                  keywords={language.grammar.keywords}
                  selected={contourSelection}
                  onSelect={(node) => setPicked({ node, position })}
                />
              )}
              {view === 'ast' && ast && (
                <AstTree
                  rows={ast}
                  onPick={(id) => {
                    const p = stepOfNode(trace, id, position);
                    if (p !== null) setPosition(p);
                  }}
                />
              )}
            </div>
          )}
        </section>
      </main>

      <StepBar position={position} count={count} enabled={trace !== null && !stale} onChange={setPosition} />
    </div>
  );
}
