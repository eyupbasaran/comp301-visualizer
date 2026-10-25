// The slider at the bottom. Positions run 0..steps.length; the last one is the end of the run.

interface Props {
  position: number;
  count: number;
  /** False when there is no run to step through, e.g. after a parse error. */
  enabled: boolean;
  onChange(position: number): void;
}

export function StepBar({ position, count, enabled, onChange }: Props) {
  const go = (p: number) => onChange(Math.max(0, Math.min(count, p)));
  const label = !enabled ? 'no run' : position < count ? `${position + 1} / ${count}` : `end / ${count}`;
  return (
    <footer className="stepbar">
      <button type="button" className="icon-button" aria-label="Previous step" disabled={!enabled || position === 0} onClick={() => go(position - 1)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M11 3 L5 9 L11 15" />
        </svg>
      </button>
      <button type="button" className="icon-button" aria-label="Next step" disabled={!enabled || position === count} onClick={() => go(position + 1)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M7 3 L13 9 L7 15" />
        </svg>
      </button>
      <label htmlFor="step" className="label">
        Step
      </label>
      <input
        id="step"
        type="range"
        min={0}
        max={count}
        value={position}
        disabled={!enabled}
        onChange={(e) => go(Number(e.target.value))}
      />
      <div className="stepbar-count">{label}</div>
      <div className="label">← → to step</div>
    </footer>
  );
}
