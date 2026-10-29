// Our connection to Open-Meteo (https://open-meteo.com), the free weather service the data comes from.
// No API key is needed. The data is CC BY 4.0, which is why the credit is shown on the dashboard.
// Everything that talks to the internet is in this file; the rest of the backend just calls these functions.
import { parseIst } from './severity.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let rateLimitWaitMs = 62000;
export const setRateLimitWait = (ms) => { rateLimitWaitMs = ms; }; // only the tests use this, so they don't wait a real minute

// Fetches a URL and returns the JSON, and deals with the ways it can go wrong:
//   - slow or no answer: give up after timeoutMs and try again (up to `retries` tries, waiting 1 s, then 4 s)
//   - our request is wrong (a 4xx): stop at once, asking again would give the same answer
//   - "429 too many requests": it matters WHICH limit we hit. The per-minute one clears in a minute, so wait
//     and retry. The hourly or daily one won't clear soon, so stop and let the caller decide (see ensureNormals).
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
      lastError = error; // network down, timeout, etc.: fall through to the wait below and try again
    }
    if (attempt < retries) await sleep(1000 * attempt * attempt);
  }
  throw lastError;
}

// Open-Meteo wants coordinates as two comma separated lists: latitude=1,2,3&longitude=a,b,c
const coords = (stations) => `latitude=${stations.map((s) => s.lat).join(',')}&longitude=${stations.map((s) => s.lon).join(',')}`;
// Gotcha: for ONE location Open-Meteo answers with a single object, for several with an array.
// This makes both look the same, and checks we got back as many answers as we asked for.
const asList = (json, expected) => {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== expected) throw new Error(`Open-Meteo returned ${list.length} locations, expected ${expected}`);
  return list;
};

// One request for all the cities: the current weather, plus the daily highs/lows for the past
// `pastDays` days and the next `forecastDays` days. The result is cleaned up into the shape we store.
export async function fetchForecastBatch(stations, { pastDays, forecastDays }) {
  const url = `${FORECAST_URL}?${coords(stations)}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max'
    + `&past_days=${pastDays}&forecast_days=${forecastDays}&timezone=Asia%2FKolkata`;
  const list = asList(await getJson(url), stations.length);
  return list.map((item, i) => {
    const c = item.current;
    // a city with no current temperature is a broken answer, better to fail loudly than store nonsense
    if (!c || typeof c.temperature_2m !== 'number') throw new Error(`No current temperature for ${stations[i].name}`);
    const d = item.daily;
    // Open-Meteo returns daily data as parallel lists (all the dates, all the maximums...); turn it into one row per day
    const daily = (d?.time || []).map((date, k) => ({
      date,
      tMaxC: d.temperature_2m_max[k],
      tMinC: d.temperature_2m_min[k],
      apparentMaxC: d.apparent_temperature_max[k],
    })).filter((row) => typeof row.tMaxC === 'number'); // drop days without a maximum
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

// The daily maximum temperature for every day from startYear to endYear (ERA5 reanalysis, from the archive API).
// We only use it once per city, to work out its normal. Keep the batch of cities small: the answer is large.
export async function fetchDailyMaxHistory(stations, startYear, endYear) {
  const url = `${ARCHIVE_URL}?${coords(stations)}&start_date=${startYear}-01-01&end_date=${endYear}-12-31`
    + '&daily=temperature_2m_max&timezone=Asia%2FKolkata';
  const list = asList(await getJson(url, { timeoutMs: 60000 }), stations.length); // bigger answer, so a longer timeout
  return list.map((item) => ({ dates: item.daily.time, values: item.daily.temperature_2m_max }));
}
