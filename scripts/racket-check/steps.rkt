#lang racket/base
;; The step hook of the patched official interpreters (see prepare.mjs). Every step records
;; what it sees, in a canonical form that tests/racket/canon.ts produces from our traces too:
;; a define-datatype record becomes (variant field ...), a list stays a list, and anything
;; else is itself. Each part is kept as the SHA-1 of its printed form, or as the printed
;; form itself when RACKET_CHECK_FULL is set (to read a difference).
(require file/sha1)
(provide step! reset-steps! steps-taken steps-seen set-store-getter! canon->string)

(define limit 100000) ; DEFAULT_STEP_LIMIT in src/core/trace.ts
(define kept 2000)    ; steps whose state is recorded; later ones are only counted
(define full? (and (getenv "RACKET_CHECK_FULL") #t))

(define taken 0)
(define seen '()) ; newest first
(define store-getter #f)

(define (set-store-getter! getter) (set! store-getter getter))
(define (reset-steps!) (set! taken 0) (set! seen '()))
(define (steps-taken) taken)
(define (steps-seen) (reverse seen))

(define (canon v)
  (cond
    [(struct? v)
     (let ([parts (vector->list (struct->vector v))])
       (cons (variant-name (car parts)) (map canon (cdr parts))))]
    [(pair? v) (cons (canon (car v)) (canon (cdr v)))]
    [else v]))

;; 'struct:extend-env -> 'extend-env
(define (variant-name s)
  (string->symbol (substring (symbol->string s) (string-length "struct:"))))

(define (canon->string v) (format "~s" (canon v)))

(define (part v)
  (let ([text (canon->string v)])
    (if full? text (sha1 (open-input-string text)))))

;; (step! 'value-of exp env), (step! 'value-of/k exp env cont), (step! 'apply-cont cont val).
;; The record is the step's kind, its arguments, and the store (#f in a language without one).
(define (step! kind . args)
  (set! taken (add1 taken))
  (when (> taken limit) (raise 'step-limit))
  (when (<= taken kept)
    (let ([store (if store-getter (store-getter) #f)])
      (set! seen (cons (cons (symbol->string kind) (map part (append args (list store)))) seen)))))
