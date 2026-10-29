// Tests how the Open-Meteo client behaves when Open-Meteo says "slow down" or "bad request".
// fetch is swapped for a fake that returns the answers we want, so no internet is used and nothing waits a real minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDailyMaxHistory, setRateLimitWait } from './openmeteo.js';

const respond = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const station = [{ lat: 28.6, lon: 77.2 }];
const okBody = [{ daily: { time: ['2024-01-01'], temperature_2m_max: [20] } }];

test('an hourly quota error stops at once and is flagged as rateLimited', async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return respond(429, { error: true, reason: 'Hourly API request limit exceeded. Please try again in the next hour.' }); };
  try {
    await assert.rejects(fetchDailyMaxHistory(station, 2019, 2024), (e) => e.rateLimited === 'hourly');
    assert.equal(calls, 1); // no pointless retries
  } finally { globalThis.fetch = real; }
});

test('a per-minute limit waits and then succeeds', async () => {
  const real = globalThis.fetch;
  setRateLimitWait(5);
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? respond(429, { error: true, reason: 'Minutely API request limit exceeded. Please try again in one minute.' }) : respond(200, okBody));
  try {
    const result = await fetchDailyMaxHistory(station, 2019, 2024);
    assert.deepEqual(result[0].values, [20]);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = real; setRateLimitWait(62000); }
});

test('a client error (400) is not retried', async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return respond(400, { error: true, reason: 'bad request' }); };
  try {
    await assert.rejects(fetchDailyMaxHistory(station, 2019, 2024), /HTTP 400/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = real; }
});
