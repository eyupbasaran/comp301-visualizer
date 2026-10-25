// The scanner every language in chapters 3-5 shares (the-lexical-spec in lang.scm):
//
//   (whitespace (whitespace) skip)
//   (comment ("%" (arbno (not #\newline))) skip)
//   (identifier (letter (arbno (or letter digit "_" "-" "?"))) symbol)
//   (number (digit (arbno digit)) number)
//   (number ("-" digit (arbno digit)) number)
//
// SLLGEN also turns the grammar's literal strings into tokens and takes the
// longest match. So "-5" is one number, but "-(" is the literal "-" and then
// "(". "x-1" is a single identifier. An identifier that equals a literal
// ("let", "zero?") is that keyword, which makes keywords reserved.

import { ParseError } from './errors';

export type Token =
  | { readonly kind: 'identifier'; readonly text: string; readonly from: number; readonly to: number }
  | { readonly kind: 'number'; readonly text: string; readonly value: bigint; readonly from: number; readonly to: number }
  /** A keyword or punctuation string from the grammar. */
  | { readonly kind: 'literal'; readonly text: string; readonly from: number; readonly to: number }
  | { readonly kind: 'eof'; readonly text: ''; readonly from: number; readonly to: number };

const LETTER = /\p{Alphabetic}/u;
const WHITESPACE = /\s/u;

const isLetter = (c: string) => LETTER.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentifierChar = (c: string) => isLetter(c) || isDigit(c) || c === '_' || c === '-' || c === '?';

/** True for literals like "let" and "zero?", which the scanner reads as identifiers first. */
export function isIdentifierShaped(literal: string): boolean {
  return /^\p{Alphabetic}[\p{Alphabetic}0-9_\-?]*$/u.test(literal);
}

/** The character (code point) starting at offset i. */
function charAt(source: string, i: number): string {
  return String.fromCodePoint(source.codePointAt(i)!);
}

function identifierEnd(source: string, i: number): number {
  if (!isLetter(charAt(source, i))) return i;
  let j = i + charAt(source, i).length;
  while (j < source.length) {
    const c = charAt(source, j);
    if (!isIdentifierChar(c)) break;
    j += c.length;
  }
  return j;
}

function numberEnd(source: string, i: number): number {
  let j = i;
  if (source[j] === '-') j++;
  if (!isDigit(source[j] ?? '')) return i;
  while (isDigit(source[j] ?? '')) j++;
  return j;
}

export function scan(source: string, literals: ReadonlySet<string>): Token[] {
  const keywords = new Set([...literals].filter(isIdentifierShaped));
  const punctuation = [...literals].filter((l) => !isIdentifierShaped(l)).sort((a, b) => b.length - a.length);
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const c = charAt(source, i);
    if (WHITESPACE.test(c)) {
      i += c.length;
      continue;
    }
    if (c === '%') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Longest match wins; on a tie the lexical spec's rules come before the grammar's literals.
    const idEnd = identifierEnd(source, i);
    const numEnd = numberEnd(source, i);
    const punct = punctuation.find((p) => source.startsWith(p, i));
    const punctEnd = punct ? i + punct.length : i;

    if (idEnd > i && idEnd >= punctEnd) {
      const text = source.slice(i, idEnd);
      tokens.push({ kind: keywords.has(text) ? 'literal' : 'identifier', text, from: i, to: idEnd });
      i = idEnd;
    } else if (numEnd > i && numEnd >= punctEnd) {
      const text = source.slice(i, numEnd);
      tokens.push({ kind: 'number', text, value: BigInt(text), from: i, to: numEnd });
      i = numEnd;
    } else if (punct) {
      tokens.push({ kind: 'literal', text: punct, from: i, to: punctEnd });
      i = punctEnd;
    } else {
      throw new ParseError(`Unexpected character '${c}'`, source, i, i + c.length);
    }
  }

  tokens.push({ kind: 'eof', text: '', from: source.length, to: source.length });
  return tokens;
}
