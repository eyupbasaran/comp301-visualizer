import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const cpsLanguage: LanguageModule = {
  id: 'cps',
  name: 'CPS',
  origin: 'chapter5/letrec-lang',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'cont'],
  examples: [
    { title: 'Lecture 24: nested diff', source: '-(-(44,11),3)' },
    {
      title: 'Lecture 24: the control context grows',
      source: 'letrec double(x) = if zero?(x)\n                   then 0\n                   else -((double -(x,1)), -2)\nin (double 3)',
    },
    {
      title: 'Lecture 24: a tail call does not',
      source: 'letrec loop(n) = if zero?(n)\n                 then 0\n                 else (loop -(n,1))\nin (loop 3)',
    },
    { title: 'Lecture 24: let, letrec and if', source: 'let b = zero?(0)\nin letrec p(x) = x\n   in if b then 3 else 4' },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
