import React from "react";
import Badge from "../Badge.jsx";
import { tierKey } from "../../api/live.js";

// The grey dashed box used both for "loading..." and for "nothing to show"; only the message differs.
export function Loading({ label = "Loading data…" }) {
  return <div className="data-state" role="status">{label}</div>;
}

// A red error box. If you pass onRetry it gets a "Try again" button. role="alert" makes screen readers read it out when it appears.
export function ErrorState({ error, onRetry }) {
  return (
    <div className="data-state data-state-error" role="alert">
      <span>{error}</span>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// A Badge for a heat level. `tier` gives the colour (Safe, Watch, Warning or Emergency), `severity` the word on it ("Heatwave").
export function SeverityBadge({ tier, severity }) {
  return <Badge tier={tierKey(tier)} label={severity || tier} />;
}

// A headline number card: small label on top, the big value, a small note underneath. tone="warn" turns it amber.
export function Stat({ label, value, note, tone }) {
  return (
    <article className={`stat-card lv-stat ${tone ? `lv-tone-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value mono">{value}</strong>
      {note && <span className="stat-source">{note}</span>}
    </article>
  );
}

// The one table component all the tabs use, so they look and behave the same.
//   columns  a list like { label: "City", key: "name" } to print row.name, or { label, render: (row) => ... } for custom content
//   rows     plain objects. rowKey(row) should give each row a unique id.
//   onRowClick  when given, rows can be clicked and also chosen with Tab + Enter/Space, and selectedKey highlights one row
//   empty    the message shown instead of a table when there are no rows (searching with no result also uses it)
// On a narrow screen a wide table scrolls sideways inside its own box instead of stretching the page.
export function DataTable({ columns, rows, empty = "No records are available.", rowKey, onRowClick, selectedKey, ariaLabel = "Data table, scrollable" }) {
  if (!rows?.length) return <Loading label={empty} />;
  return (
    // tabIndex={0} is needed so someone using only the keyboard can Tab to the box and scroll it sideways with the arrow keys
    <div className="responsive-table" tabIndex={0} role="region" aria-label={ariaLabel}>
      <table>
        <thead><tr>{columns.map((c) => <th key={c.label} style={c.align ? { textAlign: c.align } : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const key = rowKey ? rowKey(row) : i;
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={key}
                className={`${clickable ? "lv-row-click" : ""} ${selectedKey !== undefined && selectedKey === key ? "lv-row-selected" : ""}`}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row); } } : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.label} style={c.align ? { textAlign: c.align } : undefined}>{c.render ? c.render(row) : row[c.key] ?? "—"}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
