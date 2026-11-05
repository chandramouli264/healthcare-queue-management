import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

/** Runs an async loader on mount / when deps change, with loading + error state. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, loading, error, reload };
}
