import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const trampolinedLanguage: LanguageModule = {
  id: 'trampolined',
  name: 'TRAMPOLINED',
  origin: 'chapter5/letrec-lang with a trampoline (book section 5.2; no official folder)',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'cont'],
  examples: [
    { title: 'Lecture 26: nested diff', source: '-(-(44,11),3)' },
    {
      title: 'Lecture 26: a bounce per call',
      source: 'letrec double(x) = if zero?(x)\n                   then 0\n                   else -((double -(x,1)), -2)\nin (double 3)',
    },
    {
      title: 'Lecture 26: a loop, bouncing',
      source: 'letrec loop(n) = if zero?(n)\n                 then 0\n                 else (loop -(n,1))\nin (loop 3)',
    },
    { title: 'Lecture 26: let, letrec and if', source: 'let b = zero?(0)\nin letrec p(x) = x\n   in if b then 3 else 4' },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
