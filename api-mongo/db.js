// KJS-CES-01 - Exp-7: shared MongoDB connection settings for every script below.
import { MongoClient } from 'mongodb';

export const URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
export const DB_NAME = 'climateintel';

// Opens a connection, runs `work(db)`, and always closes the connection.
export async function withDb(work) {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    return await work(client.db(DB_NAME));
  } finally {
    await client.close();
  }
}
