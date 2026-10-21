// MongoDB connection for the live backend: database "climateintel_live" (separate from the Exp-7 lab database).
//
// Collections
//   stations      one document per monitoring city (+ its latest reading and 365 "normal" daily maxima)
//   observations  every current-weather reading ever collected (the time series, grows with each refresh)
//   daily         daily max/min per station and date: 30 past days + 3 forecast days, kept forever
//   alerts        automatic heat alerts raised from the data + alerts recorded by users (history kept)
//   reports       observation reports submitted through the form
//   fetch_log     one document per refresh run (when, how many stations, success or error)
import { MongoClient } from 'mongodb';
import { MONGO_URI, DB_NAME, STATIONS, REGIONS } from './config.js';

export async function connect() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(DB_NAME);
  await Promise.all([
    db.collection('observations').createIndex({ stationId: 1, observedAt: -1 }, { unique: true }),
    db.collection('observations').createIndex({ regionId: 1, observedAt: -1 }),
    db.collection('daily').createIndex({ stationId: 1, date: 1 }, { unique: true }),
    db.collection('daily').createIndex({ regionId: 1, date: -1 }),
    db.collection('alerts').createIndex({ issuedAt: -1 }),
    db.collection('alerts').createIndex({ regionId: 1, source: 1, issuedAt: -1 }),
    db.collection('reports').createIndex({ createdAt: -1 }),
    db.collection('fetch_log').createIndex({ at: -1 }),
  ]);
  // Station definitions are configuration; $set keeps the stored latest reading and normals untouched.
  await db.collection('stations').bulkWrite(STATIONS.map((s) => ({
    updateOne: {
      filter: { _id: s.id },
      update: { $set: { name: s.name, regionId: s.regionId, regionName: REGIONS.find((r) => r.id === s.regionId)?.name, lat: s.lat, lon: s.lon, terrain: s.terrain, state: s.state, tags: s.tags } },
      upsert: true,
    },
  })));
  return { client, db };
}
