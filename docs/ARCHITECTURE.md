# Architecture

## Flow

```
source ──parse──▶ AST ──run──▶ Trace ──stateAt(trace, position)──▶ panels
         grammar        interpreter + Recorder
```

- Interpreters only write the trace. Panels only read it. Neither knows about the other.
- Each language is its own folder, ported from its official EOPL3 folder ([mwand/eopl3](https://github.com/mwand/eopl3)): same variant names, same field names, same evaluation order, same error messages. When the slides and the official code disagree, the code wins.
- Numbers are `bigint`, because Racket integers never overflow.

## Steps

- Every `value-of` call is one step.
- In CPS and TRAMPOLINED, every `value-of/k` call and every `apply-cont` call is one step.
- Nothing else is a step. The value a call returns is stored on that call's step (`result`) and shown next to its expression.
- The slider has `steps.length + 1` positions: position `p` shows step `p`, the last position shows the end of the run.
- Checks: `-(-(x,3), -(v,i))` is 7 steps in LET; T8 (`double 6`) is 68 steps in LETREC.

## The trace (`src/core/trace.ts`)

- `steps`: `kind` (`value-of`, `value-of/k`, `apply-cont`), `exp`, `env`, `cont`, `result`, plus:
  - `parent`, `depth`: the `value-of` call this one runs inside (the control context)
  - `last`: the last step inside this call
  - `eventIndex`: how many store events happened before the step
  - `idCount`: objects with a larger id were made after the step started
- `events`: the store log (`newref`, `deref`, `setref`). The store at any position is rebuilt from it.
- `outcome`: `value`, `error` (an `eopl:error`, worded as DrRacket prints it), `limit` (step or depth limit), or `crash` (our bug).
- `openSteps`: the `value-of` calls that never returned, i.e. where an error happened.
- Env frames, procedures, thunks and continuations are immutable and carry an `id`, so a step can keep a pointer to them and panels can draw shared objects once.
- `stateAt(trace, position)` gives a panel everything for one position: the step, the store, what changed, the running calls.

## Folders

- `src/core/`: shared by all languages
  - `ast.ts`: node shape, `fieldsOf`, `astToSExp`
  - `scanner.ts`, `grammar.ts`: SLLGEN-style scanner and LL(1) parser
  - `values.ts`: ExpVal, procedures, thunks, extractors
  - `env.ts`, `store.ts`: environment frames, the store
  - `trace.ts`: Step, Trace, Recorder
  - `state.ts`: `stateAt`
  - `print.ts`: text forms (`(num-val 3)`, env->list)
  - `language.ts`: `LanguageModule`, `runSource`
- `src/languages/<id>/`: one folder per language
  - `lang.ts`: the grammar (from `lang.scm`) and the AST types
  - `environments.ts`: `init-env`, `apply-env`
  - `interp.ts`: `value-of`
  - `index.ts`: the `LanguageModule`
- `src/languages/index.ts`: the picker's list
- `src/ui/`: the web page (React). It only reads the trace.
- `tests/`: Vitest

## What the UI gives a new language for free

- Once a language's `module` is set, it appears in the picker with its examples.
- Without any UI work it gets: the editor highlight, the step box, the Environment diagram, Trace, AST, and Contour (for `let-exp`, `proc-exp` and `letrec-exp`).
- A one-line explanation per step exists for the LET and PROC expressions (`explain` in `src/ui/format.ts`). New expression kinds show just the equation until a sentence is added there.
- The Store and Continuation panels, and anything a language shows in its own way (thunks, pairs, the nameless translation), are UI work: say what your language needs.

## Adding a language

1. Copy `src/languages/let/` to `src/languages/<id>/`.
2. `lang.ts`: port `the-grammar` line by line. Field names come from the `cases` clauses in the official `interp.scm`, in camelCase (`p-name` → `pName`). Write the AST types to match.
3. `environments.ts`, `interp.ts`: port the official files. Wrap every `value-of` in `rec.valueOf(...)` / `rec.returns(...)`. Use `rec.store` for the store and `rec.extendEnv(...)`, `rec.procedure(...)`, etc. for anything with an id.
4. Set `module` in `src/languages/index.ts`.
5. Tests run as soon as the module is set: the official list in `tests/official/<id>.json` and this language's cases in `tests/lecture-cases.json`.
   - Every language with an official folder already has its list (converted with `scripts/official-tests.mjs`). CALL-BY-NAME and TRAMPOLINED have no official folder.
6. Add examples to the module.

## Lecture cases (`tests/lecture-cases.json`)

- One entry per program and language: `id`, `lang`, `program`, `from` (lecture), and what to check: `value`, `steps`, `error`, `diverges`, `translation`.
- `computed: true` means the value is not on the slides; it was worked out by hand and still has to be checked against real Racket.

## Commands

```
npm install
npm run dev        # dev server
npm test           # all tests
npm run typecheck
npm run build
```

Every merge to `main` runs the tests and deploys the site to GitHub Pages (`.github/workflows/deploy.yml`).
