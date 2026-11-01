// Every language in the picker, in course order. `module` is null until it is implemented.

import type { LanguageId, LanguageModule } from '../core/language';
import { callByNameLanguage } from './call-by-name';
import { callByNeedLanguage } from './call-by-need';
import { callByReferenceLanguage } from './call-by-reference';
import { cpsLanguage } from './cps';
import { explicitRefsLanguage } from './explicit-refs';
import { implicitRefsLanguage } from './implicit-refs';
import { letLanguage } from './let';
import { letrecLanguage } from './letrec';
import { mutablePairsLanguage, mutablePairsPairval2Language } from './mutable-pairs';
import { namelessLanguage } from './nameless';
import { procLanguage } from './proc';
import { trampolinedLanguage } from './trampolined';

export interface LanguageEntry {
  readonly id: LanguageId;
  readonly name: string;
  readonly module: LanguageModule | null;
  /**
   * When the official code has more than one implementation of the language:
   * what the picker calls the choice, and every implementation, `module` first.
   */
  readonly variants?: { readonly label: string; readonly modules: readonly LanguageModule[] };
}

export const LANGUAGES: readonly LanguageEntry[] = [
  { id: 'let', name: 'LET', module: letLanguage },
  { id: 'proc', name: 'PROC', module: procLanguage },
  { id: 'letrec', name: 'LETREC', module: letrecLanguage },
  { id: 'nameless', name: 'NAMELESS', module: namelessLanguage },
  { id: 'explicit-refs', name: 'EXPLICIT-REFS', module: explicitRefsLanguage },
  { id: 'implicit-refs', name: 'IMPLICIT-REFS', module: implicitRefsLanguage },
  {
    id: 'mutable-pairs',
    name: 'MUTABLE-PAIRS',
    module: mutablePairsLanguage,
    variants: { label: 'Pairs', modules: [mutablePairsLanguage, mutablePairsPairval2Language] },
  },
  { id: 'call-by-reference', name: 'CALL-BY-REFERENCE', module: callByReferenceLanguage },
  { id: 'call-by-name', name: 'CALL-BY-NAME', module: callByNameLanguage },
  { id: 'call-by-need', name: 'CALL-BY-NEED', module: callByNeedLanguage },
  { id: 'cps', name: 'CPS', module: cpsLanguage },
  { id: 'trampolined', name: 'TRAMPOLINED', module: trampolinedLanguage },
];

export function languageById(id: string): LanguageEntry | undefined {
  return LANGUAGES.find((entry) => entry.id === id);
}
