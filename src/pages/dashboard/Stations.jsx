import React, { useEffect, useMemo, useState } from "react";
import { fmtDep, fmtTemp, formatDateTime, liveApi, timeAgo } from "../../api/live.js";
import { DataTable, ErrorState, Loading, SeverityBadge } from "../../components/live/ui.jsx";
import LineChart from "../../components/live/LineChart.jsx";
import { dayMs, fmtClock } from "../../components/live/format.js";

const DAILY_LINES = [
  { key: "tMaxC", label: "Daily max", color: "#f6ad55", width: 2.4 },
  { key: "tMinC", label: "Daily min", color: "#71b4cb", width: 1.8 },
];
const READING_LINES = [
  { key: "tempC", label: "Temperature", color: "#f6ad55", width: 2.2 },
  { key: "apparentC", label: "Feels like", color: "#f98282", dash: "5 4", width: 1.6 },
];

function StationDetail({ station, generatedAt }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.stationHistory(station.id, 72)
      .then((data) => live && setState({ loading: false, error: "", data }))
      .catch((cause) => live && setState({ loading: false, error: cause.message, data: null }));
    return () => { live = false; };
  }, [station.id, retry, generatedAt]);

  const daily = useMemo(() => (state.data?.daily || []).map((d) => ({ ...d, t: dayMs(d.date) })), [state.data]);
  const readings = useMemo(() => (state.data?.readings || []).map((r) => ({ ...r, t: new Date(r.observedAt).getTime() })), [state.data]);
  const today = new Date().toISOString().slice(0, 10);
  const firstForecast = daily.find((d) => d.date > today);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{station.name}</h2>
          <p className="panel-description">{station.terrain} station · {station.lat.toFixed(2)}°N, {station.lon.toFixed(2)}°E · latest reading {timeAgo(station.observedAt)}</p>
        </div>
        <SeverityBadge tier={station.tier} severity={station.severity} />
      </div>
      {state.loading && !state.data ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} /> : (
        <>
          <h3 className="lv-h3">Daily maximum and minimum, last 30 days and forecast</h3>
          <LineChart points={daily} lines={DAILY_LINES} forecastFrom={firstForecast ? dayMs(firstForecast.date) : null} label={`${station.name} daily temperatures`} />
          <h3 className="lv-h3">Stored readings, last 72 hours</h3>
          {readings.length >= 2 ? (
            <LineChart points={readings} lines={READING_LINES} fmtX={fmtClock} label={`${station.name} stored readings`} />
          ) : (
            <p className="lv-hint">Only {readings.length} reading stored so far. A new one is saved to MongoDB every 30 minutes while the live API is running, so this chart fills up over time.</p>
          )}
          <DataTable
            rowKey={(r) => r.observedAt}
            rows={[...readings].reverse().slice(0, 10)}
            empty="No readings stored yet."
            columns={[
              { label: "Observed (IST)", render: (r) => formatDateTime(r.observedAt) },
              { label: "Temperature", render: (r) => fmtTemp(r.tempC) },
              { label: "Feels like", render: (r) => fmtTemp(r.apparentC) },
              { label: "Humidity", render: (r) => (r.humidityPct ?? "—") + (r.humidityPct != null ? "%" : "") },
              { label: "Wind", render: (r) => (r.windKmh != null ? `${r.windKmh} km/h` : "—") },
            ]}
          />
        </>
      )}
    </section>
  );
}

export default function Stations({ overview, params, goTo }) {
  const [regionFilter, setRegionFilter] = useState("all");
  const all = overview.stations;
  const rows = useMemo(() => all.filter((s) => regionFilter === "all" || s.regionId === regionFilter).sort((a, b) => (b.nowC ?? -99) - (a.nowC ?? -99)), [all, regionFilter]);
  const regionName = (id) => overview.regions.find((r) => r.id === id)?.name || id;
  const selected = all.find((s) => s.id === params.get("station")) || rows[0];

  return (
    <div className="dashboard-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cities</h2>
            <p className="panel-description">Latest stored reading per city, compared with that city's normal maximum for today. Select a row for its history.</p>
          </div>
          <label>Region
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="all">All regions</option>
              {overview.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        <DataTable
          rowKey={(r) => r.id}
          selectedKey={selected?.id}
          onRowClick={(r) => goTo("stations", { station: r.id })}
          rows={rows}
          columns={[
            { label: "City", key: "name" },
            { label: "Region", render: (r) => regionName(r.regionId) },
            { label: "Now", render: (r) => fmtTemp(r.nowC) },
            { label: "Feels like", render: (r) => fmtTemp(r.apparentC) },
            { label: "Humidity", render: (r) => (r.humidityPct != null ? `${r.humidityPct}%` : "—") },
            { label: "Wind", render: (r) => (r.windKmh != null ? `${r.windKmh} km/h` : "—") },
            { label: "Today's max", render: (r) => fmtTemp(r.todayMaxC) },
            { label: "Normal", render: (r) => fmtTemp(r.normalC) },
            { label: "Departure", render: (r) => fmtDep(r.departureC) },
            { label: "Class", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity} /> },
            { label: "Updated", render: (r) => timeAgo(r.observedAt) },
          ]}
        />
      </section>
      {selected && <StationDetail station={selected} generatedAt={overview.generatedAt} />}
    </div>
  );
}
