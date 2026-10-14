import React from "react";
import styles from "./Badge.module.css";

/**
 * Reusable severity-tier badge (SAFE / WATCH / WARNING / EMERGENCY).
 * Styled entirely through Badge.module.css (a CSS Module), not the shared
 * global.css sheet — `styles.badge` / `styles[tier]` resolve to unique,
 * auto-generated class names, so this component's CSS is scoped to just
 * this file. Used across every Dashboard tab (Live Map, Alerts, Forecast,
 * Reports) — one component, four call sites, per-tier styling via a single
 * `tier` prop.
 */
export default function Badge({ tier, label }) {
  const tierClass = styles[tier] || "";
  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {(label || tier) ? String(label || tier).toUpperCase() : ""}
    </span>
  );
}
