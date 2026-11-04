// The comparisons Compare offers: pairs of languages where the second is the first plus one
// idea (or a choice between two ideas), in course order. For each: notes anchored to the code
// that changes, and programs that show the difference when run.
//
// `anchor` is a piece of a changed line of code (from either side) in that pair's diff: the
// note is shown next to it. tests/compare/comparisons.test.ts checks every anchor still
// matches, that every program parses, and that run-in-both programs really differ.

import type { LanguageId, LanguageModule } from '../core/language';
import type { Trace } from '../core/trace';
import { languageById } from '../languages';

export interface Note {
  readonly anchor: string;
  readonly text: string;
}

export interface Side {
  readonly id: LanguageId;
  /** For a language with several implementations: which one ("pairval2"). */
  readonly variant?: string;
  /** The name shown, when it is not the language's own. */
  readonly label?: string;
  /** Show this language's official code and grammar instead of the side's own. */
  readonly codeOf?: LanguageId;
}

/** A number taken from a run that shows what the two languages do differently. */
export type Measure = 'by-name' | 'locations' | 'thunks' | 'control' | 'bounces';

export interface Comparison {
  readonly id: string;
  readonly group: string;
  readonly from: Side;
  readonly to: Side;
  readonly summary: string;
  readonly notes: readonly Note[];
  /** Programs that parse in both languages and differ in value or in `measure`. */
  readonly runBoth?: readonly RunExample[];
  /** The same task written in each language, where one program can't show the difference. */
  readonly twoWays?: readonly TwoWayExample[];
}

/** `title` says where the program is from: the book, a lecture, or ours. */
export interface RunExample {
  readonly title: string;
  readonly source: string;
  /** What to look at: where the two runs differ. */
  readonly look: string;
  readonly measure?: Measure;
}

export interface TwoWayExample {
  readonly title: string;
  readonly task: string;
  readonly from: string;
  readonly to: string;
}

const CBV: Side = { id: 'implicit-refs', label: 'CALL-BY-VALUE', codeOf: 'mutable-pairs' };

const LOOP_NEVER_RUN = 'letrec infinite-loop (x) = (infinite-loop -(x,-1))\nin let f = proc (z) 11\n   in (f (infinite-loop 0))';

const SWAP =
  'let swap = proc (x)\n             proc (y)\n               let temp = x\n               in begin\n                    set x = y;\n                    set y = temp\n                  end\nin let a = 33\n   in let b = 44\n      in begin\n           ((swap a) b);\n           -(a,b)\n         end';

const MAKEREC_438 =
  'let makerec = proc (f)\n                let d = proc (x) (f (x x))\n                in (f (d d))\nin let maketimes4 = proc (f)\n                     proc (x)\n                       if zero?(x)\n                       then 0\n                       else -((f -(x,1)), -4)\n   in let times4 = (makerec maketimes4)\n      in (times4 3)';

const ERROR_NEVER_REACHED = 'let f = proc (x)\n          proc (y)\n            if zero?(x) then 0 else y\nin ((f 0) -(zero?(0), 1))';

const EFFECT_TWICE = 'let c = 0\nin let f = proc (x) -(x,x)\n   in (f begin\n           set c = -(c,-1);\n           c\n         end)';

const WHEN_EVALUATED = 'let c = 0\nin let f = proc (x)\n            begin\n              set c = 10;\n              x\n            end\n   in (f -(c,0))';

const TIMES4 = 'letrec times4(x) = if zero?(x)\n                   then 0\n                   else -((times4 -(x,1)), -4)\nin (times4 3)';

const DOUBLE = 'letrec double(x) = if zero?(x)\n                   then 0\n                   else -((double -(x,1)), -2)\nin (double 6)';

const SUM = 'letrec sum(n) = if zero?(n)\n                then 0\n                else -((sum -(n,1)), -(0,n))\nin (sum 10)';

const SUM_ITER =
  'letrec sumacc(n) = proc (acc)\n                    if zero?(n)\n                    then acc\n                    else ((sumacc -(n,1)) -(acc, -(0,n)))\nin ((sumacc 10) 0)';

const FACT =
  'letrec times(x) = proc (y)\n                   if zero?(x)\n                   then 0\n                   else -(((times -(x,1)) y), -(0,y))\nin letrec fact(n) = if zero?(n)\n                    then 1\n                    else ((times n) (fact -(n,1)))\n   in (fact 4)';

const COUNTER_EXPLICIT =
  'let g = let counter = newref(0)\n        in proc (dummy)\n             begin\n               setref(counter, -(deref(counter), -1));\n               deref(counter)\n             end\nin let a = (g 11)\n   in let b = (g 11)\n      in -(a,b)';

const COUNTER_IMPLICIT =
  'let g = let count = 0\n        in proc (dummy)\n             begin\n               set count = -(count,-1);\n               count\n             end\nin let a = (g 11)\n   in let b = (g 11)\n      in -(a,b)';

const EVEN_ODD_EXPLICIT =
  'let x = newref(0)\nin letrec even(dummy) = if zero?(deref(x))\n                        then 1\n                        else begin\n                               setref(x, -(deref(x),1));\n                               (odd 888)\n                             end\n          odd(dummy) = if zero?(deref(x))\n                       then 0\n                       else begin\n                              setref(x, -(deref(x),1));\n                              (even 888)\n                            end\n   in begin setref(x,13); (odd 888) end';

const SWAP_PAIR =
  'let p = newpair(33,44)\nin let swap = proc (q)\n                let t = left(q)\n                in begin\n                     setleft q = right(q);\n                     setright q = t\n                   end\n   in begin\n        (swap p);\n        -(left(p), right(p))\n      end';

const TAIL_LOOP = 'letrec loop(n) = if zero?(n)\n                 then 0\n                 else (loop -(n,1))\nin (loop 10)';

const SHARED_PAIR =
  'let glo = newpair(11,22)\nin let f = proc (loc)\n            begin\n              setright loc = left(loc);\n              setleft glo = 99;\n              -(left(loc),right(loc))\n            end\n   in (f glo)';

export const COMPARISONS: readonly Comparison[] = [
  {
    id: 'let-proc',
    group: 'Chapter 3',
    from: { id: 'let' },
    to: { id: 'proc' },
    summary: 'Procedures become values: proc makes one, a call applies one.',
    notes: [
      {
        anchor: '(proc-exp (var body)',
        text: 'proc-exp makes a procedure value. It saves env, the environment where the proc is written: that is why scoping is static.',
      },
      {
        anchor: '(call-exp (rator rand)',
        text: 'call-exp evaluates the operator, then the operand, then hands both to apply-procedure.',
      },
      {
        anchor: '(define apply-procedure',
        text: "apply-procedure runs the body in the saved env extended with the parameter, not in the caller's env.",
      },
      {
        anchor: '(define-datatype proc proc?',
        text: 'A new expressed value, proc-val. A procedure is its parameter, its body and the env it was made in.',
      },
    ],
    twoWays: [
      {
        title: 'Ours: double two numbers',
        task: 'Double 5 and double 7, then subtract. LET has to write the doubling out each time; PROC writes it once, as a procedure.',
        from: 'let a = 5\nin let b = 7\n   in -(-(a, -(0,a)), -(b, -(0,b)))',
        to: 'let double = proc (x) -(x, -(0,x))\nin -((double 5), (double 7))',
      },
      {
        title: 'Lecture 13: apply twice',
        task: 'Subtract 11 from 77, twice. LET names each intermediate result; PROC names the operation and applies it to its own result.',
        from: 'let x = 77\nin let y = -(x,11)\n   in -(y,11)',
        to: 'let f = proc (x) -(x,11)\nin (f (f 77))',
      },
      {
        title: 'Book Ex. 3.20: a curried sum',
        task: 'Add 3 and 4. PROC procedures take one argument, so a two-argument sum is a procedure that returns a procedure (currying). x + y is written -(x, -(0,y)).',
        from: 'let x = 3\nin let y = 4\n   in -(x, -(0,y))',
        to: 'let plus = proc (x) proc (y) -(x, -(0,y))\nin ((plus 3) 4)',
      },
    ],
  },
  {
    id: 'proc-letrec',
    group: 'Chapter 3',
    from: { id: 'proc' },
    to: { id: 'letrec' },
    summary: 'A procedure can call itself: letrec adds a frame that makes the closure on each lookup.',
    notes: [
      {
        anchor: '(letrec-exp (p-name b-var p-body letrec-body)',
        text: 'letrec-exp evaluates its body in an env that also knows the procedure.',
      },
      {
        anchor: '(extend-env-rec p-name b-var p-body env)',
        text: "The new frame, extend-env-rec, keeps the procedure's parts (name, parameter, body), not a closure.",
      },
      {
        anchor: '(proc-val (procedure b-var p-body env))',
        text: 'apply-env makes the closure when the name is looked up, with env: the extend-env-rec frame itself. So the body sees the procedure again, and that is the recursion.',
      },
      {
        anchor: '(define-datatype environment environment?',
        text: 'The environment becomes a define-datatype so it can have this third kind of frame.',
      },
    ],
    twoWays: [
      {
        title: 'Ours: double by recursion',
        task: "double(6) by recursion. PROC has no way for a procedure to name itself, so it is passed itself as an argument (maker maker). LETREC binds the name in the procedure's own body.",
        from: 'let makedouble = proc (maker)\n                   proc (x)\n                     if zero?(x)\n                     then 0\n                     else -(((maker maker) -(x,1)), -2)\nin let double = (makedouble makedouble)\n   in (double 6)',
        to: DOUBLE,
      },
      {
        title: 'Book Ex. 3.23: times4 by self-application',
        task: 'times4(3) = 12. The book\'s trick: makemult receives itself as maker, and (maker maker) rebuilds times4 for the recursive call.',
        from: 'let makemult = proc (maker)\n                 proc (x)\n                   if zero?(x)\n                   then 0\n                   else -(((maker maker) -(x,1)), -4)\nin let times4 = proc (x) ((makemult makemult) x)\n   in (times4 3)',
        to: TIMES4,
      },
      {
        title: 'Book Ex. 3.25: makerec, recursion for any procedure',
        task: 'times4(3) = 12 again, with the trick made general: makerec turns any maketimes4-style procedure into a recursive one. This is the Y combinator; letrec does the same job in the interpreter.',
        from: 'let makerec = proc (f)\n                let d = proc (x)\n                          proc (z) ((f (x x)) z)\n                in proc (n) ((f (d d)) n)\nin let maketimes4 = proc (f)\n                     proc (x)\n                       if zero?(x)\n                       then 0\n                       else -((f -(x,1)), -4)\n   in let times4 = (makerec maketimes4)\n      in (times4 3)',
        to: TIMES4,
      },
    ],
  },
  {
    id: 'proc-nameless',
    group: 'Chapter 3',
    from: { id: 'proc' },
    to: { id: 'nameless' },
    summary: 'Names are replaced by lexical addresses before the program runs.',
    notes: [
      {
        anchor: '(define translation-of',
        text: 'translation-of runs before value-of. With a static environment (senv) of names, it turns each variable into its lexical address.',
      },
      {
        anchor: '(nameless-var-exp (n)',
        text: 'A variable is looked up by position: the n-th entry of the env. No names are left at run time.',
      },
      {
        anchor: '(nameless-let-exp (exp1 body)',
        text: 'let no longer binds a name: it just puts the value in front of the env.',
      },
      {
        anchor: '(define nameless-environment?',
        text: 'The run-time environment is just a list of values.',
      },
    ],
    runBoth: [
      {
        title: 'Book §3.7: the translation example, applied',
        source: 'let x = 37\nin let f = proc (y)\n           let z = -(y,x)\n           in -(x,y)\n   in (f 10)',
        measure: 'by-name',
        look: 'Same value. PROC looks every variable up by name; NAMELESS was translated first, so it looks none up by name. Step through both and compare the environments.',
      },
      {
        title: 'Lecture 13: static scoping',
        source: 'let x = 200\nin let f = proc (z) -(z,x)\n   in let x = 100\n      in let g = proc (z) -(z,x)\n         in -((f 1), (g 1))',
        measure: 'by-name',
        look: 'Same value: two different x, and each procedure finds its own. PROC finds it by searching each env for the name; NAMELESS knows before the run that it is the entry right after z, in whichever env the procedure saved.',
      },
      {
        title: 'Book Ex. 3.23: times4 by self-application',
        source: 'let makemult = proc (maker)\n                 proc (x)\n                   if zero?(x)\n                   then 0\n                   else -(((maker maker) -(x,1)), -4)\nin let times4 = proc (x) ((makemult makemult) x)\n   in (times4 3)',
        measure: 'by-name',
        look: 'Same value and the same steps. Each recursive call looks up maker and x again: by name in PROC, by position in NAMELESS.',
      },
    ],
  },
  {
    id: 'letrec-explicit-refs',
    group: 'Chapter 4: state',
    from: { id: 'letrec' },
    to: { id: 'explicit-refs' },
    summary: 'A store of locations, and expressions that create, read and change them.',
    notes: [
      {
        anchor: '(initialize-store!)',
        text: 'A store appears next to the environment. Each run starts with an empty one.',
      },
      {
        anchor: '(newref-exp (exp1)',
        text: 'newref puts a value in a new location and returns a reference to it: ref-val is a new expressed value.',
      },
      {
        anchor: '(setref-exp (exp1 exp2)',
        text: 'deref reads a location, setref changes it. The change outlives the expression that made it: this is an effect.',
      },
      {
        anchor: '(begin-exp (exp1 exps)',
        text: 'begin evaluates expressions in order and returns the last value. It only matters now that expressions have effects.',
      },
      {
        anchor: '(extend-env-rec* p-names b-vars p-bodies env)',
        text: 'letrec now declares several procedures at once, so they can call each other.',
      },
    ],
    twoWays: [
      {
        title: 'Book §4.2: a counter',
        task: 'Count how many times g is called. LETREC has no state, so the count has to be passed in and handed back. In EXPLICIT-REFS, g keeps it in a location of its own.',
        from: 'let g = proc (count) -(count,-1)\nin let a = (g 0)\n   in let b = (g a)\n      in -(a,b)',
        to: COUNTER_EXPLICIT,
      },
      {
        title: 'Book §4.2: even and odd',
        task: 'Is 13 odd? In EXPLICIT-REFS even and odd take no real argument: they count down a location they share. In LETREC the count has to be the argument.',
        from: 'letrec odd(x) = if zero?(x)\n                then 0\n                else if zero?(-(x,1))\n                     then 1\n                     else (odd -(x,2))\nin (odd 13)',
        to: EVEN_ODD_EXPLICIT,
      },
      {
        title: 'Book Ex. 4.16: recursion without letrec',
        task: 'times4(3) = 12. EXPLICIT-REFS can make a procedure recursive without letrec: it calls whatever is in a location, and the location is set to the procedure itself.',
        from: TIMES4,
        to: 'let times4 = newref(0)\nin begin\n     setref(times4, proc (x)\n                      if zero?(x)\n                      then 0\n                      else -((deref(times4) -(x,1)), -4));\n     (deref(times4) 3)\n   end',
      },
    ],
  },
  {
    id: 'explicit-refs-implicit-refs',
    group: 'Chapter 4: state',
    from: { id: 'explicit-refs' },
    to: { id: 'implicit-refs' },
    summary: 'Every variable is bound to a location; the store is used without newref/deref/setref.',
    notes: [
      {
        anchor: '(var-exp (var) (deref (apply-env env var)))',
        text: 'Every variable is now bound to a location, so looking one up derefs it. DenVal = Ref(ExpVal).',
      },
      {
        anchor: '(extend-env var (newref v1) env)',
        text: 'let puts its value in a new location and binds the name to that location.',
      },
      {
        anchor: '(assign-exp (var exp1)',
        text: 'set changes the location a variable is bound to. newref, deref and setref are gone from the language: the store is implicit.',
      },
      {
        anchor: '(bval reference?)',
        text: 'The environment holds references now, not expressed values.',
      },
    ],
    runBoth: [
      {
        title: 'Ours: a let and a call',
        source: 'let x = 3\nin let f = proc (y) -(y,x)\n   in (f 10)',
        measure: 'locations',
        look: 'Same value. EXPLICIT-REFS makes no location unless newref asks for one; IMPLICIT-REFS makes one for every binding: the init-env, x, f and y.',
      },
      {
        title: 'Book §4.3: a curried call',
        source: 'let f = proc (x) proc (y) -(x,y)\nin ((f 44) 33)',
        measure: 'locations',
        look: 'Same value. Each parameter gets a location of its own in IMPLICIT-REFS, at every call.',
      },
      {
        title: 'Lecture 15: double, by letrec',
        source: DOUBLE,
        measure: 'locations',
        look: 'Same value. In IMPLICIT-REFS every lookup of a letrec-bound name makes a new location for the closure, and every call one for its parameter.',
      },
    ],
    twoWays: [
      {
        title: 'Book §4.2 and §4.3: a counter',
        task: 'A counter. EXPLICIT-REFS reads and changes its location with deref and setref; in IMPLICIT-REFS the variable is the location, read by its name and changed with set.',
        from: COUNTER_EXPLICIT,
        to: COUNTER_IMPLICIT,
      },
      {
        title: 'Book §4.2 and Fig. 4.7: even and odd',
        task: 'Is 13 odd? The same program twice: deref(x) becomes x, and setref(x, …) becomes set x = ….',
        from: EVEN_ODD_EXPLICIT,
        to: 'let x = 0\nin letrec even(dummy) = if zero?(x)\n                        then 1\n                        else begin\n                               set x = -(x,1);\n                               (odd 888)\n                             end\n          odd(dummy) = if zero?(x)\n                       then 0\n                       else begin\n                              set x = -(x,1);\n                              (even 888)\n                            end\n   in begin set x = 13; (odd 888) end',
      },
      {
        title: 'Book Ex. 4.16: recursion without letrec',
        task: 'times4(3) = 12 through the store: the procedure calls whatever its variable holds, and the variable is then set to the procedure. EXPLICIT-REFS needs a location for it; in IMPLICIT-REFS the variable already is one.',
        from: 'let times4 = newref(0)\nin begin\n     setref(times4, proc (x)\n                      if zero?(x)\n                      then 0\n                      else -((deref(times4) -(x,1)), -4));\n     (deref(times4) 3)\n   end',
        to: 'let times4 = 0\nin begin\n     set times4 = proc (x)\n                    if zero?(x)\n                    then 0\n                    else -((times4 -(x,1)), -4);\n     (times4 3)\n   end',
      },
    ],
  },
  {
    id: 'implicit-refs-mutable-pairs',
    group: 'Chapter 4: state',
    from: { id: 'implicit-refs' },
    to: { id: 'mutable-pairs' },
    summary: 'Pairs whose halves live in the store, so they can be changed and shared.',
    notes: [
      { anchor: '(mutpair-val', text: 'A new expressed value: a mutable pair.' },
      {
        anchor: '(newpair-exp (exp1 exp2)',
        text: 'newpair evaluates both halves and puts each in the store.',
      },
      {
        anchor: '(setleft-exp (exp1 exp2)',
        text: 'setleft and setright change one half in place. Every name sharing the pair sees the change.',
      },
      {
        anchor: '(define make-pair',
        text: 'How a pair is kept: pairval1.scm uses two locations, pairval2.scm two consecutive ones.',
      },
    ],
    twoWays: [
      {
        title: 'Book §4.4: a shared pair',
        task: 'Change two values from inside a procedure. In IMPLICIT-REFS the procedure can only reach the two variables in its scope. In MUTABLE-PAIRS the two values travel together as one pair, and the procedure changes the halves through it.',
        from: 'let a = 11\nin let b = 22\n   in let f = proc (dummy)\n               begin\n                 set b = a;\n                 set a = 99;\n                 -(a,b)\n               end\n      in (f 0)',
        to: SHARED_PAIR,
      },
      {
        title: 'Ours: swap',
        task: 'Swap two values with a procedure. Under call-by-value swap gets copies, so in IMPLICIT-REFS it can only swap variables it can see. Given a pair, it swaps the halves, because they are locations.',
        from: 'let a = 33\nin let b = 44\n   in let swap = proc (dummy)\n                  let t = a\n                  in begin\n                       set a = b;\n                       set b = t\n                     end\n      in begin\n           (swap 0);\n           -(a,b)\n         end',
        to: SWAP_PAIR,
      },
      {
        title: 'Ours: a counter',
        task: 'A counter, kept in a variable or in the left half of a pair.',
        from: COUNTER_IMPLICIT,
        to: 'let g = let count = newpair(0,0)\n        in proc (dummy)\n             begin\n               setleft count = -(left(count), -1);\n               left(count)\n             end\nin let a = (g 11)\n   in let b = (g 11)\n      in -(a,b)',
      },
    ],
  },
  {
    id: 'pairval1-pairval2',
    group: 'Chapter 4: state',
    from: { id: 'mutable-pairs', variant: 'pairval1' },
    to: { id: 'mutable-pairs', variant: 'pairval2' },
    summary: 'The same language, two ways to keep a pair in the store.',
    notes: [
      {
        anchor: '(define-datatype mutpair mutpair?',
        text: 'pairval1: a pair is a record of two references, (a-pair left-loc right-loc).',
      },
      {
        anchor: '(reference? v)',
        text: 'pairval2: a pair is just one reference, the location of its left half.',
      },
      {
        anchor: '(let ((ref1 (newref val1)))',
        text: 'make-pair still makes two locations, one right after the other, and returns the first.',
      },
      {
        anchor: '(deref (+ 1 p))',
        text: 'So the right half is at the next location: right and setright use (+ 1 p).',
      },
    ],
    runBoth: [
      {
        title: 'Book §4.4: a shared pair',
        source: SHARED_PAIR,
        look: "Same value, same steps, same locations. What differs is the pair value: step through both and look at glo's location in the store, (a-pair l r) with two references in pairval1, (mutpair-val l) with one in pairval2.",
      },
      {
        title: 'Ours: swap the halves',
        source: SWAP_PAIR,
        look: 'Same value. setright q = t writes to the right-loc of the a-pair in pairval1, and to the location after q in pairval2: step through both and compare the store.',
      },
    ],
  },
  {
    id: 'call-by-value-call-by-reference',
    group: 'Chapter 4: parameter passing',
    from: CBV,
    to: { id: 'call-by-reference' },
    summary:
      'A variable passed to a procedure is passed as its location, not a copy. (CALL-BY-VALUE is IMPLICIT-REFS; its code here is mutable-pairs, the folder call-by-reference is built on.)',
    notes: [
      {
        anchor: '(arg (value-of-operand rand env)))',
        text: 'The operand is not just evaluated any more: value-of-operand decides what is passed.',
      },
      {
        anchor: '(define value-of-operand',
        text: "A variable passes the location it is bound to, so a set in the procedure changes the caller's variable. Anything else gets a new location.",
      },
      {
        anchor: '(lambda (proc1 val)',
        text: 'apply-procedure binds the reference it gets. Before, it made a new location for the value with (newref arg): that copy is call-by-value.',
      },
    ],
    runBoth: [
      {
        title: 'Book §4.5.1: swap',
        source: SWAP,
        look: "Under call-by-value swap changes its own copies, so a and b keep 33 and 44. Under call-by-reference x and y are a and b's locations, so they swap.",
      },
      {
        title: 'Book §4.5.1: set reaches the caller',
        source: 'let p = proc (x) set x = 4\nin let a = 3\n   in begin\n        (p a);\n        a\n      end',
        look: "Call-by-value: x is a new location holding 3, so a stays 3. Call-by-reference: x is a's location, so a becomes 4.",
      },
      {
        title: 'Book §4.5.1: passed on twice',
        source: 'let f = proc (x) set x = 44\nin let g = proc (y) (f y)\n   in let z = 55\n      in begin\n           (g z);\n           z\n         end',
        look: 'Call-by-reference passes the same location on: z, y and x all end up bound to it, so set x = 44 changes z.',
      },
      {
        title: 'Book §4.5.1: aliasing',
        source: 'let b = 3\nin let p = proc (x)\n             proc (y)\n               begin\n                 set x = 4;\n                 y\n               end\n   in ((p b) b)',
        look: 'Call-by-reference binds x and y to the same location, b\'s, so changing x changes y: 4. Call-by-value gives them a copy each: 3.',
      },
      {
        title: 'Ours: a second result through a parameter',
        source: 'let succpred = proc (n)\n                 proc (pred)\n                   begin\n                     set pred = -(n,1);\n                     -(n,-1)\n                   end\nin let p = 0\n   in let s = ((succpred 10) p)\n      in -(s,p)',
        look: 'The book\'s "typical use" of call-by-reference: return one value and assign another to a parameter. Under call-by-value p stays 0.',
      },
    ],
  },
  {
    id: 'call-by-reference-call-by-name',
    group: 'Chapter 4: parameter passing',
    from: { id: 'call-by-reference' },
    to: { id: 'call-by-name' },
    summary: 'Operands are not evaluated at the call: they are frozen in thunks. (Our TS ports: there is no official call-by-name folder.)',
    notes: [
      {
        anchor: 'rec.store.newref(rec.thunk(exp, env))',
        text: 'An operand that is not a variable is not evaluated. It is frozen in a thunk, the expression with its env, in a new location.',
      },
      {
        anchor: 'isThunk(w) ? valueOfThunk(w) : w',
        text: 'Looking up a variable that holds a thunk evaluates the thunk, on every lookup.',
      },
      {
        anchor: 'function valueOfThunk',
        text: 'value-of-thunk evaluates the frozen expression in its own saved env, not the current one.',
      },
    ],
    runBoth: [
      {
        title: 'Book §4.5.2: a loop never run',
        source: LOOP_NEVER_RUN,
        look: 'Call-by-reference evaluates (infinite-loop 0) before calling f, and never gets there. Call-by-name freezes it in a thunk that f never looks at.',
      },
      {
        title: 'Book Ex. 4.38: makerec',
        source: MAKEREC_438,
        measure: 'thunks',
        look: 'Eagerly, (f (d d)) evaluates (d d) first, which calls (x x) again, forever. Lazily, (d d) waits in a thunk until times4 needs the recursive call.',
      },
      {
        title: 'Ours: an operand with an effect',
        source: EFFECT_TWICE,
        measure: 'thunks',
        look: 'x is used twice. Call-by-reference evaluates the operand once (c becomes 1), so -(x,x) is 0. Call-by-name evaluates it at each use, c becomes 1 then 2, so -(x,x) is -(1,2).',
      },
      {
        title: 'Ours: when is the operand evaluated?',
        source: WHEN_EVALUATED,
        measure: 'thunks',
        look: 'Call-by-reference evaluates -(c,0) at the call, when c is 0. Call-by-name evaluates it when x is used, after set c = 10.',
      },
      {
        title: 'Ours: an error never reached',
        source: ERROR_NEVER_REACHED,
        look: 'The second operand is an error (zero?(0) is not a number). Call-by-reference evaluates it at the call; call-by-name never does, because y is not used.',
      },
    ],
  },
  {
    id: 'call-by-name-call-by-need',
    group: 'Chapter 4: parameter passing',
    from: { id: 'call-by-name' },
    to: { id: 'call-by-need' },
    summary: 'Call-by-name plus memoization: a thunk is evaluated at most once. (Our TS ports.)',
    notes: [
      {
        anchor: 'rec.store.setref(ref1, v1);',
        text: 'The only change: once the thunk is evaluated, its value replaces it in the location. The next lookup finds the value.',
      },
    ],
    runBoth: [
      {
        title: 'Lecture 23: the argument, twice',
        source: 'let f = proc (x) -(x, -(x,5))\nin (f -(7,2))',
        measure: 'thunks',
        look: 'Same value. x is used twice: call-by-name evaluates -(7,2) twice, call-by-need once.',
      },
      {
        title: 'Ours: doubling, four deep',
        source: 'let double = proc (x) -(x, -(0,x))\nin (double (double (double (double 1))))',
        measure: 'thunks',
        look: 'Same value. Each double uses x twice, and each x is a thunk holding another double, so call-by-name does the work 2 + 4 + 8 + 16 times. Call-by-need does each once.',
      },
      {
        title: 'Book Ex. 4.38: makerec',
        source: MAKEREC_438,
        measure: 'thunks',
        look: 'Same value, both lazy. Call-by-need remembers each thunk it evaluated, so it evaluates fewer.',
      },
      {
        title: 'Book Ex. 4.39: different answers, with an effect',
        source: EFFECT_TWICE,
        measure: 'thunks',
        look: 'The book asks for this: without effects name and need always agree. Here the operand changes c. Call-by-name evaluates it at each use of x (1, then 2); call-by-need once (1 and 1).',
      },
    ],
  },
  {
    id: 'call-by-value-call-by-need',
    group: 'Chapter 4: parameter passing',
    from: CBV,
    to: { id: 'call-by-need' },
    summary:
      'Eager and lazy: an operand is evaluated before the call, or only when (and if) it is needed, once. (CALL-BY-VALUE is IMPLICIT-REFS; its code here is mutable-pairs, which call-by-need is built on.)',
    notes: [
      {
        anchor: '(value-of-operand rand env)',
        text: 'The operand is not evaluated at the call: value-of-operand decides what is passed.',
      },
      {
        anchor: '(newref (a-thunk exp env))',
        text: 'A variable passes its own location, as in call-by-reference. Any other operand is frozen in a thunk, the expression with its env, in a new location.',
      },
      {
        anchor: '(let ((v1 (value-of-thunk w)))',
        text: "Looking up a variable whose location holds a thunk evaluates it, in the thunk's saved env.",
      },
      {
        anchor: '(setref! ref1 v1)',
        text: 'Then the value replaces the thunk in the location, so the operand is evaluated at most once.',
      },
      {
        anchor: '(define-datatype thunk thunk?',
        text: 'A thunk is the expression and the env it was written in.',
      },
    ],
    runBoth: [
      {
        title: 'Book §4.5.2: a loop never run',
        source: LOOP_NEVER_RUN,
        look: 'Call-by-value evaluates (infinite-loop 0) before calling f, and never gets there. Call-by-need freezes it in a thunk that f never needs.',
      },
      {
        title: 'Book Ex. 4.38: makerec',
        source: MAKEREC_438,
        measure: 'thunks',
        look: 'The book asks what call-by-value does here: (f (d d)) evaluates (d d) first, which calls (x x) again, forever. Call-by-need waits until times4 needs the recursive call.',
      },
      {
        title: 'Ours: when is the operand evaluated?',
        source: WHEN_EVALUATED,
        measure: 'thunks',
        look: 'Call-by-value evaluates -(c,0) at the call, when c is 0. Call-by-need evaluates it when x is first used, after set c = 10.',
      },
      {
        title: 'Ours: an error never reached',
        source: ERROR_NEVER_REACHED,
        look: 'The second operand is an error (zero?(0) is not a number). Call-by-value evaluates it at the call; call-by-need never does, because y is not used.',
      },
    ],
  },
  {
    id: 'letrec-cps',
    group: 'Chapter 5',
    from: { id: 'letrec' },
    to: { id: 'cps' },
    summary: 'The same language, but the interpreter passes the rest of the work as a continuation.',
    notes: [
      {
        anchor: '(define value-of/k',
        text: 'value-of/k takes a third argument, the continuation: what to do with the value. Every call it makes is a tail call.',
      },
      {
        anchor: '(diff1-cont exp2 env cont)',
        text: 'To evaluate -(e1,e2), evaluate e1 with a diff1-cont that remembers e2 and env. The work left to do is now a data structure.',
      },
      {
        anchor: '(define-datatype continuation continuation?',
        text: "One continuation variant per place where a sub-expression's value is awaited.",
      },
      {
        anchor: '(define apply-cont',
        text: 'apply-cont sends a value to a continuation, which does the waiting work. end-cont ends the run.',
      },
    ],
    runBoth: [
      {
        title: 'Lecture 24: a tail call',
        source: TAIL_LOOP,
        measure: 'control',
        look: 'Same value. (loop -(n,1)) is a tail call: the CPS interpreter calls it with the same continuation, so the control context stays small. The LETREC interpreter nests one more value-of for every call.',
      },
      {
        title: 'Book Ex. 5.14: a sum, recursive',
        source: SUM,
        measure: 'control',
        look: 'Same value. The recursive call is an operand of -(…, …), so its value is awaited: the continuation grows by one frame per call in CPS too. The LETREC interpreter nests several value-of calls for each pending call, so its number grows faster.',
      },
      {
        title: 'Book Ex. 5.14: a sum, with an accumulator',
        source: SUM_ITER,
        measure: 'control',
        look: 'Same value, and the same sum as the recursive one, but every call is a tail call: the continuation stays the same size however large n is. Try n = 20 in both.',
      },
      {
        title: 'Book Ex. 5.13: fact 4',
        source: FACT,
        measure: 'control',
        look: 'Same value. fact waits for (fact -(n,1)) before multiplying, as (* 4 (* 3 …)) does in the book: the continuation grows with n.',
      },
    ],
  },
  {
    id: 'cps-trampolined',
    group: 'Chapter 5',
    from: { id: 'cps' },
    to: { id: 'trampolined' },
    summary: 'The CPS interpreter, with apply-procedure/k returning a bounce. (Our TS ports; it reuses the CPS continuations.)',
    notes: [
      {
        anchor: 'type Bounce = ExpVal | (() => Bounce);',
        text: 'A bounce is the final value or a procedure of no arguments that goes on with the computation.',
      },
      {
        anchor: 'return () => valueOfK(',
        text: 'apply-procedure/k does not call value-of/k: it returns a procedure that will.',
      },
      {
        anchor: "while (typeof bounce === 'function')",
        text: 'The trampoline calls bounces until it gets a value. The stack is empty again at each bounce.',
      },
    ],
    runBoth: [
      {
        title: 'Lecture 26: a loop, bouncing',
        source: TAIL_LOOP,
        measure: 'bounces',
        look: 'Same value and the same steps. TRAMPOLINED returns to the trampoline once per procedure call, so the stack never grows.',
      },
      {
        title: 'Lecture 26: a bounce per call',
        source: 'letrec double(x) = if zero?(x)\n                   then 0\n                   else -((double -(x,1)), -2)\nin (double 3)',
        measure: 'bounces',
        look: 'Same value. double is called 4 times, so there are 4 bounces, even though the calls are not tail calls: the continuation remembers what is left to do.',
      },
      {
        title: 'Book Ex. 5.13: fact 4',
        source: FACT,
        measure: 'bounces',
        look: 'Same value. Every call, to fact and to times and to the procedure times returns, is one bounce.',
      },
    ],
  },
];

export function moduleOf(side: Side): LanguageModule {
  const entry = languageById(side.id)!;
  if (!side.variant) return entry.module!;
  return entry.variants!.modules.find((m) => m.variant?.id === side.variant)!;
}

/** Whose official code and grammar to show for this side. */
export function codeOf(side: Side): LanguageModule {
  return side.codeOf ? languageById(side.codeOf)!.module! : moduleOf(side);
}

export function nameOf(side: Side): string {
  return side.label ?? (side.variant ? `${languageById(side.id)!.name} (${side.variant})` : languageById(side.id)!.name);
}

/** The comparison Compare opens on for the language open in Explore: the one that leads to it. */
export function comparisonFor(id: LanguageId): Comparison {
  return COMPARISONS.find((c) => c.to.id === id) ?? COMPARISONS[0];
}

const isVar = (trace: Trace, i: number) => {
  const s = trace.steps[i];
  return s.kind === 'value-of' && s.exp.kind === 'var-exp';
};

export const MEASURES: Record<Measure, { readonly label: string; of(trace: Trace): number }> = {
  'by-name': { label: 'variables looked up by name', of: (t) => t.steps.filter((_, i) => isVar(t, i)).length },
  locations: { label: 'locations made', of: (t) => t.events.filter((e) => e.kind === 'newref').length },
  // A thunk's expression is evaluated by a value-of call made inside the var-exp that found it.
  thunks: { label: 'thunks evaluated', of: (t) => t.steps.filter((s) => s.parent >= 0 && isVar(t, s.parent)).length },
  control: { label: 'largest control context', of: (t) => t.steps.reduce((max, s) => Math.max(max, s.depth), 0) },
  bounces: { label: 'bounces', of: (t) => t.steps.filter((s) => s.kind === 'value-of/k' && s.bounced).length },
};
