// Thin client for the free public Open-Meteo API (https://open-meteo.com, no API key needed).
// Data licence: CC BY 4.0 - the dashboard shows the attribution.
import { parseIst } from './severity.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let rateLimitWaitMs = 62000;
export const setRateLimitWait = (ms) => { rateLimitWaitMs = ms; }; // tests only

async function getJson(url, { retries = 3, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'climateintel-live/1.0' } });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => '');
      lastError = new Error(`Open-Meteo HTTP ${res.status} ${body.slice(0, 160)}`);
      if (res.status === 429) {
        if (!/minutely/i.test(body)) { // hourly or daily quota: waiting a minute will not help, so stop and let the caller retry later
          lastError.rateLimited = /daily/i.test(body) ? 'daily' : 'hourly';
          break;
        }
        if (attempt < retries) { await sleep(rateLimitWaitMs); continue; } // per-minute limit: wait it out
      }
      if (res.status < 500 && res.status !== 429) break; // our request is wrong: retrying will not help
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(1000 * attempt * attempt);
  }
  throw lastError;
}

const coords = (stations) => `latitude=${stations.map((s) => s.lat).join(',')}&longitude=${stations.map((s) => s.lon).join(',')}`;
const asList = (json, expected) => {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== expected) throw new Error(`Open-Meteo returned ${list.length} locations, expected ${expected}`);
  return list;
};

// One request for every station: current weather + daily maxima for past days and the next days.
export async function fetchForecastBatch(stations, { pastDays, forecastDays }) {
  const url = `${FORECAST_URL}?${coords(stations)}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max'
    + `&past_days=${pastDays}&forecast_days=${forecastDays}&timezone=Asia%2FKolkata`;
  const list = asList(await getJson(url), stations.length);
  return list.map((item, i) => {
    const c = item.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new Error(`No current temperature for ${stations[i].name}`);
    const d = item.daily;
    const daily = (d?.time || []).map((date, k) => ({
      date,
      tMaxC: d.temperature_2m_max[k],
      tMinC: d.temperature_2m_min[k],
      apparentMaxC: d.apparent_temperature_max[k],
    })).filter((row) => typeof row.tMaxC === 'number');
    return {
      station: stations[i],
      current: {
        observedAt: parseIst(c.time),
        tempC: c.temperature_2m,
        apparentC: c.apparent_temperature,
        humidityPct: c.relative_humidity_2m,
        windKmh: c.wind_speed_10m,
      },
      daily,
    };
  });
}

// Ten years of daily maximum temperature (ERA5 reanalysis) for a small batch of stations.
export async function fetchDailyMaxHistory(stations, startYear, endYear) {
  const url = `${ARCHIVE_URL}?${coords(stations)}&start_date=${startYear}-01-01&end_date=${endYear}-12-31`
    + '&daily=temperature_2m_max&timezone=Asia%2FKolkata';
  const list = asList(await getJson(url, { timeoutMs: 60000 }), stations.length);
  return list.map((item) => ({ dates: item.daily.time, values: item.daily.temperature_2m_max }));
}
