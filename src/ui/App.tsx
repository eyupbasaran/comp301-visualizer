import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { originSpan } from '../core/ast';
import { runSource, type LanguageModule, type RunResult } from '../core/language';
import { stateAt } from '../core/state';
import type { Outcome } from '../core/trace';
import { LANGUAGES } from '../languages';
import { layoutAst, stepOfNode } from './astLayout';
import { AstTree } from './AstTree';
import { analyzeScopes } from './contours';
import { ContourView } from './ContourView';
import { reindent } from './reindent';
import { Editor } from './Editor';
import { EnvDiagram } from './EnvDiagram';
import { EnvHelp } from './EnvHelp';
import { layoutEnv } from './envLayout';
import { bookValue } from './format';
import { StepBar } from './StepBar';
import { Splitter, useStoredSize } from './Splitter';
import { StepBox } from './StepBox';
import { layoutStore } from './storeLayout';
import { StorePanel } from './StorePanel';
import { layoutCont } from './contLayout';
import { ContPanel } from './ContPanel';
import { ThemeToggle } from './ThemeToggle';
import { TracePanel } from './TracePanel';
import { TranslationView } from './TranslationView';

const START = { language: 'proc', example: 2 };
const PROGRAM_WIDTH = 460;
const LOWER_HEIGHT = 290;
// The Store or Continuation panel, next to the Environment.
const SIDE_WIDTH = 330;

// Views that share the lower right panel. The state panels (env, store, cont) are never tabs.
type LowerView = 'trace' | 'ast' | 'contour' | 'translation';
const LOWER_VIEWS: readonly { id: LowerView; title: string }[] = [
  { id: 'trace', title: 'Trace' },
  { id: 'ast', title: 'AST' },
  { id: 'contour', title: 'Contour' },
  { id: 'translation', title: 'Translation' },
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
  const [sideWidth, setSideWidth] = useStoredSize('comp301.storeWidth', SIDE_WIDTH);
  const workspace = useRef<HTMLElement>(null);
  const panels = useRef<HTMLElement>(null);
  const stateRow = useRef<HTMLDivElement>(null);
  const workspaceWidth = workspace.current?.clientWidth ?? 1440;
  const panelsHeight = panels.current?.clientHeight ?? 760;

  // "step" after a move of exactly one step: the page animates the change. Any
  // other move (a jump, a new run) is drawn at once. It stays until the next move.
  const lastPosition = useRef(position);
  const motion = useRef<'step' | 'jump'>('jump');
  if (lastPosition.current !== position) {
    motion.current = Math.abs(position - lastPosition.current) === 1 ? 'step' : 'jump';
    lastPosition.current = position;
  }

  const trace = result.ok ? result.trace : null;
  const stale = result.ok && result.program.source !== source;
  const count = trace ? trace.steps.length : 0;
  const state = useMemo(() => (trace ? stateAt(trace, position) : null), [trace, position]);
  const diagram = useMemo(() => (trace ? layoutEnv(trace, position) : null), [trace, position]);
  const side = language.panels.includes('store') ? 'store' : language.panels.includes('cont') ? 'cont' : null;
  const storeRows = useMemo(() => (trace && side === 'store' ? layoutStore(trace, position) : null), [trace, side, position]);
  const contView = useMemo(() => (trace && side === 'cont' ? layoutCont(trace, position) : null), [trace, side, position]);
  // The implementations of this language, when the official code has more than one.
  const variants = LANGUAGES.find((entry) => entry.id === language.id)?.variants;
  const views = LOWER_VIEWS.filter((v) => language.panels.includes(v.id));
  const view = views.some((v) => v.id === lower) ? lower : (views[0]?.id ?? 'trace');
  const ast = useMemo(
    () => (trace && state && view === 'ast' ? layoutAst(trace.program, trace, state) : null),
    [trace, state, view],
  );
  // The student's own program. Usually the trace runs on it; NAMELESS runs on its translation.
  const studentProgram = result.ok ? result.program : null;
  // The contour diagram draws the program re-indented, so every contour is a box.
  const contourProgram = useMemo(
    () => (studentProgram && view === 'contour' ? (reindent(language, studentProgram) ?? studentProgram) : null),
    [studentProgram, view, language],
  );
  const scopes = useMemo(() => (contourProgram ? analyzeScopes(contourProgram) : null), [contourProgram]);
  const step = state?.step;
  // Where this step's expression is in the student's source.
  const stepSpan = trace && step && step.kind !== 'apply-cont' ? originSpan(trace.program, step.exp) : null;
  const current = stale ? null : stepSpan;
  const contourSelection =
    picked && picked.position === position
      ? picked.node
      : (studentProgram?.nodes.find((n) => n.kind === 'var-exp' && stepSpan && n.span.from === stepSpan.from && n.span.to === stepSpan.to)?.id ??
        null);
  const parseError = result.ok ? null : { from: result.error.from, to: result.error.to };

  function run(module = language, text = source) {
    setResult(runSource(module, text));
    setPosition(0);
    // A new run is never animated, even if the old position happened to be 1.
    lastPosition.current = Number.NaN;
  }

  function pickLanguage(id: string) {
    const module = moduleById(id);
    const text = module.examples[0]?.source ?? '';
    setLanguage(module);
    setSource(text);
    run(module, text);
  }

  // Only the implementation changes, so the same program runs again.
  function pickVariant(module: LanguageModule) {
    setLanguage(module);
    run(module, source);
  }

  function pickExample(index: number) {
    const text = language.examples[index].source;
    setSource(text);
    run(language, text);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.cm-editor, input, select, textarea, [role=separator], dialog')) return;
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
    <div className="app" data-motion={motion.current}>
      <header className="topbar">
        <h1 className="brand">Schema</h1>
        <div className="controls">
          <div className="field">
            <label htmlFor="language">Language</label>
            <select id="language" className="mono" value={language.id} onChange={(e) => pickLanguage(e.target.value)}>
              {LANGUAGES.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!entry.module}>
                  {entry.module ? entry.name : `${entry.name} (soon)`}
                </option>
              ))}
            </select>
            {variants && (
              <select
                className="mono"
                aria-label={variants.label}
                title={language.variant?.description}
                value={variants.modules.indexOf(language)}
                onChange={(e) => pickVariant(variants.modules[Number(e.target.value)])}
              >
                {variants.modules.map((module, i) => (
                  <option key={module.variant?.id ?? i} value={i}>
                    {module.variant?.id ?? module.name}
                  </option>
                ))}
              </select>
            )}
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
          <ThemeToggle />
        </div>
      </header>

      <main
        className="workspace"
        ref={workspace}
        style={
          {
            '--program-width': `${programWidth}px`,
            '--lower-height': `${lowerHeight}px`,
            '--side-width': `${sideWidth}px`,
          } as CSSProperties
        }
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
          <p className="credit">
            The interpreters are translated from the code of <i>Essentials of Programming Languages</i>, 3rd ed., by
            Friedman and Wand (<a href="https://github.com/mwand/eopl3">mwand/eopl3</a>), licensed under{' '}
            <a href="https://creativecommons.org/licenses/by-nc/3.0/">CC BY-NC 3.0</a>.
          </p>
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
            <div className="state-row" ref={stateRow}>
              <div className="panel panel-env">
                <div className="panel-head">
                  <h2>Environment</h2>
                  <EnvHelp />
                </div>
                {diagram && diagram.cards.length > 0 ? (
                  <EnvDiagram diagram={diagram} />
                ) : (
                  <p className="step-note">
                    {!trace
                      ? 'Fix the program to see its environment.'
                      : step?.kind === 'apply-cont'
                        ? `This apply-cont uses no env: ${step.cont.kind} saved none.`
                        : 'The run has ended.'}
                  </p>
                )}
              </div>
              {side && (
                <>
                  <Splitter
                    orientation="vertical"
                    label={side === 'store' ? 'Store width' : 'Continuation width'}
                    value={sideWidth}
                    min={220}
                    max={Math.max(220, (stateRow.current?.clientWidth ?? 900) - 300)}
                    growKey="ArrowLeft"
                    onChange={setSideWidth}
                    toValue={(x) => (stateRow.current?.getBoundingClientRect().right ?? 0) - x}
                    onReset={() => setSideWidth(SIDE_WIDTH)}
                  />
                  {side === 'store' ? (
                    <div className="panel panel-side">
                      <div className="panel-head">
                        <h2>Store</h2>
                      </div>
                      {storeRows ? <StorePanel rows={storeRows} /> : <p className="step-note">Fix the program to see its store.</p>}
                    </div>
                  ) : (
                    <div className="panel panel-side">
                      <div className="panel-head">
                        <h2>Continuation</h2>
                        <span className="label">innermost frame on top</span>
                      </div>
                      {contView ? (
                        <ContPanel view={contView} />
                      ) : (
                        <p className="step-note">{trace ? 'The run has ended.' : 'Fix the program to see its continuation.'}</p>
                      )}
                    </div>
                  )}
                </>
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
                {view === 'contour' && <span className="label">boxes: where each declaration holds · numbers: lexical depth · re-indented as in the book</span>}
                {view === 'translation' && <span className="label">translation-of turns each variable into its lexical address</span>}
              </div>
              {view === 'trace' && <TracePanel trace={trace} position={position} smooth={motion.current === 'step'} onPick={setPosition} />}
              {view === 'contour' && scopes && (
                <ContourView
                  program={contourProgram!}
                  scopes={scopes}
                  keywords={language.grammar.keywords}
                  selected={contourSelection}
                  onSelect={(node) => setPicked({ node, position })}
                />
              )}
              {view === 'translation' && studentProgram && (
                <TranslationView student={studentProgram} trace={trace} step={step ?? null} />
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
