// What every language module provides. The UI only talks to languages through this.

import type { Program } from './ast';
import { ParseError } from './errors';
import type { Grammar } from './grammar';
import type { RunOptions, Trace } from './trace';

export type LanguageId =
  | 'let'
  | 'proc'
  | 'letrec'
  | 'nameless'
  | 'explicit-refs'
  | 'implicit-refs'
  | 'mutable-pairs'
  | 'call-by-reference'
  | 'call-by-name'
  | 'call-by-need'
  | 'cps'
  | 'trampolined';

/**
 * Panels a language can fill. The state panels (env, store, cont) are shown
 * side by side, never in tabs, whenever the language has them.
 */
export type PanelId = 'ast' | 'trace' | 'contour' | 'env' | 'store' | 'cont';

export interface Example {
  readonly title: string;
  readonly source: string;
}

export interface LanguageModule {
  readonly id: LanguageId;
  /** As the course writes it: "LET", "IMPLICIT-REFS". */
  readonly name: string;
  /** The official EOPL3 folder this is ported from, e.g. "chapter3/let-lang". */
  readonly origin: string;
  readonly grammar: Grammar;
  readonly panels: readonly PanelId[];
  readonly examples: readonly Example[];
  /** Throws ParseError. */
  parse(source: string): Program;
  /** Never throws: errors and limits end up in trace.outcome. */
  run(program: Program, options?: RunOptions): Trace;
}

export type RunResult =
  | { readonly ok: true; readonly program: Program; readonly trace: Trace }
  | { readonly ok: false; readonly error: ParseError };

/** Parse and run, the way the Run button does. */
export function runSource(language: LanguageModule, source: string, options?: RunOptions): RunResult {
  let program: Program;
  try {
    program = language.parse(source);
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e };
    throw e;
  }
  return { ok: true, program, trace: language.run(program, options) };
}
