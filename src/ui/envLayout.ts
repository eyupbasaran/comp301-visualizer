// Lays out the environment diagram for one step: which frames to draw, where,
// and the arrows between them. Pure data, so it can be tested without a browser.
//
// Frames form a tree through their saved env, with init-env (ρ0) at the root.
// The diagram draws that tree upside down: ρ0 at the bottom, newer frames
// above it, so a chain reads top to bottom, newest first. A frame that
// branches off sits in a column to the right. A closure is a dashed box next
// to the frame that binds it, with an arrow to the env it saved.
//
// Drawn: the env of this step; the env of the call this step is running for,
// when that is a different chain (so you can see the frames a lookup skips);
// and the env every drawn closure saved.
//
// From IMPLICIT-REFS on, a frame binds a name to a store location (x → 3); a
// closure kept in that location is drawn next to the frame all the same,
// marked with its location. A letrec frame with several procedures gets one
// closure box with a line per procedure: they all saved that frame. In the
// lazy languages a thunk in a location is drawn the same way: its expression,
// and an arrow to the env it saved.

import type { AstNode } from '../core/ast';
import { sourceOf } from '../core/ast';
import type { Env, Frame } from '../core/env';
import { frameBinding, framesOf } from '../core/env';
import { storeAt } from '../core/state';
import type { ApplyContStep, Step, Trace } from '../core/trace';
import type { DenVal, Proc, StoreVal, Thunk } from '../core/values';
import { boxValue, frameNames } from './format';

type EnvStep = Exclude<Step, ApplyContStep>;

export type Emphasis = 'current' | 'chain' | 'muted';

export interface CardPart {
  readonly text: string;
  /** The binding a lookup found at this step. */
  readonly mark?: boolean;
}

export interface DiagramCard {
  readonly key: string;
  readonly kind: 'frame' | 'closure';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly name: string | null;
  readonly parts: readonly CardPart[];
  readonly emphasis: Emphasis;
  readonly caption: string | null;
}

export interface DiagramArrow {
  readonly key: string;
  readonly d: string;
  readonly emphasis: 'chain' | 'muted';
}

/** Text next to an arrow: "saved env" under a closure. */
export interface DiagramLabel {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly emphasis: 'chain' | 'muted';
}

export interface Diagram {
  readonly width: number;
  readonly height: number;
  readonly cards: readonly DiagramCard[];
  readonly arrows: readonly DiagramArrow[];
  readonly labels: readonly DiagramLabel[];
}

export const EMPTY_DIAGRAM: Diagram = { width: 0, height: 0, cards: [], arrows: [], labels: [] };

// Geometry, in px. Text is monospace, so widths follow from character counts.
const CHAR = 8.4;
const CARD_H = 40;
const LINE_H = 20;
const ROW = 74;
const PAD = 20;
const TOP = 30;
const LANE_GAP = 56;
const COL_GAP = 64;
const MAX_FRAMES = 60;

interface Node {
  readonly key: string;
  readonly frames: Frame[];
  readonly minId: number;
  parent: Node | null;
  children: Node[];
  col: number;
  depth: number;
  onChain: boolean;
}

/** A closure box. CALL-BY-NAME and CALL-BY-NEED draw a thunk the same way: an expression with the env it saved. */
interface Closure {
  readonly key: string;
  readonly owner: Node;
  readonly proc: Proc | null;
  readonly thunk: Thunk | null;
  /** One line per procedure; only a letrec frame with several procedures has more than one. */
  readonly lines: readonly string[];
  /** Node of the saved env; the owner itself for a letrec frame. */
  readonly target: Node | null;
}

function stepOf(trace: Trace, index: number): Step | undefined {
  return index >= 0 ? trace.steps[index] : undefined;
}

/** The env of the call this step runs for, if it is not on this step's chain. */
function callerEnv(trace: Trace, step: EnvStep): Env | null {
  const chain = new Set(framesOf(step.env).map((f) => f.id));
  for (let s = stepOf(trace, step.parent); s; s = stepOf(trace, s.parent)) {
    if (s.kind !== 'value-of') break;
    if (s.env.kind !== 'empty-env' && !chain.has(s.env.id)) return s.env;
  }
  return null;
}

/** The closure a binding holds: directly, or (from IMPLICIT-REFS on) in the location it is bound to. */
function closureOf(v: DenVal, store: readonly StoreVal[]): Proc | null {
  const held = typeof v === 'number' ? store[v] : v;
  return held && !('kind' in held) && held.tag === 'proc-val' ? held.proc : null;
}

/** The thunk in the location a binding holds, if any (CALL-BY-NAME, CALL-BY-NEED). */
function thunkOf(v: DenVal, store: readonly StoreVal[]): Thunk | null {
  const held = typeof v === 'number' ? store[v] : null;
  return held && 'kind' in held ? held : null;
}

const short = (text: string) => (text.length > 22 ? text.slice(0, 21) + '…' : text);

function width(chars: number): number {
  return Math.max(120, Math.ceil((24 + CHAR * chars) / 4) * 4);
}

export function layoutEnv(trace: Trace, position: number): Diagram {
  const real = trace.steps[position];
  if (!real) return EMPTY_DIAGRAM;
  // apply-cont has no env of its own: draw the env its continuation frame saved, if it has one.
  let step: EnvStep;
  let caption = 'env of this step';
  if (real.kind === 'apply-cont') {
    const saved = (real.cont as { savedEnv?: Env }).savedEnv;
    if (!saved) return EMPTY_DIAGRAM;
    step = { ...real, kind: 'value-of', exp: null as unknown as AstNode, env: saved };
    caption = `env saved in ${real.cont.kind}`;
  } else {
    step = real;
  }
  const { names, initIds } = frameNames(trace);
  const store = storeAt(trace, position);

  // 1. Which frames to draw.
  const frames = new Map<number, Frame>();
  const queue: Env[] = [step.env];
  const caller = callerEnv(trace, step);
  if (caller) queue.push(caller);
  while (queue.length > 0 && frames.size < MAX_FRAMES) {
    for (let e = queue.shift()!; e.kind !== 'empty-env' && !frames.has(e.id); e = e.savedEnv) {
      frames.set(e.id, e);
      const proc =
        e.kind === 'extend-env' ? closureOf(e.bval, store) : e.kind === 'extend-nameless-env' ? closureOf(e.val, store) : null;
      if (proc) queue.push(proc.savedEnv);
      const thunk = e.kind === 'extend-env' ? thunkOf(e.bval, store) : null;
      if (thunk) queue.push(thunk.env);
    }
  }

  // 2. One node per frame; all init-env frames share the ρ0 node.
  const initFrames = [...frames.values()].filter((f) => initIds.has(f.id)).sort((a, b) => b.id - a.id);
  const nodes = new Map<number, Node>();
  const makeNode = (key: string, fs: Frame[]): Node => ({
    key,
    frames: fs,
    minId: Math.min(...fs.map((f) => f.id)),
    parent: null,
    children: [],
    col: 0,
    depth: 0,
    onChain: false,
  });
  const init = initFrames.length > 0 ? makeNode('init', initFrames) : null;
  for (const f of frames.values()) nodes.set(f.id, init && initIds.has(f.id) ? init : makeNode(`f${f.id}`, [f]));
  const nodeOf = (env: Env): Node | null => (env.kind === 'empty-env' ? null : (nodes.get(env.id) ?? null));

  const all = [...new Set(nodes.values())];
  for (const node of all) {
    if (node === init) continue;
    node.parent = nodeOf(node.frames[0].savedEnv);
    node.parent?.children.push(node);
  }
  for (const f of framesOf(step.env)) {
    const node = nodes.get(f.id);
    if (node) node.onChain = true;
  }
  const current = nodeOf(step.env);

  // 3. Columns and rows. A chain stays in its column; a branch opens a new one.
  let nextCol = 0;
  const place = (node: Node, col: number, depth: number) => {
    node.col = col;
    node.depth = depth;
    node.children.sort((a, b) => Number(b.onChain) - Number(a.onChain) || a.minId - b.minId);
    node.children.forEach((child, i) => place(child, i === 0 ? col : ++nextCol, depth + 1));
  };
  for (const root of all.filter((n) => n.parent === null).sort((a, b) => a.minId - b.minId)) {
    place(root, nextCol, 0);
    nextCol++;
  }
  const maxDepth = Math.max(0, ...all.map((n) => n.depth));

  // 4. Card text.
  // A nameless env has no names: each frame shows its position in this step's
  // env (#0 is the newest), which is the n of %lexref n.
  const slot = new Map(framesOf(step.env).map((f, i) => [f.id, i]));
  const exp = (step.exp ?? { kind: 'none' }) as unknown as { kind: string; var?: string; n?: bigint };
  // The binding apply-env finds at this step: a variable, or the target of set.
  const found =
    exp.kind === 'var-exp' || exp.kind === 'assign-exp'
      ? frameBinding(step.env, exp.var!)
      : exp.kind === 'nameless-var-exp'
        ? (framesOf(step.env)[Number(exp.n)] ?? null)
        : null;
  const partsOf = (node: Node): CardPart[] => {
    const tight = node === init;
    const bindings = node.frames.flatMap((frame): CardPart[] => {
      switch (frame.kind) {
        case 'extend-env': {
          // A location reads "x → 3": the value is in the store, at 3.
          const text =
            typeof frame.bval === 'number'
              ? `${frame.bvar}${tight ? '→' : ' → '}${frame.bval}`
              : `${frame.bvar}${tight ? '=' : ' = '}${boxValue(frame.bval)}`;
          return [{ text, mark: frame === found }];
        }
        case 'extend-env-rec':
          return [{ text: `${frame.pName} = ●`, mark: frame === found }];
        case 'extend-env-rec*':
          return frame.pNames.map((p) => ({ text: `${p} = ●`, mark: frame === found && p === exp.var }));
        case 'extend-nameless-env': {
          const at = slot.get(frame.id);
          return [{ text: at === undefined ? boxValue(frame.val) : `#${at} = ${boxValue(frame.val)}`, mark: frame === found }];
        }
      }
    });
    return bindings.flatMap((part, i) => (i === 0 ? [part] : [{ text: '  ' }, part]));
  };
  const bodyText = (body: AstNode) => short(sourceOf(trace.program, body).replace(/\s+/g, ' '));
  const closures: Closure[] = [];
  for (const node of all) {
    const frame = node.frames[0];
    if (node === init) continue;
    if (frame.kind === 'extend-env' || frame.kind === 'extend-nameless-env') {
      const bound = frame.kind === 'extend-env' ? frame.bval : frame.val;
      // Something kept in the store says where: "3: procedure x …".
      const at = typeof bound === 'number' ? `${bound}: ` : '';
      const proc = closureOf(bound, store);
      const thunk = thunkOf(bound, store);
      if (proc) {
        const head = proc.bvar === null ? 'procedure' : `procedure ${proc.bvar}`;
        closures.push({
          key: `c${proc.id}`,
          owner: node,
          proc,
          thunk: null,
          lines: [`${at}${head} ${bodyText(proc.body)}`],
          target: nodeOf(proc.savedEnv),
        });
      } else if (thunk) {
        closures.push({ key: `t${thunk.id}`, owner: node, proc: null, thunk, lines: [`${at}a-thunk ${bodyText(thunk.exp1)}`], target: nodeOf(thunk.env) });
      }
    } else if (frame.kind === 'extend-env-rec') {
      const lines = [`procedure ${frame.bVar} ${bodyText(frame.pBody)}`];
      closures.push({ key: `r${frame.id}`, owner: node, proc: null, thunk: null, lines, target: node });
    } else if (frame.kind === 'extend-env-rec*') {
      const many = frame.pNames.length > 1;
      const lines = frame.pNames.map((p, i) => `${many ? `${p}: ` : ''}procedure ${frame.bVars[i]} ${bodyText(frame.pBodies[i])}`);
      closures.push({ key: `r${frame.id}`, owner: node, proc: null, thunk: null, lines, target: node });
    }
  }
  const heightOf = (c: Closure) => Math.max(CARD_H, 2 * 10 + LINE_H * c.lines.length);

  // 5. Sizes and positions. Every frame in a column gets the column's width.
  const cols = nextCol;
  const frameW = Array<number>(cols).fill(120);
  const laneW = Array<number>(cols).fill(0);
  const label = (node: Node) => names.get(node.minId) ?? '?';
  for (const node of all) {
    const chars = label(node).length + 3 + partsOf(node).reduce((n, p) => n + p.text.length, 0);
    frameW[node.col] = Math.max(frameW[node.col], width(chars));
  }
  for (const c of closures) {
    laneW[c.owner.col] = Math.max(laneW[c.owner.col], width(Math.max(...c.lines.map((l) => l.length))));
  }
  const colX: number[] = [];
  for (let c = 0, x = PAD; c < cols; c++) {
    colX.push(x);
    x += frameW[c] + (laneW[c] > 0 ? LANE_GAP + laneW[c] : 0) + COL_GAP;
  }
  // Rows from the top (the deepest frames) down to ρ0. A row is as tall as its tallest closure box.
  const rowH = Array<number>(maxDepth + 1).fill(CARD_H);
  for (const c of closures) rowH[c.owner.depth] = Math.max(rowH[c.owner.depth], heightOf(c));
  const rowY: number[] = [];
  for (let d = maxDepth, y = TOP; d >= 0; d--) {
    rowY[d] = y;
    y += rowH[d] + ROW - CARD_H;
  }
  const at = (node: Node) => ({ x: colX[node.col], y: rowY[node.depth], w: frameW[node.col] });

  // 6. Cards, then arrows.
  const running = step.exp ? runningClosure(step, closures) : null;
  const runningKey = running?.closure.key ?? null;
  const cards: DiagramCard[] = all.map((node) => {
    const { x, y, w } = at(node);
    return {
      key: node.key,
      kind: 'frame',
      x,
      y,
      w,
      h: CARD_H,
      name: label(node),
      parts: partsOf(node),
      emphasis: node === current ? 'current' : node.onChain ? 'chain' : 'muted',
      caption: node === current ? caption : null,
    };
  });
  for (const c of closures) {
    const { x, y, w } = at(c.owner);
    const here = c.key === runningKey;
    cards.push({
      key: c.key,
      kind: 'closure',
      x: x + w + LANE_GAP,
      y,
      w: laneW[c.owner.col],
      h: heightOf(c),
      name: null,
      // Several procedures: one line each, and the running one is marked.
      parts: c.lines.flatMap((text, i) => [
        ...(i > 0 ? [{ text: '\n' }] : []),
        { text, mark: c.lines.length > 1 && here && running?.line === i },
      ]),
      emphasis: here ? 'current' : c.owner.onChain ? 'chain' : 'muted',
      caption: here ? 'running' : null,
    });
  }

  const arrows: DiagramArrow[] = [];
  const labels: DiagramLabel[] = [];
  const branchCount = new Map<Node, number>();
  for (const node of all) {
    const parent = node.parent;
    if (!parent) continue;
    const a = at(node);
    const p = at(parent);
    const emphasis = node.onChain && parent.onChain ? 'chain' : 'muted';
    const cx = a.x + a.w / 2;
    if (node.col === parent.col) {
      arrows.push({ key: `e${node.key}`, d: `M ${cx} ${a.y + CARD_H} L ${cx} ${p.y - 1}`, emphasis });
    } else {
      const k = branchCount.get(parent) ?? 0;
      branchCount.set(parent, k + 1);
      const gapY = p.y - 14 - 6 * k;
      const entryX = p.x + p.w - 20 - 12 * k;
      arrows.push({
        key: `e${node.key}`,
        d: `M ${cx} ${a.y + CARD_H} L ${cx} ${gapY} L ${entryX} ${gapY} L ${entryX} ${p.y - 1}`,
        emphasis,
      });
    }
  }
  for (const c of closures) {
    const owner = at(c.owner);
    const cy = owner.y + CARD_H / 2;
    const boxX = owner.x + owner.w + LANE_GAP;
    const emphasis = c.owner.onChain ? 'chain' : 'muted';
    arrows.push({ key: `b${c.key}`, d: `M ${owner.x + owner.w} ${cy} L ${boxX - 1} ${cy}`, emphasis: 'muted' });
    if (!c.target) continue;
    const sx = boxX + laneW[c.owner.col] / 2;
    const sy = owner.y + heightOf(c);
    const pointer = c.key === runningKey ? 'chain' : emphasis;
    if (c.target === c.owner) {
      const ex = owner.x + owner.w * 0.75;
      const ey = owner.y + CARD_H + 1;
      arrows.push({ key: `s${c.key}`, d: `M ${sx} ${sy} C ${sx} ${sy + 40}, ${ex} ${ey + 40}, ${ex} ${ey}`, emphasis: pointer });
    } else {
      const t = at(c.target);
      const ex = t.x + t.w + 1;
      const ey = t.y + CARD_H / 2;
      arrows.push({ key: `s${c.key}`, d: `M ${sx} ${sy} C ${sx} ${(sy + ey) / 2}, ${ex + 48} ${ey}, ${ex} ${ey}`, emphasis: pointer });
    }
    // Just under the closure, beside where its arrow leaves: the gap between rows is free there.
    labels.push({ key: `l${c.key}`, x: sx + 8, y: sy + 5, text: 'saved env', emphasis: pointer });
  }

  if (cards.length === 0) return EMPTY_DIAGRAM;
  const right = Math.max(...cards.map((c) => c.x + c.w));
  const bottom = Math.max(...cards.map((c) => c.y + c.h));
  return { width: right + PAD, height: bottom + PAD, cards, arrows, labels };
}

/**
 * The closure whose body this step is running in, and which of its lines: the
 * body contains the expression, and the closure's saved env is on this step's
 * chain. For a letrec frame the saved env is the frame itself.
 */
function runningClosure(step: EnvStep, closures: readonly Closure[]): { closure: Closure; line: number } | null {
  const chain = new Set(framesOf(step.env).map((f) => f.id));
  const inside = (body: AstNode) => body.span.from <= step.exp.span.from && step.exp.span.to <= body.span.to;
  for (const c of closures) {
    if (c.proc) {
      const saved = c.proc.savedEnv;
      if (saved.kind !== 'empty-env' && chain.has(saved.id) && inside(c.proc.body)) return { closure: c, line: 0 };
      continue;
    }
    if (c.thunk) {
      const saved = c.thunk.env;
      if (saved.kind !== 'empty-env' && chain.has(saved.id) && inside(c.thunk.exp1)) return { closure: c, line: 0 };
      continue;
    }
    const frame = c.owner.frames[0];
    if (!chain.has(frame.id)) continue;
    if (frame.kind === 'extend-env-rec' && inside(frame.pBody)) return { closure: c, line: 0 };
    if (frame.kind === 'extend-env-rec*') {
      const line = frame.pBodies.findIndex(inside);
      if (line !== -1) return { closure: c, line };
    }
  }
  return null;
}
