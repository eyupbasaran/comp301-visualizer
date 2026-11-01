// What the Continuation panel shows at one slider position (CPS, TRAMPOLINED).
// Pure data, so it can be tested without a browser.
//
// The continuation of this step is drawn as a stack of frames: the innermost
// (the one apply-cont would use next) on top, end-cont at the bottom, each
// with its fields as the official datatype names them.

import { eoplName, isAstNode, sourceOf, type AstNode } from '../core/ast';
import type { Env } from '../core/env';
import type { Cont, Trace } from '../core/trace';
import type { ExpVal } from '../core/values';
import { bookValue, envName } from './format';

export interface ContField {
  readonly name: string;
  readonly text: string;
}

export interface ContFrame {
  readonly key: string;
  readonly kind: string;
  readonly fields: readonly ContField[];
  /** Made by the previous step, so new at this position. */
  readonly fresh: boolean;
}

export interface ContView {
  /** Innermost first. */
  readonly frames: readonly ContFrame[];
  /** Frames left out at the bottom of a very deep continuation. */
  readonly hidden: number;
  /** apply-cont: the value handed to the top frame. */
  readonly val: string | null;
  /** TRAMPOLINED: the trampoline called a bounce right before this step. */
  readonly bounced: boolean;
  /** TRAMPOLINED: steps since the last bounce (or since the start, if none yet), this one included. */
  readonly sinceBounce: number | null;
  /** TRAMPOLINED: a bounce happened before this step. */
  readonly bouncedBefore: boolean;
}

const MAX_FRAMES = 40;

function fieldText(trace: Trace, value: unknown): string {
  if (typeof value === 'string') return value;
  if (isAstNode(value)) {
    const text = sourceOf(trace.program, value as AstNode).replace(/\s+/g, ' ').trim();
    return `«${text.length > 24 ? text.slice(0, 23) + '…' : text}»`;
  }
  const v = value as { kind?: string; tag?: string };
  if (v.tag) return bookValue(value as ExpVal);
  if (v.kind) return envName(trace, value as Env);
  return String(value);
}

export function layoutCont(trace: Trace, position: number): ContView | null {
  const step = trace.steps[position];
  if (!step || step.kind === 'value-of') return null;
  const previous = position > 0 ? trace.steps[position - 1] : null;
  const frames: ContFrame[] = [];
  let hidden = 0;
  for (let c: Cont | undefined = step.cont; c; c = c.savedCont) {
    if (frames.length === MAX_FRAMES) {
      hidden++;
      continue;
    }
    const fields = Object.entries(c)
      .filter(([key]) => key !== 'id' && key !== 'kind' && key !== 'savedCont')
      .map(([key, value]) => ({ name: eoplName(key), text: fieldText(trace, value) }));
    frames.push({ key: `k${c.id}`, kind: c.kind, fields, fresh: previous !== null && c.id >= previous.idCount });
  }

  let sinceBounce: number | null = null;
  let bouncedBefore = false;
  if (trace.steps.some((s) => s.kind === 'value-of/k' && s.bounced)) {
    sinceBounce = 1;
    for (let i = position; i >= 0; i--) {
      const s = trace.steps[i];
      if (s.kind === 'value-of/k' && s.bounced) {
        bouncedBefore = true;
        break;
      }
      if (i > 0) sinceBounce++;
    }
  }
  return {
    frames,
    hidden,
    val: step.kind === 'apply-cont' ? bookValue(step.val) : null,
    bounced: step.kind === 'value-of/k' && step.bounced === true,
    sinceBounce,
    bouncedBefore,
  };
}
