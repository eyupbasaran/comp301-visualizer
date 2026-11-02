// Line diff of two files (LCS). Inputs are a few hundred lines at most, so O(n·m) is fine.
// Only code is compared: comments and whitespace are ignored, and a line that is only a
// comment (or blank) is never a change, even when it is on one side only (`quiet`).

export type Syntax = 'scheme' | 'ts';

export type Row =
  | { readonly kind: 'same'; readonly a: number; readonly b: number }
  | { readonly kind: 'del'; readonly a: number; readonly quiet: boolean }
  | { readonly kind: 'add'; readonly b: number; readonly quiet: boolean };

export interface LineDiff {
  readonly a: readonly string[];
  readonly b: readonly string[];
  /** Line indexes (0-based) into `a` and `b`. */
  readonly rows: readonly Row[];
}

export function lines(text: string): string[] {
  const all = text.split('\n');
  if (all.at(-1) === '') all.pop();
  return all;
}

/** Where the comment in `line` starts, or -1. Strings are skipped: the ";" in (arbno ";" expression) is code. */
export function commentStart(line: string, syntax: Syntax): number {
  if (syntax === 'ts' && /^\s*(\/\*|\*)/.test(line)) return line.search(/\S/);
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (syntax === 'scheme') {
      if (c === '#' && line[i + 1] === '\\') i += 2;
      else if (c === '"') quote = c;
      else if (c === ';') return i;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '/' && line[i + 1] === '/') return i;
  }
  return -1;
}

/** The code of a line, whitespace collapsed: what the diff compares. '' for a comment or blank line. */
function code(line: string, syntax: Syntax): string {
  const start = commentStart(line, syntax);
  return (start === -1 ? line : line.slice(0, start)).replace(/\s+/g, ' ').trim();
}

export function diffLines(textA: string, textB: string, syntax: Syntax = 'scheme'): LineDiff {
  const a = lines(textA);
  const b = lines(textB);
  const ka = a.map((l) => code(l, syntax));
  const kb = b.map((l) => code(l, syntax));
  // lcs[i][j]: length of the LCS of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && ka[i] === kb[j]) rows.push({ kind: 'same', a: i++, b: j++ });
    else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) rows.push({ kind: 'add', b: j, quiet: kb[j++] === '' });
    else rows.push({ kind: 'del', a: i, quiet: ka[i++] === '' });
  }
  return { a, b, rows };
}

/** An added or deleted line of code. */
export function isChange(row: Row): boolean {
  return row.kind !== 'same' && !row.quiet;
}

export function changedCount(diff: LineDiff): number {
  return diff.rows.filter(isChange).length;
}

/** The text of every added or deleted line of code. */
export function changedLines(diff: LineDiff): string[] {
  return diff.rows.flatMap((r) => (!isChange(r) ? [] : r.kind === 'add' ? [diff.b[r.b]] : r.kind === 'del' ? [diff.a[r.a]] : []));
}

/** Runs without a change longer than 2·context fold, leaving `context` lines on each side of a change. */
export type Chunk = { readonly kind: 'rows'; readonly rows: readonly Row[] } | { readonly kind: 'fold'; readonly rows: readonly Row[] };

export function chunks(diff: LineDiff, context = 3): Chunk[] {
  const out: Chunk[] = [];
  const rows = diff.rows;
  let start = 0;
  const push = (kind: Chunk['kind'], from: number, to: number) => {
    if (to <= from) return;
    const last = out.at(-1);
    if (kind === 'rows' && last?.kind === 'rows') out[out.length - 1] = { kind, rows: [...last.rows, ...rows.slice(from, to)] };
    else out.push({ kind, rows: rows.slice(from, to) });
  };
  while (start < rows.length) {
    if (isChange(rows[start])) {
      let end = start;
      while (end < rows.length && isChange(rows[end])) end++;
      push('rows', start, end);
      start = end;
      continue;
    }
    let end = start;
    while (end < rows.length && !isChange(rows[end])) end++;
    const keepBefore = start === 0 ? 0 : context;
    const keepAfter = end === rows.length ? 0 : context;
    if (end - start > keepBefore + keepAfter + 1) {
      push('rows', start, start + keepBefore);
      push('fold', start + keepBefore, end - keepAfter);
      push('rows', end - keepAfter, end);
    } else push('rows', start, end);
    start = end;
  }
  return out;
}
