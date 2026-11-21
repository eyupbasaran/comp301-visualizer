import { describe, expect, it } from 'vitest';
import { changedCount, chunks, commentStart, diffLines } from '../../src/compare/diff';

describe('diffLines', () => {
  it('finds no change in the same text', () => {
    expect(changedCount(diffLines('a\nb\nc\n', 'a\nb\nc\n'))).toBe(0);
  });

  it('finds one insertion and one deletion', () => {
    const d = diffLines('a\nb\nc', 'a\nc\nd');
    expect(d.rows.map((r) => r.kind)).toEqual(['same', 'del', 'same', 'add']);
  });

  it('ignores trailing whitespace', () => {
    expect(changedCount(diffLines('a  \nb', 'a\nb\t'))).toBe(0);
  });

  it('ignores comments and indentation, in Scheme and TS', () => {
    expect(changedCount(diffLines('(f x) ; old\n  (g y)', '(f x)   ; new\n(g y)'))).toBe(0);
    expect(changedCount(diffLines('f(x); // old\n/** doc */\n * more', 'f(x);', 'ts'))).toBe(0);
  });

  it('shows a comment on one side only as a quiet row, not a change', () => {
    const d = diffLines('a\nb', 'a\n;; contract\n\nb');
    expect(d.rows.map((r) => r.kind)).toEqual(['same', 'add', 'add', 'same']);
    expect(changedCount(d)).toBe(0);
  });

  it('handles a file on one side only', () => {
    expect(diffLines('', 'x\ny').rows.map((r) => r.kind)).toEqual(['add', 'add']);
  });
});

describe('commentStart', () => {
  it('skips strings and character literals', () => {
    expect(commentStart('("begin" expression (arbno ";" expression) "end") ; x', 'scheme')).toBe(50);
    expect(commentStart('(char=? c #\\;)', 'scheme')).toBe(-1);
    expect(commentStart("const u = 'http://x'; // y", 'ts')).toBe(22);
  });
});

describe('chunks', () => {
  it('folds a comment-only change with the unchanged lines around it', () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const b = [...a];
    b.splice(10, 0, '; only a comment');
    expect(chunks(diffLines(a.join('\n'), b.join('\n'))).map((x) => x.kind)).toEqual(['fold']);
  });

  it('folds long unchanged runs, keeping 3 lines of context', () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const b = [...a];
    b[10] = 'changed';
    const c = chunks(diffLines(a.join('\n'), b.join('\n')));
    expect(c.map((x) => [x.kind, x.rows.length])).toEqual([
      ['fold', 7],
      ['rows', 8],
      ['fold', 6],
    ]);
  });

  it('never folds a run of one line', () => {
    const c = chunks(diffLines('x\na\nb\nc\nd\ne\nf\ng\ny', 'X\na\nb\nc\nd\ne\nf\ng\nY'));
    expect(c.every((x) => x.kind === 'rows')).toBe(true);
  });
});
