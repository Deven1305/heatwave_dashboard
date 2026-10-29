# Instructions

Everything you need to run, use and look after ClimateIntel. The README explains what the project is and how it works;
this file is the "how do I actually do it" part.

## 1. What you need

- **Node.js 18 or newer** (it was built on Node 20). Check with `node -v`.
- **MongoDB** running on your own computer, on the usual port 27017 (setup below).
- **An internet connection**, because the weather comes from the Open-Meteo website.

## 2. Run the project

Open a terminal, go into the project folder (the one that has `package.json` in it) and run:

```bash
cd kjs-ces-01-forms-nav     # or the full path to that folder
npm install                 # only the first time
npm run dev:all             # starts the backend (port 4300) and the website (port 5173)
```

Open **http://localhost:5173** in your browser. Press `Ctrl+C` in the terminal to stop both.

The very first start takes a little longer (about 1 to 3 minutes). The backend has to create the database, download the
weather and work out the normal temperature for each of the 30 cities, and the free weather service only lets us ask so
often. The dashboard already works while this happens; the heat levels settle once the normals are ready.

Other commands:

| Command | What it does |
|---|---|
| `npm run dev:all` | Backend and website together. This is the normal way to run it. |
| `npm run live` | Only the backend |
| `npm run dev` | Only the website |
| `npm test` | Runs the automatic tests |
| `npm run build` | Makes a production build of the website |
| `npm run preview` | Serves that production build |

## 3. Set up MongoDB

You don't create any database or table yourself. The backend does it on first start.

1. Install **MongoDB Community Server** and let it run as a service on port 27017.
   On Windows the service is called `MongoDB`; check it with `Get-Service MongoDB` in PowerShell.
   If you prefer Docker: `docker run -d -p 27017:27017 --name mongo mongo`.
2. Start the project (section 2). It creates a database called `climateintel_live`, its indexes and the 30 city records.
3. To look at the data, open MongoDB Compass, connect to `mongodb://localhost:27017` and open `climateintel_live`.
   You will see these collections: `stations`, `observations`, `daily`, `alerts`, `reports` and `fetch_log`.

If MongoDB isn't running, the backend stops straight away and tells you so, instead of failing quietly.

## 4. Settings

You don't need a `.env` file, every setting has a default that works. If you want to change something, copy
`.env.example` to `.env` and edit the values.

| Setting | Default | What it does |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | Where MongoDB is. Put an Atlas connection string here if you use one. |
| `LIVE_DB_NAME` | `climateintel_live` | Name of the database |
| `LIVE_API_PORT` | `4300` | Port of the backend |
| `REFRESH_MINUTES` | `30` | How often the backend fetches new weather |
| `NORMAL_START_YEAR` | `2019` | First year used to work out each city's normal (the last year is 2024) |
| `VITE_LIVE_API_URL` | `http://localhost:4300` | Where the website looks for the backend |

The list of cities and regions is not a setting. It lives in `live-api/config.js`; add a line there to add a city.

## 5. Using the dashboard

- **Fetch latest data** (top right) asks the backend to pull fresh weather right now. It can only be used once a minute.
  **Reload** just re-reads what is already stored.
- **Search** boxes are on most tabs. Type a city, a state or a word like `himalaya` or `coastal`. The text stays in the address bar,
  so a refresh keeps it.
- **Click a region card** on the Overview to see all its cities side by side.
- **Alerts tab:** the system raises alerts by itself. You can also record your own and clear it later.
- **Report an observation** (button top right) saves what you saw on the ground. It is a record only; it doesn't change any alert.

## 6. Rules to follow

- **Keep the Open-Meteo credit.** The data is licensed CC BY 4.0, so the attribution that is shown on the dashboard and in
  the footer has to stay.
- **Respect the free limits of Open-Meteo.** About 600 weighted calls a minute and 5,000 an hour. That is why the normal uses 6 years
  of history and why the refresh button waits a minute. Don't lower `REFRESH_MINUTES` a lot or add many cities at once.
- **Don't commit secrets.** There are none in the code. If you add a MongoDB connection string with a password, keep it in `.env`
  (that file is ignored by Git).
- **This is a local setup.** There is no login, so anyone who can reach the backend can record an alert or a report. CORS is open and
  MongoDB runs without a password. Before putting it on the internet: restrict the allowed origins, switch on MongoDB authentication
  and add authentication to the write routes (alerts, reports, refresh).
- **Privacy.** Reporter email and phone are saved but never sent back by the API and never searchable. Uploaded images must be JPEG,
  PNG or WebP and under 7 MB.
- **Not an official warning.** The values are model data for one point per city and the heat levels are indicative. For real
  decisions use the bulletins of the India Meteorological Department.

## 7. If something goes wrong

| What you see | What to do |
|---|---|
| "The live data service is not reachable" | The backend isn't running. Start it with `npm run dev:all` (or `npm run live`). |
| The backend stops with "Could not connect to MongoDB" | Start the MongoDB service (or the Docker container) and run it again. |
| Every city says Normal | Outside the hot season that is simply true. The Data tab shows the real numbers. |
| Heat levels stay "Normal" for a while after the first start | The normals are still being worked out. If the hourly limit was hit, the rest finish on the next 30 minute round. |
| "Try again in N s" after pressing Fetch latest data | A refresh just ran. Wait a minute. |
| "Open-Meteo could not be reached" | No internet, or their service is busy. Stored data keeps working and the next scheduled round tries again. |
| `EADDRINUSE` | Something else is using port 4300 or 5173. Stop it, or change `LIVE_API_PORT`. |
| You want to start from a clean database | Drop `climateintel_live` in MongoDB. It is rebuilt on the next start (the history then begins with the last 30 days). |

## 8. Quick checks from the terminal

```bash
curl http://localhost:4300/api/health            # {"status":"ok","mongo":"connected",...}
curl http://localhost:4300/api/overview          # regions, cities, stored-data numbers
curl "http://localhost:4300/api/search?q=himalaya"
curl -X POST http://localhost:4300/api/refresh   # fetch from Open-Meteo now (once a minute at most)
```
