import React from "react";
import { fmtTemp, formatDay, timeAgo } from "../../api/live.js";
import { SeverityBadge } from "../../components/live/ui.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import usePlaceSearch from "../../hooks/usePlaceSearch.js";
import { levelColor, noMatch } from "../../components/live/format.js";

/**
 * "Forecast" tab: the expected daily maximum for the next days in every region.
 *
 * There is no forecasting code in this project. Open-Meteo's weather models make the forecast; the backend stores it
 * in MongoDB (collection "daily", isForecast = true) at every refresh, and applies the SAME heat rules to it
 * to say what level the expected temperature would mean. Each value is the hottest city of the region.
 *
 * Search filters the rows through MongoDB (/api/search), so "himalaya" shows North-West India.
 * Props: overview (shared live data), params + setParam (URL query holds the search text), goTo(tab, extra).
 */
export default function Forecast({ overview, params, setParam, goTo }) {
  const days = overview.regions[0]?.forecast || []; // the same future dates for every region
  const q = params.get("q") || "";
  const { result, loading: searching, error: searchError } = usePlaceSearch(q);
  const waiting = q.trim() && !result;
  const regions = overview.regions.filter((r) => !q.trim() || (result && result.regions.has(r.id)));

  return (
    <div className="dashboard-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Expected daily maximum, next days</h2>
            <p className="panel-description">
              Stored in MongoDB at the last refresh ({timeAgo(overview.stored.lastSuccessAt)}). Each value is the hottest city of the region; the badge is the heat level it would mean.
            </p>
          </div>
          <SearchBox
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="Search a region, city or keyword…"
            status={searchError || (q.trim() ? (waiting ? "Searching…" : `${regions.length} region(s)`) : "")}
          />
        </div>

        {!days.length ? (
          <div className="data-state">No forecast stored yet. Use “Fetch latest data” at the top of the page.</div>
        ) : !regions.length ? (
          <div className="data-state">{waiting ? "Searching…" : noMatch(q, "regions", "Try a region, city, state, or words like coastal, hills, himalaya.")}</div>
        ) : (
          <div className="responsive-table" tabIndex={0} role="region" aria-label="Forecast by region, scrollable">
            <table className="lv-forecast">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Today</th>
                  {days.map((d) => <th key={d.date}>{formatDay(d.date)}</th>)}
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => {
                  const today = r.trend[r.trend.length - 1]; // today's value is the last "trend" day
                  return (
                    <tr key={r.id} className="lv-row-click" tabIndex={0} onClick={() => goTo("regions", { region: r.id })} onKeyDown={(e) => e.key === "Enter" && goTo("regions", { region: r.id })}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className="mono" style={{ color: levelColor(today?.level ?? 0) }}>{fmtTemp(today?.maxC)}</span></td>
                      {r.forecast.map((d) => (
                        <td key={d.date}>
                          <span className="mono" style={{ color: levelColor(d.level) }}>{fmtTemp(d.maxC)}</span>
                          <div className="lv-fc-badge"><SeverityBadge tier={d.tier} severity={d.severity} /></div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="lv-attrib">Forecasts change with every model run and can be wrong, especially beyond two days. Use official IMD bulletins for decisions.</p>
    </div>
  );
}
