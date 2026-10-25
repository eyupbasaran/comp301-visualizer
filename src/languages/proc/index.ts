import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const procLanguage: LanguageModule = {
  id: 'proc',
  name: 'PROC',
  origin: 'chapter3/proc-lang/ds-rep',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env'],
  examples: [
    { title: 'Lecture 13: apply twice', source: 'let f = proc (x) -(x,11)\nin (f (f 77))' },
    { title: 'Lecture 13: procedure as argument', source: '(proc (f) (f (f 77))\n proc (x) -(x,11))' },
    {
      title: 'Lecture 13: static scoping',
      source:
        'let x = 200\nin let f = proc (z) -(z,x)\n   in let x = 100\n      in let g = proc (z) -(z,x)\n         in -((f 1), (g 1))',
    },
    { title: 'Lecture 16: a closure', source: 'let a = 5\nin proc (x) -(x,a)' },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
