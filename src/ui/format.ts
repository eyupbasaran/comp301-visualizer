// How the UI names and prints things: frame names (ρ0, ρ1, ...), values in
// the book's notation, short source snippets, and one-line step explanations.

import { sourceOf } from '../core/ast';
import type { Env, Frame } from '../core/env';
import { framesOf } from '../core/env';
import type { StoreEvent } from '../core/store';
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
      return `(a-pair ${v.p.leftLoc} ${v.p.rightLoc})`;
  }
}

/** A value in a store cell: 200, #t, (procedure x …), (a-pair 3 4), (a-thunk «-(x,1)» ρ2). */
export function storeValue(trace: Trace, v: StoreVal): string {
  if ('kind' in v) {
    const exp = sourceOf(trace.program, v.exp1).replace(/\s+/g, ' ').trim();
    return `(a-thunk «${exp.length > 18 ? exp.slice(0, 17) + '…' : exp}» ${envName(trace, v.env)})`;
  }
  return v.tag === 'num-val' || v.tag === 'bool-val' ? boxValue(v) : bookValue(v);
}

/** True when the env binds names to store locations (IMPLICIT-REFS and after), not to values. */
export function bindsLocations(trace: Trace): boolean {
  const first = trace.steps[0];
  if (!first || first.kind === 'apply-cont') return false;
  return framesOf(first.env).some((f) => f.kind === 'extend-env' && typeof f.bval === 'number');
}

const ownCache = new WeakMap<Trace, Map<number, StoreEvent[]>>();

/** The store events a step did itself, not inside the value-of calls it made, in order. */
export function ownEvents(trace: Trace, step: Step): readonly StoreEvent[] {
  let byOwner = ownCache.get(trace);
  if (!byOwner) {
    byOwner = new Map();
    for (const e of trace.events) {
      const list = byOwner.get(e.owner);
      if (list) list.push(e);
      else byOwner.set(e.owner, [e]);
    }
    ownCache.set(trace, byOwner);
  }
  return byOwner.get(step.index) ?? [];
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
  const own = ownEvents(trace, step);
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
      return 'The operands are evaluated left to right, then subtracted.';
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
      const alloc = own.find((e) => e.kind === 'newref');
      if (bound && second && alloc) {
        return `${bound} goes into a new location, ${alloc.loc}, and a new frame ${envName(trace, second.env)} binds ${exp.var as string} to it, on top of ${rho}; the body runs there.`;
      }
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
        const frame = envName(trace, third.env);
        // From IMPLICIT-REFS on, the argument goes into a new location first.
        const alloc = own.find((e) => e.kind === 'newref');
        if (alloc && proc.bvar !== null) {
          return `Calls (procedure ${proc.bvar} …) with ${arg}, which goes into a new location, ${alloc.loc}. The body runs in a new frame ${frame} (${proc.bvar} → ${alloc.loc}) on top of the closure's saved env ${saved}${caller}.`;
        }
        // A nameless procedure has no parameter name; its argument is just the new #0.
        const head = proc.bvar === null ? `Calls (procedure …) with ${arg}` : `Calls (procedure ${proc.bvar} …) with ${proc.bvar} = ${arg}`;
        return `${head}. The body runs in a new frame ${frame} on top of the closure's saved env ${saved}${caller}.`;
      }
      return "The operator is evaluated, then the operand. The body then runs in the closure's saved env, extended with the parameter.";
    }
    case 'letrec-exp': {
      // LETREC binds one procedure (pName); the chapter 4 languages bind several (pNames).
      const names = Array.isArray(exp.pNames) ? (exp.pNames as string[]) : [exp.pName as string];
      const subject = names.length === 1 ? `${names[0]} is` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are`;
      const them = names.length === 1 ? names[0] : 'them';
      if (first) {
        const frame = envName(trace, first.env);
        const each = bindsLocations(trace)
          ? `Each lookup of ${them} puts a new closure, whose saved env is ${frame} itself, into a new location.`
          : `Each lookup of ${them} makes a new closure whose saved env is ${frame} itself.`;
        return `${subject} bound recursively in a new frame ${frame} on top of ${rho}; the body runs there. ${each}`;
      }
      return `${subject} bound recursively in a new frame on top of ${rho}; the body runs there.`;
    }
    case 'begin-exp': {
      const count = 1 + (exp.exps as unknown[]).length;
      const last = value(subSteps(trace, step)[count - 1]);
      if (last) return `The ${count} expressions run in order; the value of the last one, ${last}, is the value of the begin.`;
      return `The ${count} expressions run in order; the value of the last one is the value of the begin.`;
    }
    case 'newref-exp': {
      const alloc = own.find((e) => e.kind === 'newref');
      if (alloc && step.result) return `${bookValue(alloc.val)} goes into a new location, ${alloc.loc}; newref returns ${bookValue(step.result)}.`;
      return 'The operand is evaluated, then put into a new location.';
    }
    case 'deref-exp': {
      const read = own.find((e) => e.kind === 'deref');
      if (read && step.result) return `Reads location ${read.loc}, which holds ${bookValue(step.result)}.`;
      return 'The operand must be a reference; deref reads its location.';
    }
    case 'setref-exp': {
      const write = own.find((e) => e.kind === 'setref');
      if (write?.kind === 'setref') return `Writes ${bookValue(write.val)} into location ${write.loc}, replacing ${bookValue(write.old)}; setref returns ⌈23⌉.`;
      return 'The first operand must be a reference; the second is written into its location.';
    }
    case 'assign-exp': {
      const write = own.find((e) => e.kind === 'setref');
      const name = exp.var as string;
      if (write?.kind === 'setref') {
        return `${name} is bound to location ${write.loc}; set writes ${bookValue(write.val)} there, replacing ${bookValue(write.old)}, and returns ⌈27⌉.`;
      }
      return `set evaluates the right-hand side and writes it into the location ${name} is bound to.`;
    }
    case 'newpair-exp': {
      const [l, r] = own.filter((e) => e.kind === 'newref');
      if (l?.kind === 'newref' && r?.kind === 'newref') {
        return `${bookValue(l.val)} and ${bookValue(r.val)} go into two new locations, ${l.loc} and ${r.loc}; the pair (a-pair ${l.loc} ${r.loc}) holds them.`;
      }
      return 'Both operands are evaluated, then each goes into a new location.';
    }
    case 'left-exp':
    case 'right-exp': {
      const side = exp.kind === 'left-exp' ? 'left' : 'right';
      const read = own.find((e) => e.kind === 'deref');
      if (read && step.result) return `Reads the pair's ${side} location, ${read.loc}, which holds ${bookValue(step.result)}.`;
      return `The operand must be a pair; ${side} reads its ${side} location.`;
    }
    case 'setleft-exp':
    case 'setright-exp': {
      const side = exp.kind === 'setleft-exp' ? 'left' : 'right';
      const write = own.find((e) => e.kind === 'setref');
      if (write?.kind === 'setref') {
        return `Writes ${bookValue(write.val)} into the pair's ${side} location, ${write.loc}, replacing ${bookValue(write.old)}; set${side} returns ${side === 'left' ? '⌈82⌉' : '⌈83⌉'}.`;
      }
      return `Both operands are evaluated; the first must be a pair, and the second is written into its ${side} location.`;
    }
    case 'nameless-var-exp':
      return explainAddress(trace, step, Number(exp.n as bigint));
    case 'nameless-let-exp': {
      const bound = value(first);
      if (bound && second) return `${bound} goes into a new frame ${envName(trace, second.env)} (#0) on top of ${rho}; the body runs there.`;
      return `The right-hand side is evaluated in ${rho}, then the body in ${rho} with its value added as #0.`;
    }
    case 'nameless-proc-exp':
      return `Makes a closure (procedure …) that remembers ${rho}, the env it was made in.`;
    default:
      return null;
  }
}

/** %lexref n: skip n frames of the env, read the next one. */
function explainAddress(trace: Trace, step: ValueOfStep, n: number): string {
  const { names } = frameNames(trace);
  const frames = framesOf(step.env);
  const at = frames[n];
  if (!at) return `%lexref ${n} points past the end of the env.`;
  const here = names.get(at.id) ?? '?';
  const value = step.result ? `: ${sentenceValue(step.result)}` : '';
  if (n === 0) return `%lexref 0 reads #0, the newest frame, ${here}${value}.`;
  const skipped = [...new Set(frames.slice(0, n).map((f) => names.get(f.id) ?? '?'))].filter((s) => s !== here);
  const over = skipped.length > 0 ? ` (${skipped.join(', ')})` : '';
  return `%lexref ${n} skips ${n} frame${n === 1 ? '' : 's'}${over} and reads #${n}, in ${here}${value}.`;
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
      const misses = skipped.filter((s, i) => s !== here && skipped.indexOf(s) === i);
      if (frame.kind !== 'extend-env') {
        // apply-env on a letrec frame makes a new closure on every lookup.
        const proc = step.result ? ` ${sentenceValue(step.result)}` : '';
        const where = misses.length === 0 ? `${name} is bound by letrec in ${here}` : `${name} is not bound in ${misses.join(', ')}, so the lookup goes on to ${here}, where letrec binds it`;
        // From IMPLICIT-REFS on, the new closure also goes into a new location.
        const alloc = ownEvents(trace, step).find((e) => e.kind === 'newref');
        if (alloc) return `${where}. This lookup puts a new closure${proc}, whose saved env is ${here}, into a new location, ${alloc.loc}.`;
        return `${where}. This lookup makes a new closure${proc} whose saved env is ${here}.`;
      }
      if (typeof frame.bval === 'number') {
        // The env holds a location; the value is in the store.
        const holds = step.result ? `, which holds ${sentenceValue(step.result)}` : '';
        if (misses.length === 0) return `${name} is bound in ${here} to location ${frame.bval}${holds}.`;
        return `${name} is not bound in ${misses.join(', ')}, so the lookup goes on to ${here}, where ${name} → ${frame.bval}${holds}.`;
      }
      const value = step.result ? ` = ${sentenceValue(step.result)}` : '';
      if (misses.length === 0) return `${name} is bound in ${here}: ${name}${value}.`;
      return `${name} is not bound in ${misses.join(', ')}, so the lookup goes on to ${here}, where ${name}${value}.`;
    }
    skipped.push(here);
  }
  return `${name} is not bound in any frame, so apply-env reports an error.`;
}
