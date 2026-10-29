import React from "react";

// The tiny trend line on a region card: just the shape of the last two weeks, with a dot on the latest day.
// `values` is a list of numbers (gaps as null). With fewer than two numbers there is no line to draw, so it says so.
export default function Sparkline({ values, color = "#71b4cb", width = 130, height = 38, label = "trend" }) {
  const nums = values.filter((v) => typeof v === "number");
  if (nums.length < 2) return <div className="lv-spark-empty" aria-hidden="true">no history yet</div>;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  // each value becomes an x,y point; the 3px / 4px margins keep the line and the dot from touching the edge
  const step = (width - 6) / (values.length - 1);
  const pts = values.map((v, i) => (typeof v === "number" ? [3 + i * step, height - 4 - ((v - lo) / span) * (height - 8)] : null)).filter(Boolean);
  const last = pts[pts.length - 1];
  return (
    <svg className="lv-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}
