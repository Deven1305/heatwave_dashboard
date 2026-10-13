// KJS-CES-01 - Exp-7 (AI use case) - UPDATE: escalate an alert and refresh a reading.
import { withDb } from './db.js';

await withDb(async (db) => {
  // Central India has crossed the heatwave band -> escalate its Warning alert to Emergency
  const esc = await db.collection('alerts').updateOne(
    { id: 'HW-402905' },
    { $set: { tier: 'Emergency', message: 'ESCALATED: heatwave threshold crossed', channel: 'SMS+Siren' } }
  );
  console.log(`Alert HW-402905: ${esc.matchedCount} matched, ${esc.modifiedCount} modified (Warning -> Emergency)`);

  // A new AWS station started reporting for Western India: $inc the counter
  const inc = await db.collection('regions').updateOne(
    { id: 'western-india' },
    { $inc: { awsStationsReporting: 1 } }
  );
  console.log(`Region western-india: ${inc.matchedCount} matched, ${inc.modifiedCount} modified (awsStationsReporting +1)`);

  // updateMany: every observation taken at >= 45 C gets flagged
  const flag = await db.collection('observations').updateMany(
    { maxTempC: { $gte: 45 } },
    { $set: { flagged: true } }
  );
  console.log(`Observations flagged (>= 45 C): ${flag.modifiedCount}`);

  console.log('Updated alert document:', await db.collection('alerts').findOne({ id: 'HW-402905' }, { projection: { _id: 0 } }));
});
