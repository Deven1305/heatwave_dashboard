import React, { useEffect, useMemo, useState } from "react";
import { fmtDep, fmtTemp, formatDay, liveApi, timeAgo } from "../../api/live.js";
import { DataTable, ErrorState, Loading, SeverityBadge, Stat } from "../../components/live/ui.jsx";
import LineChart from "../../components/live/LineChart.jsx";
import { dayMs } from "../../components/live/format.js";

const LINES = [
  { key: "maxC", label: "Hottest city", color: "#f6ad55", width: 2.4 },
  { key: "avgMaxC", label: "Region average", color: "#71b4cb", width: 1.8 },
  { key: "normalAvgC", label: "Normal (2015–2024)", color: "#9fb3c2", dash: "5 4", width: 1.6 },
];

export default function Regions({ overview, params, goTo }) {
  const regions = overview.regions;
  const selectedId = regions.some((r) => r.id === params.get("region")) ? params.get("region") : regions[0].id;
  const region = regions.find((r) => r.id === selectedId);
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.regionHistory(selectedId, days)
      .then((data) => live && setState({ loading: false, error: "", data }))
      .catch((cause) => live && setState({ loading: false, error: cause.message, data: null }));
    return () => { live = false; };
  }, [selectedId, days, retry, overview.generatedAt]);

  const series = state.data?.days || [];
  const points = useMemo(() => series.map((d) => ({ ...d, t: dayMs(d.date) })), [series]);
  const firstForecast = series.find((d) => d.isForecast);
  const members = overview.stations.filter((s) => s.regionId === selectedId).sort((a, b) => (b.nowC ?? -99) - (a.nowC ?? -99));

  return (
    <div className="dashboard-stack">
      <div className="lv-pills" role="tablist" aria-label="Region">
        {regions.map((r) => (
          <button key={r.id} role="tab" aria-selected={r.id === selectedId} className={`lv-pill lv-pill-${r.level} ${r.id === selectedId ? "active" : ""}`} onClick={() => goTo("regions", { region: r.id })}>
            {r.name}
          </button>
        ))}
      </div>

      <div className="stat-grid lv-stat-grid">
        <Stat label="Condition today" value={<SeverityBadge tier={region.tier} severity={region.severity} />} note={`${region.stationsReporting}/${region.stationsTotal} cities reporting`} />
        <Stat label="Peak city" value={region.peakStation || "—"} note="highest heat stress today" />
        <Stat label="Today's max" value={fmtTemp(region.todayMaxC)} note={`normal ${fmtTemp(region.normalC)}`} />
        <Stat label="Departure from normal" value={fmtDep(region.departureC)} note="peak city, 2015–2024 average" tone={region.departureC > 3 ? "warn" : undefined} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{region.name}: daily maximum temperature</h2>
            <p className="panel-description">Past days are read from MongoDB, where every refresh keeps them. The shaded part is the stored forecast.</p>
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

      <section className="panel">
        <h2>Day by day</h2>
        <p className="panel-description">Departure and classification are for the city under the most heat stress that day.</p>
        <DataTable
          rowKey={(r) => r.date}
          rows={[...series].reverse()}
          columns={[
            { label: "Date", render: (r) => <>{formatDay(r.date)} {r.isForecast && <span className="lv-tag">forecast</span>}</> },
            { label: "Hottest city", render: (r) => `${r.hottestStation} · ${fmtTemp(r.maxC)}` },
            { label: "Region average", render: (r) => fmtTemp(r.avgMaxC) },
            { label: "Normal", render: (r) => fmtTemp(r.normalAvgC) },
            { label: "Departure", render: (r) => fmtDep(r.departureC) },
            { label: "Classification", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity} /> },
          ]}
        />
      </section>

      <section className="panel">
        <h2>Cities in {region.name}</h2>
        <p className="panel-description">Updated {timeAgo(members.find((m) => m.observedAt)?.observedAt)}. Select a city for its stored readings.</p>
        <DataTable
          rowKey={(r) => r.id}
          onRowClick={(r) => goTo("stations", { station: r.id })}
          rows={members}
          columns={[
            { label: "City", key: "name" },
            { label: "Now", render: (r) => fmtTemp(r.nowC) },
            { label: "Today's max", render: (r) => fmtTemp(r.todayMaxC) },
            { label: "Normal", render: (r) => fmtTemp(r.normalC) },
            { label: "Departure", render: (r) => fmtDep(r.departureC) },
            { label: "Classification", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity} /> },
          ]}
        />
      </section>
    </div>
  );
}
