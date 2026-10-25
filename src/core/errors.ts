/**
 * An error the EOPL interpreter itself reports with eopl:error.
 * DrRacket prints it as "where: message", e.g. "apply-env: No binding for foo".
 */
export class EoplError extends Error {
  constructor(
    readonly where: string,
    readonly detail: string,
  ) {
    super(`${where}: ${detail}`);
    this.name = 'EoplError';
  }
}

/** A scanning or parsing error, with a position for the editor. */
export class ParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(
    readonly detail: string,
    readonly source: string,
    readonly from: number,
    readonly to: number = from,
  ) {
    const { line, column } = lineColAt(source, from);
    super(`Line ${line}, column ${column}: ${detail}`);
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
  }
}

/** 1-based line and column of a source offset. */
export function lineColAt(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
