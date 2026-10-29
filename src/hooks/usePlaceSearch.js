import { useEffect, useState } from "react";
import { liveApi } from "../api/live.js";

// Gives a page the answer to "which cities and regions match what the user typed?".
// The matching is done by the backend in MongoDB; we only get ids back and the page filters the data it already has.
//
// What you get: { loading, error, result }. result is null when the box is empty (so "show everything"), otherwise
// { stations: Set of ids, regions: Set of ids, count }. A Set is used so the page can ask .has(id) quickly for every row.
export default function usePlaceSearch(text) {
  const term = text.trim();
  const [state, setState] = useState({ loading: false, error: "", result: null });

  useEffect(() => {
    if (!term) { setState({ loading: false, error: "", result: null }); return undefined; }
    let live = true; // turns false when the user types again, so an old answer can't overwrite a newer one
    setState((s) => ({ ...s, loading: true, error: "" }));
    // wait 250 ms after the last keystroke before asking, so typing "himalaya" is one request, not eight
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
