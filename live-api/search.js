// Search over the stored cities. The matching itself runs inside MongoDB (see GET /api/search in server.js);
// this file only turns the text a user typed into a safe MongoDB filter.
//
// A city matches a word when the word appears in its name, state, region name, terrain or keywords
// (keywords include things people say, like "himalaya", "coastal", "hill station").
// Several words must ALL match (some field each), so "coastal tamil" finds Chennai.
const SEARCH_FIELDS = ['name', 'state', 'regionName', 'terrain', 'tags'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // typed text is data, never a pattern

export function parseTerms(q) {
  return String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 40));
}

/**
 * Turns the text a user typed into a MongoDB filter: every word must appear (case-insensitive) in at least one
 * of `fields`. Returns null for an empty search, so callers can simply skip filtering.
 */
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

// The three searches the dashboard offers. Reporter email and phone are deliberately NOT searchable.
export const buildSearchFilter = (q) => buildTextFilter(q, SEARCH_FIELDS); // cities (Stations / Regions / Overview / Forecast)
export const ALERT_FIELDS = ['region', 'message', 'tier', 'severity', 'status', 'source'];
export const REPORT_FIELDS = ['region', 'plotId', 'status', 'observerName', 'notes', 'confidence'];

// Alerts store source as "auto" / "manual" but the screen says "Automatic" / "Recorded by a user":
// map the words people read to the values we store.
export const normalizeAlertQuery = (q) => String(q ?? '')
  .replace(/automatic/gi, 'auto')
  .replace(/recorded by a user/gi, 'manual') // the exact label shown in the table
  .replace(/\b(?:user|recorded)\b/gi, 'manual');
