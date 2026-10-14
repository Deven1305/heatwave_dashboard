import React, { useEffect, useState } from "react";
import { formatDateTime, liveApi } from "../../api/live.js";
import { DataTable, Stat } from "../../components/live/ui.jsx";

export default function DataTab({ overview }) {
  const { stored, source } = overview;
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    let live = true;
    liveApi.runs(12).then((r) => live && setRuns(r)).catch(() => live && setRuns([]));
    return () => { live = false; };
  }, [overview.generatedAt]);
  const c = stored.collections;

  return (
    <div className="dashboard-stack">
      <section className="panel">
        <h2>What is stored in MongoDB</h2>
        <p className="panel-description">Database <code>{stored.database}</code>. Everything on this dashboard is read from here, so a page reload, or a restart of the API, shows the same data again plus anything new.</p>
        <div className="stat-grid lv-stat-grid">
          <Stat label="Readings" value={c.observations.toLocaleString("en-IN")} note="current weather, every refresh" />
          <Stat label="Daily rows" value={c.daily.toLocaleString("en-IN")} note="max / min per city and day" />
          <Stat label="Alerts" value={c.alerts} note="automatic + recorded, all history" />
          <Stat label="Reports" value={c.reports} note="submitted observations" />
          <Stat label="Refresh runs" value={c.fetchRuns} note="every fetch is logged" />
        </div>
        <p className="lv-hint">First reading: {formatDateTime(stored.firstObservationAt)} · latest reading: {formatDateTime(stored.lastObservationAt)}</p>
      </section>

      <section className="panel">
        <h2>Recent refresh runs</h2>
        <DataTable
          rowKey={(r) => r.at}
          rows={runs || []}
          empty={runs === null ? "Loading…" : "No runs logged yet."}
          columns={[
            { label: "When (IST)", render: (r) => formatDateTime(r.at) },
            { label: "Trigger", key: "trigger" },
            { label: "Result", render: (r) => <span className={`lv-status ${r.ok ? "lv-status-active" : "lv-status-cleared"}`}>{r.ok ? "ok" : "failed"}</span> },
            { label: "New readings", render: (r) => r.observationsInserted ?? "—" },
            { label: "Daily rows", render: (r) => (r.ok ? `${r.dailyInserted} new, ${r.dailyUpdated} updated` : "—") },
            { label: "Took", render: (r) => (r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : "—") },
            { label: "Error", render: (r) => r.error || "" },
          ]}
        />
      </section>

      <section className="panel lv-method">
        <h2>How the numbers are made</h2>
        <ul>
          <li><strong>Source.</strong> <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> ({source.licence}), a free public weather API that needs no key. Values are model data for one point per city (30 cities, 4–6 per region), <em>not</em> measurements from IMD weather stations.</li>
          <li><strong>Collection.</strong> The live API asks Open-Meteo for every city every 30 minutes (current weather, the past 30 days of daily values, and the forecast for today and the 4 days after) and saves it. Readings are never overwritten; daily rows are updated as a day completes.</li>
          <li><strong>Normal.</strong> For each city and calendar day, the average daily maximum of 2015–2024 (ERA5 reanalysis from Open-Meteo), smoothed over ±7 days. This is a 10-year average, not IMD's official 30-year normal.</li>
          <li><strong>Classification</strong>, modelled on IMD: Heatwave = maximum at or above 40 °C (plains), 37 °C (coastal) or 30 °C (hills) <em>and</em> at least 4.5 °C above normal; Severe = at least 6.5 °C above normal; plains also at 45 °C / 47 °C absolute. Hot Day = at the threshold and 3 °C above normal. A region takes the level of its worst city.</li>
          <li><strong>Alerts.</strong> One automatic alert per region: written when the level changes, marked cleared when the region returns to normal.</li>
          <li><strong>Limits.</strong> This is a prototype. It is not an official warning service; use IMD bulletins for real decisions.</li>
        </ul>
      </section>
    </div>
  );
}
