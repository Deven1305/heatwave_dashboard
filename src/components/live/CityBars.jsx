import React from "react";
import { fmtDep, fmtTemp } from "../../api/live.js";
import { SeverityBadge } from "./ui.jsx";
import { levelColor } from "./format.js";

/**
 * Compares the cities of one region on a single temperature scale.
 *
 * One row per city (hottest first). On every row:
 *   - the BAR is today's maximum, coloured by heat level,
 *   - the white LINE is the city's normal maximum for this date,
 *   - the dashed ORANGE LINE is the "too hot" threshold for that city's terrain (plains / coastal / hills),
 *   - the DOT is the temperature right now.
 * A bar that reaches past the dashed line AND far past the white line is a heat event.
 *
 * Props: cities (rows from /api/overview "stations"), onOpen(city) called when a row is chosen.
 * Each row is a real <button>, so it works with keyboard and screen readers (the text label says it all;
 * the drawing is decorative and hidden from assistive technology).
 */
export default function CityBars({ cities, onOpen }) {
  // one shared scale for the whole region, padded so nothing touches the edges
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

      {/* scale labels and key (the key explains the four marks once, instead of labelling every row) */}
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
