import type { Program } from '../../core/ast';
import type { LanguageModule } from '../../core/language';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

export const callByReferenceLanguage: LanguageModule = {
  id: 'call-by-reference',
  name: 'CALL-BY-REFERENCE',
  origin: 'chapter4/call-by-reference',
  grammar: theGrammar,
  panels: ['ast', 'trace', 'contour', 'env', 'store'],
  examples: [
    {
      title: 'Lecture 21: set reaches the caller',
      source: 'let p = proc (x) set x = 4\nin let a = 3\n   in begin\n        (p a);\n        a\n      end',
    },
    {
      title: 'Lecture 21: swap',
      source:
        'let swap = proc (x)\n             proc (y)\n               let temp = x\n               in begin\n                    set x = y;\n                    set y = temp\n                  end\nin let a = 33\n   in let b = 44\n      in begin\n           ((swap a) b);\n           -(a,b)\n         end',
    },
    {
      title: 'Lecture 21: aliasing',
      source: 'let b = 3\nin let p = proc (x)\n             proc (y)\n               begin\n                 set x = 4;\n                 y\n               end\n   in ((p b) b)',
    },
    {
      title: 'Lecture 21: passed on twice',
      source: 'let f = proc (x) set x = 44\nin let g = proc (y) (f y)\n   in let z = 55\n      in begin\n           (g z);\n           z\n         end',
    },
  ],
  parse: (source) => theGrammar.parse(source),
  run: (program, options) => valueOfProgram(program as Program<AProgram>, options),
};
