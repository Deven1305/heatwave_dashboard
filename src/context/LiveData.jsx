import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { liveApi } from "../api/live.js";

// Keeps ONE copy of the overview data (all regions, all cities, the stored-data numbers) for the whole website.
// Any component can get it with useLive(). Without this, the ticker, the home page and the dashboard would each
// ask the backend for the same thing.
//
// What a component receives from useLive():
//   overview     the data, or null before the first answer arrives
//   error        a message if the last attempt failed (the old data stays in `overview`)
//   loading      true while a visible load is running
//   reload()     read the stored data again (what the "Reload" button does)
//   fetchLatest() ask the backend to pull new weather from Open-Meteo first, then reload (the "Fetch latest data" button)
const LiveContext = createContext(null);
const POLL_MS = 5 * 60 * 1000; // how often the page quietly re-reads the data by itself

export function LiveDataProvider({ children }) {
  const [state, setState] = useState({ overview: null, error: "", loading: true, fetchedAt: null });

  // silent = don't flip `loading` to true. The background refresh every 5 minutes is silent, so nothing flickers.
  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const overview = await liveApi.overview();
      setState({ overview, error: "", loading: false, fetchedAt: new Date() });
    } catch (cause) {
      // If the backend is down for a moment we don't want to wipe the screen. Keep the last data we had and
      // only add the error message, so the page can say "showing older data".
      setState((s) => ({ ...s, error: cause.message || "Could not load live data.", loading: false }));
    }
  }, []);

  // load once when the app starts, then again every POLL_MS. The cleanup stops the timer if the provider ever goes away.
  useEffect(() => {
    reload();
    const timer = setInterval(() => reload({ silent: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // Two steps: the backend fetches new weather from Open-Meteo and stores it, and then we read what it stored.
  // Errors (like "try again in 40 s") are not caught here; the button that called us shows them.
  const fetchLatest = useCallback(async () => {
    const summary = await liveApi.refresh();
    await reload({ silent: true });
    return summary;
  }, [reload]);

  // useMemo gives the same object back until something really changes, so components that read it don't re-draw for nothing
  const value = useMemo(() => ({ ...state, reload, fetchLatest }), [state, reload, fetchLatest]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
