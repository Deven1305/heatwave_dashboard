// KJS-CES-01 - Exp-7 (AI use case) - CREATE: build the climateintel database.
// Collections: regions (7 IMD regions), alerts (heatwave dispatches),
// observations (AWS station readings).
import fs from 'node:fs/promises';
import { withDb } from './db.js';

const regions = JSON.parse(await fs.readFile(new URL('../api-express/data/regions.json', import.meta.url), 'utf8'));
const alerts = JSON.parse(await fs.readFile(new URL('../api-express/data/alerts.json', import.meta.url), 'utf8'));

const observations = [
  { stationId: 'AWS-CI-01', region: 'Central India', maxTempC: 45.2, humidity: 22, at: new Date('2026-10-09T09:00:00Z') },
  { stationId: 'AWS-WI-01', region: 'Western India', maxTempC: 47.8, humidity: 18, at: new Date('2026-10-09T09:00:00Z') },
  { stationId: 'AWS-NW-01', region: 'North West India', maxTempC: 41.5, humidity: 30, at: new Date('2026-10-09T09:00:00Z') },
  { stationId: 'AWS-WH-01', region: 'Western Himalaya', maxTempC: 22.0, humidity: 55, at: new Date('2026-10-09T09:00:00Z') },
];

await withDb(async (db) => {
  // start clean so the script can be re-run
  for (const name of ['regions', 'alerts', 'observations']) await db.collection(name).drop().catch(() => {});

  const r = await db.collection('regions').insertMany(regions);
  const a = await db.collection('alerts').insertMany(alerts);
  const o = await db.collection('observations').insertMany(observations);

  console.log('Database created: climateintel');
  console.log(`regions      -> ${r.insertedCount} documents inserted`);
  console.log(`alerts       -> ${a.insertedCount} documents inserted`);
  console.log(`observations -> ${o.insertedCount} documents inserted`);
  console.log('Collections now in database:', (await db.listCollections().toArray()).map((c) => c.name).join(', '));
});
