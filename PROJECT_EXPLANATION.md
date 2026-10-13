# KJS-CES-01 Project Explanation

## 1. Project goal

This project combines two practical labs in one use case:

- Frontend React app for a climate intelligence dashboard
- Node.js backend to simulate a real agricultural advisory system

The app is themed around the KJS-CES-01 climate intelligence use case and the sugarcane irrigation advisory use case.

---

## 2. What the frontend does

The frontend is a React + React Router app built in Vite.

### Main files

- `src/App.jsx` — routes and page switching
- `src/main.jsx` — app mount with BrowserRouter
- `src/pages/Home.jsx` — landing page and climate dashboard intro
- `src/pages/ReportForm.jsx` — form validation demo
- `src/pages/Login.jsx` — login form example
- `src/pages/Register.jsx` — registration validation example
- `src/pages/Dashboard.jsx` — climate dashboard tabs and card layout

### Frontend features

1. Router-based navigation
   - `BrowserRouter` wraps the app
   - `Routes` and `Route` define pages
   - `NavLink` is used for navigation highlights

2. Form validation demo
   - Controlled inputs using React state
   - Validation checks for empty fields, email, phone, temperature, region, checkbox, etc.
   - Inline error messages + summary error box

3. Dashboard UI
   - Live Map tab
   - Alerts tab
   - Forecast tab
   - Reports tab

4. Weather data integration
   - `src/api/weather.js` calls public Open-Meteo APIs
   - It converts API responses into dashboard-friendly objects

---

## 3. What the Node.js backend does

The Node.js part is implemented in `api/server.js` and is meant to demonstrate the required Node experiment points:

- HTTP server using the `http` module
- URL processing using the `URL` API
- File-based JSON storage using `fs/promises`
- Asynchronous read/write operations
- JSON response generation
- Basic error handling

### Why this matters

The backend behaves like a real service that can be connected later to a React dashboard or mobile app.

### Implemented routes

The server includes routes like:

- `/` — project overview
- `/health` — health check
- `/farmers` — farmer info
- `/plots` — plot details
- `/sensors` — soil and climate sensor data
- `/irrigation?plotId=SG-1045` — rule-based irrigation recommendation
- `/prediction?plotId=SG-1045` — predicted next irrigation date
- `/water-stress?plotId=SG-1045` — stress status
- `/alerts` — alert list
- `/dashboard` — dashboard summary payload
- `/reports` — report reading and posting

---

## 4. Code-wise explanation

### 4.1 Frontend routing

File: `src/App.jsx`

```jsx
import { Routes, Route } from "react-router-dom";

<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/report" element={<ReportForm />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

How it works:
- The router decides which page to show based on the URL
- Each route maps to a component
- This is the standard React Router pattern

### 4.2 Form validation

File: `src/pages/ReportForm.jsx`

```jsx
const [form, setForm] = useState(initialForm);
const [errors, setErrors] = useState({});
const [submitted, setSubmitted] = useState(false);
```

How it works:
- `form` stores all field values
- `errors` stores validation issues
- `submitted` tracks whether the submission passed validation

Every input is controlled by `value` and `onChange`, so React owns the state.

Example validation logic:

```js
if (!form.email.trim()) {
  errors.email = { code: ERROR_CODES.REQUIRED, message: "Contact email is required." };
} else if (!EMAIL_RE.test(form.email.trim())) {
  errors.email = { code: ERROR_CODES.INVALID_EMAIL, message: "Enter a valid email address." };
}
```

This checks:
- required field
- valid format
- custom error code returned to UI

### 4.3 Dashboard logic

File: `src/pages/Dashboard.jsx`

```jsx
const [params, setParams] = useSearchParams();
const active = params.get("tab") || "live-map";
```

How it works:
- The URL query string drives the active tab
- `?tab=forecast`, `?tab=alerts`, etc.
- This makes the dashboard state shareable via URL

### 4.4 Weather API helper

File: `src/api/weather.js`

```js
export async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const json = await res.json();
  return json.current_weather;
}
```

How it works:
- Requests current weather data from a public API
- Parses JSON
- Converts the response to values used by the dashboard

### 4.5 Node server structure

File: `api/server.js`

```js
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const requestUrl = new URL(req.url || '/', `http://${host}`);
  const pathname = requestUrl.pathname;
```

How it works:
- Every incoming request is received by the Node HTTP server
- The URL is parsed to determine the route
- Different handlers return different JSON structures

### 4.6 Rule-based irrigation logic

In `api/server.js` there are helper functions such as:

```js
function buildIrrigationRecommendation(plot, sensor, rainfallForecast = 0) {
  const moisture = Number(sensor?.soilMoisture ?? 0);
  const temperature = Number(sensor?.airTemperature ?? 0);

  if (moisture < 30 || (temperature >= 38 && moisture < 45)) {
    irrigationRequired = true;
    recommendedWater = rainfallForecast > 10 ? '18 mm' : '32 mm';
    recommendedDuration = rainfallForecast > 10 ? '1.5 hours' : '2.5 hours';
    priority = 'High';
  }
```

This is a simple AI-like rule engine:
- low soil moisture + high temperature => irrigation needed
- rainfall changes the recommendation
- this mimics a basic advisory model without a real ML model

Similarly:

```js
function buildStressStatus(plot, sensor) {
  const moisture = Number(sensor?.soilMoisture ?? 0);
  let waterStressProbability = Math.round(((45 - moisture) * 2) + (airTemperature - 28) * 2.5);
```

This computes an estimate of stress risk based on moisture and temperature.

---

## 5. How to run the app

### Frontend

```bash
cd "D:\Deven\1_Hackathon_proj\kj\1-Friday\exp3\KJS-CES-01_Exp3-Form-Validation_ReactRouter-Dashboard\kjs-ces-01-forms-nav"
npm install
npm run dev -- --host 0.0.0.0
```

Then open:

- http://localhost:5173

### Backend

```bash
cd "D:\Deven\1_Hackathon_proj\kj\1-Friday\exp3\KJS-CES-01_Exp3-Form-Validation_ReactRouter-Dashboard\kjs-ces-01-forms-nav"
npm run api
```

Then test:

- http://localhost:8000/health
- http://localhost:8000/irrigation?plotId=SG-1045
- http://localhost:8000/dashboard

---

## 6. How to check the backend manually

### Option 1: Browser
Open in browser:

- http://localhost:8000/health
- http://localhost:8000/irrigation?plotId=SG-1045

### Option 2: Curl

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/irrigation?plotId=SG-1045"
```

### Option 3: JSON response inspection
You should see JSON like:

```json
{
  "status": "ok",
  "service": "kjs-ces-01-node-backend",
  "port": 8000
}
```

and for irrigation:

```json
{
  "plotId": "SG-1045",
  "irrigationRequired": true,
  "recommendedWater": "32 mm",
  "recommendedDuration": "2.5 hours",
  "priority": "High"
}
```

---

## 7. Final understanding

The full project is a combination of:

- React UI for climate and form-driven interactions
- Node backend simulating a rule-based AI advisory system
- JSON data model for future dashboard integration

This is exactly the kind of implementation expected for:
- Experiment 5 — Node.js use
- Climate intelligence scenario
- Future React dashboard/backend integration

---

## 8. Summary in one line

This project shows how a React dashboard can display climate information and how a Node.js backend can manage, analyze, and return irrigation/advisory data in a format that a future dashboard can consume.
