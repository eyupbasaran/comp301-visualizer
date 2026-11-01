import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const implicitRefsLanguage: LanguageModule = {
  id: 'implicit-refs',
  name: 'IMPLICIT-REFS',
  origin: 'chapter4/implicit-refs',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'store'],
  examples: [
    {
      title: 'Lecture 20: a counter',
      source:
        'let g = let count = 0\n        in proc (dummy)\n             begin\n               set count = -(count,-1);\n               count\n             end\nin let a = (g 11)\n   in let b = (g 11)\n      in -(a,b)',
    },
    {
      title: 'Lecture 20: even and odd',
      source:
        'let x = 0\nin letrec even(dummy) = if zero?(x)\n                        then 1\n                        else begin\n                               set x = -(x,1);\n                               (odd 888)\n                             end\n          odd(dummy) = if zero?(x)\n                       then 0\n                       else begin\n                              set x = -(x,1);\n                              (even 888)\n                            end\n   in begin set x = 13; (odd -888) end',
    },
    {
      title: 'Lecture 21: swap does not swap',
      source:
        'let swap = proc (x)\n             proc (y)\n               let temp = x\n               in begin\n                    set x = y;\n                    set y = temp\n                  end\nin let a = 33\n   in let b = 44\n      in begin\n           ((swap a) b);\n           -(a,b)\n         end',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
