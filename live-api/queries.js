// Read side of the live backend: everything the dashboard shows is computed here from MongoDB.
import { REGIONS, FRESH_MINUTES } from './config.js';
import { classify, normalFor, istDate, LABELS, TIER_OF, THRESHOLD } from './severity.js';

const round1 = (n) => Math.round(n * 10) / 10;
const mean = (values) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null);

// Station that best represents a region: highest alert level, then biggest departure, then hottest.
const heatStress = (a, b) =>
  (b.level - a.level) || ((b.departureC ?? -99) - (a.departureC ?? -99)) || ((b.todayMaxC ?? -99) - (a.todayMaxC ?? -99));

export async function loadState(db, now = new Date()) {
  const today = istDate(now);
  const [stations, dailyToday] = await Promise.all([
    db.collection('stations').find({}).toArray(),
    db.collection('daily').find({ date: today }).toArray(),
  ]);
  const dailyBy = new Map(dailyToday.map((d) => [d.stationId, d]));

  const rows = stations.map((s) => {
    const day = dailyBy.get(s._id);
    const cur = s.latest;
    const known = [day?.tMaxC, cur?.tempC].filter((v) => typeof v === 'number');
    const todayMaxC = known.length ? Math.max(...known) : null;
    const normalC = normalFor(s, today);
    const c = classify(todayMaxC, normalC, s.terrain);
    const ageMin = cur ? (now - new Date(cur.observedAt)) / 60000 : null;
    return {
      id: s._id, name: s.name, regionId: s.regionId, terrain: s.terrain, lat: s.lat, lon: s.lon,
      nowC: cur?.tempC ?? null, apparentC: cur?.apparentC ?? null, humidityPct: cur?.humidityPct ?? null,
      windKmh: cur?.windKmh ?? null, observedAt: cur?.observedAt ?? null,
      fresh: ageMin !== null && ageMin <= FRESH_MINUTES,
      todayMaxC, todayMinC: day?.tMinC ?? null, normalC,
      thresholdC: THRESHOLD[s.terrain] ?? THRESHOLD.plains, // the "too hot" limit for this terrain, drawn on the city bars
      departureC: c.departureC, level: c.level, severity: c.severity, tier: c.tier,
    };
  });

  const regions = REGIONS.map((r) => {
    const members = rows.filter((s) => s.regionId === r.id);
    const withData = members.filter((s) => s.todayMaxC !== null).sort(heatStress);
    const head = withData[0] || null;
    const nows = members.map((s) => s.nowC).filter((v) => typeof v === 'number');
    const level = head?.level ?? 0;
    return {
      id: r.id, name: r.name,
      stationsTotal: members.length, stationsReporting: members.filter((s) => s.fresh).length,
      peakStation: head?.name ?? null, todayMaxC: head?.todayMaxC ?? null,
      normalC: head?.normalC ?? null, departureC: head?.departureC ?? null,
      nowMaxC: nows.length ? Math.max(...nows) : null, nowAvgC: mean(nows),
      level, severity: LABELS[level], tier: TIER_OF[level],
      normalsReady: members.every((s) => s.normalC !== null),
    };
  });
  const periods = [...new Set(stations.map((s) => s.normalsMeta?.years).filter(Boolean))];
  return { today, stations: rows, regions, normalPeriod: periods.length ? periods.join(' / ').replace(/-/g, '–') : null };
}

// Per region: daily maximum for the last trendDays (up to today) and the stored forecast for the next days.
export async function regionTrends(db, trendDays = 14, now = new Date()) {
  const today = istDate(now);
  const since = istDate(new Date(now.getTime() - trendDays * 86400000));
  const [stations, rows] = await Promise.all([
    db.collection('stations').find({}).project({ normalMax: 1, terrain: 1, regionId: 1 }).toArray(),
    db.collection('daily').find({ date: { $gte: since } }).toArray(),
  ]);
  const byId = new Map(stations.map((s) => [s._id, s]));
  const perRegion = new Map();
  for (const row of rows) {
    const st = byId.get(row.stationId);
    if (!st) continue;
    const c = classify(row.tMaxC, normalFor(st, row.date), st.terrain);
    const dates = perRegion.get(st.regionId) || new Map();
    const cur = dates.get(row.date) || { date: row.date, maxC: -Infinity, level: 0 };
    cur.maxC = Math.max(cur.maxC, row.tMaxC);
    cur.level = Math.max(cur.level, c.level);
    dates.set(row.date, cur);
    perRegion.set(st.regionId, dates);
  }
  const out = {};
  for (const r of REGIONS) {
    const list = [...(perRegion.get(r.id)?.values() || [])].sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, severity: LABELS[d.level], tier: TIER_OF[d.level] }));
    out[r.id] = { trend: list.filter((d) => d.date <= today), forecast: list.filter((d) => d.date > today) };
  }
  return out;
}

export async function regionHistory(db, regionId, days = 30, now = new Date()) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return null;
  const stations = await db.collection('stations').find({ regionId }).toArray();
  const byId = new Map(stations.map((s) => [s._id, s]));
  const today = istDate(now);
  const since = istDate(new Date(now.getTime() - days * 86400000));
  const rows = await db.collection('daily')
    .find({ stationId: { $in: [...byId.keys()] }, date: { $gte: since } }).sort({ date: 1 }).toArray();

  const perDate = new Map();
  for (const row of rows) {
    const st = byId.get(row.stationId);
    const normal = normalFor(st, row.date);
    const c = classify(row.tMaxC, normal, st.terrain);
    const item = { station: st.name, todayMaxC: row.tMaxC, normalC: normal, departureC: c.departureC, level: c.level };
    if (!perDate.has(row.date)) perDate.set(row.date, []);
    perDate.get(row.date).push(item);
  }
  const series = [...perDate.entries()].map(([date, items]) => {
    const head = [...items].sort(heatStress)[0];
    const hottest = [...items].sort((a, b) => b.todayMaxC - a.todayMaxC)[0];
    return {
      date, isForecast: date > today,
      maxC: hottest.todayMaxC, hottestStation: hottest.station,
      avgMaxC: mean(items.map((i) => i.todayMaxC)),
      normalAvgC: mean(items.map((i) => i.normalC).filter((v) => typeof v === 'number')),
      peakStation: head.station, departureC: head.departureC,
      level: head.level, severity: LABELS[head.level], tier: TIER_OF[head.level],
      stations: items.length,
    };
  });
  return { region, days: series };
}

export async function stationHistory(db, stationId, hours = 48, now = new Date()) {
  const station = await db.collection('stations').findOne({ _id: stationId }, { projection: { normalMax: 0 } });
  if (!station) return null;
  const since = new Date(now.getTime() - hours * 3600000);
  const [readings, daily] = await Promise.all([
    db.collection('observations').find({ stationId, observedAt: { $gte: since } }).sort({ observedAt: 1 })
      .project({ _id: 0, observedAt: 1, tempC: 1, apparentC: 1, humidityPct: 1, windKmh: 1 }).toArray(),
    db.collection('daily').find({ stationId }).sort({ date: 1 })
      .project({ _id: 0, date: 1, tMaxC: 1, tMinC: 1, apparentMaxC: 1 }).toArray(),
  ]);
  return { station: { id: station._id, name: station.name, regionId: station.regionId, terrain: station.terrain }, readings, daily };
}

export async function stats(db) {
  const c = (name) => db.collection(name);
  const [observations, daily, alerts, reports, runs, first, last, lastRun, lastOk] = await Promise.all([
    c('observations').estimatedDocumentCount(), c('daily').estimatedDocumentCount(),
    c('alerts').estimatedDocumentCount(), c('reports').estimatedDocumentCount(), c('fetch_log').estimatedDocumentCount(),
    c('observations').find().sort({ observedAt: 1 }).limit(1).next(),
    c('observations').find().sort({ observedAt: -1 }).limit(1).next(),
    c('fetch_log').find().sort({ at: -1 }).limit(1).next(),
    c('fetch_log').find({ ok: true }).sort({ at: -1 }).limit(1).next(),
  ]);
  return {
    database: db.databaseName,
    collections: { observations, daily, alerts, reports, fetchRuns: runs },
    firstObservationAt: first?.observedAt ?? null, lastObservationAt: last?.observedAt ?? null,
    lastRun: lastRun ? { at: lastRun.at, ok: lastRun.ok, trigger: lastRun.trigger, error: lastRun.error ?? null } : null,
    lastSuccessAt: lastOk?.at ?? null,
  };
}
