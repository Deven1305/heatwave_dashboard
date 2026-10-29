// The backend's front door. This is the Express server the website talks to (http://localhost:4300).
// The browser never touches MongoDB or Open-Meteo itself: it asks one of the routes below, the route
// reads or writes MongoDB, and the answer goes back as JSON. Start it with `npm run live`.
//
// The file reads top to bottom: connect to MongoDB, set up Express, the routes (read-only ones first,
// then the ones that change data), the error handlers, and finally start listening.
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
// 1. Connect to MongoDB before anything else. If it isn't running there is nothing useful this server can
//    do, so we say why in plain words and stop, instead of starting up and failing on the first request.
try {
  ({ client, db } = await connect());
} catch (error) {
  console.error(`\nCould not connect to MongoDB (${error.message}).\nStart the MongoDB service (or Docker: docker run -d -p 27017:27017 mongo) and try again.\n`);
  process.exit(1);
}

// 2. Express. CORS is wide open so the website (a different port) can call us: fine on your own computer,
//    but it is one of the things to tighten before this goes on the internet (see INSTRUCTIONS.md).
//    The 9 MB body limit is there for the photo in a report (7 MB of image becomes about 9 MB once encoded as text).
const app = express();
app.use(cors());
app.use(express.json({ limit: '9mb' }));

// ---- small helpers used by the routes below ----
// Express doesn't catch errors thrown inside async routes, so wrap() hands them to the error handler at the
// bottom. Every async route is wrapped.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Accepts a region id ("west-india") or its name ("West India") in any letter case. Returns undefined if unknown.
const findRegion = (value) => REGIONS.find((r) => r.id === value || r.name.toLowerCase() === String(value).toLowerCase());
// Anything that comes from the browser goes through text(): it must be a string, is trimmed, and is cut to max
// characters. A number, object or 5 MB of text can't get through.
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// A whole number from the query string (?days=30), forced between min and max, with a default when it isn't a number.
const intParam = (v, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || fallback));

// What you see if you open http://localhost:4300 in a browser: a short description and the list of routes.
app.get('/', (req, res) => res.json({
  service: 'climateintel-live-api', database: DB_NAME, source: 'Open-Meteo (https://open-meteo.com, CC BY 4.0)',
  refreshEveryMinutes: REFRESH_MINUTES,
  routes: ['GET /api/health', 'GET /api/overview', 'GET /api/search?q=himalaya', 'GET /api/regions/:id/history?days=30', 'GET /api/stations/:id/history?hours=48',
    'GET /api/alerts?status=active&q=text&limit=100', 'POST /api/alerts', 'POST /api/alerts/:id/clear',
    'GET /api/reports?q=text', 'POST /api/reports', 'GET /api/reports/:id/photo', 'GET /api/stats', 'GET /api/runs', 'POST /api/refresh'],
}));

// "Is it alive?" The ping makes sure "ok" means MongoDB really answers, not just that this server is up.
app.get('/api/health', wrap(async (req, res) => {
  await db.command({ ping: 1 });
  res.json({ status: 'ok', mongo: 'connected', database: DB_NAME });
}));

// The main one: everything the Overview, the ticker, the home page and the forecast tab need, in a single
// answer. The website asks for this once and shares it between pages. The numbers are worked out here on
// each request (see queries.js), only the raw readings and alerts live in the database.
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

// Search for cities (and through them, regions). MongoDB does the matching, see search.js.
// The website only needs the ids back; it already holds the full data from /api/overview.
app.get('/api/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filter = buildSearchFilter(q);
  if (!filter) return res.json({ q, count: 0, stations: [], regions: [] });
  let rows = await db.collection('stations').find(filter).project({ name: 1, regionId: 1, state: 1 }).sort({ name: 1 }).toArray();
  // If the text is exactly a region's name ("west india"), the person wants that region only. Without this,
  // the word "west" would also pull in North-West India and West Bengal.
  const norm = (v) => v.toLowerCase().replace(/[-\s]+/g, ' ').trim();
  const exact = REGIONS.find((r) => norm(r.name) === norm(q));
  if (exact) rows = rows.filter((r) => r.regionId === exact.id);
  res.json({
    q, count: rows.length,
    stations: rows.map((r) => ({ id: r._id, name: r.name, state: r.state, regionId: r.regionId })),
    regions: [...new Set(rows.map((r) => r.regionId))],
  });
}));

// One region day by day (past days from MongoDB plus the forecast we stored). Used by the Regions tab chart and table.
app.get('/api/regions/:id/history', wrap(async (req, res) => {
  const result = await regionHistory(db, req.params.id, intParam(req.query.days, 30, 1, 90));
  if (!result) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });
  res.json(result);
}));

// One city: the readings we stored and its daily rows. Used by the detail panel on the Stations tab.
app.get('/api/stations/:id/history', wrap(async (req, res) => {
  const result = await stationHistory(db, req.params.id, intParam(req.query.hours, 48, 1, 24 * 90));
  if (!result) return res.status(404).json({ error: `Station "${req.params.id}" not found.` });
  res.json(result);
}));

// ---- alerts ---------------------------------------------------------------------------------
// The list of alerts, newest first. You can narrow it with ?status=active, ?q=some words and ?limit=.
app.get('/api/alerts', wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  // ?q= is the text from the search box. Object.assign adds its conditions to the filter (nothing is added if q is empty).
  Object.assign(filter, buildTextFilter(normalizeAlertQuery(String(req.query.q || '').slice(0, 80)), ALERT_FIELDS));
  const rows = await db.collection('alerts').find(filter).sort({ issuedAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500)).toArray();
  // MongoDB calls the key _id; the website expects id
  res.json({ count: rows.length, alerts: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

// Someone records an alert by hand (the form on the Alerts tab). We check everything again here, because the
// browser's checks can be skipped by anyone who calls the API directly. All the problems are reported at
// once, not one at a time, so the person can fix them in one go. 400 = "your request is wrong".
app.post('/api/alerts', wrap(async (req, res) => {
  const body = req.body || {};
  const errors = [];
  const region = findRegion(body.region);
  if (!region) errors.push(`"region" must be one of: ${REGIONS.map((r) => r.name).join(', ')}.`);
  if (!TIERS.includes(body.tier)) errors.push(`"tier" must be one of: ${TIERS.join(', ')}.`);
  const message = text(body.message, 500);
  if (message.length < 3) errors.push('"message" is required (3-500 characters).');
  if (errors.length) return res.status(400).json({ errors });
  // We build the document ourselves from the checked values. We never save req.body as it is,
  // otherwise a caller could set any field they like (for example source: 'auto').
  const doc = {
    _id: `HW-${Date.now()}${randomBytes(1).toString('hex').toUpperCase()}`,
    regionId: region.id, region: region.name, tier: body.tier, level: TIERS.indexOf(body.tier),
    message, channel: text(body.channel, 40) || 'Dashboard', issuedAt: new Date(), status: 'active', source: 'manual',
  };
  await db.collection('alerts').insertOne(doc);
  const { _id, ...rest } = doc;
  res.status(201).json({ id: _id, ...rest }); // 201 = created
}));

// Marks an alert as cleared. It is not deleted: the history keeps it, only its status changes.
app.post('/api/alerts/:id/clear', wrap(async (req, res) => {
  const r = await db.collection('alerts').findOneAndUpdate({ _id: req.params.id }, { $set: { status: 'cleared', clearedAt: new Date() } }, { returnDocument: 'after' });
  if (!r) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
  const { _id, ...rest } = r;
  res.json({ id: _id, ...rest });
}));

// ---- observation reports --------------------------------------------------------------------
// The list of reports people submitted, newest first. The photo and the contact details are left out of
// the list on purpose: the photo is big (it has its own route below) and email/phone are private.
app.get('/api/reports', wrap(async (req, res) => {
  const filter = buildTextFilter(String(req.query.q || '').slice(0, 80), REPORT_FIELDS) || {};
  const rows = await db.collection('reports').find(filter).sort({ createdAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500))
    .project({ 'photo.dataUrl': 0, email: 0, phone: 0 }).toArray(); // contact details stay private
  res.json({ count: rows.length, reports: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

// Saves a report from the form on /report. Same idea as the alert route: check everything, then build the
// document from only the fields we know about, each one cut to a sensible length.
app.post('/api/reports', wrap(async (req, res) => {
  const b = req.body || {};
  const region = findRegion(b.region);
  const plotId = text(b.plotId, 40);
  const status = text(b.status, 200);
  const temp = b.ambientTempC;
  const photo = b.photo;
  // the three rules: required fields, a believable temperature, and a photo that really is a small image
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
  // the answer repeats what was saved, but without the big photo data
  const { _id, photo: p, ...rest } = doc;
  res.status(201).json({ message: 'Report saved successfully', record: { id: _id, ...rest, photo: p ? { name: p.name, type: p.type, size: p.size } : undefined } });
}));

// Sends back the photo of a report as a real image, so a plain link or <img> can show it. In MongoDB it is
// kept as text ("data:image/png;base64,....") and decoded here.
app.get('/api/reports/:id/photo', wrap(async (req, res) => {
  const doc = await db.collection('reports').findOne({ _id: req.params.id }, { projection: { photo: 1 } });
  const m = doc?.photo?.dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return res.status(404).json({ error: 'No image stored for this report.' });
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

// ---- data collection ------------------------------------------------------------------------
// How many rows each collection has and when the first and last reading were stored.
app.get('/api/stats', wrap(async (req, res) => res.json(await stats(db))));

// The diary of collection runs (newest first). The Data tab shows it, handy when something looks stale.
app.get('/api/runs', wrap(async (req, res) => {
  const rows = await db.collection('fetch_log').find({}).sort({ at: -1 }).limit(intParam(req.query.limit, 20, 1, 200)).toArray();
  res.json({ count: rows.length, runs: rows.map(({ _id, ...rest }) => rest) });
}));

// "Fetch latest data": collect from Open-Meteo right now instead of waiting for the timer. It is allowed once a
// minute only, so pressing the button repeatedly can't use up the free quota. 429 means "slow down".
let lastManual = 0;
app.post('/api/refresh', wrap(async (req, res) => {
  const wait = 60000 - (Date.now() - lastManual);
  if (wait > 0) return res.status(429).set('Retry-After', String(Math.ceil(wait / 1000))).json({ error: `Data was just refreshed. Try again in ${Math.ceil(wait / 1000)} s.` });
  lastManual = Date.now();
  try {
    res.json(await runCycle(db, 'manual'));
  } catch (error) {
    // 502 = we are fine but the service behind us (Open-Meteo) isn't. Stored data keeps working.
    res.status(502).json({ error: `Open-Meteo could not be reached: ${error.message}` });
  }
}));

// Anything above that didn't match is a 404. After it comes the one error handler for the whole app: the
// errors we expect get a clear message and status, and for anything else the details go to the terminal
// (not to the browser) while the caller only sees a plain 500.
app.use((req, res) => res.status(404).json({ error: 'Route not found', requestedPath: req.originalUrl }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 3. Start the collector's timer, begin listening, and close the MongoDB connection properly on Ctrl+C.
const timer = await startScheduler(db);
const server = app.listen(PORT, () => console.log(`ClimateIntel live API on http://localhost:${PORT}  (database "${DB_NAME}", refresh every ${REFRESH_MINUTES} min)`));
const shutdown = async () => { clearInterval(timer); server.close(); await client.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
