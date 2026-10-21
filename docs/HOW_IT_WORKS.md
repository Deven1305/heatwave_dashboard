# How ClimateIntel works: frontend, backend and database explained simply

This guide explains the whole project in plain language. It is for someone who has never seen the code. For commands and the
API list, see the [README](../README.md).

---

## 1. The idea in one minute

India has hot summers, and heatwaves are dangerous. This project answers one question: **"How hot is it right now in each part of India,
how unusual is that, and what was it like before?"**

To do that it does four things:

1. **Collects** real weather for 30 cities from a free public website, **Open-Meteo**.
2. **Stores** every reading in a database, **MongoDB**, so history is never lost.
3. **Judges** the heat: is today's maximum just warm, or a real heatwave compared with what is normal for this city and date?
4. **Shows** it in a website (the **dashboard**), with charts, tables and automatic alerts.

Think of it like a school notebook:

| In the notebook | In the project |
|---|---|
| A student who measures the temperature every 30 minutes | the **collector** (backend) |
| The notebook pages | the **MongoDB database** |
| A teacher who reads the notebook and says "this is too hot" | the **severity logic** (backend) |
| The notice board where results are shown | the **React website** (frontend) |

## 2. The big picture

```
 ┌──────────────┐   every 30 min    ┌────────────────────────────┐   save / read   ┌────────────┐
 │  Open-Meteo  │ ────────────────► │  LIVE API  (backend)       │ ◄─────────────► │  MongoDB   │
 │ (public API) │   weather data    │  Node.js + Express         │                 │ (database) │
 └──────────────┘                   │  port 4300                 │                 └────────────┘
                                    └─────────────▲──────────────┘
                                                  │  asks for data (JSON over HTTP)
                                    ┌─────────────┴──────────────┐
                                    │  WEBSITE  (frontend)       │
                                    │  React + Vite, port 5173   │   ← what you see in the browser
                                    └────────────────────────────┘
```

Important rule: **the website never talks to Open-Meteo or MongoDB directly.** It only asks the live API. The live API is the only part that
touches the database and the outside weather service. This keeps the website simple and the data in one trusted place.

## 3. The three parts

| Part | Technology | Where in the project | Runs on |
|---|---|---|---|
| Frontend (what you see) | React 18, React Router, Vite, plain CSS | `src/` | http://localhost:5173 |
| Backend (the brain) | Node.js, Express, MongoDB driver | `live-api/` | http://localhost:4300 |
| Database (the memory) | MongoDB | database `climateintel_live` | port 27017 |

One command starts the first two: `npm run dev:all`. MongoDB runs by itself as a Windows service.

---

## 4. The database (MongoDB)

MongoDB stores **documents** (like small JSON cards) inside **collections** (like folders). The database is named `climateintel_live`.
There are six collections. You can look at them in MongoDB Compass at `mongodb://localhost:27017`.

### 4.1 `stations`: the 30 cities (30 documents)

One card per city. It also remembers the city's latest reading and its "normal" temperatures.

```json
{
  "_id": "mumbai",
  "name": "Mumbai",
  "regionId": "west-india",
  "lat": 19.08, "lon": 72.88,
  "terrain": "coastal",
  "latest": { "observedAt": "...", "tempC": 34.4, "apparentC": 38.0, "humidityPct": 48, "windKmh": 9.2 },
  "normalMax": [30.1, 30.2, ... 365 numbers, one per day of the year ...],
  "normalsMeta": { "years": "2019-2024", "source": "ERA5 reanalysis via Open-Meteo archive" }
}
```

`terrain` is `plains`, `coastal` or `hills`. It matters because each type has a different "too hot" threshold.

### 4.2 `observations`: every reading ever collected (grows all the time)

One card each time a city's current weather is saved. This is the **history of readings**. Nothing is ever overwritten.

```json
{ "stationId": "mumbai", "regionId": "west-india", "observedAt": "2026-10-21T06:45:00Z",
  "tempC": 34.4, "apparentC": 38.0, "humidityPct": 48, "windKmh": 9.2, "fetchedAt": "...", "source": "open-meteo" }
```

A rule in the database (a *unique index* on `stationId + observedAt`) makes it impossible to store the same reading twice.

### 4.3 `daily`: one card per city per day

The highest and lowest temperature of each day: the last 30 days, today, and the next 4 days (forecast).

```json
{ "stationId": "mumbai", "date": "2026-10-14", "tMaxC": 37.1, "tMinC": 27.3, "apparentMaxC": 41.0,
  "isForecast": false, "updatedAt": "..." }
```

`isForecast: true` means the day has not happened yet. Once the day passes, the next refresh overwrites it with the real value.
(That is why this collection updates, while `observations` only adds.)

### 4.4 `alerts`: heat warnings, kept as history

```json
{ "_id": "HW-20261014-282B12", "region": "West India", "tier": "Warning", "severity": "Heatwave",
  "message": "Heatwave conditions: Mumbai expects a maximum of 37.1 °C today (+6.2 °C from the normal 30.9 °C)...",
  "source": "auto", "status": "active", "issuedAt": "...", "clearedAt": null }
```

- `source`: `auto` (made by the system) or `manual` (typed by a user in the dashboard).
- `status`: `active`, `cleared` (the heat ended) or `superseded` (replaced by a stronger/weaker alert).
- Alerts are **never deleted**, so you can see the full history.

### 4.5 `reports`: observation reports from people

What the form at `/report` saves: observer name, region, temperature, severity, notes, an optional photo, and so on.
Email and phone are saved but never shown back to other people.

### 4.6 `fetch_log`: a diary of the collector

One card per collection run: when it ran, why (`startup`, `scheduled`, `manual`), whether it worked, how many rows it wrote, how long it took,
and the error if it failed. The **Data** tab in the dashboard shows this.

### 4.7 How the collections connect

```
stations ─┬─< observations   (stationId)
          ├─< daily          (stationId)
          └── regionId ────► the 7 regions (defined in code, not in the database)
alerts / reports ─── regionId ──► a region
fetch_log                       (stands alone)
```

---

## 5. The backend (`live-api/`)

The backend is a small Node.js program. It has **two jobs** that run side by side:

- **Job A, the collector:** fetch weather on a timer and save it.
- **Job B, the web server:** answer the website's questions from the database.

### 5.1 Files and what each one does

| File | Plain-English job |
|---|---|
| `config.js` | The settings: port, database name, refresh time, the **7 regions** and the **30 cities** with their coordinates. |
| `db.js` | Connects to MongoDB, creates the indexes (the "no duplicates" rules), and makes sure the 30 city cards exist. |
| `openmeteo.js` | Talks to Open-Meteo. Handles timeouts, retries, and the free plan's rate limits (waits a minute if told to slow down). |
| `severity.js` | The "teacher": decides Normal / Hot Day / Heatwave / Severe Heatwave. Also builds the normal temperatures and handles India time. Pure maths, no database. |
| `collector.js` | Runs the cycle: fetch → save → make sure normals exist → raise or clear alerts. Also the 30-minute timer. |
| `queries.js` | Reads MongoDB and prepares ready-to-show answers (overview, region history, 14-day trends, stats). |
| `server.js` | The web server (Express). Defines every URL the website can ask, checks input, and returns JSON. |
| `severity.test.js`, `openmeteo.test.js` | Automatic tests (`npm test`). |

### 5.2 What happens when the backend starts

1. Connect to MongoDB. If it is not running, stop with a clear message.
2. Create indexes and make sure the 30 stations exist.
3. Look at `fetch_log`. If the last successful collection is **older than 30 minutes**, collect now. Otherwise just serve stored data.
4. Start the web server on port 4300 and set a timer to collect again every 30 minutes.

### 5.3 One collection cycle, step by step

```
1. FETCH     one request to Open-Meteo for all 30 cities:
             current weather + daily values for the last 30 days + forecast.
2. SAVE      observations : add the new reading for each city (skip if already stored)
             daily        : add or update the daily rows
             stations     : remember each city's latest reading
3. NORMALS   if a city has no "normal" yet, download 6 years of daily highs (2019-2024),
             average each calendar day (smoothed ±7 days) and store 365 numbers.
             This happens only once per city.
4. ALERTS    judge every city, give each region the level of its worst city,
             compare with the region's last alert:
               level changed and > 0  → write a new alert (old one becomes superseded)
               level back to 0        → mark the active alert as cleared
5. LOG       write one card in fetch_log.
```

### 5.4 How heat is judged (the "teacher")

For each city, take **today's maximum temperature** and compare it with the city's **normal maximum for this date**.

| Level | Rule (a city must be at or above its threshold) |
|---|---|
| Normal | below the threshold, or less than 3 °C above normal |
| Hot Day | 3 °C or more above normal |
| Heatwave | 4.5 °C or more above normal |
| Severe Heatwave | 6.5 °C or more above normal |

Thresholds: **plains 40 °C, coastal 37 °C, hills 30 °C.** Plains cities are also Heatwave at 45 °C and Severe at 47 °C regardless of normal.

A **region** takes the level of its worst city. The levels map to alert tiers: Hot Day → *Watch*, Heatwave → *Warning*,
Severe Heatwave → *Emergency*, Normal → *Safe* (no alert).

Example: Mumbai is coastal (threshold 37). On a day with a 37.1 °C maximum where normal is 30.9 °C, the difference is +6.2 °C → **Heatwave**.
A city at 36 °C is Normal even if that is +5 above normal, because it is below its threshold.

### 5.5 The URLs the backend offers (REST API)

The website "asks questions" by visiting these addresses. Each answers with JSON.

| Question | URL |
|---|---|
| Is the backend alive? | `GET /api/health` |
| What is the current picture? | `GET /api/overview` |
| History of one region | `GET /api/regions/west-india/history?days=30` |
| History of one city | `GET /api/stations/mumbai/history?hours=72` |
| List alerts | `GET /api/alerts?status=active` |
| Add an alert | `POST /api/alerts` |
| Clear an alert | `POST /api/alerts/:id/clear` |
| List / add reports | `GET /api/reports`, `POST /api/reports` |
| What is stored? / refresh log | `GET /api/stats`, `GET /api/runs` |
| Collect now | `POST /api/refresh` (once a minute at most) |

`GET` means "give me data". `POST` means "here is new data, please save it". Bad input gets a `400` answer with the reason, a missing item gets `404`,
and a problem inside the server gets `500`.

---

## 6. The frontend (`src/`)

The frontend is a **React** app. React builds the page from small reusable pieces called components. **Vite** serves it while you develop.

### 6.1 How the page starts

```
index.html → src/main.jsx → src/App.jsx
```

`App.jsx` wraps everything in a **LiveDataProvider**, shows the navigation bar and the scrolling ticker on top, the footer at the bottom, and in the middle
the **page for the current address** (React Router picks it).

### 6.2 The shared data: `src/context/LiveData.jsx`

Many parts of the page need the same data (ticker, home, dashboard). Instead of each one asking the backend, one **provider** asks once
(`/api/overview`), keeps the answer, and re-asks every 5 minutes. Any component can read it with `useLive()`. If the backend is down, the last data stays on
screen with a warning.

### 6.3 Pages (`src/pages/`)

| Address | File | What it shows |
|---|---|---|
| `/` | `Home.jsx` | Headline "right now" card, a chip per region, how it works, links |
| `/dashboard` | `Dashboard.jsx` + `dashboard/*` | The main app with 7 tabs (below) |
| `/report` | `ReportForm.jsx` | A long validated form; saves to the database |
| `/login`, `/register` | `Login.jsx`, `Register.jsx` | Form-validation demos (no real login) |
| `/editing-demo`, `/stay-on-page` | `InPageEditing.jsx`, `StayOnPage.jsx` | Lab demos |
| `/m` | `MobileHome.jsx` | Phone-style list of alerts |
| anything else | `NotFound.jsx` | 404 page |

### 6.4 The dashboard tabs (`src/pages/dashboard/`)

The tab is kept in the address, e.g. `/dashboard?tab=regions&region=west-india`, so links can be shared and the back button works.

| Tab | File | Shows | Data it uses |
|---|---|---|---|
| Overview | `Overview.jsx` | 5 headline numbers, a card per region with a 14-day sparkline, hottest cities, latest alerts | `/api/overview`, `/api/alerts` |
| Regions | `Regions.jsx` | Chart of the last 30 days (hottest city, region average, normal), forecast shading, day-by-day table | `/api/regions/:id/history` |
| Stations | `Stations.jsx` | Table of 30 cities; pick one for its daily max/min chart and stored readings | `/api/stations/:id/history` |
| Alerts | `Alerts.jsx` | Active alerts or full history; form to add an alert; clear your own | `/api/alerts` |
| Reports | `Reports.jsx` | Reports people submitted | `/api/reports` |
| Forecast | `Forecast.jsx` | Expected daily max for the next days per region | stored forecast in `/api/overview` |
| Data | `DataTab.jsx` | What MongoDB holds, recent refresh runs, how numbers are made | `/api/stats`, `/api/runs` |

### 6.5 Building blocks (`src/components/`)

| Component | Job |
|---|---|
| `live/LineChart.jsx` | Draws the charts as SVG with no chart library. Adjusts to the container width, shows a tooltip on hover and shades the forecast. |
| `live/Sparkline.jsx` | The tiny trend line on region cards. |
| `live/ui.jsx` | Shared table, stat card, loading and error boxes, severity badge. |
| `Badge.jsx` | The coloured label (SAFE / WATCH / WARNING / EMERGENCY). |
| `Navbar.jsx`, `Ticker.jsx`, `Footer.jsx` | The frame around every page. The ticker scrolls the latest stored reading of every city. |

### 6.6 The API client: `src/api/live.js`

The one place that knows the backend's address (`http://localhost:4300`). It has a function per question (`liveApi.overview()`, `liveApi.createAlert()`...), turns failures into readable
messages, and has small helpers for formatting temperatures and times ("12 min ago").

### 6.7 Styling

`styles/global.css` holds the base look (dark navy theme, buttons, forms). `styles/live.css` holds the dashboard and home page styles; every class there starts with `lv-`.

---

## 7. Follow one reading from the sky to your screen

1. **06:45 UTC** Open-Meteo has a new value for Mumbai: 34.4 °C.
2. The collector's 30-minute timer fires and asks Open-Meteo for all 30 cities.
3. The collector adds a card to `observations`, updates today's card in `daily`, and updates `stations.mumbai.latest`.
4. It judges every city. West India's worst city is now Normal, so the active West India alert is marked `cleared`.
5. You open the dashboard. React asks `GET /api/overview`.
6. The backend reads `stations`, today's `daily` rows and the 14-day trend from MongoDB, applies the severity rules and returns one JSON answer.
7. React draws the region cards, ticker and numbers. Five minutes later it asks again, silently.

If you press **Fetch latest data**, steps 2 to 4 run immediately (`POST /api/refresh`), then step 5 onward.

## 8. What survives what

| Event | Result |
|---|---|
| You refresh the browser | Same data again, read from MongoDB |
| You stop and start the backend | History is intact; if the last collection is older than 30 minutes it collects at once and fills any gap (the past 30 days come with every fetch) |
| MongoDB is stopped | The backend refuses to start and says why |
| Open-Meteo is unreachable | Stored data keeps working; the failed run is logged; the next timer tries again |
| You drop the database | It rebuilds itself on the next start, from the last 30 days onward |

## 9. Honest limits

- The numbers are **model data for one point per city**, not readings from official weather stations.
- "Normal" is a **6-year average** (2019–2024), not the official 30-year normal.
- The heat levels follow the IMD heatwave idea but are **indicative, not official warnings**.
- In October most cities are normal, so there may be no alerts. That is real, not a bug.
- Everything is built for local use: no passwords, open access to the API. Add authentication before putting it on the internet.

## 10. Glossary

| Word | Meaning |
|---|---|
| **API** | A set of web addresses that return data instead of pages |
| **REST** | The style of using `GET`, `POST`... on addresses like `/api/alerts` |
| **JSON** | The text format of the data: `{ "name": "Mumbai", "tempC": 34.4 }` |
| **Collection / document** | MongoDB's word for a folder / a card inside it |
| **Index** | A rule or shortcut in the database; a *unique* index forbids duplicates |
| **Collector** | The backend job that fetches and saves weather |
| **Normal** | The usual maximum temperature for a city on a date (an average of past years) |
| **Departure** | Today's maximum minus the normal; `+6.2 °C` means 6.2 degrees hotter than usual |
| **Frontend / backend** | What runs in your browser / what runs on the server |
| **Component** | A reusable piece of the page in React |
| **Context** | React's way of sharing data with many components at once |
| **Vite** | The tool that serves and builds the React app |
| **ERA5** | A well-known worldwide weather record (reanalysis) used here for the normals |
| **IMD** | India Meteorological Department |

## 11. Where to change things

| I want to... | Edit |
|---|---|
| Add or move a city or region | `live-api/config.js` |
| Change the heat thresholds | `live-api/severity.js` (and its test) |
| Collect more or less often | `REFRESH_MINUTES` (see `.env.example`) |
| Add a dashboard tab | a new file in `src/pages/dashboard/`, then `Dashboard.jsx` and `Navbar.jsx` |
| Add a new API address | `live-api/server.js` (and a function in `src/api/live.js`) |
| Change colours | `src/styles/live.css` and the `:root` variables at the top |
