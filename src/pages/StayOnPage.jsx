import React, { useState, useEffect, useRef } from "react";
import { InlineEditNumber, EditOverlayButton } from "../components/InPageEdit.jsx";

const DEFAULT_WIDGETS = [
  { id: "w-temp", title: "Temperature", collapsed: true },
  { id: "w-hum", title: "Humidity", collapsed: true },
  { id: "w-alert", title: "Heatwave Alerts", collapsed: true },
  { id: "w-wind", title: "Wind Speed", collapsed: true },
];

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

export default function StayOnPage() {
  const [widgets, setWidgets] = useState(() => load("kjs_widgets_order", DEFAULT_WIDGETS));
  const [globalThreshold, setGlobalThreshold] = useState(() => load("kjs_global_threshold", 45));
  const dragItem = useRef();
  const dragNode = useRef();

  useEffect(() => persist("kjs_widgets_order", widgets), [widgets]);
  useEffect(() => persist("kjs_global_threshold", globalThreshold), [globalThreshold]);
  const [expandedId, setExpandedId] = useState(null);

  const handleDragStart = (e, params) => {
    dragItem.current = params.index;
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "drag");
    dragNode.current.addEventListener("dragend", handleDragEnd);
  };

  const handleDragEnter = (e, params) => {
    const currentItemIndex = dragItem.current;
    const targetIndex = params.index;
    if (dragNode.current === e.currentTarget) return;
    setWidgets((old) => {
      const newList = JSON.parse(JSON.stringify(old));
      const item = newList.splice(currentItemIndex, 1)[0];
      newList.splice(targetIndex, 0, item);
      dragItem.current = targetIndex;
      return newList;
    });
  };

  const handleDragEnd = () => {
    dragNode.current.removeEventListener("dragend", handleDragEnd);
    dragItem.current = null;
    dragNode.current = null;
  };

  const toggleCollapse = (id) => {
    setExpandedId((cur) => (cur === id ? null : id));
    // also keep per-widget collapsed flag for persistence
    setWidgets((rows) => rows.map((r) => (r.id === id ? { ...r, collapsed: !r.collapsed } : r)));
  };

  return (
    <section className="container" style={{ padding: 20 }}>
      <div className="dash-header">
        <div>
          <span className="eyebrow mono" style={{ color: "var(--amber)", fontSize: 12, letterSpacing: "0.08em" }}>KJS-CES-01 · EXPERIMENT 5</span>
          <h1 style={{ fontSize: 26, margin: "6px 0 0" }}>Drag-and-Drop / Stay-on-Page</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <InlineEditNumber label="Auto-Escalation Threshold" value={globalThreshold} unit="°C" min={30} max={55} onSave={setGlobalThreshold} />
          <EditOverlayButton
            title="Configure Alert Thresholds"
            fields={[{ key: "threshold", label: "Threshold (°C)", type: "number", min: 30, max: 55 }, { key: "note", label: "Note", type: "textarea", rows: 3 }]}
            initial={{ threshold: globalThreshold, note: "Recommended range 40–50°C for regions in Watch+." }}
            onSave={(vals) => setGlobalThreshold(Number(vals.threshold))}
            trigger={<span className="btn btn-ghost">Configure Alert Thresholds</span>}
          />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="stay-top" style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="widgets-row">
              {widgets.slice(0, 3).map((w, i) => (
                <div key={w.id} className={`widget-card ${expandedId === w.id ? "expanded" : "collapsed"}`} draggable onDragStart={(e) => handleDragStart(e, { index: i })} onDragEnter={(e) => handleDragEnter(e, { index: i })}>
                  <div className="widget-top-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => toggleCollapse(w.id)}>
                      <div className="widget-title">{w.title}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="icon-btn" title={expandedId === w.id ? "Collapse" : "Expand"} onClick={() => toggleCollapse(w.id)}>
                        {expandedId === w.id ? "▾" : "▸"}
                      </button>
                      <div className="widget-flag" />
                    </div>
                  </div>
                  <div className="widget-metric mono">{w.title === "Temperature" ? "Peak 45.1°C" : w.title === "Humidity" ? "38% avg" : "12 active · Emergency: 2"}</div>
                </div>
              ))}
            </div>

            <div className="recent-dispatches" style={{ marginTop: 18 }}>
              <h4>Recent Alert Dispatches</h4>
              <ul>
                <li>HW-402911 · North-West India</li>
                <li>HW-402905 · Central India</li>
              </ul>
            </div>
          </div>

          <aside style={{ width: 300 }}>
            <div className="threshold-panel">
              <div className="panel-head">Threshold (°C)</div>
              <div className="panel-body">
                <div className="threshold-value mono">{globalThreshold}</div>
                <div className="threshold-note">Recommended range 40–50°C for regions currently in Watch+.</div>
                <div className="pattern-note">Pattern 2 — Input Overlay (field-level)</div>
              </div>
            </div>
          </aside>
        </div>

        <div style={{ marginTop: 18 }}>
          {expandedId && (
            <div className="inlay-expanded">
              <div className="inlay-head">{expandedId} · {widgets.find((x) => x.id === expandedId)?.title} △ (expanded, inline)</div>
              <div className="inlay-body">
                <ul>
                  <li>Mini trend line (last 24h): 38°C → 41°C → 46°C</li>
                  <li>Last 3 dispatched alerts: WATCH, WATCH, WARNING</li>
                  <li><a href="#">View full history →</a></li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
