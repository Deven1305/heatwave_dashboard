# ClimateIntel — Live Heatwave Monitoring for India (KJS-CES-01)

A full-stack project that collects **real weather data** for 30 Indian cities from the free, public
[Open-Meteo](https://open-meteo.com) API, **stores it in MongoDB**, classifies heat conditions with IMD-style heatwave
rules, raises automatic alerts, and shows everything in a React dashboard, today's picture **and the days before it**.

- **No dummy data on the dashboard.** Every number comes from Open-Meteo, is saved in MongoDB, and is read back from there.
- **No API key, no account.** Open-Meteo is free for non-commercial use; the data licence is CC BY 4.0.
- **History survives refreshes and restarts.** Reload the page, or stop and restart the server: the stored readings are still there.

> Coursework prototype (Web Programming-II lab, collaborating organisation in the use case: India Meteorological Department).
> The values are model data for one point per city, **not** measurements from IMD weather stations, and the heat levels are an
> indicative classification, **not** an official warning. Use IMD bulletins for real decisions.

---

## Table of contents

1. [Screenshots](#1-screenshots)
2. [What it does](#2-what-it-does)
3. [Quick start (commands)](#3-quick-start-commands)
4. [MongoDB setup](#4-mongodb-setup)
5. [How the data flows](#5-how-the-data-flows)
6. [The data model (collections)](#6-the-data-model-collections)
7. [How the numbers are made](#7-how-the-numbers-are-made)
8. [Dashboard pages](#8-dashboard-pages)
9. [REST API reference](#9-rest-api-reference)
10. [Configuration](#10-configuration)
11. [Folder structure](#11-folder-structure)
12. [Tests](#12-tests)
13. [The lab back ends (Exp-5, 6, 7)](#13-the-lab-back-ends-exp-5-6-7)
14. [Security and privacy](#14-security-and-privacy)
15. [Troubleshooting](#15-troubleshooting)
16. [Further documentation](#16-further-documentation)

---

## 1. Screenshots

| Home | Overview |
|---|---|
| ![Home](docs/screenshots/home.png) | ![Overview](docs/screenshots/overview.png) |

| Regions: 30-day history, normal, forecast | Stations: stored readings |
|---|---|
| ![Regions](docs/screenshots/regions.png) | ![Stations](docs/screenshots/stations.png) |

| Alerts | Forecast |
|---|---|
| ![Alerts](docs/screenshots/alerts.png) | ![Forecast](docs/screenshots/forecast.png) |

| Data: what MongoDB holds | Observation report form |
|---|---|
| ![Data](docs/screenshots/data.png) | ![Report form](docs/screenshots/report-form.png) |

| Login | Mobile companion (`/m`) |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Mobile](docs/screenshots/mobile.png) |

## 2. What it does

- Fetches current weather, the past 30 days and a 5-day forecast (today + 4) for **30 cities in 7 regions** every 30 minutes.
- Saves every reading in MongoDB, so the history grows over time and is never overwritten.
- Compares each city's daily maximum with **its own multi-year normal** and classifies it: Normal, Hot Day, Heatwave, Severe Heatwave.
- Raises an **automatic alert** per region when the level changes, and marks it cleared when the region returns to normal. All alerts stay as history.
- Dashboard with seven tabs: Overview, Regions, Stations, Alerts, Reports, Forecast, Data.
- Lets users **record their own alerts** and **submit observation reports** (validated, stored in MongoDB).
- Mobile companion page, a live ticker, and a clear "data" tab that shows exactly what is stored and how it is computed.

## 3. Quick start (commands)

Requirements: **Node.js 18+** (developed on Node 20), **MongoDB** running locally (see section 4), an internet connection.

Open a terminal in this folder and run:

```bash
npm install          # first time only
npm run dev:all      # starts the live API (port 4300) and the React app (port 5173)
```

Then open **http://localhost:5173**.

On the very first start the API fetches the data and computes each city's normal from 6 years of history (about 1 to 3 minutes, because the free
Open-Meteo API limits requests per minute and per hour). The dashboard works immediately; heat levels appear once the normals are ready.
Press `Ctrl+C` to stop both.

| Command | What it does |
|---|---|
| `npm run dev:all` | Live API + React app together (the normal way to run the project) |
| `npm run live` | Only the live API (port 4300) |
| `npm run dev` | Only the React app (port 5173) |
| `npm test` | Unit tests for the heat classification and date helpers |
| `npm run build` / `npm run preview` | Production build / serve the build |

Handy checks while it runs:

```bash
curl http://localhost:4300/api/health      # {"status":"ok","mongo":"connected",...}
curl http://localhost:4300/api/overview    # regions, cities, stored-data stats
curl -X POST http://localhost:4300/api/refresh   # fetch from Open-Meteo right now (once a minute at most)
```

## 4. MongoDB setup

The live API needs a MongoDB server. Nothing else has to be configured: the database and collections are created automatically.

1. **Install MongoDB Community Server** and let it run as a service on port **27017**
   (Windows: the service is named `MongoDB`; check with `Get-Service MongoDB` in PowerShell).
   Alternative with Docker: `docker run -d -p 27017:27017 --name mongo mongo`.
2. **Start the project** (`npm run dev:all`). The API creates the database **`climateintel_live`**, its indexes and the 30 city records.
3. **See the data** in MongoDB Compass: connect to `mongodb://localhost:27017` and open `climateintel_live`.
   Collections: `observations`, `daily`, `stations`, `alerts`, `reports`, `fetch_log`.
4. **Another MongoDB?** Set `MONGO_URI` (for example an Atlas connection string) before starting. Never commit a connection string
   that contains a password; keep it in a git-ignored `.env`.

If MongoDB is not running, the API stops with a clear message instead of failing silently.

## 5. How the data flows

```
Open-Meteo (public API) ──every 30 min──► live API (Node + Express, port 4300) ──► MongoDB "climateintel_live"
                                                   ▲                                        │
                                                   └──────────── reads everything ──────────┘
                                                   │
                                          React app (port 5173)   ← the browser never calls Open-Meteo itself
```

1. **Collect.** On start, and every 30 minutes (`REFRESH_MINUTES`), the collector makes one request to Open-Meteo for all 30 cities.
   If the last successful run was less than 30 minutes ago, it serves the stored data and waits.
2. **Store.** New readings are inserted (never overwritten); daily rows are updated as a day completes; every run is logged.
3. **Evaluate.** Each city is classified against its normal; each region takes the level of its worst city; alerts are raised or cleared.
4. **Serve.** The React app asks the live API, which answers from MongoDB. The "Fetch latest data" button asks the API to collect right now.

## 6. The data model (collections)

| Collection | One document per | Contents |
|---|---|---|
| `stations` | monitoring city (30) | name, region, coordinates, terrain, latest reading, 365 "normal" daily maxima |
| `observations` | city and reading time | temperature, feels-like, humidity, wind, when it was observed and fetched. **Grows with every refresh** |
| `daily` | city and date | daily max/min/feels-like max; 30 past days plus today and 4 forecast days; `isForecast` flag |
| `alerts` | alert | region, level, message, source (`auto` or `manual`), status (`active`, `cleared`, `superseded`), times |
| `reports` | submitted report | the observation form data, optional image |
| `fetch_log` | refresh run | when, trigger, success, rows written, duration, error |

Indexes make `(stationId, observedAt)` and `(stationId, date)` unique, so a reading can never be stored twice.

## 7. How the numbers are made

- **Source.** Open-Meteo forecast API (current weather + daily values) and its archive API (ERA5 reanalysis, for the normals).
  Time zone is India Standard Time. 30 cities, 4 to 6 per region, one model point each.
- **Normal.** For each city and calendar day, the average daily maximum over **2019–2024**, smoothed over ±7 days
  (a 6-year average, not IMD's official 30-year normal). Computed once on first start and stored. Open-Meteo's free tier allows about
  5,000 weighted calls per hour and 6 years for 30 cities uses about 4,700, which is why the period is not longer; set `NORMAL_START_YEAR`
  (for example `2015`) for a longer one, and the normals then complete over two hours.
- **Classification** (modelled on the IMD heat-wave criteria):

  | Level | Rule |
  |---|---|
  | Hot Day | maximum at or above the threshold and **3 °C or more** above normal |
  | Heatwave | at or above the threshold and **4.5 °C or more** above normal |
  | Severe Heatwave | at or above the threshold and **6.5 °C or more** above normal |

  Threshold by terrain: **plains 40 °C, coastal 37 °C, hills 30 °C**. Plains cities also count by absolute value: 45 °C = Heatwave, 47 °C = Severe.
- **Region level.** The level of its worst city (highest level, then biggest departure). The region card shows that city.
- **Alert tiers.** Hot Day → Watch, Heatwave → Warning, Severe Heatwave → Emergency; Normal → Safe (no alert).
- **"Today's max"** is the larger of Open-Meteo's expected maximum for today and the latest reading.
- **Seasonality.** Outside the hot season most cities are normal and there may be no alerts. That is the real situation, not a fault.

## 8. Dashboard pages

| Tab (`/dashboard?tab=…`) | Shows |
|---|---|
| `overview` | Five headline numbers, a card per region (with a 14-day sparkline), hottest cities right now, latest alerts |
| `regions` | Pick a region: 30-day chart of the hottest city, region average and normal, a day-by-day table, and the region's cities |
| `stations` | Table of all 30 cities; select one for its 30-day daily max/min chart and stored readings |
| `alerts` | Active alerts or the full history; form to record an alert; clear your own alerts |
| `reports` | Observation reports stored in MongoDB (contact details are hidden) |
| `forecast` | Expected daily maximum for the next days in every region, with the heat level it implies |
| `data` | Row counts in MongoDB, first/last reading, recent refresh runs, and the method |

Other routes: `/` home, `/report` observation form, `/login`, `/register`, `/editing-demo`, `/stay-on-page` (lab demos), `/m` mobile companion.
Deep links work, for example `/dashboard?tab=regions&region=west-india` or `/dashboard?tab=stations&station=mumbai`.

## 9. REST API reference

Base URL `http://localhost:4300`. All responses are JSON; errors look like `{ "error": "…" }` or `{ "errors": ["…"] }`.

| Method & path | Description |
|---|---|
| `GET /api/health` | Pings MongoDB |
| `GET /api/overview` | Regions (with 14-day trend and forecast), cities, summary numbers, stored-data stats |
| `GET /api/regions/:id/history?days=30` | Daily series for a region (1–90 days, includes forecast) |
| `GET /api/stations/:id/history?hours=48` | Stored readings (up to 90 days) and all daily rows for a city |
| `GET /api/alerts?status=active&limit=100` | Alerts, newest first |
| `POST /api/alerts` | Record an alert `{ region, tier, message, channel? }` → 201, or 400 with the reasons |
| `POST /api/alerts/:id/clear` | Mark an alert cleared → 200 / 404 |
| `GET /api/reports` | Observation reports (no email/phone, no image data) |
| `POST /api/reports` | Save a report (validated; region must be one of the 7) → 201 / 400 |
| `GET /api/reports/:id/photo` | The report's image, if any |
| `GET /api/stats` | Collection counts and first/last reading |
| `GET /api/runs?limit=20` | The refresh log |
| `POST /api/refresh` | Collect now → 200 with a summary, 429 if called again within a minute, 502 if Open-Meteo is unreachable |

Region ids: `north-west-india`, `north-east-india`, `east-india`, `central-india`, `west-india`, `south-interior-peninsula`, `south-coastal`.

```bash
curl -X POST http://localhost:4300/api/alerts -H "Content-Type: application/json" \
  -d '{"region":"West India","tier":"Warning","message":"Avoid outdoor work 12-4 pm"}'
```

## 10. Configuration

Everything has a working default; a `.env` file is **not** required. To change something, copy [.env.example](.env.example) to `.env`.

| Variable | Default | Meaning |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `LIVE_DB_NAME` | `climateintel_live` | Database name |
| `LIVE_API_PORT` | `4300` | Live API port |
| `REFRESH_MINUTES` | `30` | How often the API collects from Open-Meteo |
| `NORMAL_START_YEAR` | `2019` | First year of the period (to 2024) used for each city's normal |
| `VITE_LIVE_API_URL` | `http://localhost:4300` | Where the React app finds the API |

Fixed in [live-api/config.js](live-api/config.js): the 30 cities, the 7 regions, days of history/forecast, the normal period.

## 11. Folder structure

```
├── live-api/                    Live backend (Node + Express + MongoDB)
│   ├── server.js                REST API, validation, error handling
│   ├── collector.js             fetch → store → normals → alerts, and the scheduler
│   ├── openmeteo.js             Open-Meteo client (timeouts, retries, rate-limit wait)
│   ├── queries.js               overview, history, trends, stats
│   ├── severity.js              classification, normals, IST helpers (pure functions)
│   ├── severity.test.js         unit tests (npm test)
│   ├── db.js, config.js         connection and indexes / settings, cities, regions
├── src/                         React app
│   ├── api/live.js              the only API client (talks to live-api)
│   ├── context/LiveData.jsx     shared overview data, re-read every 5 minutes
│   ├── pages/                   Home, Dashboard, ReportForm, Login, Register, MobileHome, demos
│   │   └── dashboard/           Overview, Regions, Stations, Alerts, Reports, Forecast, DataTab
│   ├── components/              Navbar, Ticker, Footer, Badge, InPageEdit
│   │   └── live/                LineChart, Sparkline, shared table/stat components
│   └── styles/                  global.css (base) + live.css (dashboard and home)
├── api/  api-express/  api-mongo/   lab back ends from Exp-5/6/7 (sample data, not used by the dashboard)
├── scripts/dev-all.js           starts live-api + Vite together
├── docs/screenshots/            images used in this README
└── *.md                         design and concept notes (section 16)
```

## 12. Tests

```bash
npm test      # 9 unit tests: heat levels for plains/coastal/hills, absolute 45/47 °C rule, missing data,
              # normals averaging and smoothing, 29 February handling, India-time helpers
npm run build # compiles the React app
```

The collector, MongoDB queries and every dashboard tab were also checked against the real Open-Meteo API and a real MongoDB:
a fetch stores new readings, a browser reload shows the same totals, a restart keeps the history, forms save to the database.

## 13. The lab back ends (Exp-5, 6, 7)

These were written for the lab experiments and are **kept for reference**. They use deliberately small **sample data** and the dashboard no longer
uses them.

| Folder | Port | Technique | Run |
|---|---|---|---|
| `api/` | 8100 | Node core `http`, `url`, `fs/promises`; irrigation sample data | `npm run api` |
| `api-express/` | 4100 | Express Router, JSON files, validation | `npm run api-express` |
| `api-mongo/` | 4200 | Express + MongoDB CRUD scripts (database `climateintel`, separate from the live one) | `npm run mongo:create`, `mongo:read`, `mongo:update`, `mongo:delete`, `api-mongo` |

See [api/README.md](api/README.md) for the Node core API routes.

## 14. Security and privacy

- No API keys, passwords or tokens exist in the code; Open-Meteo needs none. `.env` files are git-ignored.
- Reporter **email and phone are stored but never returned** by the reports list; the form data is validated on the server too.
- Uploaded images are limited to JPEG/PNG/WebP up to 7 MB.
- **Local development setup:** CORS is open and MongoDB runs without a password. Before any public deployment, restrict origins,
  enable MongoDB authentication, and add authentication to the write endpoints (alerts, reports, refresh).
- The Login and Register pages are validation demos; there is no real authentication.
- Please keep the Open-Meteo attribution (it is shown on the dashboard and in the footer) and respect their free-tier limits.

## 15. Troubleshooting

| Problem | Fix |
|---|---|
| "The live data service is not reachable" | Start it: `npm run dev:all` (or `npm run live`) |
| API stops with "Could not connect to MongoDB" | Start the MongoDB service (or Docker container), then run again |
| Heat levels show "Normal" everywhere | Normal outside the hot season; check the Data tab for the real numbers |
| First start is slow, or heat levels stay "Normal" for a while | It is computing the normals; the free API limits requests per minute and hour. If the hourly limit is reached the rest finish on the next 30-minute cycle |
| `Fetch latest data` says "Try again in N s" | A refresh just ran; the button is limited to once a minute |
| "Open-Meteo could not be reached" | No internet or the service is busy; stored data stays available and the next scheduled run retries |
| `EADDRINUSE` | Another program uses port 4300 or 5173; stop it or change `LIVE_API_PORT` |
| Want a clean database | In MongoDB drop `climateintel_live`; it is rebuilt on the next start (history restarts from the last 30 days) |

## 16. Further documentation

- [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md), [CONCEPTS_GUIDE.md](CONCEPTS_GUIDE.md): earlier lab walkthroughs of the front end and React/forms concepts
- [IMPLEMENTATION.md](IMPLEMENTATION.md), [EXPLANATION.md](EXPLANATION.md), [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md): how the lab requirements were implemented
  (written before the live-data rewrite, so parts describe the old sample-data back ends)
- [design.md](design.md): design blueprint (layout, palette, components)
- [api/README.md](api/README.md): Node core API notes

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
