const NODE_API = import.meta.env.VITE_NODE_API_URL || "http://localhost:8100";
const EXPRESS_API = import.meta.env.VITE_EXPRESS_API_URL || "http://localhost:4100";

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: options?.signal || AbortSignal.timeout(15000) });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || payload?.errors?.join(" ") || `Request failed (${response.status})`);
  return payload;
}

export const nodeApi = {
  dashboard: () => request(`${NODE_API}/dashboard`),
  sensors: () => request(`${NODE_API}/sensors`),
  plots: () => request(`${NODE_API}/plots`),
  farmers: () => request(`${NODE_API}/farmers`),
  alerts: () => request(`${NODE_API}/alerts`),
  irrigation: (plotId) => request(`${NODE_API}/irrigation?plotId=${encodeURIComponent(plotId)}`),
  waterStress: (plotId) => request(`${NODE_API}/water-stress?plotId=${encodeURIComponent(plotId)}`),
  prediction: (plotId) => request(`${NODE_API}/prediction?plotId=${encodeURIComponent(plotId)}`),
  reports: () => request(`${NODE_API}/reports`),
  createReport: (record) => request(`${NODE_API}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }),
};

export const expressApi = {
  regions: () => request(`${EXPRESS_API}/api/regions`),
  alerts: () => request(`${EXPRESS_API}/api/alerts`).then((payload) => payload.alerts || []),
  createAlert: (alert) => request(`${EXPRESS_API}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  }),
};

export function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}
