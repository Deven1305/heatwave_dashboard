import React, { useState } from "react";

/**
 * KJS-CES-01 — Exp-4 Part 1: reusable in-page editing primitives.
 * Shared by the /editing-demo showcase page (src/pages/InPageEditing.jsx)
 * and the Dashboard's Alerts tab (src/pages/Dashboard.jsx), which is the
 * real feature that actually needed these three patterns: tuning alert
 * thresholds and alert message text without leaving the dashboard.
 *
 * All three follow the same contract: nothing in the parent's data
 * changes until the user explicitly confirms (✓ / Save). Cancel — or,
 * for the overlay, clicking the dimmed backdrop — always discards the
 * in-progress draft and leaves the last saved value untouched.
 */

/* ---------------- Pattern 1: Single-Field Inline Edit ---------------- */

export function InlineEditNumber({
  label,
  value,
  unit = "",
  min = -100,
  max = 100,
  onSave,
  containerClassName = "inline-edit-card",
  labelClassName = "inline-edit-label",
  valueClassName = "inline-edit-value",
  hintStyle,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");

  const startEdit = () => {
    setDraft(value);
    setError("");
    setEditing(true);
  };

  const confirm = () => {
    const n = Number(draft);
    const out = Number.isNaN(n) ? value : Math.min(max, Math.max(min, n));
    onSave(out);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (!editing) {
    return (
      <div
        className={containerClassName}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className={labelClassName}>{label}</span>
        <span className={valueClassName}>
          {value}
          {unit}
        </span>
        <span className="hint" style={hintStyle}>Click to edit</span>
      </div>
    );
  }

  return (
    <div className={`${containerClassName} inline-edit-card--editing`}>
      <span className={labelClassName}>{label}</span>
      <div className="inline-edit-form">
        <input
          type="number"
          autoFocus
          value={draft}
          min={min}
          max={max}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const n = Number(v);
            if (v === "") setError("Value required");
            else if (!Number.isFinite(n)) setError("Must be a number");
            else if (n < min) setError(`Minimum is ${min}`);
            else if (n > max) setError(`Maximum is ${max}`);
            else setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") cancel();
          }}
        />
        <button className="icon-btn icon-btn--ok" onClick={confirm} aria-label="Confirm" title="Save" disabled={Boolean(error)}>
          ✓
        </button>
        <button className="icon-btn icon-btn--cancel" onClick={cancel} aria-label="Cancel" title="Cancel">
          ✗
        </button>
      </div>
      {error && <div style={{ color: "#f77f00", marginTop: 8, fontSize: 13 }}>{error}</div>}
    </div>
  );
}

/* ---------------- Pattern 2: Table Edit ---------------- */

/**
 * columns: [{ key, label, type: "text" | "number" | "select", options?, render?(row) }]
 * rows: [{ id, ...fields }]
 * onSaveRow(id, patch)
 */
export function EditableTable({ columns, rows, onSaveRow, striped = false }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft(Object.fromEntries(columns.filter((c) => c.type).map((c) => [c.key, row[c.key]])));
  };

  const confirm = (id) => {
    onSaveRow(id, draft);
    setEditingId(null);
  };

  const cancel = () => setEditingId(null);

  return (
    <table className={striped ? "edit-table edit-table--striped" : "edit-table"}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          <th aria-hidden="true"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isEditing = editingId === row.id;
          return (
            <tr
              key={row.id}
              className={isEditing ? "edit-table-row editing" : "edit-table-row"}
              onClick={() => !isEditing && startEdit(row)}
              onKeyDown={(e) => {
                if (!isEditing && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  startEdit(row);
                }
              }}
              tabIndex={isEditing ? undefined : 0}
              role={isEditing ? undefined : "button"}
              aria-label={isEditing ? undefined : "Edit row"}
            >
              {columns.map((c) => (
                <td key={c.key}>
                  {isEditing && c.type === "number" && (
                    <input
                      type="number"
                      autoFocus
                      min={c.min}
                      max={c.max}
                      value={draft[c.key]}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                    />
                  )}
                  {isEditing && c.type === "select" && (
                    <select
                      value={draft[c.key]}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                    >
                      {c.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}
                  {!(isEditing && c.type) && (c.render ? c.render(row) : row[c.key])}
                </td>
              ))}
              <td className="edit-table-actions">
                {isEditing ? (
                  <>
                    <button
                      className="icon-btn icon-btn--ok"
                      onClick={(e) => { e.stopPropagation(); confirm(row.id); }}
                      aria-label="Confirm"
                      title="Save row"
                    >
                      ✓
                    </button>
                    <button
                      className="icon-btn icon-btn--cancel"
                      onClick={(e) => { e.stopPropagation(); cancel(); }}
                      aria-label="Cancel"
                      title="Cancel"
                    >
                      ✗
                    </button>
                  </>
                ) : (
                  <span className="hint">click row to edit</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------------- Pattern 3: Overlay Edit ---------------- */

/**
 * fields: [{ key, label, type: "number" | "textarea", min?, max?, rows? }]
 * initial: object matching field keys
 * trigger: JSX for the clickable open-button's contents (default "✎ Edit")
 */
export function EditOverlayButton({ title, fields, initial, onSave, trigger = "✎ Edit", buttonClassName = "btn btn-ghost btn-small" }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});

  const openOverlay = () => {
    setDraft(initial);
    setErrors({});
    setOpen(true);
  };

  const save = () => {
    const cleaned = { ...draft };
    fields.forEach((f) => {
      if (f.type === "number") {
        const n = Number(cleaned[f.key]);
        cleaned[f.key] = Number.isNaN(n) ? initial[f.key] : Math.min(f.max ?? 999, Math.max(f.min ?? -999, n));
      }
    });
    onSave(cleaned);
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  return (
    <>
      <button className={buttonClassName} onClick={openOverlay}>
        {trigger}
      </button>

      {open && (
        <div className="overlay-backdrop" onClick={cancel}>
          <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>{title}</h3>

            {fields.map((f) => {
              const fieldBody = (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      rows={f.rows || 4}
                    />
                  ) : (
                    <>
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        value={draft[f.key]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft((d) => ({ ...d, [f.key]: v }));
                          const n = Number(v);
                          setErrors((errs) => {
                            const copy = { ...errs };
                            if (v === "") copy[f.key] = "Value required";
                            else if (!Number.isFinite(n)) copy[f.key] = "Must be a number";
                            else if (f.min !== undefined && n < f.min) copy[f.key] = `Minimum is ${f.min}`;
                            else if (f.max !== undefined && n > f.max) copy[f.key] = `Maximum is ${f.max}`;
                            else delete copy[f.key];
                            return copy;
                          });
                        }}
                      />
                      {errors[f.key] && <div style={{ color: "#f77f00", fontSize: 13, marginTop: 6 }}>{errors[f.key]}</div>}
                    </>
                  )}
                </div>
              );

              if (!f.hint) return fieldBody;

              // Pattern 2 (Input Overlay): a lightweight, non-blocking hint
              // panel next to the field — never covering it, never modal.
              return (
                <div key={f.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, marginBottom: 16 }}>{fieldBody}</div>
                  <div className="field-hint-panel" role="note">
                    {f.hint}
                  </div>
                </div>
              );
            })}

            <div className="overlay-actions">
              <button className="btn btn-outline-navy" onClick={cancel}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={Object.keys(errors).length > 0}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
