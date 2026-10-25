// How the UI names and prints things: frame names (ρ0, ρ1, ...), values in
// the book's notation, short source snippets, and one-line step explanations.

import { sourceOf } from '../core/ast';
import type { Env, Frame } from '../core/env';
import { framesOf } from '../core/env';
import type { Step, Trace, ValueOfStep } from '../core/trace';
import type { DenVal, ExpVal, StoreVal } from '../core/values';

interface FrameNames {
  /** "ρ0" for every init-env frame, then ρ1, ρ2, ... in the order frames were made. */
  readonly names: ReadonlyMap<number, string>;
  readonly initIds: ReadonlySet<number>;
}

const namesCache = new WeakMap<Trace, FrameNames>();

/** Names stay the same at every slider position, so a frame keeps its name while you step. */
export function frameNames(trace: Trace): FrameNames {
  const cached = namesCache.get(trace);
  if (cached) return cached;

  const frames = new Map<number, Frame>();
  const pending: Env[] = [];
  const visitValue = (v: StoreVal | DenVal | undefined) => {
    if (v === undefined || typeof v === 'number') return;
    if ('kind' in v) pending.push(v.env);
    else if (v.tag === 'proc-val') pending.push(v.proc.savedEnv);
  };
  for (const step of trace.steps) {
    if (step.kind !== 'apply-cont') pending.push(step.env);
    if (step.kind === 'value-of') visitValue(step.result);
  }
  for (const event of trace.events) if (event.kind !== 'deref') visitValue(event.val);
  while (pending.length > 0) {
    for (let e = pending.pop()!; e.kind !== 'empty-env' && !frames.has(e.id); e = e.savedEnv) {
      frames.set(e.id, e);
      if (e.kind === 'extend-env') visitValue(e.bval);
      else if (e.kind === 'extend-env-rec*' || e.kind === 'extend-env-rec') continue;
      else visitValue(e.val);
    }
  }

  const first = trace.steps[0];
  const initIds = new Set<number>();
  if (first && first.kind !== 'apply-cont') {
    for (const f of framesOf(first.env)) if (f.id < first.idCount) initIds.add(f.id);
  }
  const names = new Map<number, string>();
  let n = 1;
  for (const id of [...frames.keys()].sort((a, b) => a - b)) names.set(id, initIds.has(id) ? 'ρ0' : `ρ${n++}`);

  const result = { names, initIds };
  namesCache.set(trace, result);
  return result;
}

export function envName(trace: Trace, env: Env): string {
  if (env.kind === 'empty-env') return '[]';
  return frameNames(trace).names.get(env.id) ?? '?';
}

/** A value the way the trace shows it: ⌈200⌉, (bool-val #t), (procedure z …). */
export function bookValue(v: StoreVal): string {
  if ('kind' in v) return '(a-thunk …)';
  switch (v.tag) {
    case 'num-val':
      return `⌈${v.num}⌉`;
    case 'bool-val':
      return `(bool-val ${v.bool ? '#t' : '#f'})`;
    case 'proc-val':
      return v.proc.bvar === null ? '(procedure …)' : `(procedure ${v.proc.bvar} …)`;
    case 'ref-val':
      return `(ref-val ${v.ref})`;
    case 'mutpair-val':
      return `(mutpair-val ${v.p.leftLoc} ${v.p.rightLoc})`;
  }
}

/** A value inside an env box: 200, #t, ● (a pointer to a closure drawn next to it). */
export function boxValue(v: DenVal): string {
  if (typeof v === 'number') return `→${v}`;
  switch (v.tag) {
    case 'num-val':
      return v.num.toString();
    case 'bool-val':
      return v.bool ? '#t' : '#f';
    case 'proc-val':
      return '●';
    case 'ref-val':
      return `(ref-val ${v.ref})`;
    case 'mutpair-val':
      return '●';
  }
}

/** The source of a step's expression on one line, cut to `max` characters. */
export function snippet(trace: Trace, step: Step, max = 34): string {
  if (step.kind === 'apply-cont') return step.cont.kind;
  const text = sourceOf(trace.program, step.exp).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** The step as an equation: (value-of «x» ρ5) = ⌈200⌉. */
export function equation(trace: Trace, step: Step, max = 34): { call: string; result: string | null } {
  switch (step.kind) {
    case 'value-of':
      return {
        call: `(value-of «${snippet(trace, step, max)}» ${envName(trace, step.env)})`,
        result: step.result ? bookValue(step.result) : null,
      };
    case 'value-of/k':
      return { call: `(value-of/k «${snippet(trace, step, max)}» ${envName(trace, step.env)} ${step.cont.kind})`, result: null };
    case 'apply-cont':
      return { call: `(apply-cont ${step.cont.kind} ${bookValue(step.val)})`, result: null };
  }
}

/** One sentence on what this step does, or null when there is nothing useful to say. */
// Each sentence is built from the step's own sub-steps (the value-of calls it
// made), so it can quote the actual values. When those are missing because the
// run stopped inside the step, a general sentence stands in.
export function explain(trace: Trace, step: Step): string | null {
  if (step.kind !== 'value-of') return null;
  const exp = step.exp as unknown as Record<string, unknown> & { kind: string };
  const rho = envName(trace, step.env);
  const [first, second, third] = subSteps(trace, step);
  const value = (s: ValueOfStep | undefined) => (s?.result ? bookValue(s.result) : null);
  switch (exp.kind) {
    case 'var-exp':
      return explainLookup(trace, step, exp.var as string);
    case 'const-exp':
      return step.result ? `A constant: its value is ${bookValue(step.result)}.` : 'A constant: its value is the number itself.';
    case 'diff-exp': {
      const a = value(first);
      const b = value(second);
      if (a && b && step.result) return `Both operands first: ${a} and ${b}; their difference is ${bookValue(step.result)}.`;
      return 'Both operands are evaluated first, then subtracted.';
    }
    case 'zero?-exp': {
      const n = first?.result;
      if (n?.tag === 'num-val') return `The operand is ${bookValue(n)}, which ${n.num === 0n ? 'is zero, so #t' : 'is not zero, so #f'}.`;
      return 'The operand is evaluated, then tested for zero.';
    }
    case 'if-exp': {
      const test = first?.result;
      if (test?.tag === 'bool-val' && step.result) {
        const branch = test.bool ? 'then' : 'else';
        return `The test gave ${test.bool ? '#t' : '#f'}, so only the ${branch} branch runs; its value ${bookValue(step.result)} is the value of the if.`;
      }
      return 'The test is evaluated first; only the branch it picks runs.';
    }
    case 'let-exp': {
      const bound = value(first);
      if (bound && second) {
        return `${exp.var as string} = ${bound} goes into a new frame ${envName(trace, second.env)} on top of ${rho}; the body runs there.`;
      }
      return `The right-hand side is evaluated in ${rho}, then the body in ${rho} extended with ${exp.var as string}.`;
    }
    case 'proc-exp':
      return `Makes a closure (procedure ${exp.var as string} …) that remembers ${rho}, the env it was made in.`;
    case 'call-exp': {
      const proc = first?.result?.tag === 'proc-val' ? first.result.proc : null;
      const arg = value(second);
      if (proc && arg && third) {
        const saved = envName(trace, proc.savedEnv);
        const caller = saved === rho ? '' : `, not the caller's ${rho}`;
        return `Calls (procedure ${proc.bvar} …) with ${proc.bvar} = ${arg}. The body runs in a new frame ${envName(trace, third.env)} on top of the closure's saved env ${saved}${caller}.`;
      }
      return "The operator is evaluated, then the operand. The body then runs in the closure's saved env, extended with the parameter.";
    }
    default:
      return null;
  }
}

/** The value-of calls a step made directly, in order. They sit between it and its last step. */
function subSteps(trace: Trace, step: ValueOfStep): ValueOfStep[] {
  const end = step.last ?? trace.steps.length - 1;
  const subs: ValueOfStep[] = [];
  for (let i = step.index + 1; i <= end; i++) {
    const s = trace.steps[i];
    if (s.kind === 'value-of' && s.parent === step.index) subs.push(s);
  }
  return subs;
}

/** A value inside a sentence: 200, #t, (procedure a …). */
function sentenceValue(v: ExpVal): string {
  return v.tag === 'proc-val' || v.tag === 'mutpair-val' ? bookValue(v) : boxValue(v);
}

function explainLookup(trace: Trace, step: ValueOfStep, name: string): string {
  const { names } = frameNames(trace);
  const skipped: string[] = [];
  for (const frame of framesOf(step.env)) {
    const here = names.get(frame.id) ?? '?';
    const bound =
      (frame.kind === 'extend-env' && frame.bvar === name) ||
      (frame.kind === 'extend-env-rec' && frame.pName === name) ||
      (frame.kind === 'extend-env-rec*' && frame.pNames.includes(name));
    if (bound) {
      const value = step.result ? ` = ${sentenceValue(step.result)}` : '';
      const misses = skipped.filter((s, i) => s !== here && skipped.indexOf(s) === i);
      if (misses.length === 0) return `${name} is bound in ${here}: ${name}${value}.`;
      return `${name} is not bound in ${misses.join(', ')}, so the lookup goes on to ${here}, where ${name}${value}.`;
    }
    skipped.push(here);
  }
  return `${name} is not bound in any frame, so apply-env reports an error.`;
}
