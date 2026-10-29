// Connects to MongoDB and gets the database ready. It uses its own database, climateintel_live,
// which MongoDB creates by itself the first time we write to it, so there is nothing to set up by hand.
//
// What is stored where:
//   stations      one document per city: where it is, its latest reading and its 365 "normal" temperatures
//   observations  every current-weather reading we ever collected. It only grows, nothing is overwritten
//   daily         the highest and lowest temperature of each day per city: 30 past days, today and the
//                 forecast days. These rows ARE updated as a day completes
//   alerts        heat alerts, made by the system or typed in by a user. Never deleted, so there is a history
//   reports       what people submit through the observation form
//   fetch_log     a diary with one line for every time we fetched from Open-Meteo
import { MongoClient } from 'mongodb';
import { MONGO_URI, DB_NAME, STATIONS, REGIONS } from './config.js';

// Returns { client, db }. server.js keeps the client so it can close the connection on shutdown.
export async function connect() {
  // 5 seconds is enough to know MongoDB isn't there; the default (30 s) would just look like a frozen terminal
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(DB_NAME);
  // Indexes make the common lookups fast. The two "unique" ones also act as a safety net: MongoDB itself
  // refuses to store the same reading (or the same city and date) twice, even if our code had a bug.
  // createIndex does nothing when the index already exists, so it is fine to run on every start.
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
  // Make sure all 30 cities exist. The city list lives in config.js, so on every start we copy it into MongoDB.
  // $set only touches the fields listed here: the latest reading and the normals already stored are left alone.
  await db.collection('stations').bulkWrite(STATIONS.map((s) => ({
    updateOne: {
      filter: { _id: s.id },
      update: { $set: { name: s.name, regionId: s.regionId, regionName: REGIONS.find((r) => r.id === s.regionId)?.name, lat: s.lat, lon: s.lon, terrain: s.terrain, state: s.state, tags: s.tags } },
      upsert: true,
    },
  })));
  return { client, db };
}
