import { useEffect, useState } from "react";
import { liveApi } from "../api/live.js";

// Asks the live API (which searches MongoDB) which cities and regions match `text`.
// Returns result = null when nothing is being searched, otherwise { stations: Set(ids), regions: Set(ids), count }.
// Typing is debounced so the database is asked once the user pauses.
export default function usePlaceSearch(text) {
  const term = text.trim();
  const [state, setState] = useState({ loading: false, error: "", result: null });

  useEffect(() => {
    if (!term) { setState({ loading: false, error: "", result: null }); return undefined; }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const timer = setTimeout(() => {
      liveApi.search(term)
        .then((r) => live && setState({
          loading: false, error: "",
          result: { stations: new Set(r.stations.map((s) => s.id)), regions: new Set(r.regions), count: r.count },
        }))
        .catch((cause) => live && setState({ loading: false, error: cause.message, result: null }));
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [term]);

  return state;
}
