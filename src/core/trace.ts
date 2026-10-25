// The step log. Interpreters write it through a Recorder; panels only read it.
//
// What counts as a step:
//   - every value-of call is one step;
//   - in the CPS interpreters, every value-of/k call and every apply-cont call
//     is one step;
//   - nothing else. A value that a call returns is stored on that call's step
//     (`result`) and shown next to its expression; it is not a step of its own.
//
// The slider has steps.length + 1 positions: position p < steps.length shows
// step p; the last position shows the end of the run (final value or error,
// final store).

import type { AstNode, Program } from './ast';
import type { Env } from './env';
import { EoplError } from './errors';
import { Store, type StoreEvent } from './store';
import type { DenVal, ExpVal, Proc, Thunk } from './values';

/**
 * A continuation frame (chapter 5). Each CPS language declares its own
 * variants (end-cont, diff1-cont, ...) with the official field names;
 * panels show the fields other than id, kind and savedCont generically.
 */
export interface Cont {
  readonly id: number;
  readonly kind: string;
  /** Missing only on end-cont. */
  readonly savedCont?: Cont;
}

interface StepBase {
  /** Position of this step in trace.steps. */
  readonly index: number;
  /**
   * The value-of call this one runs inside (the interpreter's control
   * context), or -1. Always -1 in the CPS languages.
   */
  readonly parent: number;
  /** How many value-of calls were still running when this one started. */
  readonly depth: number;
  /** trace.events.length when the step started: the store here is events[0, eventIndex) replayed. */
  readonly eventIndex: number;
  /** Every object with id >= idCount (frame, closure, thunk, continuation) was made after this step started. */
  readonly idCount: number;
}

/** (value-of exp env) */
export interface ValueOfStep extends StepBase {
  readonly kind: 'value-of';
  readonly exp: AstNode;
  readonly env: Env;
  /** What the call returned. Missing if the run stopped before it returned. */
  result?: ExpVal;
  /** Index of the last step inside this call. Set when it returns. */
  last?: number;
}

/** (value-of/k exp env cont) */
export interface ValueOfKStep extends StepBase {
  readonly kind: 'value-of/k';
  readonly exp: AstNode;
  readonly env: Env;
  readonly cont: Cont;
  /** The value that eventually reaches `cont`, if the language fills it in. */
  result?: ExpVal;
}

/** (apply-cont cont val) */
export interface ApplyContStep extends StepBase {
  readonly kind: 'apply-cont';
  readonly cont: Cont;
  readonly val: ExpVal;
}

export type Step = ValueOfStep | ValueOfKStep | ApplyContStep;

export type Outcome =
  | { readonly kind: 'value'; readonly value: ExpVal }
  /** An eopl:error, worded the way DrRacket prints it: "apply-env: No binding for foo". */
  | { readonly kind: 'error'; readonly message: string }
  /** We stopped a run that went on too long or recursed too deep. */
  | { readonly kind: 'limit'; readonly message: string }
  /** A bug in the visualizer, not in the student's program. */
  | { readonly kind: 'crash'; readonly message: string };

export interface Trace {
  readonly program: Program;
  readonly steps: readonly Step[];
  readonly events: readonly StoreEvent[];
  /** Text the program printed, e.g. "End of computation." from end-cont. */
  readonly output: readonly string[];
  readonly outcome: Outcome;
  /** value-of calls that never returned (outermost first): where the run was when an error stopped it. */
  readonly openSteps: readonly number[];
}

export interface RunOptions {
  /** Stop after this many steps, for programs that never finish. */
  stepLimit?: number;
  /** Stop when value-of calls nest this deep. The browser's stack is far smaller than Racket's. */
  depthLimit?: number;
}

export const DEFAULT_STEP_LIMIT = 100_000;
// Measured in Node: LET overflows the JS stack at about 3,400 nested value-of
// calls, and languages with procedures use more JS frames per call.
export const DEFAULT_DEPTH_LIMIT = 1_000;

class LimitReached extends Error {}

/**
 * Everything an interpreter needs to leave a trace: step recording, the store,
 * and constructors for objects that get an id (env frames, procedures, thunks,
 * continuations). One Recorder per run.
 */
export class Recorder {
  readonly steps: Step[] = [];
  readonly events: StoreEvent[] = [];
  readonly output: string[] = [];
  readonly store: Store;
  private nextId = 0;
  /** value-of calls that have started but not returned, innermost last. */
  private readonly open: number[] = [];
  private readonly stepLimit: number;
  private readonly depthLimit: number;

  constructor(
    readonly program: Program,
    options: RunOptions = {},
  ) {
    this.stepLimit = options.stepLimit ?? DEFAULT_STEP_LIMIT;
    this.depthLimit = options.depthLimit ?? DEFAULT_DEPTH_LIMIT;
    this.store = new Store(
      (event) => this.events.push(event),
      () => this.steps.length - 1,
    );
  }

  // ---- steps ----

  /** value-of was called: one step. Hand the returned index to `returns`. */
  valueOf(exp: AstNode, env: Env): number {
    if (this.open.length >= this.depthLimit) {
      throw new LimitReached(
        `Stopped: value-of calls nested ${this.depthLimit} deep. The program may recurse forever, ` +
          `or it is too deep for the visualizer.`,
      );
    }
    const index = this.startStep();
    this.steps.push({
      kind: 'value-of',
      index,
      exp,
      env,
      parent: this.open.length > 0 ? this.open[this.open.length - 1] : -1,
      depth: this.open.length,
      eventIndex: this.events.length,
      idCount: this.nextId,
    });
    this.open.push(index);
    return index;
  }

  /** The value-of call `index` returns `val`. Gives `val` back, so `return rec.returns(step, val)` works. */
  returns(index: number, val: ExpVal): ExpVal {
    const innermost = this.open.pop();
    if (innermost !== index) {
      throw new Error(`returns(${index}) called, but the innermost running value-of is ${innermost}`);
    }
    const step = this.steps[index] as ValueOfStep;
    step.result = val;
    step.last = this.steps.length - 1;
    return val;
  }

  /** value-of/k was called: one step. */
  valueOfK(exp: AstNode, env: Env, cont: Cont): void {
    const index = this.startStep();
    this.steps.push({
      kind: 'value-of/k',
      index,
      exp,
      env,
      cont,
      parent: -1,
      depth: 0,
      eventIndex: this.events.length,
      idCount: this.nextId,
    });
  }

  /** apply-cont was called: one step. */
  applyCont(cont: Cont, val: ExpVal): void {
    const index = this.startStep();
    this.steps.push({
      kind: 'apply-cont',
      index,
      cont,
      val,
      parent: -1,
      depth: 0,
      eventIndex: this.events.length,
      idCount: this.nextId,
    });
  }

  private startStep(): number {
    if (this.steps.length >= this.stepLimit) {
      throw new LimitReached(`Stopped after ${this.stepLimit} steps. The program may never finish.`);
    }
    return this.steps.length;
  }

  // ---- objects with an id ----

  newId(): number {
    return this.nextId++;
  }

  emptyEnv(): Env {
    return { id: this.newId(), kind: 'empty-env' };
  }

  extendEnv(bvar: string, bval: DenVal, savedEnv: Env): Env {
    return { id: this.newId(), kind: 'extend-env', bvar, bval, savedEnv };
  }

  extendEnvRec(pName: string, bVar: string, pBody: AstNode, savedEnv: Env): Env {
    return { id: this.newId(), kind: 'extend-env-rec', pName, bVar, pBody, savedEnv };
  }

  extendEnvRecStar(pNames: readonly string[], bVars: readonly string[], pBodies: readonly AstNode[], savedEnv: Env): Env {
    return { id: this.newId(), kind: 'extend-env-rec*', pNames, bVars, pBodies, savedEnv };
  }

  extendNamelessEnv(val: ExpVal, savedEnv: Env): Env {
    return { id: this.newId(), kind: 'extend-nameless-env', val, savedEnv };
  }

  procedure(bvar: string | null, body: AstNode, savedEnv: Env): Proc {
    return { id: this.newId(), kind: 'procedure', bvar, body, savedEnv };
  }

  thunk(exp1: AstNode, env: Env): Thunk {
    return { id: this.newId(), kind: 'a-thunk', exp1, env };
  }

  /** A continuation frame: rec.cont<DiffOneCont>({ kind: 'diff1-cont', exp2, savedEnv, savedCont }). */
  cont<C extends Cont>(frame: Omit<C, 'id'>): C {
    return { id: this.newId(), ...frame } as C;
  }

  // ---- output ----

  /** eopl:printf */
  print(text: string): void {
    this.output.push(text);
  }

  finish(outcome: Outcome): Trace {
    return {
      program: this.program,
      steps: this.steps,
      events: this.events,
      output: this.output,
      outcome,
      openSteps: [...this.open],
    };
  }
}

/**
 * Runs an interpreter and turns whatever happens into a Trace: a value, an
 * eopl:error, a limit, or a crash. Every language's run() goes through this,
 * so run() never throws.
 */
export function record(program: Program, options: RunOptions | undefined, run: (rec: Recorder) => ExpVal): Trace {
  const rec = new Recorder(program, options);
  let outcome: Outcome;
  try {
    outcome = { kind: 'value', value: run(rec) };
  } catch (e) {
    outcome = outcomeOf(e);
  }
  return rec.finish(outcome);
}

function outcomeOf(e: unknown): Outcome {
  if (e instanceof EoplError) return { kind: 'error', message: e.message };
  if (e instanceof LimitReached) return { kind: 'limit', message: e.message };
  // Chrome and Safari throw RangeError on stack overflow, Firefox InternalError.
  if (e instanceof RangeError || (e instanceof Error && e.name === 'InternalError')) {
    return {
      kind: 'limit',
      message: 'Stopped: the interpreter recursed deeper than the browser allows. The program may recurse forever.',
    };
  }
  return { kind: 'crash', message: e instanceof Error ? e.message : String(e) };
}
