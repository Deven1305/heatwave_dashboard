import React from "react";
import styles from "./Badge.module.css";

// The little coloured pill that shows a heat level (SAFE, WATCH, WARNING, EMERGENCY).
// `tier` picks the colour ('safe', 'watch', 'warning' or 'emergency', lower case). `label` is the word printed
// on it; if you leave it out the tier name is printed. So the same colour can read "HEATWAVE" or "WARNING".
//
// The styles are in Badge.module.css, a CSS module: the class names are renamed at build time, so they can't
// clash with anything in global.css.
export default function Badge({ tier, label }) {
  const tierClass = styles[tier] || "";
  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {(label || tier) ? String(label || tier).toUpperCase() : ""}
    </span>
  );
}
