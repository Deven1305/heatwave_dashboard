import React from "react";
import { useLive } from "../context/LiveData.jsx";
import { tierKey } from "../api/live.js";

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

const SECONDS_PER_CITY = 7.5; // lower = faster scroll, higher = slower

// The row gets longer with every city, so the loop time grows with it (7.5 s per city is about 70 px/s, readable).
// Scrolling strip of the latest stored reading for every city (read from the live API, not from Open-Meteo directly).
// It is a labelled region so screen readers can find it (or skip it) as a landmark.
export default function Ticker() {
  const { overview, error, loading } = useLive();
  const items = (overview?.stations || [])
    .filter((s) => s.nowC !== null)
    .map((s) => ({ city: s.name, temp: `${s.nowC.toFixed(1)}°C`, tier: tierKey(s.tier) }));

  return (
    <div className="ticker" role="region" aria-label="Latest temperatures in 30 cities">
      {items.length ? (
        <div className="ticker-track mono" style={{ animationDuration: `${Math.max(30, Math.round(items.length * SECONDS_PER_CITY))}s` }}>
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
