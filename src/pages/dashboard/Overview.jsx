import React, { useEffect, useState } from "react";
import { fmtDep, fmtTemp, formatDateTime, formatDay, liveApi } from "../../api/live.js";
import { SeverityBadge, Stat } from "../../components/live/ui.jsx";
import Sparkline from "../../components/live/Sparkline.jsx";
import { levelColor } from "../../components/live/format.js";

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
        <span>now ≤ {fmtTemp(r.nowMaxC)}</span>
      </div>
      <Sparkline values={(r.trend || []).map((d) => d.maxC)} color={levelColor(r.level)} label={`${r.name} daily maximum, last 14 days`} />
      <div className="lv-region-foot">{r.stationsReporting}/{r.stationsTotal} cities reporting · last 14 days</div>
    </button>
  );
}

export default function Overview({ overview, goTo }) {
  const { summary, regions, stations, stored } = overview;
  const [alerts, setAlerts] = useState(null);
  useEffect(() => {
    let live = true;
    liveApi.alerts("", 5).then((rows) => live && setAlerts(rows)).catch(() => live && setAlerts([]));
    return () => { live = false; };
  }, [overview.generatedAt]);

  const ranked = [...regions].sort((a, b) => b.level - a.level || (b.departureC ?? -99) - (a.departureC ?? -99));
  const top = stations.filter((s) => s.nowC !== null).sort((a, b) => b.nowC - a.nowC).slice(0, 8);
  const hottest = summary.hottestNow;
  const counts = stored.collections;

  return (
    <div className="dashboard-stack">
      <div className="stat-grid lv-stat-grid">
        <Stat label="Regions elevated" value={`${summary.regionsElevated} / ${summary.regionsTotal}`} note="at Hot Day level or above today" tone={summary.regionsElevated ? "warn" : undefined} />
        <Stat label="Hottest right now" value={hottest ? fmtTemp(hottest.nowC) : "—"} note={hottest ? `${hottest.name} · ${formatDateTime(hottest.observedAt)}` : "no reading yet"} />
        <Stat label="Active alerts" value={summary.activeAlerts} note="automatic + recorded by users" tone={summary.activeAlerts ? "warn" : undefined} />
        <Stat label="Cities reporting" value={`${summary.stationsReporting} / ${summary.stationsTotal}`} note="latest reading under 3 hours old" />
        <Stat label="Stored in MongoDB" value={counts.observations.toLocaleString("en-IN")} note={`readings · ${counts.daily.toLocaleString("en-IN")} daily rows${stored.firstObservationAt ? ` · since ${formatDay(stored.firstObservationAt.slice(0, 10))}` : ""}`} />
      </div>

      <section>
        <div className="lv-section-head">
          <h2>Regions today</h2>
          <p>Each card shows the city under the most heat stress in that region. Select a region for its full history.</p>
        </div>
        <div className="lv-region-grid">
          {ranked.map((r) => <RegionCard key={r.id} region={r} onOpen={() => goTo("regions", { region: r.id })} />)}
        </div>
      </section>

      <div className="dashboard-two-column lv-two">
        <section className="panel">
          <h2>Hottest cities right now</h2>
          <p className="panel-description">Latest stored reading per city (temperature at 2 m).</p>
          <div className="regional-bars">
            {top.map((s) => (
              <button className="regional-bar-row lv-bar-btn" key={s.id} onClick={() => goTo("stations", { station: s.id })}>
                <span>{s.name}</span>
                <div className="regional-bar-track"><div className="regional-bar-fill" style={{ width: `${Math.max(4, Math.min(100, ((s.nowC - 10) / 40) * 100))}%`, background: levelColor(s.level) }} /></div>
                <strong className="mono">{fmtTemp(s.nowC)}</strong>
              </button>
            ))}
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
