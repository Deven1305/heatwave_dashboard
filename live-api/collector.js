// The collector is the part that keeps the database fed. Every 30 minutes (and once when the
// server starts, if the data is stale) it does three things in a row:
//   1. asks Open-Meteo for the weather and saves it,
//   2. makes sure every city has its "normal" temperature,
//   3. looks at the result and raises or clears alerts.
// server.js only calls runCycle() and startScheduler(); everything else in here is private.
import { randomBytes } from 'node:crypto';
import { HISTORY_DAYS, FORECAST_DAYS, NORMAL_YEARS, REFRESH_MINUTES } from './config.js';
import { fetchForecastBatch, fetchDailyMaxHistory } from './openmeteo.js';
import { buildNormals, istDate } from './severity.js';
import { loadState } from './queries.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(`[collector ${new Date().toISOString()}]`, ...args);

// Step 1: fetch the weather for all cities and store it.
// trigger just says why we are running ('startup', 'scheduled' or 'manual'); it ends up in fetch_log.
async function refreshAll(db, trigger = 'scheduled') {
  const started = Date.now();
  // we don't need the 365 normal values here, so leave them out of the query
  const stations = await db.collection('stations').find({}, { projection: { normalMax: 0 } }).toArray();
  const entry = { at: new Date(), trigger, ok: false, stations: stations.length };
  try {
    // one single request for every city (Open-Meteo accepts a list of coordinates)
    const results = await fetchForecastBatch(
      stations.map((s) => ({ id: s._id, name: s.name, regionId: s.regionId, lat: s.lat, lon: s.lon })),
      { pastDays: HISTORY_DAYS, forecastDays: FORECAST_DAYS },
    );
    const today = istDate();
    const fetchedAt = new Date();

    // Readings: $setOnInsert + upsert means "add it if we don't have it yet, otherwise leave it alone".
    // Open-Meteo only changes its current value every 15 minutes, so a refresh right after another one
    // often brings nothing new, and that is fine. The unique index on (stationId, observedAt) backs this up.
    const observationOps = results.map(({ station, current }) => ({
      updateOne: {
        filter: { stationId: station.id, observedAt: current.observedAt },
        update: { $setOnInsert: { stationId: station.id, regionId: station.regionId, observedAt: current.observedAt,
          tempC: current.tempC, apparentC: current.apparentC, humidityPct: current.humidityPct, windKmh: current.windKmh,
          fetchedAt, source: 'open-meteo' } },
        upsert: true,
      },
    }));
    // Daily rows are different: they do get overwritten ($set). A forecast for tomorrow gets replaced by
    // the real value once the day has happened, and today's maximum keeps moving until the evening.
    const dailyOps = results.flatMap(({ station, daily }) => daily.map((row) => ({
      updateOne: {
        filter: { stationId: station.id, date: row.date },
        update: { $set: { regionId: station.regionId, tMaxC: row.tMaxC, tMinC: row.tMinC, apparentMaxC: row.apparentMaxC,
          isForecast: row.date > today, updatedAt: fetchedAt, source: 'open-meteo' } },
        upsert: true,
      },
    })));
    // keep a copy of the newest reading on the city itself so the dashboard doesn't have to search for it
    const latestOps = results.map(({ station, current }) => ({
      updateOne: { filter: { _id: station.id }, update: { $set: { latest: { ...current, fetchedAt } } } },
    }));

    // ordered:false = if one write fails the others still go through
    const obs = await db.collection('observations').bulkWrite(observationOps, { ordered: false });
    const daily = await db.collection('daily').bulkWrite(dailyOps, { ordered: false });
    await db.collection('stations').bulkWrite(latestOps);

    Object.assign(entry, {
      ok: true, observationsInserted: obs.upsertedCount, dailyInserted: daily.upsertedCount,
      dailyUpdated: daily.modifiedCount, stationsReporting: results.length,
    });
    log(`stored ${obs.upsertedCount} new readings, ${daily.upsertedCount} new + ${daily.modifiedCount} updated daily rows (${trigger})`);
  } catch (error) {
    entry.error = error.message;
    log('refresh failed:', error.message);
    throw error;
  } finally {
    // success or failure, write one line in the diary. If even that fails we don't want to hide the real error.
    entry.durationMs = Date.now() - started;
    await db.collection('fetch_log').insertOne(entry).catch(() => {});
  }
  return entry;
}

// Step 2: the "normal" temperature of each city. It is the average daily maximum for every calendar day
// over the last few years, and we only ever work it out once per city (after that it sits in MongoDB).
async function ensureNormals(db) {
  const missing = await db.collection('stations').find({ normalMax: { $exists: false } }, { projection: { name: 1, lat: 1, lon: 1 } }).toArray();
  if (!missing.length) return 0;
  log(`computing normals for ${missing.length} stations from ${NORMAL_YEARS[0]}-${NORMAL_YEARS[1]} daily maxima...`);
  let done = 0;
  // three cities per request on purpose: the archive data is big and Open-Meteo counts it by size,
  // so bigger batches run into the per-minute limit straight away
  for (let i = 0; i < missing.length; i += 3) {
    const chunk = missing.slice(i, i + 3);
    try {
      const series = await fetchDailyMaxHistory(chunk, NORMAL_YEARS[0], NORMAL_YEARS[1]);
      await db.collection('stations').bulkWrite(chunk.map((s, k) => ({
        updateOne: { filter: { _id: s._id }, update: { $set: {
          normalMax: buildNormals(series[k].dates, series[k].values),
          normalsMeta: { years: `${NORMAL_YEARS[0]}-${NORMAL_YEARS[1]}`, source: 'ERA5 reanalysis via Open-Meteo archive', computedAt: new Date() },
        } } },
      })));
      done += chunk.length;
    } catch (error) {
      if (error.rateLimited) {
        // hourly or daily quota used up: there is no point trying the next batch, the next cycle will continue
        log(`Open-Meteo ${error.rateLimited} limit reached: ${done}/${missing.length} normals stored, the rest follow on the next cycle`);
        return done;
      }
      // any other problem: skip this batch, the cities without normals are picked up again next time
      log('normals batch failed (will retry next cycle):', error.message);
    }
    await sleep(800); // be polite to the free API
  }
  log(`normals ready for ${done}/${missing.length} stations`);
  return done;
}

// Step 3: alerts. Each region has at most one "active" automatic alert. We only write a new alert when the
// region's level has changed since the last one, so a region that stays in Heatwave for a week gives one alert, not 336.
async function evaluateAlerts(db) {
  const { regions, stations } = await loadState(db);
  // Without normals every city looks "a bit hot" and we would raise alerts we can't justify. Wait instead.
  if (stations.some((s) => s.normalC === null)) return { skipped: 'normals not ready' };
  const alerts = db.collection('alerts');
  let raised = 0;
  let cleared = 0;
  for (const r of regions) {
    const last = await alerts.find({ regionId: r.id, source: 'auto' }).sort({ issuedAt: -1 }).limit(1).next();
    const activeLevel = last && last.status === 'active' ? last.level : 0;
    if (r.level === activeLevel) continue; // nothing changed for this region
    const now = new Date();
    // close the old alert: 'cleared' if things went back to normal, 'superseded' if a different level replaces it
    if (last && last.status === 'active') {
      await alerts.updateOne({ _id: last._id }, { $set: { status: r.level === 0 ? 'cleared' : 'superseded', clearedAt: now } });
      if (r.level === 0) cleared += 1;
    }
    // and open a new one if there is something to warn about
    if (r.level > 0) {
      const dep = r.departureC === null ? '' : ` (${r.departureC >= 0 ? '+' : ''}${r.departureC} °C from the normal ${r.normalC} °C)`;
      await alerts.insertOne({
        _id: `HW-${istDate(now).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`,
        regionId: r.id, region: r.name, tier: r.tier, level: r.level, severity: r.severity,
        message: `${r.severity} conditions: ${r.peakStation} expects a maximum of ${r.todayMaxC} °C today${dep}. Indicative, based on Open-Meteo data.`,
        channel: 'Dashboard', issuedAt: now, status: 'active', source: 'auto',
        // the numbers behind the message, so an alert can always be explained later
        basis: { station: r.peakStation, todayMaxC: r.todayMaxC, normalC: r.normalC, departureC: r.departureC },
      });
      raised += 1;
    }
  }
  if (raised || cleared) log(`alerts: ${raised} raised, ${cleared} cleared`);
  return { raised, cleared };
}

// Runs the three steps in order. `running` holds the cycle that is in progress, so if the timer and
// the "Fetch latest data" button fire at the same moment the second caller just gets the same run back
// instead of starting a second one on top of it.
let running = null;
export function runCycle(db, trigger = 'scheduled') {
  if (running) return running;
  running = (async () => {
    try {
      const summary = await refreshAll(db, trigger);
      await ensureNormals(db);
      summary.alerts = await evaluateAlerts(db);
      return summary;
    } finally {
      running = null; // always let go, even if the cycle failed
    }
  })();
  return running;
}

// Called once from server.js. Collects right away if the last good run is old (a restart after a long
// pause, or the very first start), otherwise it keeps what is stored and waits for the timer.
export async function startScheduler(db) {
  const last = await db.collection('fetch_log').find({ ok: true }).sort({ at: -1 }).limit(1).next();
  const ageMin = last ? (Date.now() - last.at.getTime()) / 60000 : Infinity;
  const run = (trigger) => runCycle(db, trigger).catch(() => {}); // failures are already logged and written to fetch_log
  if (ageMin >= REFRESH_MINUTES - 1) run('startup'); // the -1 is just slack so a restart at minute 29 doesn't wait another 30
  else {
    log(`last successful refresh was ${Math.round(ageMin)} min ago - serving stored data, next refresh in ${Math.round(REFRESH_MINUTES - ageMin)} min`);
    // data is fresh, but the normals may still be unfinished from an earlier run (rate limit), so try those
    ensureNormals(db).then(() => evaluateAlerts(db)).catch((e) => log('normals check failed:', e.message));
  }
  return setInterval(() => run('scheduled'), REFRESH_MINUTES * 60000);
}
