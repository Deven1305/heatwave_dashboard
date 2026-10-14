// Collects real weather from Open-Meteo and stores it in MongoDB.
// One cycle = fetch + store readings  ->  make sure "normals" exist  ->  raise/clear alerts.
import { randomBytes } from 'node:crypto';
import { HISTORY_DAYS, FORECAST_DAYS, NORMAL_YEARS, REFRESH_MINUTES } from './config.js';
import { fetchForecastBatch, fetchDailyMaxHistory } from './openmeteo.js';
import { buildNormals, istDate } from './severity.js';
import { loadState } from './queries.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(`[collector ${new Date().toISOString()}]`, ...args);

// 1) Fetch current weather + daily history/forecast for every station and store it.
export async function refreshAll(db, trigger = 'scheduled') {
  const started = Date.now();
  const stations = await db.collection('stations').find({}, { projection: { normalMax: 0 } }).toArray();
  const entry = { at: new Date(), trigger, ok: false, stations: stations.length };
  try {
    const results = await fetchForecastBatch(
      stations.map((s) => ({ id: s._id, name: s.name, regionId: s.regionId, lat: s.lat, lon: s.lon })),
      { pastDays: HISTORY_DAYS, forecastDays: FORECAST_DAYS },
    );
    const today = istDate();
    const fetchedAt = new Date();

    const observationOps = results.map(({ station, current }) => ({
      updateOne: {
        filter: { stationId: station.id, observedAt: current.observedAt },
        update: { $setOnInsert: { stationId: station.id, regionId: station.regionId, observedAt: current.observedAt,
          tempC: current.tempC, apparentC: current.apparentC, humidityPct: current.humidityPct, windKmh: current.windKmh,
          fetchedAt, source: 'open-meteo' } },
        upsert: true,
      },
    }));
    const dailyOps = results.flatMap(({ station, daily }) => daily.map((row) => ({
      updateOne: {
        filter: { stationId: station.id, date: row.date },
        update: { $set: { regionId: station.regionId, tMaxC: row.tMaxC, tMinC: row.tMinC, apparentMaxC: row.apparentMaxC,
          isForecast: row.date > today, updatedAt: fetchedAt, source: 'open-meteo' } },
        upsert: true,
      },
    })));
    const latestOps = results.map(({ station, current }) => ({
      updateOne: { filter: { _id: station.id }, update: { $set: { latest: { ...current, fetchedAt } } } },
    }));

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
    entry.durationMs = Date.now() - started;
    await db.collection('fetch_log').insertOne(entry).catch(() => {});
  }
  return entry;
}

// 2) Normals: average daily maximum per calendar day over NORMAL_YEARS (computed once, then stored).
export async function ensureNormals(db) {
  const missing = await db.collection('stations').find({ normalMax: { $exists: false } }, { projection: { name: 1, lat: 1, lon: 1 } }).toArray();
  if (!missing.length) return 0;
  log(`computing normals for ${missing.length} stations from ${NORMAL_YEARS[0]}-${NORMAL_YEARS[1]} daily maxima...`);
  let done = 0;
  for (let i = 0; i < missing.length; i += 5) {
    const chunk = missing.slice(i, i + 5);
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
      log('normals batch failed (will retry next cycle):', error.message);
    }
    await sleep(800);
  }
  log(`normals ready for ${done}/${missing.length} stations`);
  return done;
}

// 3) Alerts: one active automatic alert per region; a new one is written whenever the level changes.
export async function evaluateAlerts(db) {
  const { regions, stations } = await loadState(db);
  if (stations.some((s) => s.normalC === null)) return { skipped: 'normals not ready' };
  const alerts = db.collection('alerts');
  let raised = 0;
  let cleared = 0;
  for (const r of regions) {
    const last = await alerts.find({ regionId: r.id, source: 'auto' }).sort({ issuedAt: -1 }).limit(1).next();
    const activeLevel = last && last.status === 'active' ? last.level : 0;
    if (r.level === activeLevel) continue;
    const now = new Date();
    if (last && last.status === 'active') {
      await alerts.updateOne({ _id: last._id }, { $set: { status: r.level === 0 ? 'cleared' : 'superseded', clearedAt: now } });
      if (r.level === 0) cleared += 1;
    }
    if (r.level > 0) {
      const dep = r.departureC === null ? '' : ` (${r.departureC >= 0 ? '+' : ''}${r.departureC} C from the normal ${r.normalC} C)`;
      await alerts.insertOne({
        _id: `HW-${istDate(now).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`,
        regionId: r.id, region: r.name, tier: r.tier, level: r.level, severity: r.severity,
        message: `${r.severity} conditions: ${r.peakStation} expects a maximum of ${r.todayMaxC} C today${dep}. Indicative, based on Open-Meteo data.`,
        channel: 'Dashboard', issuedAt: now, status: 'active', source: 'auto',
        basis: { station: r.peakStation, todayMaxC: r.todayMaxC, normalC: r.normalC, departureC: r.departureC },
      });
      raised += 1;
    }
  }
  if (raised || cleared) log(`alerts: ${raised} raised, ${cleared} cleared`);
  return { raised, cleared };
}

// A full cycle; overlapping calls share one run.
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
      running = null;
    }
  })();
  return running;
}

export async function startScheduler(db) {
  const last = await db.collection('fetch_log').find({ ok: true }).sort({ at: -1 }).limit(1).next();
  const ageMin = last ? (Date.now() - last.at.getTime()) / 60000 : Infinity;
  const run = (trigger) => runCycle(db, trigger).catch(() => {}); // errors are already logged and stored
  if (ageMin >= REFRESH_MINUTES - 1) run('startup');
  else {
    log(`last successful refresh was ${Math.round(ageMin)} min ago - serving stored data, next refresh in ${Math.round(REFRESH_MINUTES - ageMin)} min`);
    ensureNormals(db).then(() => evaluateAlerts(db)).catch((e) => log('normals check failed:', e.message));
  }
  return setInterval(() => run('scheduled'), REFRESH_MINUTES * 60000);
}
