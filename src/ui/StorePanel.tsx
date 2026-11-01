// The store as a ledger: one row per location, what it holds, who points at it,
// and what this step does to it. Rows come from storeLayout.ts.

import { useEffect, useRef } from 'react';
import type { StoreRow } from './storeLayout';

/** The line under a value: what this step does to it, or that it just changed. */
function note(r: StoreRow): string | null {
  if (r.does.length > 0) return `this step ${r.does.join(', then ')}`;
  if (r.changed) return r.changed === 'new' ? 'just made' : 'just set';
  return null;
}

export function StorePanel({ rows }: { rows: readonly StoreRow[] }) {
  const list = useRef<HTMLOListElement>(null);

  // Keep the location this step works on in view.
  const focus = rows.find((r) => r.does.length > 0) ?? rows.find((r) => r.changed);
  useEffect(() => {
    if (focus === undefined) return;
    list.current?.querySelector(`[data-loc="${focus.loc}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focus?.loc, focus]);

  if (rows.length === 0) return <p className="step-note">The store is empty.</p>;
  return (
    <ol className="store" ref={list}>
      {rows.map((r) => (
        <li
          key={r.loc}
          data-loc={r.loc}
          className={['store-row', r.ghost && 'ghost', r.changed && 'changed', r.does.length > 0 && 'touched', r.gapBefore && 'gap']
            .filter(Boolean)
            .join(' ')}
        >
          <span className="store-loc">{r.loc}</span>
          <span className="store-val">
            <span className="store-text">{r.text}</span>
            {r.names.length > 0 && <span className="store-names">← {r.names.join(', ')}</span>}
            {note(r) && <span className="store-does">{note(r)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
