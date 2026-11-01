// The store of chapter 4 (store.scm): locations 0, 1, 2, ... in allocation
// order. Interpreters use it through rec.store; every operation is logged as
// an event, and stateAt() rebuilds the store at any step from those events.

import type { Ref, StoreVal } from './values';
import { EoplError } from './errors';

// `owner` is the step whose own work the event is: the innermost value-of call
// still running (in the CPS languages, the latest step), or -1 before the first
// step. The newref of a let is owned by the let-exp's step, even though it
// happens after the step of its right-hand side.
export type StoreEvent =
  | { readonly kind: 'newref'; readonly loc: Ref; readonly val: StoreVal; readonly owner: number }
  | { readonly kind: 'deref'; readonly loc: Ref; readonly owner: number }
  | {
      readonly kind: 'setref';
      readonly loc: Ref;
      readonly val: StoreVal;
      /** The value it replaced, so a slider moving backwards can undo the write. */
      readonly old: StoreVal;
      readonly owner: number;
    };

export class Store {
  private readonly cells: StoreVal[] = [];

  /**
   * @param log receives every event
   * @param owner the step that owns an event happening now (see StoreEvent)
   */
  constructor(
    private readonly log: (event: StoreEvent) => void,
    private readonly owner: () => number,
  ) {}

  newref(val: StoreVal): Ref {
    const loc = this.cells.length;
    this.cells.push(val);
    this.log({ kind: 'newref', loc, val, owner: this.owner() });
    return loc;
  }

  deref(loc: Ref): StoreVal {
    const val = this.cells[loc];
    // In Racket this is a list-ref error. Interpreters only deref locations that newref returned.
    if (val === undefined) throw new Error(`deref: location ${loc} was never allocated`);
    this.log({ kind: 'deref', loc, owner: this.owner() });
    return val;
  }

  /** setref! in the official code. */
  setref(loc: Ref, val: StoreVal): void {
    const old = this.cells[loc];
    if (old === undefined) throw new EoplError('setref', `illegal reference ${loc} in store`);
    this.cells[loc] = val;
    this.log({ kind: 'setref', loc, val, old, owner: this.owner() });
  }

  get size(): number {
    return this.cells.length;
  }
}
