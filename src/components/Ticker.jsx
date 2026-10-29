import React from "react";
import { useLive } from "../context/LiveData.jsx";
import { tierKey } from "../api/live.js";

// One run of all the cities. The strip draws it twice in a row (see below) so the loop has no gap.
function Row({ data, keyPrefix }) {
  return (
    <>
      {data.map((d) => (
        <span className="ticker-item" key={`${keyPrefix}-${d.city}`}>
          <span className={`tier-dot tier-${d.tier}`} />
          {d.city} : {d.temp} : <span className={`tier-text-${d.tier}`}>{d.tier.toUpperCase()}</span>
        </span>
      ))}
    </>
  );
}

// How long the strip takes per city. More seconds = slower. It was a fixed time before, and with 30 cities that was
// far too fast to read, so now the total time grows with the number of cities (7.5 s each is roughly 70 px per second).
const SECONDS_PER_CITY = 7.5;

// The strip under the navbar with every city's latest temperature scrolling past. The numbers come from the shared
// overview data, so they are what is stored in MongoDB. It pauses on hover or keyboard focus (see global.css),
// and it is a labelled region so screen readers can find it, or skip it, as a landmark.
export default function Ticker() {
  const { overview, error, loading } = useLive();
  const items = (overview?.stations || [])
    .filter((s) => s.nowC !== null)
    .map((s) => ({ city: s.name, temp: `${s.nowC.toFixed(1)}°C`, tier: tierKey(s.tier) }));

  return (
    <div className="ticker" role="region" aria-label="Latest temperatures in 30 cities">
      {items.length ? (
        <div className="ticker-track mono" style={{ animationDuration: `${Math.max(30, Math.round(items.length * SECONDS_PER_CITY))}s` }}>
          {/* the same list twice: while the first copy leaves on the left the second is already coming in */}
          <Row data={items} keyPrefix="a" />
          <Row data={items} keyPrefix="b" />
        </div>
      ) : (
        <div className="ticker-message mono" role="status">
          {loading ? "Loading stored readings…" : error || "No readings stored yet."}
        </div>
      )}
    </div>
  );
}
