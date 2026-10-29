import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtTemp, formatDateTime, liveApi } from "../../api/live.js";
import { DataTable, ErrorState, Loading } from "../../components/live/ui.jsx";
import SearchBox from "../../components/live/SearchBox.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue.js";
import { noMatch } from "../../components/live/format.js";

// The Reports tab: what people submitted through the form on /report, newest first, straight from MongoDB.
//
// A report is just a record of what somebody saw. It does not change any reading, heat level or alert.
// Search is done by the backend inside MongoDB (region, station code, status, observer name, notes).
// Email and phone are saved but never sent to this page and can't be searched, to keep them private.
// Props: params + setParam (the address bar holds the search text).
export default function Reports({ params, setParam }) {
  const q = params.get("q") || "";
  const searchText = useDebouncedValue(q.trim(), 300); // ask the database once typing pauses
  const [state, setState] = useState({ loading: true, error: "", rows: [] });

  // reload whenever the search text changes
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.reports(searchText)
      .then((rows) => setState({ loading: false, error: "", rows }))
      .catch((cause) => setState({ loading: false, error: cause.message, rows: [] }));
  };
  useEffect(load, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps -- load only depends on searchText

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Field observation reports</h2>
          <p className="panel-description">Reports submitted through the observation form, newest first. Contact details are kept private.</p>
        </div>
        <SearchBox
          value={q}
          onChange={(v) => setParam("q", v)}
          placeholder="Search reports: region, station, observer, notes…"
          status={q.trim() && !state.loading ? `${state.rows.length} report(s) found` : ""}
        />
        <Link className="btn btn-primary" to="/report">+ New observation</Link>
      </div>

      {state.loading && !state.rows.length ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={load} /> : (
        <DataTable
          ariaLabel="Reports, scrollable"
          rowKey={(r) => r.id}
          rows={state.rows}
          empty={searchText ? noMatch(searchText, "reports", "Try a region, a station code like MH-014, or an observer's name.") : "No reports have been submitted yet."}
          columns={[
            { label: "Reference", key: "id" },
            { label: "Region", key: "region" },
            { label: "Station", key: "plotId" },
            { label: "Status", key: "status" },
            { label: "Temperature", render: (r) => fmtTemp(r.ambientTempC) },
            { label: "Observer", render: (r) => r.observerName || "—" },
            { label: "Submitted (IST)", render: (r) => formatDateTime(r.createdAt) },
            { label: "Evidence", render: (r) => (r.photo ? <a href={liveApi.photoUrl(r.id)} target="_blank" rel="noreferrer">View image</a> : "—") },
          ]}
        />
      )}
    </section>
  );
}
