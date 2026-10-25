import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Favorites live in localStorage under one versioned key. They survive reloads,
 * work with no account, and can be exported as JSON/Markdown from the favorites page.
 * Storage failures (private mode, quota) degrade to an in-memory set, never crash.
 */
const KEY = 'newtoys:favorites:v1';
const EVENT = 'newtoys:favorites-changed';

export interface FavoriteEntry {
  slug: string;
  addedAt: string;
}

function read(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is FavoriteEntry => typeof x?.slug === 'string').map((x) => ({ slug: x.slug, addedAt: x.addedAt || new Date().toISOString() }));
  } catch {
    return [];
  }
}

function write(entries: FavoriteEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

interface FavoritesApi {
  slugs: string[];
  entries: FavoriteEntry[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => boolean;
  remove: (slug: string) => void;
  clear: () => void;
  count: number;
}

const Ctx = createContext<FavoritesApi | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  // Start empty on both server and client, then hydrate from storage in an effect:
  // keeps SSR/prerender output deterministic and avoids hydration mismatches.
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(read());
    setReady(true);
    const sync = () => setEntries(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const commit = useCallback((next: FavoriteEntry[]) => {
    setEntries(next);
    write(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const has = useCallback((slug: string) => entries.some((e) => e.slug === slug), [entries]);
  const toggle = useCallback(
    (slug: string) => {
      const exists = entries.some((e) => e.slug === slug);
      commit(exists ? entries.filter((e) => e.slug !== slug) : [{ slug, addedAt: new Date().toISOString() }, ...entries]);
      return !exists;
    },
    [entries, commit],
  );
  const remove = useCallback((slug: string) => commit(entries.filter((e) => e.slug !== slug)), [entries, commit]);
  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo<FavoritesApi>(
    () => ({
      entries,
      slugs: entries.map((e) => e.slug),
      has,
      toggle,
      remove,
      clear,
      count: ready ? entries.length : 0,
    }),
    [entries, has, toggle, remove, clear, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites(): FavoritesApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFavorites 必须在 FavoritesProvider 内使用');
  return ctx;
}
