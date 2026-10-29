import React, { useEffect, useState } from "react";
import { fmtDep, fmtTemp, formatDateTime, formatDay, liveApi } from "../../api/live.js";
import { SeverityBadge, Stat } from "../../components/live/ui.jsx";
import Sparkline from "../../components/live/Sparkline.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import usePlaceSearch from "../../hooks/usePlaceSearch.js";
import { levelColor, noMatch } from "../../components/live/format.js";

// One card per region on the Overview. It shows the city under the most heat stress, its maximum next to its
// normal, and a 14-day sparkline. Choosing the card opens the Regions tab, where all the region's cities are listed.
export function RegionCard({ region: r, onOpen }) {
  const hot = typeof r.departureC === "number" && r.departureC > 0;
  return (
    <button className={`lv-region-card lv-level-${r.level}`} onClick={() => onOpen(r)}>
      <div className="lv-region-top"><h3>{r.name}</h3><SeverityBadge tier={r.tier} severity={r.severity} /></div>
      <div className="lv-region-temp">
        <strong className="mono">{fmtTemp(r.todayMaxC)}</strong>
        <span>today's max · {r.peakStation || "no data"}</span>
      </div>
      <div className="lv-region-meta mono">
        <span>normal {fmtTemp(r.normalC)}</span>
        <span className={hot ? "lv-up" : "lv-down"}>{fmtDep(r.departureC)}</span>
      </div>
      <Sparkline values={(r.trend || []).map((d) => d.maxC)} color={levelColor(r.level)} label={`${r.name} daily maximum, last 14 days`} />
      <div className="lv-region-foot">View its {r.stationsTotal} cities →</div>
    </button>
  );
}

// The Overview tab: today's situation on one screen.
//   1. five headline numbers,
//   2. the 7 region cards, most stressed first (with the search box above them),
//   3. the hottest cities right now and the latest alerts.
//
// Search here filters the region cards AND the "hottest cities" list. The matching is done by MongoDB through
// /api/search, so words like "coastal" work, not only names.
// Props: overview (the shared data), params + setParam (the address bar, which holds the search text), goTo (change tab).
export default function Overview({ overview, params, setParam, goTo }) {
  const { summary, regions, stations, stored } = overview;
  const q = params.get("q") || "";
  const { result, loading: searching, error: searchError } = usePlaceSearch(q);

  // latest 5 alerts (read from MongoDB through the API); reloaded when the shared data changes
  const [alerts, setAlerts] = useState(null);
  useEffect(() => {
    let live = true;
    liveApi.alerts("", 5).then((rows) => live && setAlerts(rows)).catch(() => live && setAlerts([]));
    return () => { live = false; };
  }, [overview.generatedAt]);

  // apply the search to what is shown (no search = everything)
  const waiting = q.trim() && !result; // typed, but the database has not answered yet
  const shownRegions = [...regions]
    .filter((r) => !q.trim() || (result && result.regions.has(r.id)))
    .sort((a, b) => b.level - a.level || (b.departureC ?? -99) - (a.departureC ?? -99)); // most stressed first
  const topCities = stations
    .filter((s) => s.nowC !== null && (!q.trim() || (result && result.stations.has(s.id))))
    .sort((a, b) => b.nowC - a.nowC)
    .slice(0, 8);

  const hottest = summary.hottestNow;
  const counts = stored.collections;

  return (
    <div className="dashboard-stack">
      {/* 1. headline numbers */}
      <div className="stat-grid lv-stat-grid">
        <Stat label="Regions elevated" value={`${summary.regionsElevated} / ${summary.regionsTotal}`} note="at Hot Day level or above today" tone={summary.regionsElevated ? "warn" : undefined} />
        <Stat label="Hottest right now" value={hottest ? fmtTemp(hottest.nowC) : "—"} note={hottest ? `${hottest.name} · ${formatDateTime(hottest.observedAt)}` : "no reading yet"} />
        <Stat label="Active alerts" value={summary.activeAlerts} note="automatic + recorded by users" tone={summary.activeAlerts ? "warn" : undefined} />
        <Stat label="Cities reporting" value={`${summary.stationsReporting} / ${summary.stationsTotal}`} note="latest reading under 3 hours old" />
        <Stat label="Stored in MongoDB" value={counts.observations.toLocaleString("en-IN")} note={`readings · ${counts.daily.toLocaleString("en-IN")} daily rows${stored.firstObservationAt ? ` · since ${formatDay(stored.firstObservationAt.slice(0, 10))}` : ""}`} />
      </div>

      {/* 2. region cards + search */}
      <section>
        <div className="lv-section-head lv-section-row">
          <div>
            <h2>Regions today</h2>
            <p>Each card shows the city under the most heat stress in that region. Choose one to see all its cities.</p>
          </div>
          <SearchBox
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="Search a region, city or keyword: himalaya, coastal…"
            status={searchError || (q.trim() ? (waiting ? "Searching…" : `${shownRegions.length} region(s), ${topCities.length > 7 ? "8+" : topCities.length} cit${topCities.length === 1 ? "y" : "ies"} shown`) : "")}
          />
        </div>
        {shownRegions.length ? (
          <div className="lv-region-grid">
            {shownRegions.map((r) => <RegionCard key={r.id} region={r} onOpen={() => goTo("regions", { region: r.id })} />)}
          </div>
        ) : (
          <div className="data-state">{waiting ? "Searching…" : noMatch(q, "regions or cities", "Try a region, city, state, or words like coastal, hills, himalaya.")}</div>
        )}
      </section>

      {/* 3. hottest cities + latest alerts */}
      <div className="dashboard-two-column lv-two">
        <section className="panel">
          <h2>Hottest cities right now</h2>
          <p className="panel-description">Latest stored reading per city (temperature at 2 m).</p>
          <div className="regional-bars">
            {topCities.map((s) => (
              <button className="regional-bar-row lv-bar-btn" key={s.id} onClick={() => goTo("stations", { station: s.id })}>
                <span>{s.name}</span>
                <div className="regional-bar-track"><div className="regional-bar-fill" style={{ width: `${Math.max(4, Math.min(100, ((s.nowC - 10) / 40) * 100))}%`, background: levelColor(s.level) }} /></div>
                <strong className="mono">{fmtTemp(s.nowC)}</strong>
              </button>
            ))}
            {!topCities.length && <p className="panel-description">{waiting ? "Searching…" : "No city matches the search."}</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Latest alerts</h2><button className="btn btn-ghost btn-small" onClick={() => goTo("alerts")}>All alerts</button></div>
          {alerts === null ? <p className="panel-description">Loading…</p> : !alerts.length ? (
            <p className="panel-description">No alerts yet. An alert is raised automatically when a region reaches Hot Day level or above.</p>
          ) : (
            <ul className="lv-alert-list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <div><SeverityBadge tier={a.tier} /><strong>{a.region}</strong><span className="mono">{formatDateTime(a.issuedAt)}</span></div>
                  <p>{a.message}</p>
                  <small>{a.source === "auto" ? "Automatic" : "Recorded by a user"} · {a.status}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="lv-attrib">
        Data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0), model data for representative cities, not IMD station measurements.
        Classification is indicative. See the Data tab for the method.
      </p>
    </div>
  );
}
