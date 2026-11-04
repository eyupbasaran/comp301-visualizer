// Compare mode: what one language changes from another. The concept notes, the grammar,
// the official code side by side, and programs run in both. Loaded only when opened.

import { useMemo, useState } from 'react';
import { codeOf, comparisonFor, COMPARISONS, moduleOf, nameOf, type Comparison } from '../../compare/comparisons';
import { changedCount, diffLines, isChange } from '../../compare/diff';
import { grammarDiff } from '../../compare/grammarDiff';
import { sourcesFor } from '../../compare/sources';
import type { LanguageId, LanguageModule } from '../../core/language';
import { CodeDiff } from './CodeDiff';
import { RunBoth } from './RunBoth';

const GROUPS = [...new Set(COMPARISONS.map((c) => c.group))];

function ExamplePicker(props: { id: string; examples: readonly { title: string }[]; value: number; onChange(i: number): void }) {
  if (props.examples.length < 2) return null;
  return (
    <div className="field example-picker">
      <label htmlFor={props.id}>Example</label>
      <select id={props.id} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.examples.map((ex, i) => (
          <option key={ex.title} value={i}>
            {ex.title}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  /** The language open in Explore: Compare starts with the comparison that leads to it. */
  initial: LanguageId;
  onOpen(module: LanguageModule, source: string): void;
}

export default function ComparePage({ initial, onOpen }: Props) {
  const [comparison, setComparison] = useState<Comparison>(() => comparisonFor(initial));
  const [picked, setPicked] = useState<string | null>(null);
  const [target, setTarget] = useState<{ row: number; nonce: number } | null>(null);
  const [runPick, setRunPick] = useState(0);
  const [twoPick, setTwoPick] = useState(0);
  const { from: fromSide, to: toSide, notes, runBoth, twoWays } = comparison;
  const fromCode = codeOf(fromSide);
  const toCode = codeOf(toSide);
  const sides = useMemo(() => [fromSide, toSide].map((side) => ({ name: nameOf(side), module: moduleOf(side) })), [fromSide, toSide]);

  const sources = useMemo(() => sourcesFor(fromCode, toCode), [fromCode, toCode]);
  // Files whose code is the same on both sides are left out.
  const files = useMemo(
    () =>
      sources.files
        .map((f) => ({ ...f, diff: diffLines(f.a ?? '', f.b ?? '', sources.kind) }))
        .filter((f) => changedCount(f.diff) > 0),
    [sources],
  );
  const grammar = useMemo(() => grammarDiff(fromCode.grammar, toCode.grammar), [fromCode, toCode]);
  // Where each note's anchor is: the first changed row containing it.
  const anchors = useMemo(
    () =>
      notes.map((note) => {
        for (const f of files) {
          const row = f.diff.rows.findIndex(
            (r) => isChange(r) && (r.kind === 'add' ? f.diff.b[r.b] : r.kind === 'del' ? f.diff.a[r.a] : '').includes(note.anchor),
          );
          if (row !== -1) return { file: f.name, row };
        }
        return null;
      }),
    [notes, files],
  );

  // The interpreter first: it is where each language's idea lives.
  const file = files.find((f) => f.name === picked) ?? files.find((f) => f.name.startsWith('interp.')) ?? files[0];
  const marks = new Map<number, number>();
  anchors.forEach((a, i) => {
    if (a?.file === file?.name && !marks.has(a.row)) marks.set(a.row, i + 1);
  });

  function choose(id: string) {
    setComparison(COMPARISONS.find((c) => c.id === id)!);
    setPicked(null);
    setTarget(null);
    setRunPick(0);
    setTwoPick(0);
  }

  function goTo(i: number) {
    const a = anchors[i];
    if (!a) return;
    setPicked(a.file);
    setTarget({ row: a.row, nonce: Date.now() });
  }

  return (
    <div className="compare">
      <div className="compare-bar">
        <div className="field">
          <label htmlFor="compare-pair">Comparison</label>
          <select id="compare-pair" className="mono" value={comparison.id} onChange={(e) => choose(e.target.value)}>
            {GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {COMPARISONS.filter((c) => c.group === group).map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c.from)} → {nameOf(c.to)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <span className="badge" title={sources.kind === 'ts' ? 'CALL-BY-NAME and TRAMPOLINED have no official folder' : undefined}>
          {sources.kind === 'scheme' ? `official code: ${fromCode.origin} → ${toCode.origin}` : 'our TypeScript ports (no official folder)'}
        </span>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>What changes</h2>
          <span className="label">{comparison.summary}</span>
        </div>
        <ol className="notes">
          {notes.map((note, i) => (
            <li key={note.anchor}>
              <button type="button" className="note" onClick={() => goTo(i)} disabled={!anchors[i]}>
                <span className="note-num">{i + 1}</span>
                <span>{note.text}</span>
                {anchors[i] && <span className="label mono">{anchors[i]!.file}</span>}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Grammar</h2>
          <span className="label">productions of lang.scm, by variant</span>
        </div>
        {grammar.length === 0 ? (
          <p className="step-note">The same grammar.</p>
        ) : (
          <ul className="grammar-diff mono">
            {grammar.flatMap((c) => [
              ...(c.a ? [<li key={`${c.variant}-a`} className="diff-del">{`− ${c.a}`}</li>] : []),
              ...(c.b ? [<li key={`${c.variant}-b`} className="diff-add">{`+ ${c.b}`}</li>] : []),
            ])}
          </ul>
        )}
      </section>

      {file && (
        <section className="panel">
          <div className="panel-head">
            <div className="tabs" role="group" aria-label="File">
              {files.map((f) => (
                <button key={f.name} type="button" className="tab file-tab" aria-pressed={f.name === file.name} onClick={() => setPicked(f.name)}>
                  {f.name}{' '}
                  <span className="label">
                    {f.a === undefined ? `only in ${sides[1].name}` : f.b === undefined ? `only in ${sides[0].name}` : `±${changedCount(f.diff)}`}
                  </span>
                </button>
              ))}
            </div>
            <span className="label">comments are dimmed and never count as a change</span>
          </div>
          <CodeDiff
            key={`${comparison.id}-${file.name}`}
            diff={file.diff}
            syntax={sources.kind}
            fromName={file.a === undefined ? `${sides[0].name} (no ${file.name})` : sides[0].name}
            toName={file.b === undefined ? `${sides[1].name} (no ${file.name})` : sides[1].name}
            marks={marks}
            target={target && anchors.some((a) => a?.file === file.name && a.row === target.row) ? target : null}
          />
        </section>
      )}

      {runBoth && (
        <section className="panel">
          <div className="panel-head">
            <h2>Run in both</h2>
            <span className="label">the same program, two languages</span>
            <ExamplePicker id="run-example" examples={runBoth} value={runPick} onChange={setRunPick} />
          </div>
          <RunBoth
            key={`${comparison.id}-both-${runPick}`}
            sides={sides}
            sources={[runBoth[runPick].source]}
            look={runBoth[runPick].look}
            measure={runBoth[runPick].measure}
            onOpen={onOpen}
          />
        </section>
      )}

      {twoWays && (
        <section className="panel">
          <div className="panel-head">
            <h2>Same idea, two ways</h2>
            <span className="label">one program in each language</span>
            <ExamplePicker id="two-example" examples={twoWays} value={twoPick} onChange={setTwoPick} />
          </div>
          <RunBoth
            key={`${comparison.id}-two-${twoPick}`}
            sides={sides}
            sources={[twoWays[twoPick].from, twoWays[twoPick].to]}
            look={twoWays[twoPick].task}
            onOpen={onOpen}
          />
        </section>
      )}
    </div>
  );
}
