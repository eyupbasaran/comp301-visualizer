// Draws the layout from envLayout.ts: frame and closure boxes, with the arrows underneath.
//
// Boxes keep their key from step to step, so after a single step they glide
// to their new place and new ones fade in (styles.css). An arrow is keyed by
// its path too: one that changed is drawn again rather than bent in place.

import { useEffect, useId, useRef } from 'react';
import type { Diagram } from './envLayout';

const arrowKey = (arrow: Diagram['arrows'][number]) => `${arrow.key} ${arrow.d}`;

export function EnvDiagram({ diagram }: { diagram: Diagram }) {
  // Marker ids must be unique on the page: the help dialog draws diagrams too.
  const id = useId().replace(/:/g, '');
  // What was on screen last time: only boxes and arrows that are new get the "entering" class.
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    seen.current = new Set([...diagram.cards.map((c) => c.key), ...diagram.arrows.map(arrowKey)]);
  }, [diagram]);
  const entering = (key: string) => (seen.current.has(key) ? '' : ' entering');

  return (
    <div className="env-scroll">
      <div className="env-host" style={{ width: diagram.width, height: diagram.height }}>
        <svg className="env-arrows" width={diagram.width} height={diagram.height} aria-hidden="true">
          <defs>
            <marker id={`${id}-chain`} orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
              <path d="M0 0 L4 2 L0 4 Z" className="head-chain" />
            </marker>
            <marker id={`${id}-muted`} orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
              <path d="M0 0 L4 2 L0 4 Z" className="head-muted" />
            </marker>
          </defs>
          {diagram.arrows.map((arrow) => (
            <path
              key={arrowKey(arrow)}
              d={arrow.d}
              pathLength={1}
              className={`arrow ${arrow.emphasis}${entering(arrowKey(arrow))}`}
              markerEnd={`url(#${id}-${arrow.emphasis})`}
            />
          ))}
        </svg>
        {diagram.labels.map((label) => (
          <span key={label.key} className={`env-label ${label.emphasis}`} style={{ left: label.x, top: label.y }}>
            {label.text}
          </span>
        ))}
        {diagram.cards.map((card) => (
          <div key={card.key}>
            {card.caption && (
              <div className={`env-caption ${card.kind}`} style={{ left: card.x, top: card.y - 22 }}>
                {card.caption}
              </div>
            )}
            <div
              className={`env-card ${card.kind} ${card.emphasis}${entering(card.key)}`}
              style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
            >
              {card.name && <i className="rho">{card.name}</i>}
              <span>
                {card.parts.map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
