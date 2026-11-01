import type { Program } from '../../core/ast';
import type { Example, LanguageModule } from '../../core/language';
import type { PairVal } from '../../core/pairvals';
import { valueOfProgram } from './interp';
import { theGrammar, type AProgram } from './lang';

const examples: readonly Example[] = [
  {
    title: 'Book §4.4: a shared pair',
    source:
      'let glo = newpair(11,22)\nin let f = proc (loc)\n            begin\n              setright loc = left(loc);\n              setleft glo = 99;\n              -(left(loc),right(loc))\n            end\n   in (f glo)',
  },
  {
    title: 'A counter in a pair',
    source:
      'let g = let count = newpair(0,0)\n        in proc (dummy)\n             begin\n               setleft count = -(left(count), -1);\n               left(count)\n             end\nin -((g 22), (g 22))',
  },
  { title: 'setleft and setright', source: 'let p = newpair(22,33)\nin begin\n     setleft p = 77;\n     setright p = left(p);\n     -(left(p), right(p))\n   end' },
];

// The same language with the pairs of pairval1.scm or pairval2.scm.
function mutablePairs(pairval: PairVal, description: string): LanguageModule {
  return {
    id: 'mutable-pairs',
    name: 'MUTABLE-PAIRS',
    origin: 'chapter4/mutable-pairs',
    variant: { id: pairval, description },
    grammar: theGrammar,
    panels: ['ast', 'trace', 'contour', 'env', 'store'],
    examples,
    parse: (source) => theGrammar.parse(source),
    run: (program, options) => valueOfProgram(program as Program<AProgram>, options, pairval),
  };
}

// Described the way the comment at the top of each file does.
export const mutablePairsLanguage = mutablePairs('pairval1', 'pairval1.scm: a pair is two references, (a-pair left-loc right-loc).');
export const mutablePairsPairval2Language = mutablePairs(
  'pairval2',
  'pairval2.scm: a pair is two consecutive locations, represented as a reference to the first.',
);
