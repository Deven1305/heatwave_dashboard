// This is the ONLY file in the website that talks to the backend (live-api). Every page and hook goes through
// liveApi below, so if the backend address or an error message ever needs to change, it changes here once.
// The browser never calls Open-Meteo or MongoDB itself: it asks the backend, which has already stored the data.
const BASE = import.meta.env.VITE_LIVE_API_URL || "http://localhost:4300";

// Sends one request and returns the JSON. Anything that goes wrong becomes a normal Error with a message a
// person can read, because the pages just show error.message to the user.
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, signal: options.signal || AbortSignal.timeout(20000) });
  } catch {
    // fetch only throws when it could not reach the server at all (not running, no network, 20 s timeout)
    throw new Error("The live data service is not reachable. Start it with: npm run dev:all");
  }
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;
  // the backend explains its refusals as { error } or { errors: [...] }: show that text, or a plain fallback
  if (!response.ok) throw new Error(payload?.error || payload?.errors?.join(" ") || `Request failed (${response.status})`);
  return payload;
}

// POST with a JSON body (or no body, like "refresh" and "clear")
const post = (path, body) => request(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// One function per backend route. The names say what you get back; the routes are described in README.md.
export const liveApi = {
  overview: () => request("/api/overview"),
  regionHistory: (id, days = 30) => request(`/api/regions/${encodeURIComponent(id)}/history?days=${days}`),
  stationHistory: (id, hours = 48) => request(`/api/stations/${encodeURIComponent(id)}/history?hours=${hours}`),
  // q is the text from the search box; the matching happens in MongoDB on the server, not here
  alerts: (status = "", limit = 100, q = "") => request(`/api/alerts?limit=${limit}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((p) => p.alerts),
  createAlert: (alert) => post("/api/alerts", alert),
  clearAlert: (id) => post(`/api/alerts/${encodeURIComponent(id)}/clear`),
  reports: (q = "") => request(`/api/reports${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((p) => p.reports),
  createReport: (record) => post("/api/reports", record),
  photoUrl: (id) => `${BASE}/api/reports/${encodeURIComponent(id)}/photo`,
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),
  runs: (limit = 12) => request(`/api/runs?limit=${limit}`).then((p) => p.runs),
  refresh: () => post("/api/refresh"),
};

// ---- formatting helpers ---------------------------------------------------------------------
// Small display helpers shared by many pages. A missing value shows as a dash instead of "NaN" or "null".
export const fmtTemp = (v) => (typeof v === "number" ? `${v.toFixed(1)}°C` : "—");
export const fmtDep = (v) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}°C` : "—");

// "14 Oct 2026, 6:12 pm", always in Indian time whatever the timezone of the computer is
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(date);
}

// "2026-10-14" -> "Wed, 14 Oct". The date is read as UTC and printed as UTC, otherwise some timezones would show the day before.
export function formatDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

// "12 min ago", "3 h 5 min ago", "4 days ago"
export function timeAgo(value, now = Date.now()) {
  if (!value) return "never";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// "Warning" -> "warning": the lower-case key the Badge and the CSS use
export const tierKey = (tier) => String(tier || "safe").toLowerCase();
