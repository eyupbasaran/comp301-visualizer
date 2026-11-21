// Every known program, run by the official interpreters in Racket and by ours, compared
// step by step: the outcome, the step count, and at each step the expression, environment,
// store and continuation. Needs Racket and the prepared official code, so it runs only with
// RACKET_CHECK=1: `npm run racket-check` (see scripts/racket-check).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPARISONS } from '../../src/compare/comparisons';
import { runSource, type LanguageModule } from '../../src/core/language';
import { stateAt } from '../../src/core/state';
import type { Trace } from '../../src/core/trace';
import { LANGUAGES } from '../../src/languages';
import { canonCont, canonEnv, canonExp, canonStore, canonVal, type EnvRep } from './canon';

const DIR = 'scripts/racket-check';
const OUT = join(DIR, 'out');
const RACKET = process.env.RACKET ?? (process.platform === 'win32' ? 'C:\\Program Files\\Racket\\Racket.exe' : 'racket');
const FULL = !!process.env.RACKET_CHECK_FULL;
/** Steps whose state is compared; must match `kept` in steps.rkt. */
const KEPT = 2000;

interface Target {
  readonly label: string;
  readonly module: LanguageModule;
  /** The folder prepare.mjs made from the official code. TRAMPOLINED has none; it is checked against CPS. */
  readonly racket: string;
  readonly rep: EnvRep;
}

const targets: Target[] = LANGUAGES.flatMap((entry) =>
  (entry.variants ? entry.variants.modules : [entry.module!]).map((module) => {
    const label = module.variant ? `${module.id} (${module.variant.id})` : module.id;
    const racket = module.variant?.id === 'pairval2' ? 'mutable-pairs-pairval2' : module.id === 'trampolined' ? 'cps' : module.id;
    const rep: EnvRep = module.id === 'let' || module.id === 'proc' ? 'list' : module.id === 'nameless' ? 'nameless' : 'datatype';
    return { label, module, racket, rep };
  }),
);

function allPrograms(): string[] {
  const programs = new Set<string>();
  for (const t of targets) for (const ex of t.module.examples) programs.add(ex.source);
  for (const f of readdirSync('tests/official')) {
    for (const test of JSON.parse(readFileSync(`tests/official/${f}`, 'utf8')).tests) programs.add(test.program);
  }
  for (const c of JSON.parse(readFileSync('tests/lecture-cases.json', 'utf8'))) programs.add(c.program);
  for (const c of COMPARISONS) {
    for (const ex of c.runBoth ?? []) programs.add(ex.source);
    for (const ex of c.twoWays ?? []) [ex.from, ex.to].forEach((p) => programs.add(p));
  }
  return [...programs];
}

const part = (text: string) => (FULL ? text : createHash('sha1').update(text, 'utf8').digest('hex'));

/** What each step saw, as steps.rkt records it. */
function seen(trace: Trace, rep: EnvRep, hasStore: boolean): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < Math.min(trace.steps.length, KEPT); i++) {
    const step = trace.steps[i];
    const store = canonStore(hasStore ? stateAt(trace, i).store : null, rep);
    if (step.kind === 'value-of') out.push([step.kind, canonExp(step.exp), canonEnv(step.env, rep), store].map((t, j) => (j ? part(t) : t)));
    else if (step.kind === 'value-of/k')
      out.push([step.kind, canonExp(step.exp), canonEnv(step.env, rep), canonCont(step.cont, rep), store].map((t, j) => (j ? part(t) : t)));
    else out.push([step.kind, canonCont(step.cont, rep), canonVal(step.val, rep), store].map((t, j) => (j ? part(t) : t)));
  }
  return out;
}

interface RacketResult {
  key: string;
  kind: 'value' | 'error' | 'limit';
  value?: string;
  message?: string;
  steps: number;
  seen: string[][];
}

describe.skipIf(process.env.RACKET_CHECK !== '1')('the official interpreters, step by step', () => {
  it('agree with ours on every program, at every step', () => {
    if (!existsSync(join(DIR, 'langs'))) throw new Error('Run node scripts/racket-check/prepare.mjs first.');
    mkdirSync(OUT, { recursive: true });

    const runs: { key: string; target: Target; source: string }[] = [];
    for (const target of targets) {
      for (const source of allPrograms()) {
        try {
          target.module.parse(source);
        } catch {
          continue; // the parsers are compared separately
        }
        runs.push({ key: `${target.label}\t${source}`, target, source });
      }
    }
    writeFileSync(join(OUT, 'programs.json'), JSON.stringify(runs.map((r) => ({ key: r.key, lang: r.target.racket, program: r.source }))));
    execFileSync(RACKET, [join(DIR, 'run.rkt'), join(OUT, 'programs.json'), join(OUT, 'racket.json')], {
      stdio: 'inherit',
      timeout: 1_800_000,
      env: process.env,
    });
    const racket = new Map((JSON.parse(readFileSync(join(OUT, 'racket.json'), 'utf8')) as RacketResult[]).map((r) => [r.key, r]));

    const problems: string[] = [];
    const summary: Record<string, { runs: number; same: number }> = {};
    for (const { key, target, source } of runs) {
      const s = (summary[target.label] ??= { runs: 0, same: 0 });
      s.runs++;
      const r = racket.get(key)!;
      const result = runSource(target.module, source);
      if (!result.ok) throw new Error(`${key} stopped parsing`);
      const { trace } = result;
      const ours = trace.outcome;
      const found: string[] = [];

      if (ours.kind === 'crash') found.push(`ours crashed: ${ours.message}`);
      else if (ours.kind !== 'limit' && r.kind !== 'limit') {
        if (ours.kind !== r.kind) found.push(`outcome: ours ${ours.kind}, Racket ${r.kind} ${r.value ?? r.message ?? ''}`);
        else if (ours.kind === 'value' && canonVal(ours.value, target.rep) !== r.value) found.push(`value: ours ${canonVal(ours.value, target.rep)}, Racket ${r.value}`);
        else if (ours.kind === 'error' && ours.message !== r.message) found.push(`error: ours "${ours.message}", Racket "${r.message}"`);
        if (trace.steps.length !== r.steps) found.push(`steps: ours ${trace.steps.length}, Racket ${r.steps}`);
      }
      // Our depth limit can stop a run Racket finishes: compare the steps both made.
      const mine = seen(trace, target.rep, target.module.panels.includes('store'));
      const both = Math.min(mine.length, r.seen.length);
      for (let i = 0; i < both; i++) {
        const fields = mine[i].map((v, j) => (v === r.seen[i][j] ? null : j)).filter((j) => j !== null);
        if (fields.length) {
          found.push(`step ${i} (${mine[i][0]}) differs in ${fields.map((j) => ['kind', ...(mine[i][0] === 'apply-cont' ? ['cont', 'val'] : mine[i][0] === 'value-of/k' ? ['exp', 'env', 'cont'] : ['exp', 'env']), 'store'][j!]).join(', ')}`);
          break;
        }
      }
      if (found.length) problems.push(`${target.label}: ${JSON.stringify(source)}\n    ${found.join('\n    ')}`);
      else s.same++;
    }

    const report = [
      ...Object.entries(summary).map(([label, s]) => `${label.padEnd(30)} ${s.same}/${s.runs} the same`),
      `${problems.length} runs differ`,
      ...problems,
    ].join('\n');
    writeFileSync(join(OUT, 'report.txt'), report + '\n');
    expect(problems, report).toEqual([]);
  }, 1_800_000);
});
