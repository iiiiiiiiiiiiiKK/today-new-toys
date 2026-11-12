import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Light / dark theme.
 *
 * The whole palette is CSS custom properties on `:root`, so a theme is one
 * `data-theme` attribute on <html> plus a second token block in theme-light.css —
 * no component knows which theme is active.
 *
 * Two different states, deliberately kept apart:
 *   - `theme`     what is painted right now
 *   - `explicit`  whether the visitor picked it, versus following the OS
 *
 * Only an explicit choice is persisted. If we wrote the OS-derived theme to
 * localStorage (the previous behaviour), the very next OS change would be swallowed
 * because the stored key made everything look like a user decision.
 *
 * An inline script in index.html applies the stored value before first paint so the
 * page never flashes the wrong palette.
 */
export type Theme = 'light' | 'dark';

/** Stores only the visitor's explicit choice. Absent = follow the OS. */
export const STORAGE_KEY = 'toys.theme';

interface ThemeApi {
  theme: Theme;
  /** True when the visitor chose the theme; false while following the OS. */
  explicit: boolean;
  toggle: () => void;
  set: (theme: Theme) => void;
  /** Drop the explicit choice and follow the OS again. */
  followSystem: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

const prefersLight = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: light)').matches);

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    /* private mode */
    return null;
  }
}

function readInitial(): { theme: Theme; explicit: boolean } {
  const stored = readStored();
  if (stored) return { theme: stored, explicit: true };
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.theme : null;
  if (attr === 'light' || attr === 'dark') return { theme: attr, explicit: false };
  return { theme: prefersLight() ? 'light' : 'dark', explicit: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readInitial, []);
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [explicit, setExplicit] = useState(initial.explicit);

  // Paint + keep the browser chrome in step. Storage is written by the actions,
  // never by this effect, so following the OS does not become a stored choice.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f4ec' : '#07070a');
  }, [theme]);

  // Keep following the OS while there is no explicit choice.
  useEffect(() => {
    if (explicit) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const onChange = (event: MediaQueryListEvent) => setThemeState(event.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  // Another tab may flip the choice; mirror it instead of drifting.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        setThemeState(event.newValue);
        setExplicit(true);
      } else {
        setExplicit(false);
        setThemeState(prefersLight() ? 'light' : 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const write = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* nothing to persist in private mode */
    }
  }, []);

  const set = useCallback(
    (next: Theme) => {
      setThemeState(next);
      setExplicit(true);
      write(next);
    },
    [write],
  );

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      write(next);
      return next;
    });
    setExplicit(true);
  }, [write]);

  const followSystem = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setExplicit(false);
    setThemeState(prefersLight() ? 'light' : 'dark');
  }, []);

  const value = useMemo(
    () => ({ theme, explicit, toggle, set, followSystem }),
    [theme, explicit, toggle, set, followSystem],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}
