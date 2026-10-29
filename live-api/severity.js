// The heat rules. Given a city's maximum temperature, its normal for the date and its terrain, decide
// how serious the heat is. It is loosely based on how the India Meteorological Department (IMD) defines
// a heat wave, but it is our own simplified version and NOT an official warning.
//
// Nothing in this file touches the database or the network. That is on purpose: pure functions are easy
// to test (see severity.test.js) and easy to reason about.
//
// The rules in short:
//   - a city only counts if it reaches the limit for its terrain: plains 40, coastal 37, hills 30 degrees C
//   - then it is the departure (how far above its normal) that decides:
//       3 or more = Hot Day, 4.5 or more = Heatwave, 6.5 or more = Severe Heatwave
//   - plains cities also count by the raw number: 45 and up is a Heatwave, 47 and up is Severe

export const THRESHOLD = { plains: 40, coastal: 37, hills: 30 };
export const LABELS = ['Normal', 'Hot Day', 'Heatwave', 'Severe Heatwave']; // index = level
export const TIER_OF = ['Safe', 'Watch', 'Warning', 'Emergency'];           // same index, the name used for alerts

const round1 = (n) => Math.round(n * 10) / 10;

// Returns { level (0-3), severity (word), tier (alert name), departureC }.
// normal can be null (we may not have worked it out yet), and then we can't say more than "Hot Day".
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
  // the absolute rule only applies on the plains, where 45+ is dangerous whatever the season
  if (terrain === 'plains') {
    if (tMax >= 47) level = 3;
    else if (tMax >= 45) level = Math.max(level, 2);
  }
  return { level, severity: LABELS[level], tier: TIER_OF[level], departureC };
}

// ---- dates (India Standard Time) ------------------------------------------------------------
// The server could be running in any timezone, but "today" for this project always means today in India.
// So we shift the clock by +5:30 ourselves and read the date part of the result.
const IST_MS = 5.5 * 60 * 60 * 1000;
export const istDate = (now = new Date()) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
// Open-Meteo sends times like "2026-10-14T12:15" with no timezone (we asked for Asia/Kolkata);
// this turns that into a proper Date. The length check adds ":00" when the seconds are missing.
export const parseIst = (localIso) => new Date(`${localIso}${localIso.length === 16 ? ':00' : ''}+05:30`);

// ---- normals --------------------------------------------------------------------------------
// A city's "normal" for a date is the average daily maximum on that calendar day over the last few years,
// smoothed over a week either side (single days are noisy). We keep it as 365 numbers, one per day of the
// year, and look one up by position. 29 February has no slot of its own, it shares 28 February.
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; // day-of-year the month starts on (non-leap year)
export function dayIndex(dateStr) {
  const month = Number(dateStr.slice(5, 7)) - 1;
  let day = Number(dateStr.slice(8, 10));
  if (month === 1 && day === 29) day = 28;
  return MONTH_START[month] + day - 1; // 0..364
}

// dates / values are parallel lists of daily maximums from several years. Returns the 365 normals.
export function buildNormals(dates, values, halfWindow = 7) {
  // first pass: total and count for each calendar day across all the years
  const sum = new Array(365).fill(0);
  const count = new Array(365).fill(0);
  dates.forEach((d, i) => {
    const v = values[i];
    if (typeof v !== 'number') return; // a missing day is skipped, not counted as zero
    const k = dayIndex(d);
    sum[k] += v;
    count[k] += 1;
  });
  // second pass: for each day, average it together with the days around it
  const normals = new Array(365).fill(null);
  for (let k = 0; k < 365; k++) {
    let s = 0;
    let c = 0;
    for (let o = -halfWindow; o <= halfWindow; o++) {
      const j = (k + o + 365) % 365; // the % wraps around, so 1 January looks at late December
      s += sum[j];
      c += count[j];
    }
    normals[k] = c ? round1(s / c) : null;
  }
  return normals;
}

// The normal of one city for one date ("2026-10-14"), or null if its normals aren't stored yet.
export const normalFor = (station, dateStr) => station.normalMax?.[dayIndex(dateStr)] ?? null;
