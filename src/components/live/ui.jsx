import React from "react";
import Badge from "../Badge.jsx";
import { tierKey } from "../../api/live.js";

export function Loading({ label = "Loading data…" }) {
  return <div className="data-state" role="status">{label}</div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="data-state data-state-error" role="alert">
      <span>{error}</span>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function SeverityBadge({ tier, severity }) {
  return <Badge tier={tierKey(tier)} label={severity || tier} />;
}

export function Stat({ label, value, note, tone }) {
  return (
    <article className={`stat-card lv-stat ${tone ? `lv-tone-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value mono">{value}</strong>
      {note && <span className="stat-source">{note}</span>}
    </article>
  );
}

// columns: [{ label, key?, render?(row), align? }]
export function DataTable({ columns, rows, empty = "No records are available.", rowKey, onRowClick, selectedKey, ariaLabel = "Data table, scrollable" }) {
  if (!rows?.length) return <Loading label={empty} />;
  return (
    // tabIndex lets keyboard users scroll a wide table sideways (WCAG: scrollable regions must be focusable)
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
