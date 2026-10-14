import React from "react";
import { fmtTemp, formatDay, timeAgo } from "../../api/live.js";
import { SeverityBadge } from "../../components/live/ui.jsx";
import { levelColor } from "../../components/live/format.js";

// Forecast = the next days stored at the last refresh (Open-Meteo model forecast, per region: hottest city).
export default function Forecast({ overview, goTo }) {
  const days = overview.regions[0]?.forecast || [];
  return (
    <div className="dashboard-stack">
      <section className="panel">
        <h2>Expected daily maximum, next days</h2>
        <p className="panel-description">
          Forecast stored in MongoDB at the last refresh ({timeAgo(overview.stored.lastSuccessAt)}). Each value is the hottest of the
          region's cities; the badge uses the same classification as the live view.
        </p>
        {!days.length ? (
          <div className="data-state">No forecast stored yet. Use “Fetch latest data” at the top of the page.</div>
        ) : (
          <div className="responsive-table">
            <table className="lv-forecast">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Today</th>
                  {days.map((d) => <th key={d.date}>{formatDay(d.date)}</th>)}
                </tr>
              </thead>
              <tbody>
                {overview.regions.map((r) => {
                  const today = r.trend[r.trend.length - 1];
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
