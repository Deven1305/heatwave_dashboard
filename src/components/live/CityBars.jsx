import React from "react";
import { fmtDep, fmtTemp } from "../../api/live.js";
import { SeverityBadge } from "./ui.jsx";
import { levelColor } from "./format.js";

// The "cities of a region" picture shown after you open a region. One row per city, hottest first, all on the SAME
// temperature scale so the rows can be compared by eye. In each row:
//   the coloured BAR      today's maximum (the colour is the heat level)
//   the white LINE        what is normal for this city on this date
//   the dashed orange LINE the "too hot" limit for that city's terrain (plains 40, coastal 37, hills 30)
//   the DOT               the temperature right now
// A bar that passes the dashed line and sits far right of the white line is a real heat event; a bar past the
// dashed line but near the white line is a city that is hot but not unusual.
//
// `cities` are the "stations" rows from /api/overview; onOpen(city) runs when a row is chosen.
// Each row is a <button> with a full sentence as its aria-label, so a screen reader reads the numbers out; the drawing itself is hidden from it.
export default function CityBars({ cities, onOpen }) {
  // One scale for the whole region: from 2 degrees below the lowest number to 2 above the highest (so nothing sits on the edge).
  const values = cities.flatMap((c) => [c.todayMaxC, c.normalC, c.nowC, c.thresholdC]).filter((v) => typeof v === "number");
  if (!values.length) return <div className="data-state">No readings stored for these cities yet.</div>;
  const lo = Math.floor(Math.min(...values) - 2);
  const hi = Math.ceil(Math.max(...values) + 2);
  const pct = (v) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;

  const sorted = [...cities].sort((a, b) => (b.todayMaxC ?? -99) - (a.todayMaxC ?? -99));

  return (
    <div className="lv-citybars">
      <ul className="lv-citybars-list">
        {sorted.map((c) => (
          <li key={c.id}>
            <button
              className="lv-city"
              onClick={() => onOpen(c)}
              aria-label={`${c.name}: today's maximum ${fmtTemp(c.todayMaxC)}, normal ${fmtTemp(c.normalC)}, ${fmtDep(c.departureC)} from normal, ${c.severity}. Open city details.`}
            >
              <span className="lv-city-name">{c.name}<small>{c.terrain}</small></span>

              <span className="lv-city-track" aria-hidden="true">
                {typeof c.todayMaxC === "number" && <i className="lv-city-bar" style={{ width: pct(c.todayMaxC), background: levelColor(c.level) }} />}
                {typeof c.thresholdC === "number" && <i className="lv-city-limit" style={{ left: pct(c.thresholdC) }} />}
                {typeof c.normalC === "number" && <i className="lv-city-normal" style={{ left: pct(c.normalC) }} />}
                {typeof c.nowC === "number" && <i className="lv-city-now" style={{ left: pct(c.nowC) }} />}
              </span>

              <span className="lv-city-vals">
                <strong className="mono">{fmtTemp(c.todayMaxC)}</strong>
                <small className="mono">{fmtDep(c.departureC)}</small>
              </span>
              <span className="lv-city-badge"><SeverityBadge tier={c.tier} severity={c.severity} /></span>
            </button>
          </li>
        ))}
      </ul>

      {/* the scale's two end values, and a key. The key explains the four marks once, so the rows stay uncluttered */}
      <div className="lv-citybars-axis mono" aria-hidden="true"><span>{lo}°C</span><span>{hi}°C</span></div>
      <ul className="lv-citybars-key">
        <li><i className="k-bar" /> today's maximum</li>
        <li><i className="k-normal" /> normal for this date</li>
        <li><i className="k-limit" /> heat threshold for the terrain</li>
        <li><i className="k-now" /> right now</li>
      </ul>
    </div>
  );
}
