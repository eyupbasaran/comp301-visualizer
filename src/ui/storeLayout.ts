// What the Store panel shows at one slider position. Pure data, so it can be
// tested without a browser.
//
// Each row is a location and what it holds now, plus:
//   - the names on this step's env chain that point at it (x → 3, or x = (ref-val 3));
//   - whether it changed since the previous position (new / set);
//   - what this step does to it itself: reads it, writes it, or makes it. A
//     location this step makes is not in the store yet, so it shows as a
//     dashed "ghost" row after the others until the slider gets there.

import { framesOf } from '../core/env';
import { stateAt } from '../core/state';
import type { Trace } from '../core/trace';
import { ownEvents, storeValue } from './format';

export interface StoreRow {
  readonly loc: number;
  readonly text: string;
  readonly names: readonly string[];
  readonly changed: 'new' | 'set' | null;
  /** What this step does to the location itself: "makes", "reads", "writes 13". */
  readonly does: readonly string[];
  /** Made by this step, later than this position: not in the store yet. */
  readonly ghost: boolean;
  /** Locations before this one are skipped: other steps make them first. */
  readonly gapBefore: boolean;
}

export function layoutStore(trace: Trace, position: number): StoreRow[] {
  const state = stateAt(trace, position);
  const step = state.step;

  // Names that point at a location: the binding apply-env would find for each name.
  const names = new Map<number, string[]>();
  if (step && step.kind !== 'apply-cont') {
    const seen = new Set<string>();
    for (const frame of framesOf(step.env)) {
      if (frame.kind === 'extend-env-rec' || frame.kind === 'extend-env-rec*') {
        for (const p of frame.kind === 'extend-env-rec' ? [frame.pName] : frame.pNames) seen.add(p);
      }
      if (frame.kind !== 'extend-env' || seen.has(frame.bvar)) continue;
      seen.add(frame.bvar);
      const v = frame.bval;
      const loc = typeof v === 'number' ? v : v.tag === 'ref-val' ? v.ref : null;
      if (loc !== null) names.set(loc, [...(names.get(loc) ?? []), frame.bvar]);
    }
  }

  // Changes since the previous position. Position 0 has init-env's locations; those are not news.
  const changed = new Map<number, 'new' | 'set'>();
  if (position > 0) {
    for (const e of state.changes) {
      if (e.kind === 'newref') changed.set(e.loc, 'new');
      else if (e.kind === 'setref' && changed.get(e.loc) !== 'new') changed.set(e.loc, 'set');
    }
  }

  // What this step does itself.
  const does = new Map<number, string[]>();
  const ghosts = new Map<number, string>();
  if (step) {
    const note = (loc: number, text: string) => does.set(loc, [...(does.get(loc) ?? []), text]);
    for (const e of ownEvents(trace, step)) {
      if (e.kind === 'newref') {
        ghosts.set(e.loc, storeValue(trace, e.val));
        note(e.loc, 'makes');
      } else if (e.kind === 'deref') note(e.loc, 'reads');
      else note(e.loc, `writes ${storeValue(trace, e.val)}`);
    }
  }

  const row = (loc: number, text: string, ghost: boolean, gapBefore: boolean): StoreRow => ({
    loc,
    text,
    names: names.get(loc) ?? [],
    changed: ghost ? null : (changed.get(loc) ?? null),
    does: does.get(loc) ?? [],
    ghost,
    gapBefore,
  });
  const rows = state.store.map((val, loc) => row(loc, storeValue(trace, val), false, false));
  let last = state.store.length - 1;
  for (const [loc, text] of [...ghosts].sort((a, b) => a[0] - b[0])) {
    rows.push(row(loc, text, true, loc > last + 1));
    last = loc;
  }
  return rows;
}
