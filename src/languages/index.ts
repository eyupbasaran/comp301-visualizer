// Every language in the picker, in course order. `module` is null until it is implemented.

import type { LanguageId, LanguageModule } from '../core/language';
import { explicitRefsLanguage } from './explicit-refs';
import { implicitRefsLanguage } from './implicit-refs';
import { letLanguage } from './let';
import { letrecLanguage } from './letrec';
import { mutablePairsLanguage } from './mutable-pairs';
import { namelessLanguage } from './nameless';
import { procLanguage } from './proc';

export interface LanguageEntry {
  readonly id: LanguageId;
  readonly name: string;
  readonly module: LanguageModule | null;
}

export const LANGUAGES: readonly LanguageEntry[] = [
  { id: 'let', name: 'LET', module: letLanguage },
  { id: 'proc', name: 'PROC', module: procLanguage },
  { id: 'letrec', name: 'LETREC', module: letrecLanguage },
  { id: 'nameless', name: 'NAMELESS', module: namelessLanguage },
  { id: 'explicit-refs', name: 'EXPLICIT-REFS', module: explicitRefsLanguage },
  { id: 'implicit-refs', name: 'IMPLICIT-REFS', module: implicitRefsLanguage },
  { id: 'mutable-pairs', name: 'MUTABLE-PAIRS', module: mutablePairsLanguage },
  { id: 'call-by-reference', name: 'CALL-BY-REFERENCE', module: null },
  { id: 'call-by-name', name: 'CALL-BY-NAME', module: null },
  { id: 'call-by-need', name: 'CALL-BY-NEED', module: null },
  { id: 'cps', name: 'CPS', module: null },
  { id: 'trampolined', name: 'TRAMPOLINED', module: null },
];

export function languageById(id: string): LanguageEntry | undefined {
  return LANGUAGES.find((entry) => entry.id === id);
}
