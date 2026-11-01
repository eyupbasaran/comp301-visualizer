// NAMELESS, as in top.scm: run = value-of-translation (translation-of-program (scan&parse s)).
// The trace is over the translated program; an unbound variable stops the run
// in the translator, before any step.

import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { record } from '../../core/trace';
import { valueOfTranslation } from './interp';
import { theGrammar, type AProgram } from './lang';
import { translationOfProgram } from './translator';

export const namelessLanguage: LanguageModule = {
  id: 'nameless',
  name: 'NAMELESS',
  origin: 'chapter3/lexaddr-lang',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'translation', 'env'],
  examples: [
    { title: 'Lectures 16–17: translation', source: 'let x = 37\nin proc (y)\n     let z = -(y,x)\n     in -(x,y)' },
    { title: 'Lecture 13: apply twice', source: 'let f = proc (x) -(x,11)\nin (f (f 77))' },
    {
      title: 'Lecture 13: static scoping',
      source:
        'let x = 200\nin let f = proc (z) -(z,x)\n   in let x = 100\n      in let g = proc (z) -(z,x)\n         in -((f 1), (g 1))',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => {
    let translated;
    try {
      translated = translationOfProgram(program as Program<AProgram>);
    } catch (e) {
      // Record the translator's error (e.g. "translation-of: unbound variable in code: foo") as the outcome.
      return record(program, options, () => {
        throw e;
      });
    }
    return valueOfTranslation(translated, options);
  },
};
