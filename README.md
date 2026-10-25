# COMP301 Visualizer

Languages, and the official EOPL3 folder each one is translated from:

- LET: `chapter3/let-lang`
- PROC: `chapter3/proc-lang/ds-rep`
- LETREC: `chapter3/letrec-lang`
- NAMELESS: `chapter3/lexaddr-lang`
- EXPLICIT-REFS: `chapter4/explicit-refs`
- IMPLICIT-REFS: `chapter4/implicit-refs`
- MUTABLE-PAIRS: `chapter4/mutable-pairs`
- CALL-BY-REFERENCE: `chapter4/call-by-reference`
- CALL-BY-NAME: no official folder (book section 4.5.2: call-by-need without memoization)
- CALL-BY-NEED: `chapter4/call-by-need`
- CPS: `chapter5/letrec-lang`
- TRAMPOLINED: no official folder (book section 5.2)

## How a language is made

Each interpreter is a line-by-line TypeScript translation of the official EOPL3 code, [mwand/eopl3](https://github.com/mwand/eopl3), the code the course uses. PROC as an example:

| `chapter3/proc-lang/ds-rep/` | ours |
|---|---|
| `lang.scm` | `src/languages/proc/lang.ts` |
| `environments.scm` | `src/languages/proc/environments.ts` |
| `interp.scm` | `src/languages/proc/interp.ts` |
| `tests.scm` | `tests/official/proc.json` (converted; runs automatically) |

- Keep the same `cases` clauses, evaluation order, error messages and init-env. Don't simplify or "fix" anything.
- The only additions are the recording calls: `rec.valueOf` / `rec.returns` around each `value-of`, and `rec.*` for env frames, closures and the store.
- Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Credit

The interpreters are translated from the code of *Essentials of Programming Languages*, 3rd ed., by Daniel P. Friedman and Mitchell Wand, licensed under [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/).
