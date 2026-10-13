// Minimal Open-Meteo helpers for fetching current temperatures and simple forecasts.
// Chosen API: Open-Meteo (https://open-meteo.com/) — free, public REST API, no
// API key or authentication header required for the endpoints used here.
// This file is the single place in the app that calls fetch() against a real
// server; every component that needs live weather data imports one of these
// three functions instead of calling fetch() itself, so the actual HTTP/URL
// details never leak into the UI code. The original dummy arrays are kept in
// the components as commented fallbacks so you can revert quickly during
// development or if the API is unreachable.

/**
 * Fetches the current weather for one location from Open-Meteo.
 * @param {number} lat  - latitude of the location
 * @param {number} lon  - longitude of the location
 * @returns {Promise<Object>} resolves to Open-Meteo's `current_weather` object
 *   (contains `temperature` in °C, `windspeed`, `winddirection`, `time`, ...)
 * @throws if the HTTP response status is not ok (e.g. network/server error)
 */
export async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }); // real network call — no API key needed
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const json = await res.json(); // parse the JSON response body
  // Open-Meteo returns temperature in °C as `current_weather.temperature`.
  return json.current_weather;
}

/**
 * Fetches current temperature for a list of cities in parallel and maps each
 * one to the { city, temp, tier } shape the app's UI (ticker/map) expects.
 * @param {Array<{city: string, lat: number, lon: number}>} cityList
 * @returns {Promise<Array<{city: string, temp: string, tier: string}>>}
 *   only successfully-fetched cities are included — a failed city is
 *   silently dropped so one bad request never breaks the whole list.
 */
export async function fetchTemperaturesForCities(cityList) {
  const promises = cityList.map(async (c) => {
    try {
      const w = await fetchCurrentWeather(c.lat, c.lon);
      const tempC = typeof w.temperature === "number" ? w.temperature : parseFloat(w.temperature);
      // derive a simple severity tier for display (matches the app's styling expectations)
      const tier = tempC >= 44 ? "emergency" : tempC >= 40 ? "warning" : tempC >= 38 ? "watch" : "safe";
      return { city: c.city, temp: `${tempC.toFixed(1)}°C`, tier };
    } catch (e) {
      // On error, return null so Promise.all below never rejects as a whole —
      // the caller can fall back to dummy/placeholder data for this one city.
      return null;
    }
  });

  const results = await Promise.all(promises); // wait for every city's request
  return results.filter(Boolean); // drop the failed (null) entries
}

/**
 * Fetches a short daily max-temperature forecast for one location.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} Open-Meteo's `daily` object, e.g.
 *   { time: [...dates], temperature_2m_max: [...values] }
 */
export async function fetchRegionForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  const json = await res.json();
  return json.daily;
}
