// What the panels read: the state of a run at one slider position.

import type { StoreEvent } from './store';
import type { Step, Trace, ValueOfStep } from './trace';
import type { StoreVal } from './values';

export interface StateAt {
  /** 0 .. steps.length */
  readonly position: number;
  /** The step at this position; null at the last position (the end of the run). */
  readonly step: Step | null;
  /** Store contents at this moment; index = location. */
  readonly store: readonly StoreVal[];
  /** Store events since the previous position (all events before step 0 at position 0). */
  readonly changes: readonly StoreEvent[];
  /**
   * The value-of calls running at this moment, outermost first; the last one
   * is this step itself. At the end of a run that stopped early, the calls
   * that never returned.
   */
  readonly stack: readonly ValueOfStep[];
}

/** Number of slider positions: one per step, plus the end of the run. */
export function positionCount(trace: Trace): number {
  return trace.steps.length + 1;
}

/** How many store events happened before `position`. */
export function eventIndexAt(trace: Trace, position: number): number {
  return position < trace.steps.length ? trace.steps[position].eventIndex : trace.events.length;
}

export function stateAt(trace: Trace, position: number): StateAt {
  if (!Number.isInteger(position) || position < 0 || position > trace.steps.length) {
    throw new RangeError(`position ${position} is outside 0..${trace.steps.length}`);
  }
  const step = position < trace.steps.length ? trace.steps[position] : null;
  const eventIndex = eventIndexAt(trace, position);
  const previous = position === 0 ? 0 : eventIndexAt(trace, position - 1);
  return {
    position,
    step,
    store: storeCursor(trace).moveTo(eventIndex),
    changes: trace.events.slice(previous, eventIndex),
    stack: step ? stackOf(trace, step) : trace.openSteps.map((i) => trace.steps[i] as ValueOfStep),
  };
}

function stackOf(trace: Trace, step: Step): ValueOfStep[] {
  const stack: ValueOfStep[] = [];
  for (let s: Step | undefined = step; s?.kind === 'value-of'; s = trace.steps[s.parent]) stack.push(s);
  return stack.reverse();
}

// Rebuilding the store: one cursor per trace walks the event log forwards or
// backwards, so dragging the slider costs only the events in between.

class StoreCursor {
  private readonly cells: StoreVal[] = [];
  private applied = 0;

  constructor(private readonly events: readonly StoreEvent[]) {}

  moveTo(target: number): StoreVal[] {
    while (this.applied < target) {
      const e = this.events[this.applied++];
      if (e.kind === 'newref') this.cells.push(e.val);
      else if (e.kind === 'setref') this.cells[e.loc] = e.val;
    }
    while (this.applied > target) {
      const e = this.events[--this.applied];
      if (e.kind === 'newref') this.cells.pop();
      else if (e.kind === 'setref') this.cells[e.loc] = e.old;
    }
    return this.cells.slice();
  }
}

const cursors = new WeakMap<Trace, StoreCursor>();

function storeCursor(trace: Trace): StoreCursor {
  let cursor = cursors.get(trace);
  if (!cursor) {
    cursor = new StoreCursor(trace.events);
    cursors.set(trace, cursor);
  }
  return cursor;
}
