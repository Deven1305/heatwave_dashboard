import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLive } from "../context/LiveData.jsx";
import { timeAgo } from "../api/live.js";
import { ErrorState, Loading } from "../components/live/ui.jsx";
import Overview from "./dashboard/Overview.jsx";
import Regions from "./dashboard/Regions.jsx";
import Stations from "./dashboard/Stations.jsx";
import Alerts from "./dashboard/Alerts.jsx";
import Reports from "./dashboard/Reports.jsx";
import Forecast from "./dashboard/Forecast.jsx";
import DataTab from "./dashboard/DataTab.jsx";

export const TABS = [
  ["overview", "Overview"], ["regions", "Regions"], ["stations", "Stations"], ["alerts", "Alerts"],
  ["reports", "Reports"], ["forecast", "Forecast"], ["data", "Data"],
];
const ALIASES = { field: "stations", "live-map": "overview" }; // older links

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const { overview, error, loading, reload, fetchLatest } = useLive();
  const [notice, setNotice] = useState({ kind: "", text: "" });
  const [fetching, setFetching] = useState(false);

  const requested = ALIASES[params.get("tab")] || params.get("tab");
  const activeTab = TABS.some(([id]) => id === requested) ? requested : "overview";
  const goTo = (tab, extra = {}) => setParams(tab === "overview" && !Object.keys(extra).length ? {} : { tab, ...extra });

  const pullLatest = async () => {
    setFetching(true);
    setNotice({ kind: "", text: "" });
    try {
      const run = await fetchLatest();
      setNotice({ kind: "ok", text: `Fetched from Open-Meteo and stored in MongoDB: ${run.observationsInserted} new readings, ${run.dailyInserted + run.dailyUpdated} daily rows touched.` });
    } catch (cause) {
      setNotice({ kind: "bad", text: cause.message });
    } finally {
      setFetching(false);
    }
  };

  const lastOk = overview?.stored?.lastSuccessAt;
  return (
    <section className="dashboard-page container">
      <header className="dash-header">
        <div>
          <span className="eyebrow mono">KJS CES 01 · LIVE HEAT MONITORING</span>
          <h1>Heatwave intelligence dashboard</h1>
          <p className="dashboard-intro">
            Real weather for 30 Indian cities in 7 regions, collected from Open-Meteo and kept in MongoDB, so today's picture
            always comes with the days before it.
          </p>
        </div>
        <div className="lv-live">
          <span className={`lv-live-pill ${error ? "lv-live-bad" : ""}`}>
            <i aria-hidden="true" />{error ? "Service unreachable" : lastOk ? `Live · collected ${timeAgo(lastOk)}` : "Waiting for first data"}
          </span>
          <div className="lv-live-actions">
            <button className="btn btn-ghost" onClick={() => reload()} disabled={loading}>{loading ? "Loading…" : "Reload"}</button>
            <button className="btn btn-primary" onClick={pullLatest} disabled={fetching}>{fetching ? "Fetching…" : "Fetch latest data"}</button>
          </div>
        </div>
      </header>

      {notice.text && <div className={`lv-notice lv-notice-${notice.kind}`} role="status">{notice.text}</div>}

      <nav className="tab-bar" aria-label="Dashboard sections">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab-btn ${activeTab === id ? "active" : ""}`} aria-current={activeTab === id ? "page" : undefined} onClick={() => goTo(id)}>{label}</button>
        ))}
      </nav>

      {!overview && loading ? <Loading label="Reading stored data…" /> : !overview ? <ErrorState error={error} onRetry={() => reload()} /> : (
        <>
          {error && <ErrorState error={`Showing the last data received. ${error}`} onRetry={() => reload()} />}
          {activeTab === "overview" && <Overview overview={overview} goTo={goTo} />}
          {activeTab === "regions" && <Regions overview={overview} params={params} goTo={goTo} />}
          {activeTab === "stations" && <Stations overview={overview} params={params} goTo={goTo} />}
          {activeTab === "alerts" && <Alerts overview={overview} onChanged={() => reload({ silent: true })} />}
          {activeTab === "reports" && <Reports />}
          {activeTab === "forecast" && <Forecast overview={overview} goTo={goTo} />}
          {activeTab === "data" && <DataTab overview={overview} />}
        </>
      )}
    </section>
  );
}
