// The store as a ledger: one row per location, what it holds, who points at it,
// and what this step does to it. Rows come from storeLayout.ts.

import { useEffect, useRef } from 'react';
import type { StoreRow } from './storeLayout';

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
          <span className="store-val">{r.text}</span>
          <span className="store-names">{r.names.length > 0 ? `← ${r.names.join(', ')}` : ''}</span>
          <span className="store-does">{r.does.length > 0 ? r.does.join(', then ') : r.changed === 'new' ? 'just made' : r.changed ? 'just set' : ''}</span>
        </li>
      ))}
    </ol>
  );
}
