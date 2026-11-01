import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const explicitRefsLanguage: LanguageModule = {
  id: 'explicit-refs',
  name: 'EXPLICIT-REFS',
  origin: 'chapter4/explicit-refs',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'store'],
  examples: [
    {
      title: 'Lecture 18: a counter',
      source:
        'let g = let counter = newref(0)\n        in proc (dummy)\n             begin\n               setref(counter, -(deref(counter), -1));\n               deref(counter)\n             end\nin let a = (g 11)\n   in let b = (g 11)\n      in -(a,b)',
    },
    {
      title: 'Lecture 18: even and odd',
      source:
        'let x = newref(0)\nin letrec even(dummy) = if zero?(deref(x))\n                        then 1\n                        else begin\n                               setref(x, -(deref(x),1));\n                               (odd 888)\n                             end\n          odd(dummy) = if zero?(deref(x))\n                       then 0\n                       else begin\n                              setref(x, -(deref(x),1));\n                              (even 888)\n                            end\n   in begin setref(x,13); (odd 888) end',
    },
    {
      title: 'Lecture 18: a reference to a reference',
      source: 'let x = newref(newref(0))\nin begin\n     setref(deref(x), 11);\n     deref(deref(x))\n   end',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
