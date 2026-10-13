import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Badge from "../components/Badge.jsx";
import { expressApi, formatDateTime, nodeApi } from "../api/backend.js";
import { fetchRegionForecast } from "../api/weather.js";

const TABS = [["overview", "Overview"], ["regions", "Regional heat"], ["field", "AWS monitoring"], ["alerts", "Alerts"], ["reports", "Reports"], ["forecast", "Forecast"]];
const FORECAST_LOCATION = { label: "Central India", latitude: 22, longitude: 79 };
const severityTier = (value) => /severe/i.test(value) ? "emergency" : /heatwave/i.test(value) ? "warning" : /hot/i.test(value) ? "watch" : "safe";
const alertTier = (value) => /high|emergency/i.test(value) ? "emergency" : /warning/i.test(value) ? "warning" : /moderate|watch/i.test(value) ? "watch" : "safe";

function Loading({ label = "Loading data…" }) { return <div className="data-state">{label}</div>; }
function ErrorState({ error, onRetry }) { return <div className="data-state data-state-error"><span>{error}</span><button className="btn btn-ghost" onClick={onRetry}>Try again</button></div>; }
function DataTable({ columns, rows, empty = "No records are available." }) {
  if (!rows?.length) return <Loading label={empty} />;
  return <div className="responsive-table"><table><thead><tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || row.alertId || row.sensorId || row.plotId || i}>{columns.map((c) => <td key={c.label} data-label={c.label}>{c.render ? c.render(row) : row[c.key] ?? "—"}</td>)}</tr>)}</tbody></table></div>;
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "overview";
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [refreshedAt, setRefreshedAt] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [dashboard, regions, regionalAlerts, sensors, plots, farmers, reports] = await Promise.all([nodeApi.dashboard(), expressApi.regions(), expressApi.alerts(), nodeApi.sensors(), nodeApi.plots(), nodeApi.farmers(), nodeApi.reports()]);
      setData({ dashboard, regions, regionalAlerts, sensors, plots, farmers, reports }); setRefreshedAt(new Date().toISOString());
    } catch (cause) { setError(cause.message || "The dashboard services could not be reached."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const selectTab = (tab) => setParams(tab === "overview" ? {} : { tab });
  return <section className="dashboard-page container">
    <header className="dash-header"><div><span className="eyebrow mono">KJS CES 01 · DECISION SUPPORT</span><h1>Heatwave intelligence dashboard</h1><p className="dashboard-intro">Regional observations, AWS telemetry, alerts, reports, and a live public forecast in one operational view.</p></div><div className="refresh-control"><span className="mono">Fetched {refreshedAt ? formatDateTime(refreshedAt) : "—"}</span><button className="btn btn-ghost" disabled={loading} onClick={load}>{loading ? "Refreshing…" : "Refresh"}</button></div></header>
    <nav className="tab-bar" aria-label="Dashboard sections">{TABS.map(([id, label]) => <button key={id} className={"tab-btn " + (activeTab === id ? "active" : "")} aria-current={activeTab === id ? "page" : undefined} onClick={() => selectTab(id)}>{label}</button>)}</nav>
    {loading && !data ? <Loading /> : error && !data ? <ErrorState error={error} onRetry={load} /> : <>{error && <ErrorState error={"Some data may be stale: " + error} onRetry={load} />}{activeTab === "overview" && <Overview data={data} selectTab={selectTab} />}{activeTab === "regions" && <Regions regions={data.regions} />}{activeTab === "field" && <FieldMonitoring data={data} />}{activeTab === "alerts" && <Alerts alerts={data.regionalAlerts} onChanged={load} regions={data.regions} />}{activeTab === "reports" && <Reports reports={data.reports} />}{activeTab === "forecast" && <Forecast />}</>}
  </section>;
}

function Overview({ data, selectTab }) {
  const { dashboard, regions, sensors, regionalAlerts } = data;
  const stations = regions.reduce((sum, region) => sum + Number(region.awsStationsReporting || 0), 0);
  const elevated = regions.filter((region) => severityTier(region.severity) !== "safe").length;
  const latest = sensors.reduce((current, sensor) => !current || new Date(sensor.timestamp) > new Date(current.timestamp) ? sensor : current, null);
  const cards = [["AWS stations reporting", stations, "Regional API"], ["Regions above normal", elevated + " / " + regions.length, "Derived from regional readings"], ["Recorded regional alerts", regionalAlerts.length, "Alert API"], ["Latest telemetry", latest ? formatDateTime(latest.timestamp) : "Not available", "Node telemetry API"]];
  return <><div className="stat-grid">{cards.map(([label, value, source]) => <article className="stat-card" key={label}><span className="stat-label">{label}</span><strong className="stat-value mono">{value}</strong><span className="stat-source">{source}</span></article>)}</div><div className="dashboard-two-column"><section className="panel"><h2>Operational summary</h2><p>The Node dashboard service reports {dashboard?.summary?.activeSensors ?? sensors.length} active field sensors and {dashboard?.summary?.alertCount ?? 0} field alerts. Regional monitoring is supplied independently by the Express service.</p><div className="action-row"><button className="btn btn-primary" onClick={() => selectTab("field")}>Inspect AWS readings</button><button className="btn btn-ghost" onClick={() => selectTab("alerts")}>Review alerts</button></div></section><section className="panel"><h2>Current regional severity</h2><div className="regional-bars" aria-label="Regional maximum temperatures">{regions.slice().sort((a, b) => b.currentMaxTempC - a.currentMaxTempC).map((region) => <div className="regional-bar-row" key={region.id}><span>{region.region}</span><div className="regional-bar-track"><div className={"regional-bar-fill regional-bar-" + severityTier(region.severity)} style={{ width: Math.max(0, Math.min(100, Number(region.currentMaxTempC) / 60 * 100)) + "%" }} /></div><strong className="mono">{region.currentMaxTempC}°C</strong></div>)}</div><DataTable columns={[{ label: "Region", key: "region" }, { label: "Condition", render: (r) => <Badge tier={severityTier(r.severity)} label={r.severity} /> }, { label: "Current max", render: (r) => r.currentMaxTempC + "°C" }]} rows={regions.slice().sort((a, b) => b.currentMaxTempC - a.currentMaxTempC)} /></section></div></>;
}

function Regions({ regions }) { return <section className="panel"><h2>Region-wise heat monitoring</h2><p className="panel-description">Severity is calculated by the regional backend from reported maximum temperature. Departure is calculated from the configured normal maximum.</p><DataTable columns={[{ label: "Region", key: "region" }, { label: "Current max", render: (r) => r.currentMaxTempC + "°C" }, { label: "Normal max", render: (r) => r.normalMaxTempC + "°C" }, { label: "Departure", render: (r) => (r.currentMaxTempC - r.normalMaxTempC).toFixed(1) + "°C" }, { label: "AWS reporting", key: "awsStationsReporting" }, { label: "Classification", render: (r) => <Badge tier={severityTier(r.severity)} label={r.severity} /> }]} rows={regions} /></section>; }

function FieldMonitoring({ data }) {
  const [selectedId, setSelectedId] = useState(data.plots[0]?.plotId || ""); const [details, setDetails] = useState(null); const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);
  const rows = useMemo(() => data.sensors.map((sensor) => ({ ...sensor, plot: data.plots.find((plot) => plot.plotId === sensor.plotId) })), [data]);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetails(null); setDetailError("");
    Promise.all([nodeApi.irrigation(selectedId), nodeApi.waterStress(selectedId), nodeApi.prediction(selectedId)])
      .then(([irrigation, stress, prediction]) => { if (!cancelled) setDetails({ irrigation, stress, prediction }); })
      .catch((cause) => { if (!cancelled) setDetailError(cause.message); });
    return () => { cancelled = true; };
  }, [selectedId, retry, data.sensors]);
  return <div className="dashboard-stack"><section className="panel"><h2>AWS telemetry</h2><p className="panel-description">Readings are served from the current Node backend. Select a plot to inspect backend-generated irrigation and water-stress guidance.</p><DataTable columns={[{ label: "Plot", key: "plotId" }, { label: "Location", render: (r) => r.plot?.village || "—" }, { label: "Air", render: (r) => r.airTemperature + "°C" }, { label: "Soil moisture", render: (r) => r.soilMoisture + "%" }, { label: "Humidity", render: (r) => r.humidity + "%" }, { label: "Observed", render: (r) => formatDateTime(r.timestamp) }, { label: "Status", key: "status" }]} rows={rows} /></section><section className="panel"><div className="panel-head"><div><h2>Plot decision support</h2><p className="panel-description">Rules and prediction are computed by the existing Node service for the selected plot.</p></div><label>Plot<select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{data.plots.map((plot) => <option value={plot.plotId} key={plot.plotId}>{plot.plotId} · {plot.village}</option>)}</select></label></div>{detailError ? <ErrorState error={detailError} onRetry={() => setRetry((value) => value + 1)} /> : !selectedId ? <Loading label="No plots are available for analysis." /> : !details ? <Loading label="Loading plot analysis…" /> : <div className="decision-grid"><Decision label="Irrigation" value={details.irrigation.irrigationRequired ? "Recommended" : "Not required"} detail={details.irrigation.recommendedWater + " · " + details.irrigation.recommendedDuration + " · " + details.irrigation.priority + " priority"} /><Decision label="Water stress" value={details.stress.waterStressProbability + "%"} detail={details.stress.status + ". " + details.stress.alert} /><Decision label="Next irrigation" value={details.prediction.predictedIrrigationDate} detail={details.prediction.confidence + "% confidence"} /></div>}</section></div>;
}
function Decision({ label, value, detail }) { return <article className="decision-card"><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>; }

function Alerts({ alerts, regions, onChanged }) {
  const [form, setForm] = useState({ region: regions[0]?.region || "", tier: "Watch", message: "", channel: "App Push" }); const [status, setStatus] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setStatus(""); try { await expressApi.createAlert(form); setForm((current) => ({ ...current, message: "" })); setStatus("Alert saved to the dashboard."); onChanged(); } catch (cause) { setStatus(cause.message); } finally { setSaving(false); } };
  return <div className="dashboard-stack"><section className="panel"><h2>Regional alerts</h2><DataTable columns={[{ label: "ID", key: "id" }, { label: "Region", key: "region" }, { label: "Severity", render: (r) => <Badge tier={alertTier(r.tier)} label={r.tier} /> }, { label: "Message", key: "message" }, { label: "Channel", key: "channel" }, { label: "Issued", key: "issued" }]} rows={alerts} empty="No regional alerts are currently recorded." /></section><form className="panel alert-form" onSubmit={submit}><h2>Record a regional alert</h2><p className="panel-description">Records an alert in the regional service. The channel is recorded as metadata; SMS and push delivery are not connected.</p><div className="form-grid"><label>Region<select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{regions.map((region) => <option value={region.region} key={region.id}>{region.region}</option>)}</select></label><label>Severity<select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>{["Safe", "Watch", "Warning", "Emergency"].map((tier) => <option key={tier}>{tier}</option>)}</select></label><label>Channel<select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{["App Push", "SMS", "SMS + Dashboard"].map((channel) => <option key={channel}>{channel}</option>)}</select></label><label className="form-full">Message<textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="State the observed condition and recommended action." /></label></div><div className="action-row"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save alert"}</button>{status && <span className="form-status">{status}</span>}</div></form></div>;
}

function Reports({ reports }) { return <section className="panel"><h2>Submitted field reports</h2><p className="panel-description">Reports submitted through the observation form are persisted by the Node backend and appear here after a refresh.</p><DataTable columns={[{ label: "Reference", key: "id" }, { label: "Plot", key: "plotId" }, { label: "Region", key: "region" }, { label: "Status", key: "status" }, { label: "Submitted", render: (r) => formatDateTime(r.createdAt) }, { label: "Evidence", render: (r) => r.photo?.dataUrl?.match(/^data:image\/(jpeg|png|webp);base64,/) ? <a href={r.photo.dataUrl} download={r.photo.name || "evidence"}>Download image</a> : "—" }]} rows={reports} empty="No submitted reports are available." /></section>; }

function Forecast() {
  const [state, setState] = useState({ loading: true, error: "", daily: null });
  const load = useCallback(() => { setState({ loading: true, error: "", daily: null }); fetchRegionForecast(FORECAST_LOCATION.latitude, FORECAST_LOCATION.longitude).then((daily) => setState({ loading: false, error: "", daily })).catch((cause) => setState({ loading: false, error: cause.message || "Forecast unavailable.", daily: null })); }, []);
  useEffect(() => { load(); }, [load]);
  const rows = (state.daily?.time || []).map((date, index) => ({ id: date, date, max: state.daily.temperature_2m_max[index] }));
  return <section className="panel"><div className="panel-head"><div><h2>Live temperature forecast</h2><p className="panel-description">Daily maximum temperature for {FORECAST_LOCATION.label}, requested from the Open-Meteo public weather API when this tab opens.</p></div><button className="btn btn-ghost" onClick={load} disabled={state.loading}>Refresh forecast</button></div>{state.loading ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={load} /> : <DataTable columns={[{ label: "Date", key: "date" }, { label: "Forecast maximum", render: (r) => r.max.toFixed(1) + "°C" }]} rows={rows} />}</section>;
}
