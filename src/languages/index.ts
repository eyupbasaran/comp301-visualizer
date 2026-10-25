// Every language in the picker, in course order. `module` is null until it is implemented.

import type { LanguageId, LanguageModule } from '../core/language';
import { letLanguage } from './let';
import { procLanguage } from './proc';

export interface LanguageEntry {
  readonly id: LanguageId;
  readonly name: string;
  readonly module: LanguageModule | null;
}

export const LANGUAGES: readonly LanguageEntry[] = [
  { id: 'let', name: 'LET', module: letLanguage },
  { id: 'proc', name: 'PROC', module: procLanguage },
  { id: 'letrec', name: 'LETREC', module: null },
  { id: 'nameless', name: 'NAMELESS', module: null },
  { id: 'explicit-refs', name: 'EXPLICIT-REFS', module: null },
  { id: 'implicit-refs', name: 'IMPLICIT-REFS', module: null },
  { id: 'mutable-pairs', name: 'MUTABLE-PAIRS', module: null },
  { id: 'call-by-reference', name: 'CALL-BY-REFERENCE', module: null },
  { id: 'call-by-name', name: 'CALL-BY-NAME', module: null },
  { id: 'call-by-need', name: 'CALL-BY-NEED', module: null },
  { id: 'cps', name: 'CPS', module: null },
  { id: 'trampolined', name: 'TRAMPOLINED', module: null },
];

export function languageById(id: string): LanguageEntry | undefined {
  return LANGUAGES.find((entry) => entry.id === id);
}
