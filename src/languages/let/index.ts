import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const letLanguage: LanguageModule = {
  id: 'let',
  name: 'LET',
  origin: 'chapter3/let-lang',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env'],
  examples: [
    { title: 'Lecture 11: nested diff', source: '-(-(x,3), -(v,i))' },
    {
      title: 'Lecture 12: let and if',
      source: 'let x = 33\nin let y = 22\n   in if zero?(-(x,11))\n      then -(y,2)\n      else -(y,4)',
    },
    { title: 'Lecture 10: diff', source: '-(55, -(x,11))' },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
