import React, { useCallback, useEffect, useState } from "react";
import { formatDateTime, liveApi } from "../../api/live.js";
import { DataTable, ErrorState, Loading, SeverityBadge } from "../../components/live/ui.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue.js";
import { noMatch } from "../../components/live/format.js";

// The Alerts tab.
//   - The list of alerts from MongoDB: just the active ones, or the whole history (alerts are never deleted).
//   - A search box. The text goes to the backend, which looks in the region, message, level, status and source
//     ("mumbai", "heatwave", "cleared", "automatic"...).
//   - A form to record your own alert. The automatic ones are made by the system and can't be edited or cleared here.
// Props: overview (gives the region names for the form), params + setParam (the address bar holds the search text),
// onChanged() tells the page to re-read the shared data after an alert is added or cleared.
export default function Alerts({ overview, params, setParam, onChanged }) {
  const [filter, setFilter] = useState("active"); // "active" | "all"
  const q = params.get("q") || "";
  const searchText = useDebouncedValue(q.trim(), 300); // ask the database once typing pauses
  const [state, setState] = useState({ loading: true, error: "", rows: [] });

  // ---- form state ----
  const regions = overview.regions;
  const [form, setForm] = useState({ region: regions[0]?.name || "", tier: "Watch", message: "", channel: "Dashboard" });
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [saving, setSaving] = useState(false);

  // (re)load the list whenever the filter or the search text changes
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.alerts(filter === "active" ? "active" : "", 200, searchText)
      .then((rows) => setState({ loading: false, error: "", rows }))
      .catch((cause) => setState({ loading: false, error: cause.message, rows: [] }));
  }, [filter, searchText]);
  useEffect(() => { load(); }, [load, overview.generatedAt]);

  // save a new alert; the server validates it again and answers 400 with the reasons if something is wrong
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ kind: "", text: "" });
    try {
      await liveApi.createAlert(form);
      setForm((f) => ({ ...f, message: "" }));
      setStatus({ kind: "ok", text: "Alert saved to MongoDB." });
      load();
      onChanged();
    } catch (cause) {
      setStatus({ kind: "bad", text: cause.message });
    } finally {
      setSaving(false);
    }
  };

  // mark one of your own alerts as cleared (it stays in the history)
  const clear = async (id) => {
    try {
      await liveApi.clearAlert(id);
      load();
      onChanged();
    } catch (cause) {
      setStatus({ kind: "bad", text: cause.message });
    }
  };

  const emptyText = searchText
    ? noMatch(searchText, "alerts", "Try a region, a level such as Warning, or a word from the message.")
    : filter === "active" ? "No active alerts. Every region is currently below Hot Day level." : "No alerts have been stored yet.";

  return (
    <div className="dashboard-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Alerts</h2>
            <p className="panel-description">
              Raised automatically when a region reaches Hot Day level or above, and cleared when it drops back. Every alert stays as history.
            </p>
          </div>
          <SearchBox
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder="Search alerts: region, level, message, status…"
            status={q.trim() && !state.loading ? `${state.rows.length} alert(s) found` : ""}
          />
          <div className="lv-seg" role="group" aria-label="Alert filter">
            <button aria-pressed={filter === "active"} className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Active</button>
            <button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All history</button>
          </div>
        </div>

        {state.loading && !state.rows.length ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={load} /> : (
          <DataTable
            ariaLabel="Alerts, scrollable"
            rowKey={(r) => r.id}
            rows={state.rows}
            empty={emptyText}
            columns={[
              { label: "Level", render: (r) => <SeverityBadge tier={r.tier} severity={r.severity || r.tier} /> },
              { label: "Region", key: "region" },
              { label: "Message", key: "message" },
              { label: "Source", render: (r) => (r.source === "auto" ? "Automatic" : "Recorded by a user") },
              { label: "Status", render: (r) => <span className={`lv-status lv-status-${r.status}`}>{r.status}</span> },
              { label: "Issued (IST)", render: (r) => formatDateTime(r.issuedAt) },
              // only your own alerts can be cleared by hand; automatic ones follow the data
              { label: "Action", render: (r) => (r.status === "active" && r.source === "manual" ? <button className="btn btn-ghost btn-small" onClick={() => clear(r.id)}>Clear</button> : null) },
            ]}
          />
        )}
      </section>

      <form className="panel alert-form" onSubmit={submit}>
        <h2>Record an alert</h2>
        <p className="panel-description">For a warning you want to add yourself. It is stored in MongoDB next to the automatic ones. The channel is only a label; SMS and push delivery are not connected.</p>
        <div className="form-grid">
          <label>Region
            <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
              {regions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </label>
          <label>Level
            <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
              {["Safe", "Watch", "Warning", "Emergency"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Channel
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {["Dashboard", "App Push", "SMS", "SMS + Dashboard"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="form-full">Message
            <textarea required minLength={3} maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="State the observed condition and the recommended action." />
          </label>
        </div>
        <div className="action-row">
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save alert"}</button>
          {status.text && <span className={`form-status ${status.kind === "bad" ? "status-bad" : "status-ok"}`} role="status">{status.text}</span>}
        </div>
      </form>
    </div>
  );
}
