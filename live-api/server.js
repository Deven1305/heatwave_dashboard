// ClimateIntel live API: real Open-Meteo weather, stored in and served from MongoDB. Port 4300.
//   npm run live      (needs MongoDB on mongodb://127.0.0.1:27017)
import { randomBytes } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { PORT, DB_NAME, REGIONS, TIERS, REFRESH_MINUTES } from './config.js';
import { connect } from './db.js';
import { loadState, regionHistory, regionTrends, stationHistory, stats } from './queries.js';
import { runCycle, startScheduler } from './collector.js';
import { buildSearchFilter, buildTextFilter, normalizeAlertQuery, ALERT_FIELDS, REPORT_FIELDS } from './search.js';

let client;
let db;
// 1. Connect to MongoDB first: without the database there is nothing to serve, so fail early with a clear message.
try {
  ({ client, db } = await connect());
} catch (error) {
  console.error(`\nCould not connect to MongoDB (${error.message}).\nStart the MongoDB service (or Docker: docker run -d -p 27017:27017 mongo) and try again.\n`);
  process.exit(1);
}

// 2. The web server. CORS is open because this is a local development setup (see README, security notes).
const app = express();
app.use(cors());
app.use(express.json({ limit: '9mb' }));

// ---- small helpers used by the routes below ----
// wrap: lets an async route throw; the error is passed to the error handler at the bottom instead of crashing.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// findRegion: accepts a region id ("west-india") or its name ("West India"), any letter case.
const findRegion = (value) => REGIONS.find((r) => r.id === value || r.name.toLowerCase() === String(value).toLowerCase());
// text: a trimmed string cut to `max` characters, or "" when the value is not a string (never trust client input).
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// intParam: a whole number from a query string, kept inside [min, max], with a default.
const intParam = (v, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || fallback));

// Service description: handy when you open http://localhost:4300 in a browser.
app.get('/', (req, res) => res.json({
  service: 'climateintel-live-api', database: DB_NAME, source: 'Open-Meteo (https://open-meteo.com, CC BY 4.0)',
  refreshEveryMinutes: REFRESH_MINUTES,
  routes: ['GET /api/health', 'GET /api/overview', 'GET /api/search?q=himalaya', 'GET /api/regions/:id/history?days=30', 'GET /api/stations/:id/history?hours=48',
    'GET /api/alerts?status=active&q=text&limit=100', 'POST /api/alerts', 'POST /api/alerts/:id/clear',
    'GET /api/reports?q=text', 'POST /api/reports', 'GET /api/reports/:id/photo', 'GET /api/stats', 'GET /api/runs', 'POST /api/refresh'],
}));

// Health check: pings MongoDB so "ok" really means the database answers.
app.get('/api/health', wrap(async (req, res) => {
  await db.command({ ping: 1 });
  res.json({ status: 'ok', mongo: 'connected', database: DB_NAME });
}));

// Current picture: regions, stations, headline numbers, when data was last collected.
app.get('/api/overview', wrap(async (req, res) => {
  const [state, s, active, trends] = await Promise.all([loadState(db), stats(db), db.collection('alerts').countDocuments({ status: 'active' }), regionTrends(db)]);
  const reporting = state.stations.filter((x) => x.fresh).length;
  res.json({
    generatedAt: new Date(), today: state.today,
    regions: state.regions.map((r) => ({ ...r, ...trends[r.id] })), stations: state.stations,
    summary: {
      stationsTotal: state.stations.length, stationsReporting: reporting,
      regionsElevated: state.regions.filter((r) => r.level > 0).length, regionsTotal: state.regions.length,
      activeAlerts: active,
      hottestNow: state.stations.filter((x) => x.nowC !== null).sort((a, b) => b.nowC - a.nowC)[0] ?? null,
    },
    stored: s, source: { name: 'Open-Meteo', url: 'https://open-meteo.com', licence: 'CC BY 4.0' },
    normalsReady: state.stations.every((x) => x.normalC !== null), normalPeriod: state.normalPeriod,
  });
}));

// Search cities by name, state, region, terrain or keyword ("himalaya", "coastal"...). The matching runs in MongoDB.
app.get('/api/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filter = buildSearchFilter(q);
  if (!filter) return res.json({ q, count: 0, stations: [], regions: [] });
  let rows = await db.collection('stations').find(filter).project({ name: 1, regionId: 1, state: 1 }).sort({ name: 1 }).toArray();
  // typing a region's exact name ("west india", "north-west india") means that region only
  const norm = (v) => v.toLowerCase().replace(/[-\s]+/g, ' ').trim();
  const exact = REGIONS.find((r) => norm(r.name) === norm(q));
  if (exact) rows = rows.filter((r) => r.regionId === exact.id);
  res.json({
    q, count: rows.length,
    stations: rows.map((r) => ({ id: r._id, name: r.name, state: r.state, regionId: r.regionId })),
    regions: [...new Set(rows.map((r) => r.regionId))],
  });
}));

// Daily series for one region (past days from MongoDB plus the stored forecast): feeds the Regions chart and table.
app.get('/api/regions/:id/history', wrap(async (req, res) => {
  const result = await regionHistory(db, req.params.id, intParam(req.query.days, 30, 1, 90));
  if (!result) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });
  res.json(result);
}));

// Stored readings and daily rows for one city: feeds the Stations detail panel.
app.get('/api/stations/:id/history', wrap(async (req, res) => {
  const result = await stationHistory(db, req.params.id, intParam(req.query.hours, 48, 1, 24 * 90));
  if (!result) return res.status(404).json({ error: `Station "${req.params.id}" not found.` });
  res.json(result);
}));

// ---- alerts ---------------------------------------------------------------------------------
// List alerts, newest first. Optional: ?status=active, ?q=text (matched in MongoDB), ?limit=.
app.get('/api/alerts', wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  // optional free-text search (?q=heatwave mumbai), matched inside MongoDB
  Object.assign(filter, buildTextFilter(normalizeAlertQuery(String(req.query.q || '').slice(0, 80)), ALERT_FIELDS));
  const rows = await db.collection('alerts').find(filter).sort({ issuedAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500)).toArray();
  res.json({ count: rows.length, alerts: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

// Record an alert by hand. Validated here (never trust the browser); answers 400 with every reason at once.
app.post('/api/alerts', wrap(async (req, res) => {
  const body = req.body || {};
  const errors = [];
  const region = findRegion(body.region);
  if (!region) errors.push(`"region" must be one of: ${REGIONS.map((r) => r.name).join(', ')}.`);
  if (!TIERS.includes(body.tier)) errors.push(`"tier" must be one of: ${TIERS.join(', ')}.`);
  const message = text(body.message, 500);
  if (message.length < 3) errors.push('"message" is required (3-500 characters).');
  if (errors.length) return res.status(400).json({ errors });
  const doc = {
    _id: `HW-${Date.now()}${randomBytes(1).toString('hex').toUpperCase()}`,
    regionId: region.id, region: region.name, tier: body.tier, level: TIERS.indexOf(body.tier),
    message, channel: text(body.channel, 40) || 'Dashboard', issuedAt: new Date(), status: 'active', source: 'manual',
  };
  await db.collection('alerts').insertOne(doc);
  const { _id, ...rest } = doc;
  res.status(201).json({ id: _id, ...rest });
}));

// Mark an alert as cleared. The alert stays in the history; only its status changes.
app.post('/api/alerts/:id/clear', wrap(async (req, res) => {
  const r = await db.collection('alerts').findOneAndUpdate({ _id: req.params.id }, { $set: { status: 'cleared', clearedAt: new Date() } }, { returnDocument: 'after' });
  if (!r) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
  const { _id, ...rest } = r;
  res.json({ id: _id, ...rest });
}));

// ---- observation reports --------------------------------------------------------------------
// List observation reports. Photos and contact details are left out; ?q=text searches (not email/phone).
app.get('/api/reports', wrap(async (req, res) => {
  const filter = buildTextFilter(String(req.query.q || '').slice(0, 80), REPORT_FIELDS) || {};
  const rows = await db.collection('reports').find(filter).sort({ createdAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500))
    .project({ 'photo.dataUrl': 0, email: 0, phone: 0 }).toArray(); // contact details stay private
  res.json({ count: rows.length, reports: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

// Save an observation report from the form. Only known fields are stored (an allow-list), each cut to a safe length.
app.post('/api/reports', wrap(async (req, res) => {
  const b = req.body || {};
  const region = findRegion(b.region);
  const plotId = text(b.plotId, 40);
  const status = text(b.status, 200);
  const temp = b.ambientTempC;
  const photo = b.photo;
  if (!plotId || !region || !status
    || (temp !== undefined && (typeof temp !== 'number' || !Number.isFinite(temp) || temp < -10 || temp > 60))
    || (photo && (typeof photo.dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(photo.dataUrl) || photo.dataUrl.length > 7 * 1024 * 1024))) {
    return res.status(400).json({ error: 'Provide plotId, a known region, status, a valid temperature (-10 to 60) and valid image evidence if attached.' });
  }
  const doc = {
    _id: `R-${Date.now()}${randomBytes(1).toString('hex')}`,
    plotId, region: region.name, regionId: region.id, status,
    observerName: text(b.observerName, 100), email: text(b.email, 150), phone: text(b.phone, 20),
    ambientTempC: temp, observedAt: text(b.observedAt, 40), confidence: text(b.confidence, 40), notes: text(b.notes, 2000),
    referenceUrl: text(b.referenceUrl, 300),
    dataSources: Array.isArray(b.dataSources) ? b.dataSources.slice(0, 10).map((v) => text(v, 60)) : [],
    photo: photo ? { name: text(photo.name, 120), type: text(photo.type, 40), size: Number(photo.size) || undefined, dataUrl: photo.dataUrl } : undefined,
    createdAt: new Date(),
  };
  await db.collection('reports').insertOne(doc);
  const { _id, photo: p, ...rest } = doc;
  res.status(201).json({ message: 'Report saved successfully', record: { id: _id, ...rest, photo: p ? { name: p.name, type: p.type, size: p.size } : undefined } });
}));

// Serve a report's image. It is stored as a data URL in MongoDB and decoded here so <a href> and <img> can use it.
app.get('/api/reports/:id/photo', wrap(async (req, res) => {
  const doc = await db.collection('reports').findOne({ _id: req.params.id }, { projection: { photo: 1 } });
  const m = doc?.photo?.dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return res.status(404).json({ error: 'No image stored for this report.' });
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

// ---- data collection ------------------------------------------------------------------------
// Collection counts and first/last reading time: feeds the "Stored in MongoDB" numbers.
app.get('/api/stats', wrap(async (req, res) => res.json(await stats(db))));

// The refresh diary (one entry per collection run): feeds the Data tab.
app.get('/api/runs', wrap(async (req, res) => {
  const rows = await db.collection('fetch_log').find({}).sort({ at: -1 }).limit(intParam(req.query.limit, 20, 1, 200)).toArray();
  res.json({ count: rows.length, runs: rows.map(({ _id, ...rest }) => rest) });
}));

// Collect from Open-Meteo right now. Limited to once a minute so the free API quota is not burnt by button presses.
let lastManual = 0;
app.post('/api/refresh', wrap(async (req, res) => {
  const wait = 60000 - (Date.now() - lastManual);
  if (wait > 0) return res.status(429).set('Retry-After', String(Math.ceil(wait / 1000))).json({ error: `Data was just refreshed. Try again in ${Math.ceil(wait / 1000)} s.` });
  lastManual = Date.now();
  try {
    res.json(await runCycle(db, 'manual'));
  } catch (error) {
    res.status(502).json({ error: `Open-Meteo could not be reached: ${error.message}` });
  }
}));

// 404 for unknown routes, then one central error handler: expected problems get a clear status, the rest become a 500.
app.use((req, res) => res.status(404).json({ error: 'Route not found', requestedPath: req.originalUrl }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 3. Start collecting on a timer, open the port, and shut down cleanly (Ctrl+C closes the database connection).
const timer = await startScheduler(db);
const server = app.listen(PORT, () => console.log(`ClimateIntel live API on http://localhost:${PORT}  (database "${DB_NAME}", refresh every ${REFRESH_MINUTES} min)`));
const shutdown = async () => { clearInterval(timer); server.close(); await client.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
