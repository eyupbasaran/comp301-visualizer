import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const letrecLanguage: LanguageModule = {
  id: 'letrec',
  name: 'LETREC',
  origin: 'chapter3/letrec-lang',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env'],
  examples: [
    {
      title: 'Lecture 15: double',
      source: 'letrec double(x) = if zero?(x)\n                   then 0\n                   else -((double -(x,1)), -2)\nin (double 6)',
    },
    {
      title: 'Lecture 15: letrec inside lets',
      source:
        'let a = 1\nin let b = 2\n   in letrec f(x) = if zero?(x)\n                    then 0\n                    else -((f -(x,1)), -2)\n      in (f 2)',
    },
    {
      title: 'Lecture 16: sum with a curried add',
      source:
        'let add = proc (x) proc (y) -(x, -(0, y))\nin letrec sum(n) = if zero?(n)\n                   then 0\n                   else ((add n) (sum -(n, 1)))\n   in (sum 5)',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
