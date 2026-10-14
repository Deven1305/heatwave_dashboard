// Heat classification, modelled on the India Meteorological Department (IMD) heat-wave criteria.
// Pure functions only (no I/O) so they can be unit-tested: npm test
//
//   Heat wave        : max temp >= station threshold AND departure from normal >= 4.5 C
//   Severe heat wave : same, with departure >= 6.5 C
//   Plains stations also count by absolute value: >= 45 C heat wave, >= 47 C severe.
//   "Hot day" (our extra level): at or above the threshold with departure >= 3 C.
// Thresholds: plains 40 C, coastal 37 C, hills 30 C.
// This is an indicative classification for a prototype, NOT an official IMD warning.

export const THRESHOLD = { plains: 40, coastal: 37, hills: 30 };
export const LABELS = ['Normal', 'Hot Day', 'Heatwave', 'Severe Heatwave'];
export const TIER_OF = ['Safe', 'Watch', 'Warning', 'Emergency'];

const round1 = (n) => Math.round(n * 10) / 10;

export function classify(tMax, normal, terrain = 'plains') {
  if (typeof tMax !== 'number' || Number.isNaN(tMax)) {
    return { level: 0, severity: LABELS[0], tier: TIER_OF[0], departureC: null };
  }
  const threshold = THRESHOLD[terrain] ?? THRESHOLD.plains;
  const departureC = typeof normal === 'number' ? round1(tMax - normal) : null;
  let level = 0;
  if (tMax >= threshold) {
    if (departureC === null) level = 1; // no normal available: cannot say more than "hot"
    else if (departureC >= 6.5) level = 3;
    else if (departureC >= 4.5) level = 2;
    else if (departureC >= 3) level = 1;
  }
  if (terrain === 'plains') {
    if (tMax >= 47) level = 3;
    else if (tMax >= 45) level = Math.max(level, 2);
  }
  return { level, severity: LABELS[level], tier: TIER_OF[level], departureC };
}

// ---- dates (India Standard Time) ------------------------------------------------------------
const IST_MS = 5.5 * 60 * 60 * 1000;
export const istDate = (now = new Date()) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
export const parseIst = (localIso) => new Date(`${localIso}${localIso.length === 16 ? ':00' : ''}+05:30`);

// ---- normals --------------------------------------------------------------------------------
// A station's "normal" is the average daily maximum for that calendar day over the reference years,
// smoothed over +-7 days. Stored as 365 numbers; 29 Feb uses 28 Feb.
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export function dayIndex(dateStr) {
  const month = Number(dateStr.slice(5, 7)) - 1;
  let day = Number(dateStr.slice(8, 10));
  if (month === 1 && day === 29) day = 28;
  return MONTH_START[month] + day - 1; // 0..364
}

export function buildNormals(dates, values, halfWindow = 7) {
  const sum = new Array(365).fill(0);
  const count = new Array(365).fill(0);
  dates.forEach((d, i) => {
    const v = values[i];
    if (typeof v !== 'number') return;
    const k = dayIndex(d);
    sum[k] += v;
    count[k] += 1;
  });
  const normals = new Array(365).fill(null);
  for (let k = 0; k < 365; k++) {
    let s = 0;
    let c = 0;
    for (let o = -halfWindow; o <= halfWindow; o++) {
      const j = (k + o + 365) % 365;
      s += sum[j];
      c += count[j];
    }
    normals[k] = c ? round1(s / c) : null;
  }
  return normals;
}

export const normalFor = (station, dateStr) => station.normalMax?.[dayIndex(dateStr)] ?? null;
