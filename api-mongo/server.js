// KJS-CES-01 - Exp-7 (AI use case): Express REST API backed by MongoDB.
// Same resources as the Exp-6 JSON-file API, but now persisted in MongoDB.
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { URI, DB_NAME } from './db.js';

const PORT = Number(process.env.PORT) || 4200;
const TIERS = ['Safe', 'Watch', 'Warning', 'Emergency'];

const client = new MongoClient(URI);
await client.connect();
const db = client.db(DB_NAME);
const regions = db.collection('regions');
const alerts = db.collection('alerts');

const severityFrom = (t) => (t >= 47 ? 'Severe Heatwave' : t >= 44 ? 'Heatwave' : t >= 40 ? 'Hot Day' : 'Normal');
const withSeverity = (r) => ({ ...r, severity: severityFrom(r.currentMaxTempC) });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({
  service: 'kjs-ces-01-mongo-api', database: DB_NAME,
  routes: ['GET /api/regions', 'GET /api/hotspots', 'GET /api/alerts', 'POST /api/alerts', 'PATCH /api/alerts/:id', 'DELETE /api/alerts/:id'],
}));

app.get('/api/regions', async (req, res, next) => {
  try { res.json((await regions.find({}, { projection: { _id: 0 } }).toArray()).map(withSeverity)); } catch (e) { next(e); }
});

// Hotspots = regions at Heatwave level or worse, found with a MongoDB query
app.get('/api/hotspots', async (req, res, next) => {
  try {
    const rows = await regions.find({ currentMaxTempC: { $gte: 44 } }, { projection: { _id: 0 } }).sort({ currentMaxTempC: -1 }).toArray();
    res.json({ count: rows.length, hotspots: rows.map(withSeverity) });
  } catch (e) { next(e); }
});

app.get('/api/alerts', async (req, res, next) => {
  try {
    const filter = req.query.tier ? { tier: req.query.tier } : {};
    const rows = await alerts.find(filter, { projection: { _id: 0 } }).toArray();
    res.json({ count: rows.length, alerts: rows });
  } catch (e) { next(e); }
});

app.post('/api/alerts', async (req, res, next) => {
  try {
    const { region, tier, message } = req.body;
    const errors = [];
    if (!region) errors.push('"region" is required.');
    if (!TIERS.includes(tier)) errors.push(`"tier" must be one of: ${TIERS.join(', ')}.`);
    if (!message) errors.push('"message" is required.');
    if (errors.length) return res.status(400).json({ errors });
    const doc = { id: `HW-${Date.now()}`, region, tier, message, channel: req.body.channel || 'App Push', issued: new Date().toISOString() };
    await alerts.insertOne({ ...doc });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

app.patch('/api/alerts/:id', async (req, res, next) => {
  try {
    if (req.body.tier && !TIERS.includes(req.body.tier)) return res.status(400).json({ errors: ['invalid tier'] });
    const r = await alerts.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { returnDocument: 'after', projection: { _id: 0 } });
    if (!r) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
    res.json(r);
  } catch (e) { next(e); }
});

app.delete('/api/alerts/:id', async (req, res, next) => {
  try {
    const r = await alerts.deleteOne({ id: req.params.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: `Alert "${req.params.id}" not found.` });
    res.json({ message: 'Alert deleted.', id: req.params.id });
  } catch (e) { next(e); }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found', requestedPath: req.originalUrl }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error', detail: err.message }); });

app.listen(PORT, () => console.log(`Exp-7 MongoDB API running on http://localhost:${PORT}`));
