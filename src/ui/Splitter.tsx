// A drag handle between two areas. Drag it with the mouse, or focus it and use
// the arrow keys (Shift for bigger steps). Double-click puts it back.

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** "vertical": a line between columns, dragged sideways. "horizontal": a line between rows. */
  orientation: 'vertical' | 'horizontal';
  label: string;
  /** The size it controls, in px. */
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  /** The size for a pointer at this position. */
  toValue(clientX: number, clientY: number): number;
  /** Which arrow key makes the size bigger. */
  growKey: 'ArrowRight' | 'ArrowUp';
  onReset(): void;
}

export function Splitter({ orientation, label, value, min, max, onChange, toValue, growKey, onReset }: Props) {
  const dragging = useRef(false);
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)));
  const shrinkKey = growKey === 'ArrowRight' ? 'ArrowLeft' : 'ArrowDown';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      title={`${label}: drag, or double-click to reset`}
      className={`splitter ${orientation}`}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (dragging.current) onChange(clamp(toValue(e.clientX, e.clientY)));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key !== growKey && e.key !== shrinkKey) return;
        // Keep the arrows from also moving the step slider.
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 64 : 16;
        onChange(clamp(value + (e.key === growKey ? step : -step)));
      }}
    />
  );
}

/** A size the viewer chose, kept in this browser only. Falls back quietly where storage is blocked. */
export function useStoredSize(key: string, initial: number): [number, (value: number) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem(key));
      return Number.isFinite(stored) && stored > 0 ? stored : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Private window or blocked storage: the size just isn't remembered.
    }
  }, [key, value]);
  return [value, setValue];
}
