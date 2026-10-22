import React from "react";
import { Link } from "react-router-dom";
import { useLive } from "../context/LiveData.jsx";
import { fmtTemp, formatDateTime, timeAgo } from "../api/live.js";
import { levelColor } from "../components/live/format.js";
import usePageTitle from "../hooks/usePageTitle.js";

const STEPS = [
  ["01", "Collect", "Every 30 minutes the live API asks Open-Meteo for the current weather, the last 30 days and the coming days of 30 Indian cities."],
  ["02", "Store", "MongoDB keeps every reading and every daily value. Reload the page or restart the server and the history is still there."],
  ["03", "Alert", "Each city is compared with its own multi-year normal using IMD-style heatwave rules. A region's alert follows its worst city."],
];

const FEATURES = [
  ["Regions", "Seven regions with a 30-day temperature chart, the normal for the season and the stored forecast.", "regions"],
  ["Cities", "Current temperature, feels-like, humidity and wind for every city, plus its stored readings.", "stations"],
  ["Alerts", "Automatic heat alerts with full history, and a form to record your own.", "alerts"],
  ["Forecast", "Expected maximum for the next days in every region, with the heat level it would mean.", "forecast"],
];

export default function Home() {
  usePageTitle("Live heat monitor");
  const { overview, error, loading } = useLive();
  const s = overview?.summary;
  const hottest = s?.hottestNow;
  const lastOk = overview?.stored?.lastSuccessAt;

  return (
    <>
      <section className="hero container lv-hero">
        <div>
          <span className="eyebrow mono">LIVE · INDIA HEAT MONITOR</span>
          <h1>India's heat,<br /><span className="accent-text">as it happens.</span></h1>
          <p>
            Real weather for 30 cities in 7 regions, kept in a database so you can read today against the days before it,
            with automatic heatwave alerts.
          </p>
          <div className="hero-ctas">
            <Link to="/dashboard" className="btn btn-primary">Open the dashboard ↗</Link>
            <Link to="/report" className="btn btn-ghost">Report an observation</Link>
          </div>
        </div>

        <aside className="lv-now" aria-live="polite">
          <span className="eyebrow mono">RIGHT NOW</span>
          {overview ? (
            <>
              <div className="lv-now-temp">
                <strong className="mono">{fmtTemp(hottest?.nowC)}</strong>
                <span>hottest city: {hottest ? hottest.name : "—"}</span>
              </div>
              <dl>
                <div><dt>Regions at Hot Day or above</dt><dd className="mono">{s.regionsElevated} / {s.regionsTotal}</dd></div>
                <div><dt>Cities reporting</dt><dd className="mono">{s.stationsReporting} / {s.stationsTotal}</dd></div>
                <div><dt>Active alerts</dt><dd className="mono">{s.activeAlerts}</dd></div>
                <div><dt>Collected</dt><dd className="mono">{timeAgo(lastOk)}</dd></div>
              </dl>
              {hottest?.observedAt && <small>Reading from {formatDateTime(hottest.observedAt)} IST</small>}
            </>
          ) : loading ? (
            <p className="lv-now-msg">Reading stored data…</p>
          ) : (
            <p className="lv-now-msg">{error} <code>npm run dev:all</code> starts everything.</p>
          )}
        </aside>
      </section>

      {overview && (
        <section className="container lv-strip-wrap" aria-label="Regions today">
          <div className="lv-strip">
            {[...overview.regions].sort((a, b) => b.level - a.level || (b.todayMaxC ?? 0) - (a.todayMaxC ?? 0)).map((r) => (
              <Link key={r.id} to={`/dashboard?tab=regions&region=${r.id}`} className="lv-chip" style={{ borderColor: `${levelColor(r.level)}66` }}>
                <i style={{ background: levelColor(r.level) }} aria-hidden="true" />
                <span>{r.name}</span>
                <strong className="mono">{fmtTemp(r.todayMaxC)}</strong>
                <small>{r.severity}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section container">
        <span className="eyebrow mono">HOW IT WORKS</span>
        <h2 className="section-title">From a weather API to an alert you can trust</h2>
        <div className="lv-steps">
          {STEPS.map(([n, title, text]) => (
            <article className="lv-step" key={n}><span className="mono">{n}</span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="section container">
        <span className="eyebrow mono">EXPLORE</span>
        <h2 className="section-title">Everything is one click from the dashboard</h2>
        <div className="card-grid">
          {FEATURES.map(([title, text, tab], i) => (
            <Link className="feature-card feature-link" key={tab} to={`/dashboard?tab=${tab}`}>
              <span className="feature-number mono">0{i + 1}</span><h3>{title}</h3><p>{text}</p><span className="feature-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="lv-honest">
          <h3>About the data</h3>
          <p>
            Weather comes from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (free, CC BY 4.0): model data for one point
            per city, not readings from IMD weather stations. "Normal" is a multi-year average, and the heat levels are an indicative
            classification, not an official warning. Use IMD bulletins for decisions.
          </p>
        </div>
      </section>

      <section className="final-cta">
        <div className="container">
          <h2 className="section-title">Seen something on the ground?</h2>
          <p>Report an observation. It is validated, stored in MongoDB and listed on the dashboard.</p>
          <Link className="btn btn-primary" to="/report">Create an observation</Link>
        </div>
      </section>
    </>
  );
}
