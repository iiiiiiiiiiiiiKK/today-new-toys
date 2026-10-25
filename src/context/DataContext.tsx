import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadData, type DataFile } from '../lib/data';

type State = { status: 'loading'; data: null; error: null } | { status: 'ready'; data: DataFile; error: null } | { status: 'error'; data: null; error: string };

interface DataApi {
  state: State;
  retry: () => void;
}

const Ctx = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, error: null });
    loadData()
      .then((data) => {
        if (alive) setState({ status: 'ready', data, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setState({ status: 'error', data: null, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData 必须在 DataProvider 内使用');
  return ctx;
}

/** Convenience for pages that can only render with data loaded (guarded by <DataGate>). */
export function useDataReady(): DataFile {
  const { state } = useData();
  if (state.status !== 'ready') throw new Error('数据尚未加载');
  return state.data;
}
