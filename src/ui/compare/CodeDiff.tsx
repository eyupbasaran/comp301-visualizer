// One file of a Compare diff, side by side: the `from` language left, `to` right.
// Deleted and added lines in the same run are paired on one line; long unchanged
// stretches fold. Comments are dimmed, and a comment-only line is never coloured as a
// change. `marks` puts a note's number next to the row it explains.

import { Fragment, useEffect, useRef, useState } from 'react';
import { chunks, commentStart, type LineDiff, type Row, type Syntax } from '../../compare/diff';

interface Side {
  readonly num: number;
  readonly text: string;
  readonly kind: 'same' | 'del' | 'add' | 'quiet';
}

interface Line {
  readonly left: Side | null;
  readonly right: Side | null;
  /** Indexes into diff.rows. */
  readonly rows: readonly number[];
}

function sideBySide(diff: LineDiff, rows: readonly Row[], first: number): Line[] {
  const lines: Line[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.kind === 'same') {
      lines.push({
        left: { num: r.a + 1, text: diff.a[r.a], kind: 'same' },
        right: { num: r.b + 1, text: diff.b[r.b], kind: 'same' },
        rows: [first + i],
      });
      i++;
      continue;
    }
    const dels: number[] = [];
    const adds: number[] = [];
    while (i < rows.length && rows[i].kind !== 'same') (rows[i].kind === 'del' ? dels : adds).push(i++);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      const d = dels[k] === undefined ? undefined : (rows[dels[k]] as Extract<Row, { kind: 'del' }>);
      const a = adds[k] === undefined ? undefined : (rows[adds[k]] as Extract<Row, { kind: 'add' }>);
      lines.push({
        left: d ? { num: d.a + 1, text: diff.a[d.a], kind: d.quiet ? 'quiet' : 'del' } : null,
        right: a ? { num: a.b + 1, text: diff.b[a.b], kind: a.quiet ? 'quiet' : 'add' } : null,
        rows: [dels[k], adds[k]].filter((x) => x !== undefined).map((x) => first + x),
      });
    }
  }
  return lines;
}

function Cells({ side, syntax }: { side: Side | null; syntax: Syntax }) {
  if (!side) return <td className="diff-num" colSpan={2} />;
  const start = commentStart(side.text, syntax);
  return (
    <>
      <td className="diff-num">{side.num}</td>
      <td className={`diff-code diff-${side.kind}`}>
        {start === -1 ? (
          side.text
        ) : (
          <>
            {side.text.slice(0, start)}
            <span className="diff-comment">{side.text.slice(start)}</span>
          </>
        )}
      </td>
    </>
  );
}

interface Props {
  diff: LineDiff;
  syntax: Syntax;
  fromName: string;
  toName: string;
  /** Row index → note number. */
  marks: ReadonlyMap<number, number>;
  /** A row to scroll to; `nonce` changes on every click so the same row can be shown again. */
  target: { row: number; nonce: number } | null;
}

export function CodeDiff({ diff, syntax, fromName, toName, marks, target }: Props) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const targetRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    targetRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [target]);

  let first = 0;
  return (
    <div className="diff-scroll">
      <table className="diff">
        <colgroup>
          <col className="diff-mark-col" />
          <col className="diff-num-col" />
          <col />
          <col className="diff-num-col" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th colSpan={2}>{fromName}</th>
            <th colSpan={2}>{toName}</th>
          </tr>
        </thead>
        <tbody>
          {chunks(diff).map((chunk, c) => {
            const start = first;
            first += chunk.rows.length;
            if (chunk.kind === 'fold' && !open.has(c)) {
              return (
                <tr key={c} className="diff-fold">
                  <td colSpan={5}>
                    <button type="button" onClick={() => setOpen(new Set([...open, c]))}>
                      ⋯ {chunk.rows.length} unchanged lines
                    </button>
                  </td>
                </tr>
              );
            }
            return (
              <Fragment key={c}>
                {sideBySide(diff, chunk.rows, start).map((line, l) => {
                  const mark = line.rows.map((r) => marks.get(r)).find((m) => m !== undefined);
                  const isTarget = target !== null && line.rows.includes(target.row);
                  return (
                    <tr key={l} ref={isTarget ? targetRef : undefined} className={isTarget ? 'diff-target' : undefined}>
                      <td className="diff-mark">{mark !== undefined && <span className="note-num">{mark}</span>}</td>
                      <Cells side={line.left} syntax={syntax} />
                      <Cells side={line.right} syntax={syntax} />
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
