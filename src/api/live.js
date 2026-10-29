// The only backend the app talks to: the live API (real Open-Meteo data, stored in MongoDB).
// The browser never calls Open-Meteo itself - it reads what the API has stored.
const BASE = import.meta.env.VITE_LIVE_API_URL || "http://localhost:4300";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, signal: options.signal || AbortSignal.timeout(20000) });
  } catch {
    throw new Error("The live data service is not reachable. Start it with: npm run dev:all");
  }
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || payload?.errors?.join(" ") || `Request failed (${response.status})`);
  return payload;
}

const post = (path, body) => request(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const liveApi = {
  overview: () => request("/api/overview"),
  regionHistory: (id, days = 30) => request(`/api/regions/${encodeURIComponent(id)}/history?days=${days}`),
  stationHistory: (id, hours = 48) => request(`/api/stations/${encodeURIComponent(id)}/history?hours=${hours}`),
  // q is optional free text; MongoDB does the matching on the server
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
export const fmtTemp = (v) => (typeof v === "number" ? `${v.toFixed(1)}°C` : "—");
export const fmtDep = (v) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}°C` : "—");

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return "never";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export const tierKey = (tier) => String(tier || "safe").toLowerCase();
