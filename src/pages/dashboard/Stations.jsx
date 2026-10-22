import React, { useEffect, useMemo, useState } from "react";
import { fmtDep, fmtTemp, formatDateTime, liveApi, timeAgo } from "../../api/live.js";
import { DataTable, ErrorState, Loading, SeverityBadge } from "../../components/live/ui.jsx";
import LineChart from "../../components/live/LineChart.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import usePlaceSearch from "../../hooks/usePlaceSearch.js";
import { dayMs, fmtClock, noMatch } from "../../components/live/format.js";

/**
 * "Stations" tab: one row per city (a "station" here is a monitoring point, not a physical weather station).
 *
 *   top    : a short table of all cities (search box + region filter). The table only carries what is needed to
 *            compare cities at a glance; humidity, wind and the normal live in the detail panel (progressive disclosure).
 *   bottom : the selected city's facts, its 30-day daily max/min chart and its stored readings, all read from MongoDB.
 *
 * Search asks MongoDB (via /api/search) so keywords such as "himalaya" or "coastal" work, not just names.
 * Props: overview (shared live data), params (URL query), goTo(tab, extra), setParam(key, value).
 */

const DAILY_LINES = [
  { key: "tMaxC", label: "Daily max", color: "#f6ad55", width: 2.4 },
  { key: "tMinC", label: "Daily min", color: "#71b4cb", width: 1.8 },
];
const READING_LINES = [
  { key: "tempC", label: "Temperature", color: "#f6ad55", width: 2.2 },
  { key: "apparentC", label: "Feels like", color: "#f98282", dash: "5 4", width: 1.6 },
];

// A small "label / value" pair for the facts grid.
const Fact = ({ label, value }) => (
  <div className="lv-fact"><dt>{label}</dt><dd className="mono">{value}</dd></div>
);

/** Detail panel for one city: facts, daily chart, stored readings. */
function StationDetail({ station, generatedAt }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);

  // load this city's stored history whenever the city (or the shared data) changes
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
          <p className="panel-description">{station.terrain} point · {station.lat.toFixed(2)}°N, {station.lon.toFixed(2)}°E · latest reading {timeAgo(station.observedAt)}</p>
        </div>
        <SeverityBadge tier={station.tier} severity={station.severity} />
      </div>

      {/* the facts that used to be table columns */}
      <dl className="lv-facts">
        <Fact label="Now" value={fmtTemp(station.nowC)} />
        <Fact label="Feels like" value={fmtTemp(station.apparentC)} />
        <Fact label="Humidity" value={station.humidityPct != null ? `${station.humidityPct}%` : "—"} />
        <Fact label="Wind" value={station.windKmh != null ? `${station.windKmh} km/h` : "—"} />
        <Fact label="Today's max" value={fmtTemp(station.todayMaxC)} />
        <Fact label="Normal for today" value={fmtTemp(station.normalC)} />
        <Fact label="Heat threshold" value={fmtTemp(station.thresholdC)} />
      </dl>

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
            ariaLabel={`${station.name} stored readings, scrollable`}
            rowKey={(r) => r.observedAt}
            rows={[...readings].reverse().slice(0, 8)}
            empty="No readings stored yet."
            columns={[
              { label: "Observed (IST)", render: (r) => formatDateTime(r.observedAt) },
              { label: "Temperature", render: (r) => fmtTemp(r.tempC) },
              { label: "Feels like", render: (r) => fmtTemp(r.apparentC) },
              { label: "Humidity", render: (r) => (r.humidityPct != null ? `${r.humidityPct}%` : "—") },
              { label: "Wind", render: (r) => (r.windKmh != null ? `${r.windKmh} km/h` : "—") },
            ]}
          />
        </>
      )}
    </section>
  );
}

export default function Stations({ overview, params, goTo, setParam }) {
  const [regionFilter, setRegionFilter] = useState("all");
  const q = params.get("q") || "";
  const { result, loading: searching, error: searchError } = usePlaceSearch(q);
  const all = overview.stations;

  // rows = region filter AND search result, hottest right now first
  const rows = useMemo(() => {
    if (q.trim() && !result) return []; // still waiting for the database's answer
    return all
      .filter((s) => regionFilter === "all" || s.regionId === regionFilter)
      .filter((s) => !result || result.stations.has(s.id))
      .sort((a, b) => (b.nowC ?? -99) - (a.nowC ?? -99));
  }, [all, regionFilter, result, q]);

  const regionName = (id) => overview.regions.find((r) => r.id === id)?.name || id;
  const selected = rows.find((s) => s.id === params.get("station")) || rows[0]; // default: the first row

  return (
    <div className="dashboard-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cities</h2>
            <p className="panel-description">Latest stored reading per city against its normal for today. Choose a row for details.</p>
          </div>
          <SearchBox
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="Search a city, state or keyword: himalaya, coastal, Tamil Nadu…"
            status={searchError || (q.trim() ? (searching && !result ? "Searching…" : `${rows.length} of ${all.length} cities`) : "")}
          />
          <label>Region
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="all">All regions</option>
              {overview.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        <DataTable
          ariaLabel="Cities, scrollable"
          rowKey={(r) => r.id}
          selectedKey={selected?.id}
          onRowClick={(r) => goTo("stations", { station: r.id, ...(q ? { q } : {}) })}
          rows={rows}
          empty={q.trim() ? (result || searchError ? noMatch(q, "cities", "Try a city, state, region, or words like coastal, hills, himalaya.") : "Searching…") : "No cities."}
          columns={[
            { label: "City", key: "name" },
            { label: "Region", render: (r) => regionName(r.regionId) },
            { label: "Now", render: (r) => fmtTemp(r.nowC) },
            { label: "Today's max", render: (r) => fmtTemp(r.todayMaxC) },
            { label: "Departure", render: (r) => fmtDep(r.departureC) },
            { label: "Class", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity} /> },
          ]}
        />
      </section>
      {selected && <StationDetail station={selected} generatedAt={overview.generatedAt} />}
    </div>
  );
}
