# COMP301 Lecture Analysis: Visualizations and Languages

Source: the 26 lecture folders (29 decks, PDFs and Racket files), kept locally in `lectures/` and not in the repo. Every slide was reviewed visually. Language semantics were checked against the official EOPL3 code the course points to ([github.com/mwand/eopl3](https://github.com/mwand/eopl3)).

## Summary

- The second half of the course (Lectures 10–26) is one chain of languages:
  **LET → PROC → LETREC → Nameless (lexical addressing) → EXPLICIT-REFS → IMPLICIT-REFS → MUTABLE-PAIRS → CALL-BY-REFERENCE → CALL-BY-NAME / CALL-BY-NEED → CPS → Trampolined CPS.**
  That is 11 languages or interpreter variants. The first half (Lectures 02–09) is Scheme/Racket.
- The six most important visualizations: **environment diagram, store, value-of step trace, contour diagram, continuation, AST.** Environment and contour drawings are direct quiz questions. Quiz #9: *"Find the value. Draw the contours for the entire expression. Draw the environment diagram at the time of evaluation for the expression in the box."*
- The step slider matches how the course itself explains evaluation: in the instructor's "what we envision" traces, every line is one `value-of` expansion. The sample trace in the CPS lecture is exactly 10 steps: 5 `value-of/k` + 5 `apply-cont`.
- Correctness risks are in §4. Test programs taken from the slides, with expected values, are in §6.

---

## 1. Lecture map

| Lecture | Topic | Source | Language | Drawn or shown in class |
|---|---|---|---|---|
| 01 | Syllabus, E-tutor, "COMP301 For Beginners" | — | — | Section leaders' tip: practice environment and contour diagrams until they are automatic |
| 02 | Paradigms, Scheme basics, REPL | SICP 1.1 | Scheme | "Visible world / execution world" eval diagram |
| 03 | lambda, substitution model, recursive vs iterative processes | SICP 1.1–1.2 | Scheme | Substitution steps, growing expression, iteration table |
| 04 | Pairs, lists, cons'ing up / cdr'ing down | SICP 2.1–2.2 | Scheme | Box-and-pointer |
| 05 | Order of growth, higher-order procedures (map/filter/reduce) | SICP 1.3, 2.2 | Scheme | Box-and-pointer (student notes) |
| 06 | Inductive sets, grammars, induction | EOPL 1.1 | Scheme | Derivation (deduction) tree, BNF, Kleene |
| 07 | Recursive procedures, follow the grammar, auxiliary procedures | EOPL 1.2–1.3 | Scheme | Grammar ↔ procedure mapping (occurs-free?, subst) |
| 08 | Data abstraction, interface vs implementation, environment interface | EOPL 2.1–2.2 | Scheme | Data-structure representation of environments |
| 09 | Representation strategies, procedural representation, define-datatype | EOPL 2.2–2.4 | Scheme (eopl) | Data-structure vs procedural environments |
| 10 | Concrete vs abstract syntax, AST, parse/unparse, LET grammar | EOPL 2.5, 3.1–3.2 | LET | AST, `#(struct:…)` output |
| 11 | LET behavior specification | EOPL 3.2 | LET | Equational trace (⌈ ⌉ / ⌊ ⌋) |
| 12 | LET implementation | EOPL 3.2 | LET | Spec rule ↔ interpreter code side by side |
| 13–14 | PROC | EOPL 3.3 | PROC | Environment trace with closures, AST (a drawing corrected in class) |
| 15 | LETREC | EOPL 3.4 | LETREC | EOPL box environment diagram, step by step |
| 16 | Scoping and binding, lexical addressing, translator | EOPL 3.5–3.7 | PROC → Nameless | Contour diagram, static vs dynamic scoping |
| 17 | Nameless interpretation | EOPL 3.7 | Nameless | Nameless env (list of values), lexical depth |
| 18 | State and effects, EXPLICIT-REFS | EOPL 4.1–4.2 | EREF | Env + closure + location ("Behind the scenes"), σ chain |
| 19 | Store implementation | EOPL 4.2 | EREF | Store as a list |
| 20 | IMPLICIT-REFS, MUTABLE-PAIRS | EOPL 4.3–4.4 | IREF, MP | Env → location → value |
| 21–22 | Parameter passing (CBV, CBR, lazy) | EOPL 4.5 | CBR, Lazy | Instrumented env + store trace |
| 23 | Lazy evaluation (and Midterm Q7: letrec-m) | EOPL 4.5.2 | Call-by-name, call-by-need | Thunks, memoization |
| 24 | CPS | EOPL 5.1 | CPS (LETREC) | Nested continuation structure |
| 25 | CPS implementation | EOPL 5.1 | CPS | Procedural vs data-structure continuations |
| 26 | Trampolining | EOPL 5.2 | Trampolined | Bounces, stack growth |

Notes:
- Folder numbers don't always match the "Lecture N" titles inside the slides; for example, the deck in folder 21 is titled "Lecture 24 Parameter Passing". This document always uses folder numbers.
- The syllabus also lists EOPL chapters 6–9, but the decks we have end at §5.2 (trampolining). If the course goes further this term (e.g. exceptions), those languages get added.
- Some slides in Lectures 09, 16, 18 and 23 are exam statistics and carry nothing for the visualizer.

---

## 2. Languages (in course order)

Common to all EOPL languages:
- `Program ::= Expression` → `a-program (exp1)`.
- **The init-env is the same in every language: `i = 1, v = 5, x = 10`.**
- Scanner: an identifier starts with a letter, followed by letters, digits, `_`, `-` or `?` (e.g. `infinite-loop`). `-5` is a single number token, while `-(` starts a diff-exp. `%` starts a comment that runs to the end of the line.
- No boolean literals. Booleans only come from `zero?`.

### 2.0 Scheme / Racket (Lectures 02–10)
- Used for SICP-style functional programming exercises and as the language the interpreters are written in (the defining language). `#lang scheme` / `#lang racket`, `(require (lib "eopl.ss" "eopl"))` for define-datatype and cases, `(require racket/trace)` for tracing.
- Visualization needs: substitution model, box-and-pointer, call traces, derivation trees.
- Not a defined language. Could become a mini-Scheme mode in a second phase, for the Midterm 1 topics.

### 2.1 LET (Lectures 10–12) — EOPL §3.2, `chapter3/let-lang`
```
Expression ::= Number                                    const-exp (num)
             | -(Expression , Expression)                diff-exp (exp1 exp2)
             | zero? (Expression)                        zero?-exp (exp1)
             | if Expression then Expression else Expression   if-exp (exp1 exp2 exp3)
             | Identifier                                var-exp (var)
             | let Identifier = Expression in Expression let-exp (var exp1 body)
```
- `ExpVal = Int + Bool`, `DenVal = Int + Bool`.
- Environment data structure: `empty-env`, `extend-env`.

### 2.2 PROC (Lectures 13–15) — §3.3, `chapter3/proc-lang`
- New: `proc (Identifier) Expression` → `proc-exp (var body)` and `(Expression Expression)` → `call-exp (rator rand)`.
- `ExpVal = DenVal = Int + Bool + Proc`. A closure is `(procedure var body saved-env)`.
- One parameter. Lexical scoping.
- Two representations of procedures are shown: a Racket lambda (procedural) and define-datatype.

### 2.3 LETREC (Lectures 15–16) — §3.4, `chapter3/letrec-lang`
- New: `letrec Identifier (Identifier) = Expression in Expression` → `letrec-exp (p-name b-var p-body letrec-body)`.
- The official grammar allows one procedure with one parameter.
- The environment gains `extend-env-rec (p-name b-var body env)`. When the searched name is p-name, `apply-env` builds a **new** `(proc-val (procedure b-var p-body env))` on every lookup, where `env` is the rec frame itself.
- Exam variant: **letrec-m** (several procedures, `extend-env-rec*` / `apply-extend-env-rec*`), asked in Midterm Q7.

### 2.4 Nameless / lexical addressing (Lectures 16–17) — §3.6–3.7, `chapter3/lexaddr-lang`
- The source language is PROC: const, diff, zero?, if, var, let, proc, call. **No letrec.**
- Target language: `%lexref n` → `nameless-var-exp (num)`, `%let Exp in Exp` → `nameless-let-exp (exp1 body)`, `%lexproc Exp` → `nameless-proc-exp (body)`. The official code spells `%lexref` as `%nameless-var`.
- `translation-of : Exp × Senv → Nameless-exp`. `Senv = Listof(Sym)`, `init-senv = (i v x)`. `apply-senv` returns the index, i.e. the lexical address.
- The nameless env is a list of ExpVals: extend is `cons`, apply is `list-ref`. A procedure is `(procedure body saved-nameless-env)`.
- `run = value-of-program (translation-of-program (scan&parse s))`.
- Concepts covered in the same lecture: **static vs dynamic scoping**, shadowing, holes, extent, contour diagrams, lexical depth.

### 2.5 EXPLICIT-REFS / EREF (Lectures 18–19) — §4.2, `chapter4/explicit-refs`
- New: `newref (Exp)`, `deref (Exp)`, `setref (Exp , Exp)` and `begin Exp {; Exp}* end`.
- letrec now takes several procedures: `letrec {Identifier (Identifier) = Expression}* in Expression` → `letrec-exp (p-names b-vars p-bodies letrec-body)`, with `extend-env-rec*` in the environment.
- `ExpVal = Int + Bool + Proc + Ref(ExpVal)`, `DenVal = ExpVal`.
- The store is a global list. `value-of-program` calls `initialize-store!` first. `newref` returns `(length the-store)` as the address and appends the value. `deref` is `list-ref`. `setref!` rebuilds the list. **`setref` returns ⌈23⌉.** References are integers.
- The spec is in store-passing style: `(value-of exp ρ σ0) = (val, σ1)`.

### 2.6 IMPLICIT-REFS / IREF (Lecture 20) — §4.3, `chapter4/implicit-refs`
- newref, deref and setref are gone. New: `set Identifier = Expression` → `assign-exp (var exp1)`, which **returns ⌈27⌉**. begin and multi-procedure letrec stay.
- `ExpVal = Int + Bool + Proc`, `DenVal = Ref(ExpVal)`.
- **Every binding allocates a location:** let (`newref val1`), procedure calls (`newref val`) and letrec. For letrec, `apply-env` does `(newref (proc-val …))` on every lookup, so **each access to a letrec-bound name allocates a new location**.
- `var-exp` → `(deref (apply-env env var))`. init-env locations: `i → 0`, `v → 1`, `x → 2`.

### 2.7 MUTABLE-PAIRS (Lectures 20–22) — §4.4, `chapter4/mutable-pairs`
- On top of IREF: `newpair (Exp , Exp)`, `left (Exp)`, `right (Exp)`, `setleft Exp = Exp` (**⌈82⌉**), `setright Exp = Exp` (**⌈83⌉**).
- `ExpVal = Int + Bool + Proc + MutPair`, `DenVal = Ref(ExpVal)`, `MutPair = Ref(ExpVal) × Ref(ExpVal)`.
- Representation 1 (`pairval1`): `(a-pair left-loc right-loc)`.
- Representation 2 (`pairval2`): a pair is the reference of its left element; the right element is at `(+ 1 p)` (consecutive locations). Quiz #8 asked for `setright` in this representation.
- Lectures 20 and 22 have a motivation slide, "Adding lists/pairs to the language": a LET + `cons`/`emptylist` example (EOPL Ex. 3.9–3.10).

### 2.8 CALL-BY-REFERENCE (Lectures 21–22) — §4.5.1, `chapter4/call-by-reference`
- Same syntax, ExpVal and DenVal as IREF.
- The only change is `value-of-operand` in `call-exp`: if the operand is a `var-exp`, its existing location is passed as is; otherwise `newref` allocates a new one.
- `apply-procedure` now does `(extend-env var val saved-env)` without allocating. Result: aliasing, swap.
- Compared in class with "Natural (PROC)" and "Call-by-value (IREF)".

### 2.9 CALL-BY-NAME and CALL-BY-NEED (Lectures 21–23) — §4.5.2, `chapter4/call-by-need`
- `DenVal = Ref(ExpVal + Thunk)`, `Thunk = (a-thunk exp1 env)`.
- `value-of-operand`: for a `var-exp`, its existing reference; otherwise `(newref (a-thunk exp env))`.
- `var-exp`: `w = deref ref1`. If `w` is an expval it is returned directly, otherwise `(value-of-thunk w)`. Call-by-need also writes the result back into the same location with `setref! ref1 val1` (memoization).
- In the official code **`let` stays strict**: `value-of exp1` first, then `newref val`.
- The official repo only has call-by-need. Call-by-name is the same code without the `setref!`, as on the slides.

### 2.10 CPS interpreter (Lectures 24–25) — §5.1, `chapter5/letrec-lang`
- The language is LETREC, with the same syntax. `value-of/k : Exp × Env × Cont → FinalAnswer`, `FinalAnswer = ExpVal`.
- Continuations (data-structure representation, official names):

| Continuation | Fields |
|---|---|
| `end-cont` | — |
| `zero1-cont` | saved-cont |
| `let-exp-cont` | var, body, saved-env, saved-cont |
| `if-test-cont` | exp2, exp3, saved-env, saved-cont |
| `diff1-cont` | exp2, saved-env, saved-cont |
| `diff2-cont` | val1, saved-cont |
| `rator-cont` | rand, saved-env, saved-cont |
| `rand-cont` | val1, saved-cont |

- Applying `end-cont` prints "End of computation."
- The procedural representation is shown too: `Cont = ExpVal → FinalAnswer`.
- The book's worked example calls `if-test-cont` `test-cont`. The name in the code is `if-test-cont`.

### 2.11 Trampolined interpreter (Lecture 26) — §5.2
- `apply-procedure/k` returns a `(lambda () …)`, i.e. a bounce.
- `trampoline`: `(if (expval? bounce) bounce (trampoline (bounce)))`. `Bounce = ExpVal ∪ (() → Bounce)`. `value-of-program` wraps everything in `trampoline`.
- Racket demo `fact-cont-tramp-orig.rkt`: once stack-size passes 10 it returns a bounce and prints "returning bounce" / "trampolined".

### 2.12 Variants seen in exams and PS sessions
- letrec-m: several mutually recursive procedures (Midterm Q7).
- `let` with several bindings (needed by the static/dynamic example in Lecture 16).
- Dynamic scoping (Lecture 16).
- let → proc conversion. A student note in Lecture 14 says the midterm will ask for it.
- LET + lists (cons, emptylist), the motivation slide in Lectures 20/22.

---

## 3. Visualizations

### 3.1 Priority table

| # | Visualization | Lectures | Languages | Priority | Why it matters |
|---|---|---|---|---|---|
| 1 | Environment diagram | 08–09, 13–24 | All, LET to CPS | ★★★ | Quiz #9. Lecture 20 announcement: "The environment question graded generously". Drawn step by step in Lectures 15, 16 and 18 |
| 2 | Store | 18–23 | EREF, IREF, MP, CBR, Lazy | ★★★ | Learning outcome: "Trace CBV/CBR evaluation using the env & store" |
| 3 | value-of step trace (equational trace) | 11–16, 24 | All | ★★★ | The instructor's "what we envision" traces. The natural match for the slider |
| 4 | Contour diagram and lexical depth | 16–18 | All named languages | ★★★ | Quiz #9. Tip #14 in the beginners' guide |
| 5 | Continuation (control context) | 24–26 | CPS, Trampolined | ★★★ | Quiz #11 "What is a continuation?", Quiz 12 |
| 6 | AST | 10, 14, 16–17 | All | ★★★ | Lecture 14: an AST drawing discussed and corrected in class, marked "very important" in the notes |
| 7 | Named → nameless translation | 16–17 | Nameless | ★★ | The translator and senv are exam material |
| 8 | Parameter passing comparison | 21–23 | CBV, CBR, name, need | ★★ | One program with different results is the lectures' main example |
| 9 | Active interpreter code and spec rule | 11–12 and later | All | ★★ | Spec and code side by side in Lecture 12 |
| 10 | Trampoline and stack depth | 24–26 | CPS, Trampolined | ★★ | The Racket demos print exactly this |
| 11 | Box-and-pointer | 04–05, 20 (pairs) | Scheme, MP | ★★ | Among the hardest topics in the Midterm 1 survey |
| 12 | Substitution model and process shape | 03–04, 24 | Scheme | ★★ | Recursive vs iterative carries all the way to CPS |
| 13 | Derivation tree and grammar | 06–07, 09 | (Scheme) | ★ | Midterm 1 survey: rules of inference, top-down/bottom-up |
| 14 | Representation comparisons | 08–09, 13, 25 | — | ★ | Procedural vs data-structure representations |

### 3.2 How the course draws each one, and what we should show

**1. Environment diagram**
- Course notation A, the EOPL box drawing (Lectures 15, 16, 18):
  `ρ → [extend-env | • | • | •]→`. The variable name hangs below the first cell and the value below the second. The last cell points to the next (older) frame. ρ always points to the newest frame.
  An `extend-env-rec` box is drawn as `[extend-env-rec | •p-name | •b-var | <<body>> | •]`.
  A closure box is `[proc-val | procedure | var | <<body>> | •saved-env]` ("Behind the scenes", Lecture 18). When a value is a closure it is often abbreviated `<proc…>`.
- Notation B, equational: `[y=⌈val2⌉][x=⌈val1⌉]ρ`, with `[f=…]` for long closures.
- Notation C, instrumented output: `((f 3) (i 0) (v 1) (x 2))`.
- What each step should show: the current ρ, a new frame being created, the path `apply-env` walks (the instructor traces it in red pen in Lecture 17), the closure's saved-env arrow ("saved environments are different!", Lecture 15).
- A snapshot that directly answers "what was the environment when the boxed expression was evaluated?"
- The init-env frames (i, v, x) sit at the end of the chain and should be collapsible.

**2. Store**
- A 0..n location table (new address = current length). `ref-val` as an arrow to its location. proc-vals written into the store by IREF letrec. "Frozen" thunk cells (exp + env) in the lazy languages, and the memoization update. Pairs as two cells, each representation shown separately.
- The store-passing chain σ0 → σ1 → σ2. Handwritten note on the slide: "In case exp1 changes the memory, must use sigma 1".
- Two layers in IREF: the environment holds location numbers, the store holds values.
- At each step, highlight the cell that was allocated, read (deref) or written (setref, set). The EOPL store never shrinks; its growth should be visible.

**3. value-of step trace**
- Each step is one `(value-of <<exp>> ρ)` rewrite with ⌈ ⌉ / ⌊ ⌋, as in Lecture 11's "what we envision".
- At each slider step, the same expression is highlighted in the editor and in the AST.
- In CPS, `(value-of/k <<exp>> ρ cont)` and `(apply-cont cont val)` alternate.

**4. Contour diagram**
- Nested boxes for each binding construct (let body, proc body, letrec), arrows from binders to references, subscripts like `x1`/`x2`, lexical depth numbers. Student notes compute lexical depth as "number of contours crossed − 1". Shadowing and holes should be visible.
- It is a static analysis, so it can be shown before Run.
- A static / dynamic scoping switch (Lecture 16 example: static 6, dynamic 8).

**5. Continuation**
- Continuation frames as a stack: innermost on top, `end-cont` at the bottom, fields visible (exp2, saved-env, val1…).
- Text notation: `#(struct:diff1-cont <<3>> ρ0 #(struct:end-cont))`.
- A chart of the control context's size over time. fact vs fact-iter (Lecture 24).
- A procedural view: the nested lambdas from `Fact-final.rkt`.

**6. AST**
- The EOPL tree drawing: boxes with the variant name (`lambda-exp`, `app-exp`, `let-exp`…), labeled edges (`bound-var`, `body`, `rator`, `rand`, `exp1`, `var`…), identifiers and numbers as leaves.
- **Binders are not var-exps.** The var field of `let-exp` is a plain identifier; this is the correction made on a student drawing in Lecture 14.
- A `#(struct:a-program #(struct:diff-exp …))` text view.
- Concrete ↔ abstract mapping: highlight which grammar rule was used. Highlight the active node during evaluation.

**7. Named → nameless translation**
- Both programs side by side. Arrows from `#n` to its binder, the senv at each node, the nameless env list (`value of z → value of y → value of x → saved-env`).

**8. Parameter passing comparison**
- The same program under CBV, CBR, call-by-name and call-by-need, side by side: result and store differences.
- Aliasing: two environment entries pointing to the same location. A counter for how many times a thunk is evaluated.

**9. Active interpreter code and spec rule**
- The Racket `cases` clause running at that step, together with the book's spec rule (as in Lecture 12). Useful for "implementation" exam questions.

**10. Trampoline**
- Bounce events and a stack-depth chart that resets. The moment `apply-procedure/k` returns a thunk.

**11. Box-and-pointer**
- `[car|cdr]` cells, a diagonal slash for nil. Building a list step by step while cons'ing up, cdr'ing down. The same visual language can be reused for mutable pairs in the store.

**12. Substitution model**
- The `(fact 3) … 6` rewrite chain, pending operations ("pending operations make the expression grow"), the iteration table (product / counter).

**13. Derivation tree**
- Inference-rule trees, e.g. `(-7 . (3 . (14 . ()))) ∈ List-of-Int`. S-list and LcExp grammar derivations.

**14. Representation comparisons**
- Environments as tagged lists vs closures, continuations as procedures vs datatypes, unary / Scheme / bignum natural numbers.

---

## 4. Correctness checklist

Points checked against the official code, so the visualizer never teaches students something wrong:

1. **init-env:** `i=1, v=5, x=10` in every language. In the IREF-based languages (IREF, MP, CBR, Lazy) the locations are `i→0, v→1, x→2` (Racket evaluates arguments left to right), so the user's first `newref` is location 3. In EREF the init-env allocates nothing; the first `newref` is location 0.
2. **Environment order is newest first:** `((f 3) (i 0) (v 1) (x 2))`.
3. **LETREC:** `apply-env` builds a new closure on every lookup. The closure's environment is the rec frame itself, not the outer ρ.
4. **IREF / MP / CBR / Lazy letrec:** every access to a letrec-bound name does a `newref`, so the store grows. Show this exactly as it happens; a short note can explain it.
5. **Fixed return values:** `setref` → 23, `set` → 27, `setleft` → 82, `setright` → 83.
6. **EREF has `DenVal = ExpVal`:** let does not allocate; only `newref` does. In IREF, let, procedure calls and letrec lookups allocate.
7. **CBR:** only `var-exp` operands share a location. A call like `(f -(x,1))` allocates a new one.
8. **Call-by-need:** `let` is strict. Memoization replaces the thunk with its value in the same location. Call-by-name re-evaluates on every access.
9. **CPS:** continuation names and fields as in the official code. `end-cont` prints "End of computation." In the trampolined version, bounces happen only in `apply-procedure/k`.
10. **Nameless:** no letrec. `init-senv = (i v x)`. The lexical address is the position in the senv.
11. **Evaluation order:** diff evaluates exp1, then exp2; call evaluates the rator, then the rand. This matters in languages with effects.
12. **Errors:** cases such as "No binding for …" and `expval->num` type mismatches are shown as errors, the way the EOPL interpreter reports them; never silently fixed.
13. **Traps in the slide examples:**
    - The lazy example in Lecture 21, `infinite-loop(-(x,-1))`, doesn't fit the EOPL grammar. The correct form is `(infinite-loop -(x,-1))`.
    - In the CPS example in Lecture 24, `b` isn't in the init-env and needs a binding.
    - "PROC: evaluates to 3" in Lecture 21 is conceptual; PROC has no `set` or `begin`.
    - The EREF/IREF examples need multi-procedure letrec and begin. The static/dynamic example needs a multi-binding let.

---

## 5. Product suggestions

1. **The official EOPL3 code is the source of truth for semantics.** Port each interpreter one to one: same variant names, same allocation order. Run differential tests against real Racket + eopl3 in CI, comparing the result, store and environment at every step. The examples in §6 become the golden test set.
2. **A "what changed?" view.** Between two consecutive languages: grammar, ExpVal/DenVal and the changed `value-of` clauses. Tip #12 of the section leaders' guide, turned into a feature.
3. **Exam practice mode.** Panels are hidden; the student predicts the value, the environment diagram at the boxed expression and the contours, then reveals and compares. There is no DrRacket in the exam, and drawing questions come up.
4. **"Box the expression".** Clicking any subexpression in the editor jumps the slider to the step(s) where it is evaluated. A direct match for the Quiz #9 format.
5. **Comparison mode.** The same program side by side: CBV / CBR, static / dynamic, name / need, LETREC / CPS.
6. **Interpreter view.** The active `cases` clause and the spec rule together (Lecture 12 style).
7. **EOPL trace output.** A text dump in the slides' format: `newref: allocating location 3`, `entering body of let f with env = ((f 3) (i 0) (v 1) (x 2))`, `store = …`. Students can compare it with DrRacket.
8. **Notation options.** EOPL box drawing / `[x=⌈1⌉]ρ` / env->list.
9. **Step granularity.** Only `value-of` calls, or every rewrite; `value-of/k` and `apply-cont` in CPS. IDE-style step over / into / out. A step limit for programs that don't terminate (e.g. the lazy example runs forever under CBV).
10. **Lecture example library.** The programs from the slides, preloaded with lecture and slide references.
11. **Shareable links.** Program, language and step in the URL, ready to share in PS sessions.
12. **Second phase: mini-Scheme mode.** Midterm 1 topics with the substitution model and box-and-pointer.
13. **Representation switches.** Procedural / data-structure representations for environments, procedures and continuations (Lectures 09, 13, 25), showing how the same run looks under each.

---

## 6. Test programs from the slides

Expected values come from the slides. Those marked "(computed)" aren't on the slides; they were worked out by hand and must be checked against real Racket.

| # | Language | Program | Expected | Source |
|---|---|---|---|---|
| T1 | LET | `-(-(x,3), -(v,i))` | 3 (7 `value-of` calls) | Lecture 11 |
| T2 | LET | `let x = 33 in let y = 22 in if zero?(-(x,11)) then -(y,2) else -(y,4)` | 18 | Lecture 12 (the slide uses ρ = [x=33, y=22]) |
| T3 | LET | `-(55, -(x,11))` | 56 (computed); the AST is on the slide | Lecture 10 |
| T4 | PROC | `let f = proc (x) -(x,11) in (f (f 77))` | 55 | Lecture 13 |
| T5 | PROC | `(proc (f) (f (f 77)) proc (x) -(x,11))` | 55 | Lecture 13 |
| T6 | PROC | `let x = 200 in let f = proc (z) -(z,x) in let x = 100 in let g = proc (z) -(z,x) in -((f 1), (g 1))` | -100 | Lecture 13 |
| T7 | PROC | `let a = 5 in proc (x) -(x,a)` | `(proc-val (procedure x <<-(x,a)>> [a=⌈5⌉]ρ))` | Lecture 16 |
| T8 | LETREC | `letrec double(x) = if zero?(x) then 0 else -((double -(x,1)), -2) in (double 6)` | 12 | Lecture 15 |
| T9 | LETREC | `let a=1 in let b=2 in letrec f(x) = if zero?(x) then 0 else -((f -(x,1)),-2) in (f 2)` | 4; the environment diagram is on the slides | Lectures 15, 16, 18 |
| T10 | LETREC | `let add = proc(x) proc(y) -(x, -(0, y)) in letrec sum(n) = if zero?(n) then 0 else ((add n) (sum -(n, 1))) in (sum 5)` | 15 (computed); the environment at n=3 is on the slides | Lectures 16, 18 |
| T11 | Nameless | `let x = 37 in proc (y) let z = -(y,x) in -(x,y)` | `%let 37 in %lexproc %let -(%lexref 0, %lexref 1) in -(%lexref 2, %lexref 1)` | Lectures 16, 17 |
| T12 | EREF | `let x = newref(0) in letrec even(dummy) = if zero?(deref(x)) then 1 else begin setref(x, -(deref(x),1)); (odd 888) end odd(dummy) = if zero?(deref(x)) then 0 else begin setref(x, -(deref(x),1)); (even 888) end in begin setref(x,13); (odd 888) end` | 1 (computed) | Lecture 18 |
| T13 | EREF | `let g = let counter = newref(0) in proc (dummy) begin setref(counter, -(deref(counter), -1)); deref(counter) end in let a = (g 11) in let b = (g 11) in -(a,b)` | -1 | Lecture 18 |
| T14 | EREF | `let x = newref(newref(0)) in begin setref(deref(x), 11); deref(deref(x)) end` | 11 (computed) | Lecture 18 |
| T15 | IREF | `let x = 0 in letrec even(dummy) = if zero?(x) then 1 else begin set x = -(x,1); (odd 888) end odd(dummy) = if zero?(x) then 0 else begin set x = -(x,1); (even 888) end in begin set x = 13; (odd -888) end` | 1 (computed) | Lecture 20 |
| T16 | IREF | `let g = let count = 0 in proc (dummy) begin set count = -(count,-1); count end in let a = (g 11) in let b = (g 11) in -(a,b)` | -1 (computed) | Lecture 20 |
| T17 | IREF / CBR | `let p = proc (x) set x = 4 in let a = 3 in begin (p a); a end` | CBV 3, CBR 4 | Lecture 21 |
| T18 | IREF / CBR | `let f = proc (x) set x = 44 in let g = proc (y) (f y) in let z = 55 in begin (g z); z end` | CBV 55, CBR 44; the full CBR env + store trace is on the slides | Lecture 21 |
| T19 | CBR | `let swap = proc (x) proc (y) let temp = x in begin set x = y; set y = temp end in let a = 33 in let b = 44 in begin ((swap a) b); -(a,b) end` | CBR 11, CBV -11 (computed) | Lecture 21 |
| T20 | CBR | `let b = 3 in let p = proc (x) proc (y) begin set x = 4; y end in ((p b) b)` | CBR 4 (CBV 3, computed) | Lecture 21 |
| T21 | Lazy | `letrec infinite-loop (x) = (infinite-loop -(x,-1)) in let f = proc (z) 11 in (f (infinite-loop 0))` | name/need 11; doesn't terminate under CBV | Lectures 21, 23 |
| T22 | Lazy | `let f = proc (x) -(x, -(x,5)) in (f -(7,2))` | 5; the thunk is evaluated twice under name, once under need (computed) | Lecture 23 (handwritten example) |
| T23 | CPS | `-(-(44,11),3)` | 30; the 10-step continuation sequence is on the slides | Lecture 24 |
| T24 | CPS | `let b = zero?(0) in letrec p(x) = x in if b then 3 else 4` | 3 | Lecture 24 (on the slide, `b` is bound outside the init-env) |
| T25 | Static / dynamic | `let a = 3 in let p = proc (x) -(x,a) a = 5 in -(a,(p 2))` | static 6, dynamic 8; needs a multi-binding let | Lecture 16 (speaker notes) |

For the Scheme part: `(fact 3)` → 6, `(ifact 4)` → 24, `(enumerate-interval 2 4)` → `(2 3 4)`, `((compose sqrt (lambda (x) (+ x 4))) 12)` → 4.
