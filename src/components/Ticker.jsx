import React, { useEffect, useState } from "react";
import { fetchTemperaturesForCities } from "../api/weather.js";

// City coordinates (approx). These are used to query Open-Meteo for current temps.
const CITY_COORDS = [
  { city: "Nagpur", lat: 21.1458, lon: 79.0882 },
  { city: "Ahmedabad", lat: 23.0225, lon: 72.5714 },
  { city: "Pune", lat: 18.5204, lon: 73.8567 },
  { city: "Jaipur", lat: 26.9124, lon: 75.7873 },
  { city: "Delhi", lat: 28.7041, lon: 77.1025 },
  { city: "Bhopal", lat: 23.2599, lon: 77.4126 },
  { city: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { city: "Lucknow", lat: 26.8467, lon: 80.9462 },
];

function Row({ data = [], keyPrefix }) {
  return (
    <>
      {data.map((d, i) => (
        <span className="ticker-item" key={`${keyPrefix}-${i}`}>
          <span className={`tier-dot tier-${d.tier}`} />
          {d.city} : {d.temp} : <span className={`tier-text-${d.tier}`}>{d.tier.toUpperCase()}</span>
        </span>
      ))}
    </>
  );
}

export default function Ticker() {
  // liveData starts as `null` (no data yet); becomes a real array once the
  // API call below resolves. This distinction is what dataToShow uses to
  // decide between showing placeholders and showing real numbers.
  const [liveData, setLiveData] = useState(null);

  // Fetches current temperatures for all configured cities exactly once,
  // when Ticker first mounts (empty dependency array = run only on mount).
  useEffect(() => {
    let mounted = true; // guards against setting state after unmount
    fetchTemperaturesForCities(CITY_COORDS)
      .then((res) => {
        // only apply the result if the component is still mounted and the
        // API actually returned at least one successful city
        if (mounted) setLiveData(res || []);
      })
      .catch(() => {
        // Silent failure: dataToShow below falls back to the "--°C" placeholders,
        // so a network error never crashes or blanks the ticker.
      });
    return () => (mounted = false); // cleanup: runs if Ticker unmounts mid-fetch
  }, []);

  // Show live API data once it has arrived; otherwise show "--°C"
  // placeholders for the same cities so the ticker layout never jumps.
  const dataToShow = liveData || [];

  return (
    <div className="ticker">
      {!liveData ? <div className="ticker-message mono" role="status">Loading current weather from Open-Meteo…</div> : !liveData.length ? <div className="ticker-message mono" role="status">Current weather is unavailable. Check your connection and reload.</div> : <div className="ticker-track mono">
        <Row data={dataToShow} keyPrefix="a" />
        <Row data={dataToShow} keyPrefix="b" />
      </div>}
    </div>
  );
}
