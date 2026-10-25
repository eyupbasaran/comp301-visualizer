// Draws the outline from astLayout.ts. Clicking a node moves the slider to a step that evaluates it.

import { useEffect, useRef } from 'react';
import type { AstRow, AstState } from './astLayout';

const TITLES: Record<AstState, string> = {
  current: 'evaluated at this step',
  open: 'running: this step is inside it',
  evaluated: 'evaluated in this run; click to go to its step',
  never: 'never evaluated in this run',
};

export function AstTree({ rows, onPick }: { rows: readonly AstRow[]; onPick(nodeId: number): void }) {
  const list = useRef<HTMLUListElement>(null);
  const currentRow = useRef<HTMLLIElement>(null);
  const currentKey = rows.find((r) => r.state === 'current')?.key;

  // Keep the current node in the middle of the list; only the list scrolls, never the page.
  useEffect(() => {
    const ul = list.current;
    const li = currentRow.current;
    if (!ul || !li) return;
    const offset = li.getBoundingClientRect().top - ul.getBoundingClientRect().top;
    ul.scrollTop += offset - (ul.clientHeight - li.offsetHeight) / 2;
  }, [currentKey]);

  return (
    <ul className="ast" aria-label="Abstract syntax tree" ref={list}>
      {rows.map((row) => {
        const node = row.node;
        return (
          <li key={row.key} ref={row.key === currentKey ? currentRow : undefined}>
            <span className="ast-guide" aria-hidden="true">
              {row.guide}
            </span>
            {node && row.state ? (
              <button
                type="button"
                className={`ast-node ${row.state}`}
                title={TITLES[row.state]}
                disabled={row.state === 'never' || node.kind === 'a-program'}
                onClick={() => onPick(node.id)}
              >
                {row.label}
              </button>
            ) : (
              <span className="ast-binder">{row.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
