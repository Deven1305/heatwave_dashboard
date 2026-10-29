import React, { useEffect, useMemo, useState } from "react";
import { fmtDep, fmtTemp, formatDay, liveApi } from "../../api/live.js";
import { DataTable, ErrorState, Loading, SeverityBadge, Stat } from "../../components/live/ui.jsx";
import LineChart from "../../components/live/LineChart.jsx";
import CityBars from "../../components/live/CityBars.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import usePlaceSearch from "../../hooks/usePlaceSearch.js";
import { dayMs, noMatch } from "../../components/live/format.js";

// The Regions tab. Pick one of the 7 regions and you get:
//   1. its headline numbers,
//   2. its cities side by side (CityBars): this is what you see after clicking a region card on the Overview,
//   3. a chart of the last days (hottest city, region average, normal) with the stored forecast shaded,
//   4. a day-by-day table, cut short until you press "Show all".
//
// Search: the box asks MongoDB which regions contain a matching city, so "himalaya" offers North-West India and
// lists Srinagar and Shimla as shortcuts. The text lives in the address (?q=) so it survives a reload.
// Props: overview (shared data), params (the address bar), goTo(tab, extra) to change tab, setParam(key, value) to edit the address.

// the three lines of the history chart
const LINES = [
  { key: "maxC", label: "Hottest city", color: "#f6ad55", width: 2.4 },
  { key: "avgMaxC", label: "Region average", color: "#71b4cb", width: 1.8 },
  { key: "normalAvgC", label: "Normal", color: "#9fb3c2", dash: "5 4", width: 1.6 },
];
const TABLE_PREVIEW_ROWS = 10; // the day-by-day table shows this many rows until "Show all" is pressed

export default function Regions({ overview, params, goTo, setParam }) {
  const regions = overview.regions;

  // ---- search: which regions / cities match the typed text (answered by MongoDB) ----
  const q = params.get("q") || "";
  const { result, loading: searching, error: searchError } = usePlaceSearch(q);
  const visible = q.trim() ? (result ? regions.filter((r) => result.regions.has(r.id)) : []) : regions;
  const matchingCities = result ? overview.stations.filter((s) => result.stations.has(s.id)) : [];

  // ---- which region is open: the one in the URL if it is still visible, otherwise the first visible one ----
  const selectedId = visible.find((r) => r.id === params.get("region"))?.id ?? visible[0]?.id ?? null;
  const region = regions.find((r) => r.id === selectedId);
  const cities = overview.stations.filter((s) => s.regionId === selectedId);

  // ---- the region's stored history (from MongoDB) ----
  const [days, setDays] = useState(30);
  const [showAll, setShowAll] = useState(false);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!selectedId) return undefined;
    let live = true; // ignore the answer if the user already moved on
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.regionHistory(selectedId, days)
      .then((data) => live && setState({ loading: false, error: "", data }))
      .catch((cause) => live && setState({ loading: false, error: cause.message, data: null }));
    return () => { live = false; };
  }, [selectedId, days, retry, overview.generatedAt]);

  const series = state.data?.days || [];
  const points = useMemo(() => series.map((d) => ({ ...d, t: dayMs(d.date) })), [series]);
  const firstForecast = series.find((d) => d.isForecast);
  const tableRows = [...series].reverse(); // newest (forecast) first
  const shownRows = showAll ? tableRows : tableRows.slice(0, TABLE_PREVIEW_ROWS);

  const searchBox = (
    <SearchBox
      value={q}
      onChange={(v) => setParam("q", v)}
      placeholder="Search a region, city, state or keyword: himalaya, coastal, Gujarat…"
      status={searchError || (q.trim() ? (searching && !result ? "Searching…" : `${visible.length} region(s), ${matchingCities.length} matching cit${matchingCities.length === 1 ? "y" : "ies"}`) : "")}
    />
  );

  // nothing to show (no match, or still waiting for the first answer)
  if (!region) {
    return (
      <div className="dashboard-stack">
        {searchBox}
        <div className="data-state">
          {q.trim() ? (result || searchError ? noMatch(q, "regions or cities", "Try a region, city, state, or words like coastal, hills, himalaya.") : "Searching…") : "No regions."}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-stack">
      {searchBox}

      {/* when searching: the matching cities as shortcuts to their own page */}
      {q.trim() && matchingCities.length > 0 && (
        <div className="lv-matches" role="group" aria-label="Matching cities">
          <span>Matching cities:</span>
          {matchingCities.map((s) => (
            <button key={s.id} className="lv-match" onClick={() => goTo("stations", { station: s.id, q })}>
              {s.name} <small>{s.severity}</small>
            </button>
          ))}
        </div>
      )}

      <div className="lv-pills" role="group" aria-label="Region">
        {visible.map((r) => (
          <button key={r.id} aria-pressed={r.id === selectedId} className={`lv-pill lv-pill-${r.level} ${r.id === selectedId ? "active" : ""}`} onClick={() => setParam("region", r.id)}>
            {r.name}
          </button>
        ))}
      </div>

      {/* 1. headline numbers */}
      <div className="stat-grid lv-stat-grid">
        <Stat label="Condition today" value={<SeverityBadge tier={region.tier} severity={region.severity} />} note={`${region.stationsReporting}/${region.stationsTotal} cities reporting`} />
        <Stat label="Peak city" value={region.peakStation || "—"} note="highest heat stress today" />
        <Stat label="Today's max" value={fmtTemp(region.todayMaxC)} note={`normal ${fmtTemp(region.normalC)}`} />
        <Stat label="Departure from normal" value={fmtDep(region.departureC)} note={`peak city, ${overview.normalPeriod || "multi-year"} average`} tone={region.departureC > 3 ? "warn" : undefined} />
      </div>

      {/* 2. the region's cities, compared on one scale */}
      <section className="panel">
        <h2>Cities in {region.name}</h2>
        <p className="panel-description">{cities.length} cities compared on one scale. Choose a city for its own history.</p>
        <CityBars cities={cities} onOpen={(c) => goTo("stations", { station: c.id })} />
      </section>

      {/* 3. 30-day history chart */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Last {days} days</h2>
            <p className="panel-description">Past days are read from MongoDB. The shaded part is the stored forecast.</p>
          </div>
          <label>Period
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          </label>
        </div>
        {state.loading && !state.data ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} /> : (
          <>
            <LineChart points={points} lines={LINES} forecastFrom={firstForecast ? dayMs(firstForecast.date) : null} label={`${region.name} daily maximum temperature`} />
            {days > 33 && series.length < days && <p className="lv-hint">Only {series.length} days are stored so far. Each refresh adds the previous 30 days; older history grows over time.</p>}
          </>
        )}
      </section>

      {/* 4. day by day (shortened: long tables bury the point) */}
      <section className="panel">
        <h2>Day by day</h2>
        <p className="panel-description">Departure and classification are for the city under the most heat stress that day.</p>
        <DataTable
          ariaLabel={`${region.name} day by day, scrollable`}
          rowKey={(r) => r.date}
          rows={shownRows}
          columns={[
            { label: "Date", render: (r) => <>{formatDay(r.date)} {r.isForecast && <span className="lv-tag">forecast</span>}</> },
            { label: "Hottest city", render: (r) => `${r.hottestStation} · ${fmtTemp(r.maxC)}` },
            { label: "Average", render: (r) => fmtTemp(r.avgMaxC) },
            { label: "Normal", render: (r) => fmtTemp(r.normalAvgC) },
            { label: "Departure", render: (r) => fmtDep(r.departureC) },
            { label: "Class", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity} /> },
          ]}
        />
        {tableRows.length > TABLE_PREVIEW_ROWS && (
          <button className="btn btn-ghost btn-small lv-more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer days" : `Show all ${tableRows.length} days`}
          </button>
        )}
      </section>
    </div>
  );
}
