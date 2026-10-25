// Draws the layout from envLayout.ts: frame and closure boxes, with the arrows underneath.

import type { Diagram } from './envLayout';

export function EnvDiagram({ diagram }: { diagram: Diagram }) {
  return (
    <div className="env-scroll">
      <div className="env-host" style={{ width: diagram.width, height: diagram.height }}>
        <svg className="env-arrows" width={diagram.width} height={diagram.height} aria-hidden="true">
          <defs>
            <marker id="head-chain" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
              <path d="M0 0 L4 2 L0 4 Z" className="head-chain" />
            </marker>
            <marker id="head-muted" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible">
              <path d="M0 0 L4 2 L0 4 Z" className="head-muted" />
            </marker>
          </defs>
          {diagram.arrows.map((arrow) => (
            <path key={arrow.key} d={arrow.d} className={`arrow ${arrow.emphasis}`} markerEnd={`url(#head-${arrow.emphasis})`} />
          ))}
        </svg>
        {diagram.cards.map((card) => (
          <div key={card.key}>
            {card.caption && (
              <div className={`env-caption ${card.kind}`} style={{ left: card.x, top: card.y - 22 }}>
                {card.caption}
              </div>
            )}
            <div
              className={`env-card ${card.kind} ${card.emphasis}`}
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
