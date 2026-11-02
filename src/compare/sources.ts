// The code shown in Compare: the official EOPL3 Scheme (vendored in src/eopl3, see src/eopl3/SOURCE)
// when both languages have an official folder, otherwise our TypeScript ports for both sides.

import type { LanguageModule } from '../core/language';

const scheme = import.meta.glob<string>('../eopl3/**/*.scm', { query: '?raw', import: 'default', eager: true });
const ports = import.meta.glob<string>('../languages/*/*.ts', { query: '?raw', import: 'default', eager: true });

export interface SourceFile {
  readonly name: string;
  /** Missing when the file exists on one side only. */
  readonly a: string | undefined;
  readonly b: string | undefined;
}

export interface Sources {
  readonly kind: 'scheme' | 'ts';
  readonly files: readonly SourceFile[];
}

const ORDER = ['lang', 'interp', 'translator', 'data-structures', 'continuations', 'environments', 'store', 'pairvals', 'pairval1', 'pairval2'];

function filesIn(all: Record<string, string>, dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, text] of Object.entries(all)) {
    if (path.startsWith(dir) && !path.slice(dir.length).includes('/')) out.set(path.slice(dir.length), text);
  }
  return out;
}

export function schemeFiles(module: LanguageModule): Map<string, string> {
  return filesIn(scheme, `../eopl3/${module.origin}/`);
}

function portFiles(module: LanguageModule): Map<string, string> {
  const files = filesIn(ports, `../languages/${module.id}/`);
  files.delete('index.ts');
  return files;
}

function rank(name: string): number {
  const i = ORDER.indexOf(name.replace(/\.(scm|ts)$/, ''));
  return i === -1 ? ORDER.length : i;
}

export function sourcesFor(from: LanguageModule, to: LanguageModule): Sources {
  let a = schemeFiles(from);
  let b = schemeFiles(to);
  const kind = a.size > 0 && b.size > 0 ? 'scheme' : 'ts';
  // Two implementations in one folder (pairval1, pairval2): only their own files differ.
  if (kind === 'scheme' && from.origin === to.origin && from.variant && to.variant) {
    const [x, y] = [from.variant.id, to.variant.id];
    return { kind, files: [{ name: `${x}.scm → ${y}.scm`, a: a.get(`${x}.scm`), b: b.get(`${y}.scm`) }] };
  }
  if (kind === 'ts') {
    a = portFiles(from);
    b = portFiles(to);
  }
  const names = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return { kind, files: names.map((name) => ({ name, a: a.get(name), b: b.get(name) })) };
}
