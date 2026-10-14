import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { liveApi } from "../api/live.js";

// One shared copy of the overview (regions, stations, stored-data stats) for the whole app.
// It is re-read from the API (which reads MongoDB) every 5 minutes and whenever reload() is called.
const LiveContext = createContext(null);
const POLL_MS = 5 * 60 * 1000;

export function LiveDataProvider({ children }) {
  const [state, setState] = useState({ overview: null, error: "", loading: true, fetchedAt: null });

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const overview = await liveApi.overview();
      setState({ overview, error: "", loading: false, fetchedAt: new Date() });
    } catch (cause) {
      // keep the last good data on screen and just say it may be stale
      setState((s) => ({ ...s, error: cause.message || "Could not load live data.", loading: false }));
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(() => reload({ silent: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // Ask the API to pull fresh data from Open-Meteo right now, then re-read it.
  const fetchLatest = useCallback(async () => {
    const summary = await liveApi.refresh();
    await reload({ silent: true });
    return summary;
  }, [reload]);

  const value = useMemo(() => ({ ...state, reload, fetchLatest }), [state, reload, fetchLatest]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
