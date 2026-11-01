// The continuation of this step as a stack of frames, innermost on top.
// Frames come from contLayout.ts.

import type { ContView } from './contLayout';

export function ContPanel({ view }: { view: ContView }) {
  return (
    <div className="cont">
      {view.bounced && <p className="cont-bounce">The trampoline has just called a bounce: the stack starts again from here.</p>}
      {view.sinceBounce !== null && !view.bounced && (
        <p className="cont-note">
          {view.sinceBounce} step{view.sinceBounce === 1 ? '' : 's'} since {view.bouncedBefore ? 'the last bounce' : 'the start; no bounce yet'}
        </p>
      )}
      {view.val && (
        <p className="cont-val">
          <span className="mono">{view.val}</span> goes to the top frame
        </p>
      )}
      <ol className="cont-stack">
        {view.frames.map((f, i) => (
          <li key={f.key} className={['cont-frame', i === 0 && view.val ? 'applied' : '', f.fresh ? 'fresh' : ''].filter(Boolean).join(' ')}>
            <span className="cont-kind">{f.kind}</span>
            {f.fields.map((field) => (
              <span key={field.name} className="cont-field">
                <i>{field.name}</i> {field.text}
              </span>
            ))}
          </li>
        ))}
        {view.hidden > 0 && <li className="cont-more">… {view.hidden} more frames down to end-cont</li>}
      </ol>
    </div>
  );
}
