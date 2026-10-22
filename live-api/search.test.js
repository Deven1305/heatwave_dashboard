import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchFilter, buildTextFilter, normalizeAlertQuery, parseTerms, REPORT_FIELDS } from './search.js';

test('parseTerms lowercases, splits on spaces and limits the input', () => {
  assert.deepEqual(parseTerms('  Himalaya   SHIMLA '), ['himalaya', 'shimla']);
  assert.deepEqual(parseTerms(''), []);
  assert.deepEqual(parseTerms(undefined), []);
  assert.equal(parseTerms('a b c d e f g').length, 5);
  assert.equal(parseTerms('x'.repeat(100))[0].length, 40);
});

test('an empty search has no filter', () => {
  assert.equal(buildSearchFilter('   '), null);
});

test('every word must match some field, and each field is searched', () => {
  const f = buildSearchFilter('coastal tamil');
  assert.equal(f.$and.length, 2);
  assert.deepEqual(f.$and[0].$or.map((c) => Object.keys(c)[0]), ['name', 'state', 'regionName', 'terrain', 'tags']);
});

test('typed characters cannot act as a regular expression', () => {
  const [{ $or }] = buildSearchFilter('a.b(').$and;
  const re = $or[0].name;
  assert.ok(re.test('A.B('));
  assert.ok(!re.test('AxB('));
});

test('buildTextFilter searches exactly the fields it is given', () => {
  const f = buildTextFilter('heat', ['region', 'message']);
  assert.deepEqual(f.$and[0].$or.map((c) => Object.keys(c)[0]), ['region', 'message']);
  assert.equal(buildTextFilter('', ['region']), null);
});

test('reporter contact details are never searchable', () => {
  assert.ok(!REPORT_FIELDS.includes('email'));
  assert.ok(!REPORT_FIELDS.includes('phone'));
});

test('alert wording on screen maps to stored values', () => {
  assert.equal(normalizeAlertQuery('Automatic warning'), 'auto warning');
  assert.equal(normalizeAlertQuery('Recorded by a user'), 'manual');
  assert.equal(normalizeAlertQuery('user warning'), 'manual warning');
});
