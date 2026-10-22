// Shared colours and small helpers for the live dashboard.
export const LEVEL_COLORS = ["#71b4cb", "#eac76b", "#f6ad55", "#f98282"]; // normal, hot day, heatwave, severe
export const levelColor = (level) => LEVEL_COLORS[level] || LEVEL_COLORS[0];

// "2026-10-14" -> epoch ms (UTC midnight; the chart formats it in UTC so the day never shifts)
export const dayMs = (date) => Date.parse(date);

export const fmtClock = (t) => new Date(t).toLocaleString("en-IN", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
});

// Message shown when a search finds nothing; `what` is the plural noun being searched ("cities", "alerts"...).
export const noMatch = (q, what, hint = "") => `No ${what} match “${q.trim()}”.${hint ? ` ${hint}` : ""}`;
