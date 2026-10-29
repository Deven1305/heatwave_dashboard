// Search. When someone types in a search box, the browser sends that text to the backend and MongoDB
// does the matching. This file only turns the typed text into a MongoDB filter, and does it carefully
// because the text comes from a user and can't be trusted.
//
// How it matches: the text is split into words. Every word has to appear somewhere in the document
// (in any of the fields we look at), so "coastal tamil" finds Chennai: "coastal" is in its keywords
// and "tamil" is in its state. Case doesn't matter.
const SEARCH_FIELDS = ['name', 'state', 'regionName', 'terrain', 'tags']; // the fields a city is searched on
// Puts a backslash in front of every character that means something in a regular expression.
// Without this, typing "(" or "*" would be read as a pattern: it could crash the query or match the wrong things.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // typed text is data, never a pattern

// "  Himalaya  SHIMLA " -> ['himalaya', 'shimla']. Capped at 5 words of 40 letters so nobody can send the database a monster query.
export function parseTerms(q) {
  return String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 40));
}

// Builds the filter: for each word, "this word is in field A OR field B OR ...", and all the words
// have to pass (AND). Returns null for an empty search, which the callers read as "don't filter".
export function buildTextFilter(q, fields) {
  const terms = parseTerms(q);
  if (!terms.length) return null;
  return {
    $and: terms.map((term) => {
      const re = new RegExp(escapeRegex(term), 'i');
      return { $or: fields.map((field) => ({ [field]: re })) };
    }),
  };
}

// The three searches we offer. Look at what is NOT in the lists: reporters' email and phone number
// can never be searched, so nobody can find a person by typing their number.
export const buildSearchFilter = (q) => buildTextFilter(q, SEARCH_FIELDS); // cities (used by Stations, Regions, Overview, Forecast)
export const ALERT_FIELDS = ['region', 'message', 'tier', 'severity', 'status', 'source'];
export const REPORT_FIELDS = ['region', 'plotId', 'status', 'observerName', 'notes', 'confidence'];

// In the database an alert's source is "auto" or "manual", but the table shows "Automatic" and
// "Recorded by a user". If someone searches with the words they can see, translate them to what is stored.
export const normalizeAlertQuery = (q) => String(q ?? '')
  .replace(/automatic/gi, 'auto')
  .replace(/recorded by a user/gi, 'manual') // the exact label shown in the table
  .replace(/\b(?:user|recorded)\b/gi, 'manual');
