import React, { useState } from "react";
import { Link } from "react-router-dom";
import { InlineEditNumber, EditableTable, EditOverlayButton } from "../components/InPageEdit.jsx";

/**
 * KJS-CES-01 — Experiment 4, Part 1: In-Page Editing, pattern showcase.
 *
 * This page demonstrates the three wireframed patterns in isolation, with
 * the exact sample data from the wireframe (Emergency Threshold 45°C,
 * Mumbai/Pune/Nagpur city table, Mumbai district alert policy).
 *
 * These are NOT just a demo — the same three components
 * (src/components/InPageEdit.jsx) are wired into real dashboard data on
 * the Dashboard's Alerts tab (src/pages/Dashboard.jsx, /dashboard?tab=alerts):
 * that's where an operator would actually use them, to tune the global
 * emergency threshold, edit each region's alert threshold/tier, and
 * rewrite a region's alert message — see the "Used on: Dashboard → Alerts
 * tab" links below each pattern.
 */

const TIERS = ["Safe", "Watch", "Warning", "Emergency"];

const initialCities = [
  { id: "mumbai", city: "Mumbai", threshold: 42, tier: "Warning" },
  { id: "pune", city: "Pune", threshold: 38, tier: "Watch" },
  { id: "nagpur", city: "Nagpur", threshold: 46, tier: "Emergency" },
];

export default function InPageEditing() {
  const [emergencyThreshold, setEmergencyThreshold] = useState(45);
  const [cities, setCities] = useState(initialCities);
  const [districtAlert, setDistrictAlert] = useState({
    city: "Mumbai",
    threshold: 42,
    tier: "Warning",
    message: "EXTREME HEAT WARNING: temps expected to exceed 40°C in the next 24 hours.",
  });

  return (
    <section className="form-page container">
      <div className="form-header">
        <span className="eyebrow mono">EXP-4 · PART 1 — IN-PAGE EDITING</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>In-Page Editing Patterns</h1>
        <p style={{ color: "rgba(241,250,238,0.65)", maxWidth: "62ch" }}>
          Three ways to edit data without leaving the page: an inline single-field edit, an
          editable table row, and an overlay panel — each commits only on confirm/Save, and
          discards the draft on cancel. This page shows the patterns with sample data; they're
          used for real on the{" "}
          <Link to="/dashboard?tab=alerts" style={{ color: "var(--orange)" }}>
            Dashboard's Alerts tab
          </Link>
          .
        </p>
      </div>

      <div className="editing-demo-block">
        <h2 className="editing-demo-title">Pattern 1 — Single-Field Inline Edit</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Click the value below. It swaps in place for a numeric input with ✓ (save) / ✗ (cancel).
        </p>
        <InlineEditNumber label="Emergency Threshold" value={emergencyThreshold} unit="°C" min={-10} max={60} onSave={setEmergencyThreshold} />
        <p className="hint" style={{ marginTop: 14 }}>
          Used on: <Link to="/dashboard?tab=alerts" style={{ color: "var(--steel)" }}>Dashboard → Alerts tab</Link> — "Global Auto-Escalation Threshold".
        </p>
      </div>

      <div className="editing-demo-block">
        <h2 className="editing-demo-title">Pattern 2 — Table Edit</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Click any row in "Manage City Thresholds" to make just that row editable.
        </p>
        <EditableTable
          columns={[
            { key: "city", label: "City" },
            { key: "threshold", label: "Threshold", type: "number", min: -10, max: 60, render: (r) => `${r.threshold}°C` },
            { key: "tier", label: "Tier", type: "select", options: TIERS, render: (r) => <span className={`tier-text-${r.tier.toLowerCase()}`}>{r.tier}</span> },
          ]}
          rows={cities}
          onSaveRow={(id, patch) => setCities((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
        />
        <p className="hint" style={{ marginTop: 14 }}>
          Used on: <Link to="/dashboard?tab=alerts" style={{ color: "var(--steel)" }}>Dashboard → Alerts tab</Link> — "Manage Region Alert Thresholds".
        </p>
      </div>

      <div className="editing-demo-block">
        <h2 className="editing-demo-title">Pattern 3 — Overlay Edit</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Click "Edit Alert" to open the District Alert Policy panel over a dimmed backdrop.
        </p>
        <div className="inline-edit-card">
          <span className="inline-edit-label">{districtAlert.city}</span>
          <span className="inline-edit-value" style={{ fontSize: 20 }}>
            {districtAlert.threshold}°C · {districtAlert.tier} tier
          </span>
          <EditOverlayButton
            title="Edit District Alert Policy"
            trigger="✎ Edit Alert"
            fields={[
              { key: "threshold", label: "Alert Threshold (°C)", type: "number", min: -10, max: 60 },
              { key: "message", label: "Warning Message", type: "textarea", rows: 4 },
            ]}
            initial={districtAlert}
            onSave={(patch) => setDistrictAlert((d) => ({ ...d, ...patch }))}
          />
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Used on: <Link to="/dashboard?tab=alerts" style={{ color: "var(--steel)" }}>Dashboard → Alerts tab</Link> — "Edit" button on each alert dispatch row.
        </p>
      </div>
    </section>
  );
}
