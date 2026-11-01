// Ports of pairval1.scm and pairval2.scm, the two representations of mutable
// pairs in chapter 4. The official folders with pairs (mutable-pairs,
// call-by-reference, call-by-need) carry the same two files, and each one's
// pairvals.scm picks one of them.

import type { Store } from './store';
import type { APair, ExpVal, MutPair, Ref } from './values';

export type PairVal = 'pairval1' | 'pairval2';

export interface PairOps {
  // make-pair : ExpVal * ExpVal -> MutPair
  makePair(val1: ExpVal, val2: ExpVal): MutPair;
  // left : MutPair -> ExpVal
  left(p: MutPair): ExpVal;
  // right : MutPair -> ExpVal
  right(p: MutPair): ExpVal;
  // setleft : MutPair * ExpVal -> Unspecified
  setleft(p: MutPair, val: ExpVal): void;
  // setright : MutPair * ExpVal -> Unspecified
  setright(p: MutPair, val: ExpVal): void;
}

/** The pair operations of one representation. A run only ever makes pairs of the one it uses. */
export function pairOps(pairval: PairVal, store: Store): PairOps {
  // Only ExpVals are ever put in a pair.
  const deref = (ref: Ref) => store.deref(ref) as ExpVal;

  if (pairval === 'pairval1') {
    // A mutable pair is two references: (a-pair left-loc right-loc).
    const aPair = (p: MutPair) => p as APair;
    return {
      makePair: (val1, val2) => {
        const leftLoc = store.newref(val1);
        const rightLoc = store.newref(val2);
        return { kind: 'a-pair', leftLoc, rightLoc };
      },
      left: (p) => deref(aPair(p).leftLoc),
      right: (p) => deref(aPair(p).rightLoc),
      setleft: (p, val) => store.setref(aPair(p).leftLoc, val),
      setright: (p, val) => store.setref(aPair(p).rightLoc, val),
    };
  }

  // pairval2.scm: two consecutive locations (left and right), represented as
  // a reference to the first. newref takes the next free location, so the
  // right element is always at p + 1.
  const ref = (p: MutPair) => p as Ref;
  return {
    makePair: (val1, val2) => {
      const ref1 = store.newref(val1);
      store.newref(val2);
      return ref1;
    },
    left: (p) => deref(ref(p)),
    right: (p) => deref(ref(p) + 1),
    setleft: (p, val) => store.setref(ref(p), val),
    setright: (p, val) => store.setref(ref(p) + 1, val),
  };
}
