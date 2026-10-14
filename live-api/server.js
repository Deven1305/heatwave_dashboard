// ClimateIntel live API: real Open-Meteo weather, stored in and served from MongoDB. Port 4300.
//   npm run live      (needs MongoDB on mongodb://127.0.0.1:27017)
import { randomBytes } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { PORT, DB_NAME, REGIONS, TIERS, REFRESH_MINUTES } from './config.js';
import { connect } from './db.js';
import { loadState, regionHistory, regionTrends, stationHistory, stats } from './queries.js';
import { runCycle, startScheduler } from './collector.js';

let client;
let db;
try {
  ({ client, db } = await connect());
} catch (error) {
  console.error(`\nCould not connect to MongoDB (${error.message}).\nStart the MongoDB service (or Docker: docker run -d -p 27017:27017 mongo) and try again.\n`);
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '9mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const findRegion = (value) => REGIONS.find((r) => r.id === value || r.name.toLowerCase() === String(value).toLowerCase());
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const intParam = (v, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || fallback));

app.get('/', (req, res) => res.json({
  service: 'climateintel-live-api', database: DB_NAME, source: 'Open-Meteo (https://open-meteo.com, CC BY 4.0)',
  refreshEveryMinutes: REFRESH_MINUTES,
  routes: ['GET /api/health', 'GET /api/overview', 'GET /api/regions/:id/history?days=30', 'GET /api/stations/:id/history?hours=48',
    'GET /api/alerts?status=active&limit=100', 'POST /api/alerts', 'POST /api/alerts/:id/clear',
    'GET /api/reports', 'POST /api/reports', 'GET /api/reports/:id/photo', 'GET /api/stats', 'GET /api/runs', 'POST /api/refresh'],
}));

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

app.get('/api/regions/:id/history', wrap(async (req, res) => {
  const result = await regionHistory(db, req.params.id, intParam(req.query.days, 30, 1, 90));
  if (!result) return res.status(404).json({ error: `Region "${req.params.id}" not found.` });
  res.json(result);
}));

app.get('/api/stations/:id/history', wrap(async (req, res) => {
  const result = await stationHistory(db, req.params.id, intParam(req.query.hours, 48, 1, 24 * 90));
  if (!result) return res.status(404).json({ error: `Station "${req.params.id}" not found.` });
  res.json(result);
}));

// ---- alerts ---------------------------------------------------------------------------------
app.get('/api/alerts', wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  const rows = await db.collection('alerts').find(filter).sort({ issuedAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500)).toArray();
  res.json({ count: rows.length, alerts: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

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

app.post('/api/alerts/:id/clear', wrap(async (req, res) => {
  const r = await db.collection('alerts').findOneAndUpdate({ _id: req.params.id }, { $set: { status: 'cleared', clearedAt: new Date() } }, { returnDocument: 'after' });
  if (!r) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
  const { _id, ...rest } = r;
  res.json({ id: _id, ...rest });
}));

// ---- observation reports --------------------------------------------------------------------
app.get('/api/reports', wrap(async (req, res) => {
  const rows = await db.collection('reports').find({}).sort({ createdAt: -1 }).limit(intParam(req.query.limit, 100, 1, 500))
    .project({ 'photo.dataUrl': 0, email: 0, phone: 0 }).toArray(); // contact details stay private
  res.json({ count: rows.length, reports: rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}));

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

app.get('/api/reports/:id/photo', wrap(async (req, res) => {
  const doc = await db.collection('reports').findOne({ _id: req.params.id }, { projection: { photo: 1 } });
  const m = doc?.photo?.dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return res.status(404).json({ error: 'No image stored for this report.' });
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

// ---- data collection ------------------------------------------------------------------------
app.get('/api/stats', wrap(async (req, res) => res.json(await stats(db))));

app.get('/api/runs', wrap(async (req, res) => {
  const rows = await db.collection('fetch_log').find({}).sort({ at: -1 }).limit(intParam(req.query.limit, 20, 1, 200)).toArray();
  res.json({ count: rows.length, runs: rows.map(({ _id, ...rest }) => rest) });
}));

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

app.use((req, res) => res.status(404).json({ error: 'Route not found', requestedPath: req.originalUrl }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const timer = await startScheduler(db);
const server = app.listen(PORT, () => console.log(`ClimateIntel live API on http://localhost:${PORT}  (database "${DB_NAME}", refresh every ${REFRESH_MINUTES} min)`));
const shutdown = async () => { clearInterval(timer); server.close(); await client.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
