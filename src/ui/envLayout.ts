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

import { sourceOf } from '../core/ast';
import type { Env, Frame } from '../core/env';
import { frameBinding, framesOf } from '../core/env';
import type { ApplyContStep, Step, Trace } from '../core/trace';
import type { ExpVal, Proc } from '../core/values';
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

interface Closure {
  readonly key: string;
  readonly owner: Node;
  readonly proc: Proc | null;
  readonly text: string;
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

function closureOf(v: ExpVal | number): Proc | null {
  return typeof v !== 'number' && v.tag === 'proc-val' ? v.proc : null;
}

function width(chars: number): number {
  return Math.max(120, Math.ceil((24 + CHAR * chars) / 4) * 4);
}

export function layoutEnv(trace: Trace, position: number): Diagram {
  const step = trace.steps[position];
  if (!step || step.kind === 'apply-cont') return EMPTY_DIAGRAM;
  const { names, initIds } = frameNames(trace);

  // 1. Which frames to draw.
  const frames = new Map<number, Frame>();
  const queue: Env[] = [step.env];
  const caller = callerEnv(trace, step);
  if (caller) queue.push(caller);
  while (queue.length > 0 && frames.size < MAX_FRAMES) {
    for (let e = queue.shift()!; e.kind !== 'empty-env' && !frames.has(e.id); e = e.savedEnv) {
      frames.set(e.id, e);
      if (e.kind === 'extend-env') {
        const proc = closureOf(e.bval);
        if (proc) queue.push(proc.savedEnv);
      }
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
  const partsOf = (node: Node): CardPart[] => {
    const found = step.exp.kind === 'var-exp' ? frameBinding(step.env, (step.exp as unknown as { var: string }).var) : null;
    const bindings = node.frames.flatMap((frame): CardPart[] => {
      switch (frame.kind) {
        case 'extend-env': {
          const sep = node === init ? '=' : ' = ';
          return [{ text: `${frame.bvar}${sep}${boxValue(frame.bval)}`, mark: frame === found }];
        }
        case 'extend-env-rec':
          return [{ text: `${frame.pName} = ●`, mark: frame === found }];
        case 'extend-env-rec*':
          return [{ text: frame.pNames.map((p) => `${p} = ●`).join('  '), mark: frame === found }];
        case 'extend-nameless-env':
          return [{ text: boxValue(frame.val) }];
      }
    });
    return bindings.flatMap((part, i) => (i === 0 ? [part] : [{ text: '  ' }, part]));
  };
  const closures: Closure[] = [];
  for (const node of all) {
    const frame = node.frames[0];
    if (node === init) continue;
    if (frame.kind === 'extend-env') {
      const proc = closureOf(frame.bval);
      if (proc) {
        const body = sourceOf(trace.program, proc.body).replace(/\s+/g, ' ');
        const text = `procedure ${proc.bvar ?? ''} ${body.length > 22 ? body.slice(0, 21) + '…' : body}`;
        closures.push({ key: `c${proc.id}`, owner: node, proc, text, target: nodeOf(proc.savedEnv) });
      }
    } else if (frame.kind === 'extend-env-rec') {
      const body = sourceOf(trace.program, frame.pBody).replace(/\s+/g, ' ');
      const text = `procedure ${frame.bVar} ${body.length > 22 ? body.slice(0, 21) + '…' : body}`;
      closures.push({ key: `r${frame.id}`, owner: node, proc: null, text, target: node });
    }
  }

  // 5. Sizes and positions. Every frame in a column gets the column's width.
  const cols = nextCol;
  const frameW = Array<number>(cols).fill(120);
  const laneW = Array<number>(cols).fill(0);
  const label = (node: Node) => names.get(node.minId) ?? '?';
  for (const node of all) {
    const chars = label(node).length + 3 + partsOf(node).reduce((n, p) => n + p.text.length, 0);
    frameW[node.col] = Math.max(frameW[node.col], width(chars));
  }
  for (const c of closures) laneW[c.owner.col] = Math.max(laneW[c.owner.col], width(c.text.length));
  const colX: number[] = [];
  for (let c = 0, x = PAD; c < cols; c++) {
    colX.push(x);
    x += frameW[c] + (laneW[c] > 0 ? LANE_GAP + laneW[c] : 0) + COL_GAP;
  }
  const at = (node: Node) => ({ x: colX[node.col], y: TOP + (maxDepth - node.depth) * ROW, w: frameW[node.col] });

  // 6. Cards, then arrows.
  const runningProc = runningClosure(step, closures);
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
      caption: node === current ? 'env of this step' : null,
    };
  });
  for (const c of closures) {
    const { x, y, w } = at(c.owner);
    cards.push({
      key: c.key,
      kind: 'closure',
      x: x + w + LANE_GAP,
      y,
      w: laneW[c.owner.col],
      h: CARD_H,
      name: null,
      parts: [{ text: c.text }],
      emphasis: c.proc !== null && c.proc === runningProc ? 'current' : c.owner.onChain ? 'chain' : 'muted',
      caption: c.proc !== null && c.proc === runningProc ? 'running' : null,
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
    const sy = owner.y + CARD_H;
    const pointer = c.proc === runningProc ? 'chain' : emphasis;
    if (c.target === c.owner) {
      const ex = owner.x + owner.w * 0.75;
      const ey = owner.y + CARD_H + 1;
      arrows.push({ key: `s${c.key}`, d: `M ${sx} ${sy} C ${sx} ${sy + 40}, ${ex} ${ey + 40}, ${ex} ${ey}`, emphasis });
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
  return { width: right + PAD, height: TOP + maxDepth * ROW + CARD_H + PAD, cards, arrows, labels };
}

/** The closure whose body this step is running in: its body contains the expression, and its saved env is on this step's chain. */
function runningClosure(step: EnvStep, closures: readonly Closure[]): Proc | null {
  const chain = new Set(framesOf(step.env).map((f) => f.id));
  for (const c of closures) {
    const p = c.proc;
    if (!p || p.savedEnv.kind === 'empty-env' || !chain.has(p.savedEnv.id)) continue;
    if (p.body.span.from <= step.exp.span.from && step.exp.span.to <= p.body.span.to) return p;
  }
  return null;
}
