// Extend mode: guided practice for "extend the language" questions. The student writes
// (a) the grammar entry, (b) the abstract syntax, (c) the define-datatype entry,
// (d) the specification and (e) the implementation. (a) is tried live against the base
// grammar and the example programs; (b) and (c) are checked against (a); (d) and (e)
// are compared with a model answer. Loaded only when opened.

import { useMemo, useState, type ReactNode } from 'react';
import { printProduction } from '../../compare/grammarDiff';
import { schemeFiles } from '../../compare/sources';
import { eoplName, fieldsOf, isAstNode, type AstNode, type FieldValue } from '../../core/ast';
import { GrammarError } from '../../core/grammar';
import type { LanguageModule } from '../../core/language';
import { clauseOf, extendGrammar } from '../../extend/extend';
import { baseOf, EXERCISES, modelLanguage, type Exercise } from '../../extend/exercises';
import {
  checkAbstract,
  checkDatatype,
  defaultNames,
  printAbstract,
  printDatatype,
  readAbstract,
  readDatatype,
  readEntry,
  ReadError,
  slotsOf,
  toProduction,
  type Abstract,
  type Entry,
} from '../../extend/grammarText';
import { useStoredText } from '../Splitter';
import { RunBoth } from '../compare/RunBoth';

interface Props {
  onOpen(module: LanguageModule, source: string): void;
}

export default function ExtendPage({ onOpen }: Props) {
  const [id, setId] = useStoredText('comp301.extend.exercise', EXERCISES[0].id);
  const exercise = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  return (
    <div className="compare extend">
      <div className="compare-bar">
        <div className="field">
          <label htmlFor="extend-exercise">Exercise</label>
          <select id="extend-exercise" className="mono" value={exercise.id} onChange={(e) => setId(e.target.value)}>
            {EXERCISES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <span className="badge">extends {baseOf(exercise).name}</span>
      </div>
      <ExercisePanel key={exercise.id} exercise={exercise} onOpen={onOpen} />
    </div>
  );
}

function attempt<T>(f: () => T): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    return { ok: true, value: f() };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e };
    throw e;
  }
}

function ExercisePanel({ exercise, onOpen }: { exercise: Exercise; onOpen: Props['onOpen'] }) {
  const key = (part: string) => `comp301.extend.${exercise.id}.${part}`;
  const [a, setA] = useStoredText(key('a'), '');
  const [b, setB] = useStoredText(key('b'), '');
  const [c, setC] = useStoredText(key('c'), '');
  const [d, setD] = useStoredText(key('d'), '');
  const [e, setE] = useStoredText(key('e'), '');
  const [pick, setPick] = useState(0);
  const base = baseOf(exercise);
  const model = useMemo(() => modelLanguage(exercise), [exercise]);

  const entry = useMemo(() => (a.trim() ? attempt(() => readEntry(a)) : null), [a]);
  const abstract = useMemo(() => (b.trim() ? attempt(() => readAbstract(b)) : null), [b]);
  const named: Abstract | null =
    entry?.ok && abstract?.ok && checkAbstract(entry.value, abstract.value).length === 0 ? abstract.value : null;
  const grammar = useMemo(
    () => (entry?.ok ? attempt(() => extendGrammar(base, toProduction(entry.value, named))) : null),
    [entry, named, base],
  );

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>The question</h2>
          <span className="label">{exercise.title}</span>
        </div>
        <p className="question">{exercise.question}</p>
        <p className="step-note">Write each part below. Parts (a)–(c) are checked; for (d) and (e), compare yours with the model answer.</p>
      </section>

      <Step
        letter="a"
        title="Concrete grammar"
        hint="The book's notation, Expression ::= …, or an SLLGEN entry, (expression (…) name-exp)."
        value={a}
        onChange={setA}
        rows={2}
        placeholder="Expression ::= …"
        answer={<pre className="mono answer">{`${exercise.answer.grammar}\n\nIn lang.scm:\n${printProduction(toProduction(readEntry(exercise.answer.grammar), readAbstract(exercise.answer.abstract)))}`}</pre>}
        onUse={() => setA(exercise.answer.grammar)}
      >
        {entry && !entry.ok && <ReadProblem text={a} error={entry.error} />}
        {grammar && !grammar.ok && (
          <p className="status bad">
            ✗ {grammar.error instanceof GrammarError ? `It does not fit ${base.name}'s grammar: ${grammar.error.message}` : grammar.error.message}
          </p>
        )}
        {entry?.ok && grammar?.ok && (
          <>
            <p className="status good">✓ Fits {base.name}'s grammar (still LL(1)). In lang.scm this is:</p>
            <pre className="mono answer">{printProduction(toProduction(entry.value, named))}</pre>
            <ul className="example-checks">
              {exercise.examples.map((ex, i) => {
                const parsed = attempt(() => grammar.value.parse(ex.source));
                return (
                  <li key={i}>
                    <button type="button" className="link-button" aria-pressed={pick === i} onClick={() => setPick(i)}>
                      Example {i + 1}
                    </button>{' '}
                    {parsed.ok ? <span className="status good">✓ parses</span> : <span className="status bad">✗ {parsed.error.message}</span>}
                  </li>
                );
              })}
            </ul>
            <FieldTreeOf entry={entry.value} named={named} source={exercise.examples[pick].source} parse={(s) => grammar.value.parse(s)} />
          </>
        )}
      </Step>

      <Step
        letter="b"
        title="Abstract syntax"
        hint="The variant and its fields: one for each Expression, Identifier and Number in (a), never for a keyword."
        value={b}
        onChange={setB}
        rows={1}
        placeholder="name-exp (field1 field2 …)"
        check={() => {
          if (!entry?.ok) return ['Write (a) first: (b) is checked against it.'];
          if (!abstract?.ok) return [abstract?.error.message ?? 'Write the abstract syntax.'];
          return checkAbstract(entry.value, abstract.value);
        }}
        answer={
          <>
            <pre className="mono answer">{exercise.answer.abstract}</pre>
            {entry?.ok && (
              <p className="step-note">
                From your (a), with default names:{' '}
                <code>{printAbstract(entry.value.variant ?? 'name-exp', defaultNames(slotsOf(entry.value)))}</code>. Any names work, as long as
                there is one per field, in order.
              </p>
            )}
          </>
        }
        onUse={() => setB(exercise.answer.abstract)}
      />

      <Step
        letter="c"
        title="define-datatype entry"
        hint="The variant again, with a predicate for each field: what kind of value it holds."
        value={c}
        onChange={setC}
        rows={4}
        placeholder="(name-exp (field1 predicate?) …)"
        check={() => {
          if (!entry?.ok) return ['Write (a) first: (c) is checked against it.'];
          const dt = attempt(() => readDatatype(c));
          if (!dt.ok) return [dt.error.message];
          return checkDatatype(entry.value, named, dt.value);
        }}
        answer={
          <>
            <pre className="mono answer">{exercise.answer.datatype}</pre>
            {entry?.ok && (
              <>
                <p className="step-note">Generated from your (a){named ? ' and (b)' : ''}:</p>
                <pre className="mono answer">
                  {printDatatype(
                    named?.variant ?? entry.value.variant ?? 'name-exp',
                    named?.fields ?? defaultNames(slotsOf(entry.value)),
                    slotsOf(entry.value),
                  )}
                </pre>
              </>
            )}
          </>
        }
        onUse={() => setC(exercise.answer.datatype)}
      />

      <Step
        letter="d"
        title="Behaviour specification"
        hint="(value-of (name-exp …) ρ) = …: which parts are evaluated, in which env, and what the new env binds."
        value={d}
        onChange={setD}
        rows={4}
        placeholder="(value-of (… ) ρ) = …"
        answer={
          <>
            <pre className="mono answer">{exercise.answer.spec}</pre>
            <Checklist items={exercise.checklist} />
          </>
        }
      />

      <Step
        letter="e"
        title="Implementation"
        hint={`The clause you would add to value-of in ${base.name}'s interp.scm.`}
        value={e}
        onChange={setE}
        rows={6}
        placeholder="(name-exp (…) …)"
        answer={
          <>
            <pre className="mono answer">{exercise.answer.implementation}</pre>
            <RelatedClauses exercise={exercise} />
          </>
        }
      />

      <section className="panel">
        <div className="panel-head">
          <h2>Run it</h2>
          <span className="label">{base.name} with the model answer</span>
        </div>
        <RunBoth
          key={pick}
          sides={[{ name: `${base.name} + ${exercise.id}`, module: model }]}
          sources={[exercise.examples[pick].source]}
          look={exercise.examples.map((ex, i) => `Example ${i + 1}: ${ex.value === 'error' ? 'an error' : ex.value}${ex.note ? ` (${ex.note})` : ''}.`).join(' ')}
          runLabel="Run"
          onOpen={onOpen}
        />
      </section>
    </>
  );
}

interface StepProps {
  letter: string;
  title: string;
  hint: string;
  value: string;
  onChange(text: string): void;
  rows: number;
  placeholder: string;
  /** Mechanical check: the problems, or [] when it is right. */
  check?: () => string[];
  answer: ReactNode;
  onUse?: () => void;
  children?: ReactNode;
}

function Step({ letter, title, hint, value, onChange, rows, placeholder, check, answer, onUse, children }: StepProps) {
  const [checked, setChecked] = useState<string[] | null>(null);
  const [shown, setShown] = useState(false);
  return (
    <section className="panel extend-step">
      <div className="panel-head">
        <h2>
          ({letter}) {title}
        </h2>
        <span className="label">{hint}</span>
      </div>
      <textarea
        className="mono answer-input"
        aria-label={`(${letter}) ${title}`}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(ev) => {
          onChange(ev.target.value);
          setChecked(null);
        }}
      />
      {children}
      <div className="step-actions">
        {check && (
          <button type="button" className="check-button" onClick={() => setChecked(check())}>
            Check
          </button>
        )}
        <button type="button" className="link-button" onClick={() => setShown(!shown)}>
          {shown ? 'Hide the answer' : 'Show the answer'}
        </button>
        {shown && onUse && (
          <button type="button" className="link-button" onClick={onUse}>
            Use it as my answer
          </button>
        )}
      </div>
      {checked && (checked.length === 0 ? <p className="status good">✓ Right.</p> : checked.map((p) => <p key={p} className="status bad">✗ {p}</p>))}
      {shown && <div className="model-answer">{answer}</div>}
    </section>
  );
}

function ReadProblem({ text, error }: { text: string; error: Error }) {
  const at = error instanceof ReadError ? error.at : null;
  return (
    <div>
      <p className="status bad">✗ {error.message}</p>
      {at !== null && (
        <pre className="mono answer caret">
          {text.split('\n')[text.slice(0, at).split('\n').length - 1]}
          {'\n'}
          {' '.repeat(at - (text.lastIndexOf('\n', at - 1) + 1))}^
        </pre>
      )}
    </div>
  );
}

/** The new expression in an example, each part labelled with the field it fills. */
function FieldTreeOf({ entry, named, source, parse }: { entry: Entry; named: Abstract | null; source: string; parse(source: string): { nodes: readonly AstNode[] } }) {
  const parsed = attempt(() => parse(source));
  if (!parsed.ok) return null;
  const variant = toProduction(entry, named)[2];
  const node = parsed.value.nodes.find((n) => n.kind === variant);
  if (!node) return null;
  return (
    <div className="field-tree-wrap">
      <p className="step-note">
        How the example is parsed: {named ? 'your field names' : 'default field names until (b) is right'}.
      </p>
      <pre className="mono example-source">{source}</pre>
      <FieldTree node={node} source={source} />
    </div>
  );
}

function FieldTree({ node, source }: { node: AstNode; source: string }) {
  const text = (v: FieldValue): string =>
    isAstNode(v) ? source.slice(v.span.from, v.span.to).replace(/\s+/g, ' ') : Array.isArray(v) ? `(${v.map(text).join(' ')})` : String(v);
  return (
    <ul className="field-tree mono">
      <li>
        <b>{node.kind}</b>
        <ul>
          {fieldsOf(node).map(([name, value]) => (
            <li key={name}>
              <span className="field-name">{eoplName(name)}</span> = {Array.isArray(value) ? <span className="field-list">list</span> : null}{' '}
              {text(value)}
              {isAstNode(value) && <span className="label"> {value.kind}</span>}
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
}

function Checklist({ items }: { items: readonly string[] }) {
  return (
    <>
      <p className="step-note">A full answer decides:</p>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

function RelatedClauses({ exercise }: { exercise: Exercise }) {
  const interp = schemeFiles(baseOf(exercise)).get('interp.scm') ?? '';
  return (
    <>
      <p className="step-note">The closest clauses already in the official {baseOf(exercise).origin}/interp.scm:</p>
      {exercise.related.map((variant) => (
        <pre key={variant} className="mono answer related">
          {clauseOf(interp, variant)}
        </pre>
      ))}
    </>
  );
}
