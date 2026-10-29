import React from "react";
import styles from "./Badge.module.css";

/**
 * Reusable severity-tier badge (SAFE / WATCH / WARNING / EMERGENCY).
 * Styled entirely through Badge.module.css (a CSS Module), not the shared
 * global.css sheet — `styles.badge` / `styles[tier]` resolve to unique,
 * auto-generated class names, so this component's CSS is scoped to just
 * this file. Used across the dashboard, home page and mobile page: one component,
 * per-tier styling via the `tier` prop, and an optional `label` for the words shown.
 */
export default function Badge({ tier, label }) {
  const tierClass = styles[tier] || "";
  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {(label || tier) ? String(label || tier).toUpperCase() : ""}
    </span>
  );
}
