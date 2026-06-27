import { useCallback, useState } from 'react';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'rta.theme';

export function readTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* v8 ignore next -- storage can be unavailable in private or locked-down browsers. */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(readTheme);
  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next: ThemeName = previous === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
