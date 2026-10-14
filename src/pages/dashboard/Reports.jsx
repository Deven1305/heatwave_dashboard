import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmtTemp, formatDateTime, liveApi } from "../../api/live.js";
import { DataTable, ErrorState, Loading } from "../../components/live/ui.jsx";

export default function Reports() {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    liveApi.reports()
      .then((rows) => setState({ loading: false, error: "", rows }))
      .catch((cause) => setState({ loading: false, error: cause.message, rows: [] }));
  };
  useEffect(load, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Field observation reports</h2>
          <p className="panel-description">Reports submitted through the observation form are stored in MongoDB and listed here, newest first. Contact details are kept private and are not shown.</p>
        </div>
        <Link className="btn btn-primary" to="/report">+ New observation</Link>
      </div>
      {state.loading && !state.rows.length ? <Loading /> : state.error ? <ErrorState error={state.error} onRetry={load} /> : (
        <DataTable
          rowKey={(r) => r.id}
          rows={state.rows}
          empty="No reports have been submitted yet."
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
