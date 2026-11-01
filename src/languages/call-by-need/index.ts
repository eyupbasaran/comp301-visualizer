import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const callByNeedLanguage: LanguageModule = {
  id: 'call-by-need',
  name: 'CALL-BY-NEED',
  origin: 'chapter4/call-by-need',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'store'],
  examples: [
    {
      title: 'Lecture 23: the argument, once',
      source: 'let f = proc (x) -(x, -(x,5))\nin (f -(7,2))',
    },
    {
      title: 'Lectures 21, 23: a loop never run',
      source: 'letrec infinite-loop (x) = (infinite-loop -(x,-1))\nin let f = proc (z) 11\n   in (f (infinite-loop 0))',
    },
    {
      title: 'Lecture 21: set reaches the caller',
      source: 'let p = proc (x) set x = 4\nin let a = 3\n   in begin\n        (p a);\n        a\n      end',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
