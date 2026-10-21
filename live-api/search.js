// Search over the stored cities. The matching itself runs inside MongoDB (see GET /api/search in server.js);
// this file only turns the text a user typed into a safe MongoDB filter.
//
// A city matches a word when the word appears in its name, state, region name, terrain or keywords
// (keywords include things people say, like "himalaya", "coastal", "hill station").
// Several words must ALL match (some field each), so "coastal tamil" finds Chennai.
export const SEARCH_FIELDS = ['name', 'state', 'regionName', 'terrain', 'tags'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // typed text is data, never a pattern

export function parseTerms(q) {
  return String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 40));
}

export function buildSearchFilter(q) {
  const terms = parseTerms(q);
  if (!terms.length) return null;
  return {
    $and: terms.map((term) => {
      const re = new RegExp(escapeRegex(term), 'i');
      return { $or: SEARCH_FIELDS.map((field) => ({ [field]: re })) };
    }),
  };
}
