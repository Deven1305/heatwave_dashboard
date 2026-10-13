// KJS-CES-01 - Exp-7 (AI use case) - DELETE: remove a resolved alert.
import { withDb } from './db.js';

await withDb(async (db) => {
  const alerts = db.collection('alerts');
  console.log('Alerts before delete:', await alerts.countDocuments());

  const result = await alerts.deleteOne({ id: 'HW-402890' }); // the Watch-tier alert has expired
  if (result.deletedCount === 1) console.log('Successfully deleted alert HW-402890.');
  else console.log('No matching alert, nothing deleted.');

  console.log('Alerts after delete :', await alerts.countDocuments());
  console.log('Remaining alert ids :', (await alerts.find({}, { projection: { _id: 0, id: 1, tier: 1 } }).toArray()).map((a) => `${a.id} (${a.tier})`).join(', '));
});
