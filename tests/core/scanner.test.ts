import { describe, expect, it } from 'vitest';
import { ParseError } from '../../src/core/errors';
import { scan } from '../../src/core/scanner';

const LITERALS = new Set(['-', '(', ',', ')', 'zero?', 'if', 'then', 'else', 'let', '=', 'in']);
const tokens = (source: string) => scan(source, LITERALS).map((t) => `${t.kind} ${t.text}`.trim());

describe('scanner', () => {
  it('reads -5 as one number but -( as the minus literal', () => {
    expect(tokens('-(-5,x)')).toEqual(['literal -', 'literal (', 'number -5', 'literal ,', 'identifier x', 'literal )', 'eof']);
  });

  it('reads a minus followed by a space as the literal', () => {
    expect(tokens('- 5')).toEqual(['literal -', 'number 5', 'eof']);
  });

  it('lets identifiers contain digits, _, - and ?', () => {
    expect(tokens('x-1 even? a_b c2')).toEqual(['identifier x-1', 'identifier even?', 'identifier a_b', 'identifier c2', 'eof']);
  });

  it('reads keywords as literals, and longer names as identifiers', () => {
    expect(tokens('let letx zero? zero?x in')).toEqual([
      'literal let',
      'identifier letx',
      'literal zero?',
      'identifier zero?x',
      'literal in',
      'eof',
    ]);
  });

  it('splits a number from a name that follows it', () => {
    expect(tokens('5x')).toEqual(['number 5', 'identifier x', 'eof']);
  });

  it('accepts non-ASCII letters, as Racket does', () => {
    expect(tokens('ağaç')).toEqual(['identifier ağaç', 'eof']);
  });

  it('skips % comments to the end of the line', () => {
    expect(tokens('x % a comment -(\ny')).toEqual(['identifier x', 'identifier y', 'eof']);
  });

  it('keeps numbers exact beyond 2^53', () => {
    const [token] = scan('123456789012345678901234567890', LITERALS);
    expect(token).toMatchObject({ kind: 'number', value: 123456789012345678901234567890n });
  });

  it('records offsets', () => {
    const [, , x] = scan('-( x,1)', LITERALS);
    expect(x).toMatchObject({ kind: 'identifier', from: 3, to: 4 });
  });

  it('reports an unexpected character with its line and column', () => {
    try {
      scan('-(x,\n  #)', LITERALS);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e).toMatchObject({ line: 2, column: 3, message: "Line 2, column 3: Unexpected character '#'" });
    }
  });
});
