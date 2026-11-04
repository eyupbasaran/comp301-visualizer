// Programs run in two languages: one program run in both, or (two sources) one program
// in each. What each says, a number that shows the difference, and a way into Explore.

import { useMemo, useState } from 'react';
import { MEASURES, type Measure } from '../../compare/comparisons';
import { runSource, type LanguageModule, type RunResult } from '../../core/language';
import { Editor } from '../Editor';
import { summary } from '../format';

function detail(result: RunResult): string | null {
  if (!result.ok) return result.error.message;
  const outcome = result.trace.outcome;
  return outcome.kind === 'value' ? null : outcome.message;
}

interface Side {
  readonly name: string;
  readonly module: LanguageModule;
}

interface Props {
  sides: readonly Side[];
  /** One source: run in both. Two: the first in sides[0], the second in sides[1]. */
  sources: readonly string[];
  /** What to look for. */
  look: string;
  measure?: Measure;
  /** The button's text, when it is not "Run in both" / "Run both". */
  runLabel?: string;
  onOpen(module: LanguageModule, source: string): void;
}

export function RunBoth({ sides, sources, look, measure, runLabel, onOpen }: Props) {
  const [edited, setEdited] = useState(sources);
  const [ran, setRan] = useState(sources);
  const shared = sources.length === 1;
  const sourceOf = (texts: readonly string[], i: number) => (shared ? texts[0] : texts[i]);
  const results = useMemo(() => sides.map((side, i) => runSource(side.module, ran[shared ? 0 : i])), [sides, ran, shared]);
  const keywords = useMemo(
    () => (shared ? [[...new Set(sides.flatMap((s) => s.module.grammar.keywords))]] : sides.map((s) => s.module.grammar.keywords)),
    [sides, shared],
  );
  const run = () => setRan(edited);
  const stale = edited.some((text, i) => text !== ran[i]);

  const editor = (i: number) => (
    <Editor
      value={edited[i]}
      onChange={(text) => setEdited((all) => all.map((t, j) => (j === i ? text : t)))}
      onRun={run}
      keywords={keywords[i]}
      current={null}
      error={null}
    />
  );

  const card = (side: Side, i: number) => {
    const result = results[i];
    return (
      <div className="run-both-card">
        <div className="panel-head">
          <h3>{side.name}</h3>
          <button type="button" className="link-button" onClick={() => onOpen(side.module, sourceOf(ran, i))}>
            Step through it in {side.module.name} →
          </button>
        </div>
        <div className={`mono${result.ok && result.trace.outcome.kind === 'value' ? '' : ' error'}`}>{summary(result)}</div>
        {measure && result.ok && (
          <div className="mono run-both-measure">
            {MEASURES[measure].label}: <b>{MEASURES[measure].of(result.trace)}</b>
          </div>
        )}
        {detail(result) && <p className="step-note">{detail(result)}</p>}
      </div>
    );
  };

  return (
    <div className="run-both-wrap">
      <p className="step-note">{look}</p>
      {shared ? (
        <div className="run-both">
          <div className="run-both-program">{editor(0)}</div>
          <div className="run-both-results">{sides.map(card)}</div>
        </div>
      ) : (
        <div className="run-both two-ways">
          {sides.map((side, i) => (
            <div key={i} className="run-both-program">
              {editor(i)}
              {card(side, i)}
            </div>
          ))}
        </div>
      )}
      <div className="run-both-actions">
        <button type="button" className="run" onClick={run} title="Run (Ctrl+Enter)">
          {runLabel ?? (shared ? 'Run in both' : 'Run both')}
        </button>
        {stale && <span className="step-note">The program changed. Run it again to update the results.</span>}
      </div>
    </div>
  );
}
