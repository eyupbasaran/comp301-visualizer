#lang racket/base
;; racket run.rkt programs.json racket.json
;; Runs each program with the official `run` of its language (langs/<lang>, made by
;; prepare.mjs) and records the outcome, the step count and what each step saw (steps.rkt).
(require json racket/port racket/runtime-path racket/file "steps.rkt")

(define-runtime-path langs "langs")

(define runners (make-hash))
(define (runner lang)
  (hash-ref! runners lang
             (lambda ()
               (define dir (build-path langs lang))
               (define top (if (file-exists? (build-path dir "top-interp.scm")) "top-interp.scm" "top.scm"))
               (define store (build-path dir "store.scm"))
               (cons (dynamic-require (build-path dir top) 'run)
                     (and (file-exists? store) (dynamic-require store 'get-store-as-list))))))

(define args (current-command-line-arguments))
(define programs (call-with-input-file (vector-ref args 0) read-json))

(define results
  (for/list ([p (in-list programs)])
    (define r (runner (hash-ref p 'lang)))
    (set-store-getter! (cdr r))
    (reset-steps!)
    (define outcome
      (with-handlers ([(lambda (v) (eq? v 'step-limit)) (lambda (_) (hasheq 'kind "limit"))]
                      [exn:fail? (lambda (e) (hasheq 'kind "error" 'message (exn-message e)))])
        (define v
          (parameterize ([current-output-port (open-output-nowhere)])
            ((car r) (hash-ref p 'program))))
        (hasheq 'kind "value" 'value (canon->string v))))
    (hash-set* outcome 'key (hash-ref p 'key) 'steps (steps-taken) 'seen (steps-seen))))

(call-with-output-file (vector-ref args 1) #:exists 'replace
  (lambda (out) (write-json results out)))
(printf "ran ~a programs\n" (length results))
