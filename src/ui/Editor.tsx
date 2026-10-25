// The program editor (CodeMirror 6). Keywords come from the language's grammar;
// `current` is the expression passed to value-of at this step, `error` a parse error.

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap, lineNumbers, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { useEffect, useRef } from 'react';

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

interface Props {
  value: string;
  onChange(value: string): void;
  onRun(): void;
  keywords: readonly string[];
  current: TextRange | null;
  error: TextRange | null;
}

const keywordMark = Decoration.mark({ class: 'tok-keyword' });
const commentMark = Decoration.mark({ class: 'tok-comment' });
const currentMark = Decoration.mark({ class: 'cm-current' });
const errorMark = Decoration.mark({ class: 'cm-parse-error' });

// Same token shapes as the scanner: identifiers may contain - and ?, % starts a comment.
const TOKEN = /%[^\n]*|\p{Alphabetic}[\p{Alphabetic}0-9_\-?]*/gu;

function syntax(keywords: ReadonlySet<string>) {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const m of view.state.doc.toString().matchAll(TOKEN)) {
      const from = m.index;
      const to = from + m[0].length;
      if (m[0].startsWith('%')) builder.add(from, to, commentMark);
      else if (keywords.has(m[0])) builder.add(from, to, keywordMark);
    }
    return builder.finish();
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

const setMarks = StateEffect.define<{ current: TextRange | null; error: TextRange | null }>();

const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setMarks)) continue;
      const length = tr.state.doc.length;
      const ranges = [];
      const { current, error } = effect.value;
      if (current && current.from < current.to && current.to <= length) ranges.push(currentMark.range(current.from, current.to));
      if (error && length > 0) {
        // An error at the very end (or on an empty span) underlines the last character.
        const to = Math.min(Math.max(error.to, error.from + 1), length);
        const from = Math.min(error.from, to - 1);
        ranges.push(errorMark.range(from, to));
      }
      next = Decoration.set(ranges, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function Editor({ value, onChange, onRun, keywords, current, error }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };
  const syntaxSlot = useRef(new Compartment());

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([
            { key: 'Mod-Enter', run: () => (callbacks.current.onRun(), true) },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          marks,
          syntaxSlot.current.of(syntax(new Set(keywords))),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Program' }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
    // Made once; the effects below keep it in sync with the props.
  }, []);

  useEffect(() => {
    const editor = view.current!;
    if (editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current!.dispatch({ effects: syntaxSlot.current.reconfigure(syntax(new Set(keywords))) });
  }, [keywords]);

  const cf = current?.from;
  const ct = current?.to;
  const ef = error?.from;
  const et = error?.to;
  useEffect(() => {
    const editor = view.current!;
    const range = cf !== undefined && ct !== undefined ? { from: cf, to: ct } : null;
    const bad = ef !== undefined && et !== undefined ? { from: ef, to: et } : null;
    const effects: StateEffect<unknown>[] = [setMarks.of({ current: range, error: bad })];
    const target = range ?? bad;
    if (target && target.from <= editor.state.doc.length) effects.push(EditorView.scrollIntoView(target.from, { y: 'nearest' }));
    editor.dispatch({ effects });
  }, [cf, ct, ef, et]);

  return <div className="editor" ref={host} />;
}
