// Converts an official EOPL3 tests.scm into the JSON that tests/official.test.ts runs.
//
//   node scripts/official-tests.mjs path/to/tests.scm chapter3/let-lang > tests/official/let.json
//
// Expected values: a number means (num-val n), #t/#f mean (bool-val ...),
// and `error` means the run must end in an eopl:error, as in top.scm.

import { readFileSync } from 'node:fs';

const [file, origin] = process.argv.slice(2);
if (!file || !origin) {
  console.error('usage: node scripts/official-tests.mjs <tests.scm> <origin, e.g. chapter3/let-lang>');
  process.exit(1);
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) i++;
    else if (c === ';') while (i < text.length && text[i] !== '\n') i++;
    else if (c === '(' || c === ')' || c === "'") tokens.push(text[i++]);
    else if (c === '"') {
      let s = '';
      for (i++; text[i] !== '"'; i++) s += text[i] === '\\' ? text[++i] : text[i];
      i++;
      tokens.push({ string: s });
    } else {
      let j = i;
      while (j < text.length && !/[\s()";']/.test(text[j])) j++;
      tokens.push({ atom: text.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

function read(tokens) {
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')') list.push(read(tokens));
    tokens.shift();
    return list;
  }
  if (token === "'") return [{ atom: 'quote' }, read(tokens)];
  return token;
}

function expected(datum) {
  if (Array.isArray(datum)) return datum.map(expected);
  if (datum.string !== undefined) return datum.string;
  const atom = datum.atom;
  if (/^-?\d+$/.test(atom)) return Number(atom);
  if (atom === '#t') return true;
  if (atom === '#f') return false;
  return atom;
}

function findTestList(datum) {
  if (!Array.isArray(datum)) return null;
  if (datum[0]?.atom === 'define' && datum[1]?.atom === 'test-list') return datum[2][1];
  for (const sub of datum) {
    const found = findTestList(sub);
    if (found) return found;
  }
  return null;
}

const tokens = tokenize(readFileSync(file, 'utf8'));
const forms = [];
while (tokens.length) forms.push(read(tokens));
const list = forms.map(findTestList).find(Boolean);
if (!list) throw new Error(`no (define test-list '(...)) in ${file}`);

const tests = list.map(([name, program, answer]) => ({
  name: name.atom,
  program: program.string,
  expected: expected(answer),
}));
console.log(JSON.stringify({ origin: `${origin}/tests.scm`, tests }, null, 2));
