// Light or dark. Follows the system until the viewer picks one; the pick is kept
// in this browser. index.html applies a kept pick before the page draws.

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const KEY = 'comp301.theme';
const DARK = '(prefers-color-scheme: dark)';

function storedTheme(): Theme | null {
  try {
    const theme = window.localStorage.getItem(KEY);
    return theme === 'light' || theme === 'dark' ? theme : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [picked, setPicked] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(() => (window.matchMedia?.(DARK).matches ? 'dark' : 'light'));

  useEffect(() => {
    const query = window.matchMedia?.(DARK);
    if (!query) return;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (picked) root.dataset.theme = picked;
    else delete root.dataset.theme;
    try {
      if (picked) window.localStorage.setItem(KEY, picked);
    } catch {
      // Blocked storage: the pick lasts until the page is closed.
    }
  }, [picked]);

  const next: Theme = (picked ?? system) === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="theme-toggle" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => setPicked(next)}>
      {next === 'dark' ? (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2z" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
