// node scripts/racket-check/prepare.mjs
//
// Copies the official interpreters (a clone of mwand/eopl3 in scripts/racket-check/.eopl3,
// or the folder in $EOPL3) to scripts/racket-check/langs/<name>, and patches the copies so
// every step calls step! from steps.rkt with what the step sees:
//   (value-of exp env)          -> (step! 'value-of exp env)
//   (value-of/k exp env cont)   -> (step! 'value-of/k exp env cont)
//   (apply-cont cont val)       -> (step! 'apply-cont cont val)
// Nothing else in the official code changes, except where our language is defined
// as a variation of an official folder (CALL-BY-NAME, and the pairval1 languages).

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const official = process.env.EOPL3 ?? join(here, '.eopl3');
const langs = join(here, 'langs');

if (!existsSync(join(official, 'chapter3'))) {
  console.error(`No official code in ${official}. Clone it first (the commit in src/eopl3/SOURCE):
  git clone https://github.com/mwand/eopl3.git scripts/racket-check/.eopl3`);
  process.exit(1);
}

// Our language -> its official folder. pairval1: pairvals.scm picks pairval1.scm (the official
// folders pick pairval2.scm). noMemo: call-by-need without the memoizing setref!, which is how
// the book defines call-by-name (section 4.5.2).
export const COPIES = {
  let: { from: 'chapter3/let-lang' },
  proc: { from: 'chapter3/proc-lang/ds-rep' },
  letrec: { from: 'chapter3/letrec-lang' },
  nameless: { from: 'chapter3/lexaddr-lang' },
  'explicit-refs': { from: 'chapter4/explicit-refs' },
  'implicit-refs': { from: 'chapter4/implicit-refs' },
  'mutable-pairs': { from: 'chapter4/mutable-pairs', pairval1: true },
  'mutable-pairs-pairval2': { from: 'chapter4/mutable-pairs' },
  'call-by-reference': { from: 'chapter4/call-by-reference', pairval1: true },
  'call-by-need': { from: 'chapter4/call-by-need', pairval1: true },
  'call-by-name': { from: 'chapter4/call-by-need', pairval1: true, noMemo: true },
  cps: { from: 'chapter5/letrec-lang', cps: true },
};

function replaceOnce(text, pattern, replacement, what) {
  const matches = text.match(new RegExp(pattern.source, 'g')) ?? [];
  if (matches.length !== 1) throw new Error(`${what}: expected 1 match, found ${matches.length}`);
  return text.replace(pattern, replacement);
}

// (define name (lambda (a b ...) -> the same, then (step! 'name a b ...)
function hook(text, name, what) {
  const pattern = new RegExp(`\\(define ${name.replace('/', '\\/')}\\s+\\(lambda \\(([^)]*)\\)`);
  return replaceOnce(text, pattern, (m, params) => `${m} (step! '${name} ${params.trim().split(/\s+/).join(' ')})`, what);
}

rmSync(langs, { recursive: true, force: true });
for (const [name, c] of Object.entries(COPIES)) {
  const dir = join(langs, name);
  cpSync(join(official, c.from), dir, { recursive: true, filter: (src) => !src.includes('compiled') });

  const interpFile = join(dir, 'interp.scm');
  let interp = readFileSync(interpFile, 'utf8');
  interp = replaceOnce(interp, /\(module interp \(lib "eopl\.ss" "eopl"\)/, '$&\n  (require "../../steps.rkt")', `${name} module line`);
  if (c.cps) {
    interp = hook(interp, 'value-of/k', `${name} value-of/k`);
    interp = hook(interp, 'apply-cont', `${name} apply-cont`);
  } else {
    interp = hook(interp, 'value-of', `${name} value-of`);
  }
  if (c.noMemo) interp = replaceOnce(interp, /\(setref! ref1 v1\)/, '', `${name} memo`);
  writeFileSync(interpFile, interp);

  if (c.pairval1) {
    const pv = join(dir, 'pairvals.scm');
    const text = readFileSync(pv, 'utf8');
    if ((text.match(/pairval2\.scm/g) ?? []).length !== 2) throw new Error(`${name}: unexpected pairvals.scm`);
    writeFileSync(pv, text.replace(/pairval2\.scm/g, 'pairval1.scm'));
  }
  console.log(`${name.padEnd(24)} <- ${c.from}${c.pairval1 ? ' (pairval1)' : ''}${c.noMemo ? ' (no memoization)' : ''}`);
}
