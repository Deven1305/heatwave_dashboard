// KJS-CES-01 - Exp-7 (AI use case) - READ: heatwave hotspot queries.
import { withDb } from './db.js';

await withDb(async (db) => {
  // 1. Hotspot regions: IMD-style rule "max temperature >= 44 C" (Heatwave or worse)
  const hotspots = await db.collection('regions')
    .find({ currentMaxTempC: { $gte: 44 } }, { projection: { _id: 0, region: 1, currentMaxTempC: 1 } })
    .sort({ currentMaxTempC: -1 })
    .toArray();
  console.log('--- Hotspot regions (currentMaxTempC >= 44) ---');
  console.table(hotspots);

  // 2. Emergency alerts only
  const emergency = await db.collection('alerts').find({ tier: 'Emergency' }, { projection: { _id: 0 } }).toArray();
  console.log('--- Emergency alerts ---');
  console.log(emergency);

  // 3. Aggregation: how many alerts per tier
  const perTier = await db.collection('alerts').aggregate([
    { $group: { _id: '$tier', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  console.log('--- Alerts per tier (aggregate) ---');
  console.log(perTier);

  // 4. Aggregation: average AWS reading
  const [avg] = await db.collection('observations').aggregate([
    { $group: { _id: null, avgTempC: { $avg: '$maxTempC' }, stations: { $sum: 1 } } },
  ]).toArray();
  console.log('--- AWS observations ---');
  console.log(`stations: ${avg.stations}, average max temperature: ${avg.avgTempC.toFixed(2)} C`);
});
