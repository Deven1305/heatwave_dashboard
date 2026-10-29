// Tests for the heat rules in severity.js. Run them with `npm test` (Node's own test runner, nothing to install).
// If you change a threshold or a rule on purpose, the matching test here should fail first: update it to the new rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, dayIndex, buildNormals, istDate, parseIst, normalFor } from './severity.js';

test('plains: below 40 C is never a heat event', () => {
  assert.equal(classify(39.9, 30, 'plains').level, 0);
});

test('plains: departure decides hot day / heat wave / severe heat wave', () => {
  assert.equal(classify(40.5, 38, 'plains').level, 0); // +2.5
  assert.equal(classify(41.5, 38, 'plains').severity, 'Hot Day'); // +3.5
  assert.equal(classify(41, 35, 'plains').severity, 'Heatwave'); // +6.0 (>= 4.5)
  assert.equal(classify(42, 34.5, 'plains').severity, 'Severe Heatwave'); // +7.5 (>= 6.5)
});

test('plains: absolute 45 C / 47 C count even when the normal is high', () => {
  assert.equal(classify(45, 44, 'plains').severity, 'Heatwave');
  assert.equal(classify(47.1, 46.5, 'plains').severity, 'Severe Heatwave');
});

test('coastal and hills use their own thresholds', () => {
  assert.equal(classify(38, 31, 'coastal').severity, 'Severe Heatwave'); // threshold 37
  assert.equal(classify(36, 30, 'coastal').level, 0); // below 37
  assert.equal(classify(31, 25, 'hills').severity, 'Heatwave'); // threshold 30, +6
  assert.equal(classify(47, 46, 'hills').level, 0); // 47 C absolute rule is plains only
});

test('missing data is handled', () => {
  assert.equal(classify(null, 30).level, 0);
  assert.equal(classify(41, null, 'plains').severity, 'Hot Day'); // no normal: cannot say more than "hot"
  assert.equal(classify(41, null, 'plains').departureC, null);
});

test('tier names follow the level', () => {
  assert.deepEqual([0, 1, 2, 3].map((n) => ['Safe', 'Watch', 'Warning', 'Emergency'][n]), ['Safe', 'Watch', 'Warning', 'Emergency']);
  assert.equal(classify(42, 34.5, 'plains').tier, 'Emergency');
});

test('dayIndex ignores the year and maps 29 Feb to 28 Feb', () => {
  assert.equal(dayIndex('2023-01-01'), 0);
  assert.equal(dayIndex('2024-02-29'), dayIndex('2024-02-28'));
  assert.equal(dayIndex('2023-12-31'), 364);
  assert.equal(dayIndex('2023-03-01'), 59);
});

test('buildNormals averages the same calendar day over the years', () => {
  const dates = ['2020-06-10', '2021-06-10', '2022-06-10'];
  const normals = buildNormals(dates, [40, 42, 44], 0); // no smoothing
  assert.equal(normals[dayIndex('2023-06-10')], 42);
  assert.equal(normals[dayIndex('2023-01-01')], null);
  assert.equal(buildNormals(dates, [40, 42, 44]).length, 365);
  assert.equal(normalFor({ normalMax: normals }, '2025-06-10'), 42);
});

test('IST helpers', () => {
  assert.equal(istDate(new Date('2026-10-14T20:00:00Z')), '2026-10-15'); // 01:30 IST next day
  assert.equal(istDate(new Date('2026-10-14T10:00:00Z')), '2026-10-14');
  assert.equal(parseIst('2026-10-14T12:15').toISOString(), '2026-10-14T06:45:00.000Z');
});
