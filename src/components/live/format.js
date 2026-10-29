// Small helpers shared by the dashboard pieces: colours for the heat levels, and a few formatters.
// one colour per heat level, in level order: normal, hot day, heatwave, severe heatwave
const LEVEL_COLORS = ["#71b4cb", "#eac76b", "#f6ad55", "#f98282"]; // normal, hot day, heatwave, severe
export const levelColor = (level) => LEVEL_COLORS[level] || LEVEL_COLORS[0];

// "2026-10-14" -> a number the charts can place on their time axis. It is midnight UTC on purpose: the charts print
// dates in UTC too, so the day can't slip to the neighbour in other timezones.
export const dayMs = (date) => Date.parse(date);

// "14 Oct, 12:15" in Indian time, for the axis of the stored-readings chart
export const fmtClock = (t) => new Date(t).toLocaleString("en-IN", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
});

// The sentence shown when a search finds nothing. `what` is the plural of the thing searched ("cities", "alerts"...),
// `hint` is an optional tip on what to try instead.
export const noMatch = (q, what, hint = "") => `No ${what} match “${q.trim()}”.${hint ? ` ${hint}` : ""}`;
