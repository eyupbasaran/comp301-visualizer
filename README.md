# Schema

Step through the EOPL languages of COMP301 and see the environment, store and continuation at each step.

Languages, and the official EOPL3 folder each one is translated from:

- LET: `chapter3/let-lang`
- PROC: `chapter3/proc-lang/ds-rep`
- LETREC: `chapter3/letrec-lang`
- NAMELESS: `chapter3/lexaddr-lang`
- EXPLICIT-REFS: `chapter4/explicit-refs`
- IMPLICIT-REFS: `chapter4/implicit-refs`
- MUTABLE-PAIRS: `chapter4/mutable-pairs`, with the pairs of `pairval1.scm` (the representation the lectures teach first) or `pairval2.scm` (consecutive locations), picked next to the language
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

## Compare

The **Compare** tab in the top bar compares two languages from a curated list: each step of the course (PROC from LET, NAMELESS from PROC, …), the parameter-passing family (CALL-BY-VALUE, which is IMPLICIT-REFS, against CALL-BY-REFERENCE, CALL-BY-NAME and CALL-BY-NEED), and the two pair representations. For each it shows hand-written notes, the grammar productions added or removed, and the official code side by side, with comments dimmed and never counted as a change. Where one program shows the difference (in its value, or in a number such as thunks evaluated or the size of the control context), it is run in both; otherwise the same task is written once in each language. The official `.scm` files are vendored in `src/eopl3/` (pinned in `src/eopl3/SOURCE`). CALL-BY-NAME and TRAMPOLINED have no official folder, so pairs with them compare our TypeScript ports.

## Credit

The interpreters are translated from the code of *Essentials of Programming Languages*, 3rd ed., by Daniel P. Friedman and Mitchell Wand, licensed under [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/).
