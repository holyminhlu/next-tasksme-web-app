"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceResult } from "@/lib/api/service";

export type WidgetError = {
  code: string;
  message: string;
};

export type WidgetState<T> = {
  /** Initial load only; reloads keep showing the previous data. */
  loading: boolean;
  /** True while a reload is in flight and previous data is still shown. */
  refreshing: boolean;
  data: T | null;
  error: WidgetError | null;
  lastUpdated: Date | null;
  reload: () => void;
};

/**
 * Independent data slot for a dashboard widget: each caller loads, errors
 * and retries on its own. `fetcher` must be referentially stable
 * (useCallback) — changing it triggers a fresh load.
 */
export function useWidget<T>(
  fetcher: (() => Promise<ServiceResult<T>>) | null,
): WidgetState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<WidgetError | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!fetcher) {
      return;
    }

    const seq = ++requestSeq.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch lifecycle
    setInFlight(true);
    setError(null);

    void fetcher().then((result) => {
      if (seq !== requestSeq.current) {
        return;
      }

      setInFlight(false);
      setHasLoaded(true);

      if (result.ok) {
        setData(result.data);
        setError(null);
        setLastUpdated(new Date());
      } else {
        setError({ code: result.code, message: result.message });
      }
    });
  }, [fetcher, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return {
    loading: inFlight && !hasLoaded,
    refreshing: inFlight && hasLoaded,
    data,
    error,
    lastUpdated,
    reload,
  };
}
