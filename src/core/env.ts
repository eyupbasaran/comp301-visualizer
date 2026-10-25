// Environment frames. Field names follow the environment datatypes in the
// official data-structures.scm files.
//
// Frames are never changed after they are made, so a step can simply keep the
// env it was given. `id` is unique within one run: two closures that share a
// frame point at the same id, and panels draw that frame once. Frames are made
// through the Recorder (rec.extendEnv, ...), which hands out the ids.

import type { AstNode } from './ast';
import type { DenVal, ExpVal } from './values';

export type Env = EmptyEnv | ExtendEnv | ExtendEnvRec | ExtendEnvRecStar | ExtendNamelessEnv;

export interface EmptyEnv {
  readonly id: number;
  readonly kind: 'empty-env';
}

/** (extend-env bvar bval saved-env). `bval` is a Ref from IMPLICIT-REFS on. */
export interface ExtendEnv {
  readonly id: number;
  readonly kind: 'extend-env';
  readonly bvar: string;
  readonly bval: DenVal;
  readonly savedEnv: Env;
}

/** letrec with one procedure: chapter 3 LETREC and the chapter 5 interpreters. */
export interface ExtendEnvRec {
  readonly id: number;
  readonly kind: 'extend-env-rec';
  readonly pName: string;
  readonly bVar: string;
  readonly pBody: AstNode;
  readonly savedEnv: Env;
}

/** letrec with several procedures: the chapter 4 languages. */
export interface ExtendEnvRecStar {
  readonly id: number;
  readonly kind: 'extend-env-rec*';
  readonly pNames: readonly string[];
  readonly bVars: readonly string[];
  readonly pBodies: readonly AstNode[];
  readonly savedEnv: Env;
}

/** NAMELESS: the environment is a list of values; a variable is its position in the list. */
export interface ExtendNamelessEnv {
  readonly id: number;
  readonly kind: 'extend-nameless-env';
  readonly val: ExpVal;
  readonly savedEnv: Env;
}

export type Frame = Exclude<Env, EmptyEnv>;

/** The frames of an environment, newest first. */
export function framesOf(env: Env): Frame[] {
  const frames: Frame[] = [];
  for (let e = env; e.kind !== 'empty-env'; e = e.savedEnv) frames.push(e);
  return frames;
}

/** The frame that binds `name` (what apply-env would find), or null. */
export function frameBinding(env: Env, name: string): Frame | null {
  for (const frame of framesOf(env)) {
    switch (frame.kind) {
      case 'extend-env':
        if (frame.bvar === name) return frame;
        break;
      case 'extend-env-rec':
        if (frame.pName === name) return frame;
        break;
      case 'extend-env-rec*':
        if (frame.pNames.includes(name)) return frame;
        break;
      case 'extend-nameless-env':
        break;
    }
  }
  return null;
}
