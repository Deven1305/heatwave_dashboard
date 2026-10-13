# CODEBASE_GUIDE.md
## A complete, file-by-file, folder-by-folder walkthrough of this project

This file explains **every file in the project**, in the order you'd
naturally read them (config first, then entry point, then the app itself),
what each one contains, why it's written the way it is, and how it connects
to everything around it. It assumes no prior familiarity with the codebase.
For deep-dives into *which React/JS concept* is being demonstrated where,
see [`CONCEPTS_GUIDE.md`](CONCEPTS_GUIDE.md) instead — this file is
organized by *file*, that one is organized by *concept*.

## The full folder tree

```
kjs-ces-01-forms-nav/
├── index.html                  # the one real HTML page — Vite's entry point
├── package.json                 # project identity, scripts, dependencies
├── vite.config.js                # build-tool configuration
├── design.md                      # visual/product design blueprint
├── EXPLANATION.md                  # lab-activity requirement mapping
├── IMPLEMENTATION.md                # deep-dive on validation logic
├── CONCEPTS_GUIDE.md                 # (this pair) concept-by-concept guide
├── CODEBASE_GUIDE.md                  # (this file) file-by-file guide
├── dist/                                # production build output (generated)
└── src/
    ├── main.jsx                          # React root + router mount
    ├── App.jsx                            # route table
    ├── api/
    │   └── weather.js                      # Open-Meteo API integration
    ├── styles/
    │   └── global.css                       # shared design system / CSS
    ├── components/
    │   ├── Navbar.jsx                        # top navigation bar
    │   ├── Ticker.jsx                         # scrolling live-temp strip
    │   ├── Footer.jsx                          # site footer
    │   ├── Badge.jsx                            # reusable tier badge (CSS Modules)
    │   ├── Badge.module.css                      # Badge's scoped styles
    │   └── InPageEdit.jsx                          # 3 reusable inline-editing widgets
    └── pages/
        ├── Home.jsx                                 # landing page
        ├── ReportForm.jsx                            # Exp-3 field-report form
        ├── Login.jsx                                  # login form
        ├── Register.jsx                                # registration form
        ├── Dashboard.jsx                                # tabbed console
        ├── InPageEditing.jsx                             # in-page editing demo
        ├── StayOnPage.jsx                                 # drag-and-drop demo
        └── NotFound.jsx                                    # 404 catch-all
```

---

## Project-root files

### `package.json`
This is the project's identity card and dependency manifest — every
Node/JavaScript project has one. The important parts:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
},
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0"
},
"devDependencies": {
  "@vitejs/plugin-react": "^4.3.1",
  "vite": "^5.4.0"
}
```
- `"scripts"` defines the commands you run with `npm run <name>` (e.g.
  `npm run dev` literally runs `vite`, which starts a local dev server with
  hot-reload at `http://localhost:5173`).
- `"dependencies"` are packages the *shipped app* needs at runtime: React
  itself, `react-dom` (the piece that actually renders React components
  into a real browser DOM), and `react-router-dom` (client-side routing —
  see `App.jsx`/`main.jsx` below).
- `"devDependencies"` are packages only needed while *developing/building*
  — Vite (the dev server + bundler) and its official React plugin (which
  is what teaches Vite to understand JSX syntax and enable React's
  fast-refresh during development).
- There is deliberately **no** form library (Formik, React Hook Form) and
  no validation library (Yup, Zod) listed — all form state and validation
  in this project is written by hand, on purpose, because the lab activity
  this project fulfils specifically asks for *manual* validation.

### `vite.config.js`
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```
Vite is the build tool: in development it serves your source files
directly (with instant hot-reload when you save a file), and for
production (`npm run build`) it bundles everything into a handful of
optimized `.js`/`.css` files under `dist/`. This file is about as minimal
as a Vite config gets — it just registers the `react()` plugin, which
teaches Vite's build pipeline to understand `.jsx` syntax. Everything else
(the CSS Modules support used by `Badge.module.css`, for example) is
already built into Vite by default — no extra configuration line was
needed to make `*.module.css` files work; Vite recognizes that filename
pattern automatically.

### `index.html`
```html
<head>
  ...
  <title>ClimateIntel · Heatwave Monitoring — KJS-CES-01</title>
  <link rel="stylesheet" href="...Space+Grotesk...IBM+Plex+Sans...IBM+Plex+Mono..." />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
```
This is the **only real `.html` file in the whole app** — React apps built
this way are "Single Page Applications" (SPAs): the browser loads this one
HTML page once, and every "page" you see afterwards (Home, Login,
Dashboard, ...) is actually just React swapping out what's inside
`<div id="root"></div>`, without ever asking the server for a new HTML
file. Two things worth noticing:
- The `<link>` pulls in three Google Fonts (Space Grotesk for headings,
  IBM Plex Sans for body text, IBM Plex Mono for data/code-like text) —
  referenced later by name inside `global.css`.
- `<script type="module" src="/src/main.jsx">` is the single line that
  boots the entire React app — the browser loads `main.jsx`, and
  everything else (every component, every page) is pulled in from there via
  `import` statements.

### `design.md`
Not code — a written design specification (color palette, typography,
landing-page section order, dashboard layout rules) that the actual JSX/CSS
in this project was built to match. Useful background if you want to
understand *why* a given color or layout choice was made, but not part of
the running app.

### `EXPLANATION.md` and `IMPLEMENTATION.md`
Pre-existing project documentation focused on mapping the code to specific
lab-activity requirements (`EXPLANATION.md`) and on a deep technical
walkthrough of the validation/regex logic specifically
(`IMPLEMENTATION.md`). This guide and `CONCEPTS_GUIDE.md` complement them
with a broader, more beginner-oriented pass over the *entire* codebase.

### `dist/`
Generated output from `npm run build` — not source code, and not meant to
be hand-edited. Deleting it and re-running `npm run build` regenerates it
from scratch.

---

## `src/main.jsx` — where the app actually starts

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```
Read top to bottom, this is the entire boot sequence of the app:
1. `import "./styles/global.css"` — importing a `.css` file directly from a
   `.jsx` file is a Vite feature: it tells the bundler "include this
   stylesheet in the final page." Because it's imported **here**, at the
   very root, its styles are available globally to every component in the
   app — this is the "one shared stylesheet" approach, as opposed to the
   CSS Modules approach used just for `Badge.jsx` (see that file below).
2. `document.getElementById("root")` grabs the empty `<div id="root">`
   from `index.html`.
3. `ReactDOM.createRoot(...).render(...)` — this is the actual hand-off
   from plain HTML to React: "take control of this DOM node, and render
   this JSX tree inside it, keeping it up to date forever after."
4. `<React.StrictMode>` — a development-only wrapper that doesn't render
   anything itself; it just makes React double-invoke certain functions
   (like component bodies) during development to help you catch subtle
   bugs (like accidentally mutating state) earlier. It has no effect in
   the production build.
5. `<BrowserRouter>` — wraps everything else and turns on React Router's
   URL-based navigation, using the browser's real History API (so URLs
   look like `/dashboard?tab=alerts`, not `/#/dashboard`). It has to be
   *outside* `<App />` because everything inside `App` — `<Routes>`,
   `<Link>`, `useNavigate()`, `useSearchParams()` — needs to be inside a
   `<BrowserRouter>` to work at all; they all rely on "router context" that
   only `<BrowserRouter>` provides.
6. `<App />` — the actual application, defined in `App.jsx` (next).

---

## `src/App.jsx` — the route table and page shell

```jsx
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Ticker from "./components/Ticker.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
// ...six more page imports...

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Ticker />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/editing-demo" element={<InPageEditing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stay-on-page" element={<StayOnPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
```
This is the app's **shell + route table**, and it's worth understanding as
two separate ideas stacked on top of each other:

**The shell (things that appear on *every* page):** `<Navbar />` and
`<Ticker />` above the routed content, `<Footer />` below it — these three
components render on every single route, because they're written *outside*
`<Routes>`. Only the content between them changes as you navigate.

**The route table:** `<Routes>` looks at the browser's current URL and
renders whichever single `<Route>`'s `element` has a matching `path` — for
example, visiting `/login` renders `<Login />` in place of everything else
inside `<main>`. `<Route path="*" element={<NotFound />} />` is a
**catch-all**: `*` matches any URL that didn't match one of the routes
listed above it, which is what makes typing a nonexistent URL show the 404
page instead of a blank screen or a browser error.

Why `<main style={{ flex: 1 }}>` specifically: it's a flexbox trick (paired
with `.app-shell` in `global.css` being `display: flex; flex-direction: column; min-height: 100vh;`)
that makes the `<main>` content stretch to fill any leftover vertical
space, so the footer is always pushed to the bottom of the viewport even on
short pages, instead of floating awkwardly in the middle.

---

## `src/api/weather.js` — the app's only network layer

Already covered in depth in `CONCEPTS_GUIDE.md` §10/§12 (Promises,
async/await, API Integration) — the short version, for this file's
purpose: this is the **only file in the project that talks to the
network**. It exports three plain `async` functions
(`fetchCurrentWeather`, `fetchTemperaturesForCities`,
`fetchRegionForecast`), all calling the free Open-Meteo weather API, and it
is imported by exactly two files: `Ticker.jsx` and `Dashboard.jsx`. Keeping
every `fetch(...)` call inside this one small module — instead of writing
`fetch(...)` directly inside components — means the components stay
focused on *rendering*, and if the weather provider or URL format ever
needed to change, this is the only file that would need editing.

---

## `src/styles/global.css` — the shared design system

A single, large (~1200-line) stylesheet, imported once in `main.jsx`, so
its rules apply everywhere. It's organized top-to-bottom, roughly:

1. **`:root` custom properties (CSS variables)** — near the very top:
   ```css
   :root {
     --steel: #457b9d;
     --amber: #f4a300;
     --orange: #f77f00;
     --red: #d62828;
     /* ...more: fonts, backgrounds, etc. */
   }
   ```
   A CSS variable defined on `:root` is visible from **any** stylesheet in
   the whole app — including `Badge.module.css`, even though that file is
   a separate, scoped CSS Module (variable scoping and class-name scoping
   are independent mechanisms — see `CONCEPTS_GUIDE.md` §8). This is why
   the same four alert-tier colors (`--steel`/`--amber`/`--orange`/`--red`)
   show up consistently everywhere in the app — every component references
   the *same four variables*, never a hardcoded hex value repeated in
   multiple places.
2. **Layout primitives** — `.app-shell`, `.container`, generic section
   spacing.
3. **Component classes**, one block per UI pattern used across the app —
   `.navbar`, `.ticker`, `.hero`, `.card-grid`, `.field` / `.error-msg` /
   `.error-summary` / `.success-banner` (the form-validation visual
   language, used identically by `ReportForm.jsx`, `Login.jsx`, and
   `Register.jsx`), `.login-form` / `.pw-*` (login/register page specifics),
   `.tab-bar` / `.stat-grid` / `.panel` (dashboard), `.inline-edit-*` /
   `.edit-table` / `.overlay-*` (the reusable in-page editing widgets),
   `.widget-card` / `.threshold-panel` (drag-and-drop page).
4. Near where the old `.badge` / `.badge-*` rules used to live, there's now
   a short comment:
   ```css
   /* .badge / .badge-* rules moved to src/components/Badge.module.css
      (a CSS Module) — see Badge.jsx, used across the Dashboard tabs. */
   ```
   This documents *why* you won't find `.badge` defined here anymore — it's
   a deliberate signpost left behind after extracting `Badge.jsx` into its
   own CSS-Modules-based component, so a future reader searching this file
   for "badge" finds an explanation instead of nothing.

**Why one global file for almost everything, plus one CSS Module just for
`Badge`?** Nearly every class here is *meant* to be shared verbatim by
class name across many files (`.btn`, `.field`, `.panel`) — that's the
normal, idiomatic use of a global stylesheet, and rewriting all of it into
per-component CSS Modules would add a lot of import boilerplate for no
real benefit. `Badge` was pulled out specifically because it's a small,
fully self-contained, highly reusable component where "guaranteed no class
name collision, ever" is a nice property to have, and because it's a clear,
minimal example of the CSS Modules technique for grading/learning purposes.
Both approaches coexisting is intentional, not inconsistent — see
`CONCEPTS_GUIDE.md` §8 for the full reasoning.

---

## `src/components/` — shared, reusable building blocks

Anything in this folder is imported by **more than one** page, or is
generic enough that it *could* be. Pages, by contrast (next section), are
each mounted by exactly one `<Route>`.

### `Navbar.jsx`
```jsx
const dashLinks = [
  { label: "Live Map", tab: "live-map" },
  { label: "Alerts", tab: "alerts" },
  { label: "Forecast", tab: "forecast" },
  { label: "Reports", tab: "reports" },
];

export default function Navbar() {
  const navigate = useNavigate();
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="logo">...</NavLink>
        <nav>
          <ul className="nav-links">
            {dashLinks.map((l) => (
              <li key={l.tab}>
                <NavLink to={`/dashboard?tab=${l.tab}`} className={({ isActive }) => (isActive ? "active" : "")}>
                  {l.label}
                </NavLink>
              </li>
            ))}
            {/* ...three more static NavLinks... */}
          </ul>
        </nav>
        <button className="btn btn-primary" onClick={() => navigate("/login")}>Dashboard Login</button>
      </div>
    </header>
  );
}
```
- `dashLinks.map((l) => ...)` builds the four dashboard nav links from one
  small array instead of writing four nearly-identical `<li><NavLink>...`
  blocks by hand — a common "data-driven JSX" pattern used throughout this
  project (see also `Home.jsx`'s `features`/`stakeholders`/`steps` arrays).
- `<NavLink>` (not `<Link>`) is used specifically because it accepts a
  **function** as `className`: `className={({ isActive }) => (isActive ? "active" : "")}`.
  React Router calls that function for you and tells you, via `isActive`,
  whether this link's `to` currently matches the browser's URL — letting
  the navbar visually highlight whichever section you're on. Plain
  `<Link>` has no such built-in "am I the current page" awareness.
- The "Dashboard Login" button uses `useNavigate()` instead of a `<Link>`
  because it's just a plain `<button>`, not an anchor-like element — you
  call `navigate("/login")` imperatively, inside an `onClick` handler,
  rather than declaring `to="/login"` on the element itself. Both `<Link>`/`<NavLink>`
  and `useNavigate()` end up doing the same underlying thing (changing the
  URL without a full page reload); which one you reach for depends on
  whether you're rendering something that's fundamentally a link, or
  triggering navigation as a *side effect* of some other interaction.

### `Ticker.jsx`
Covered in `CONCEPTS_GUIDE.md` §4/§12 in detail (the `useEffect` +
API-fetch pattern). Structurally: a small local `Row` sub-component renders
the same list of cities twice, side-by-side (`keyPrefix="a"` /
`keyPrefix="b"`), which combined with a CSS scrolling animation in
`global.css` (`.ticker-track`) creates a seamless, infinitely-looping
marquee effect — the CSS scrolls exactly one copy's width before looping,
so the seam between the two copies is never visible.

### `Footer.jsx`
The simplest component in the project structurally — no state, no hooks,
just static JSX with a handful of `<Link>`s (for internal navigation, e.g.
`<Link to="/register">Register</Link>`) and one plain `<a>` (for the
external Open-Meteo credit link, which correctly uses a real anchor tag
with `target="_blank" rel="noreferrer"`, since it leaves the app entirely —
`Link`/`NavLink` are only for *internal* React Router navigation). One
small dynamic touch: `{new Date().getFullYear()}` in the copyright line, so
it's never manually out of date.

### `Badge.jsx` + `Badge.module.css`
Covered in full in `CONCEPTS_GUIDE.md` §2, §8, and §9 — this is the
project's CSS Modules example and one of its clearest component-reuse
examples simultaneously. In short: `Badge({ tier })` renders a small pill
showing `tier.toUpperCase()` (e.g. "WARNING"), colored according to which
of four severity tiers it is, with all of its CSS scoped to itself via
`Badge.module.css`. It's imported and used by `Dashboard.jsx` in four
separate places (once per tab).

### `InPageEdit.jsx`
The largest, most reusable file in `components/` — three independent,
generic editing widgets, each documented at the top of the file:

- **`InlineEditNumber({ label, value, unit, min, max, onSave })`** — shows
  a value as plain text; clicking it swaps in a number input with ✓/✗
  buttons. Internally it tracks its own `editing` (are we in edit mode?),
  `draft` (the in-progress typed value, separate from the real `value`
  prop so a cancel can discard it), and `error` (live range/type
  validation as you type) via three separate `useState` calls. It never
  touches the parent's real data directly — it only calls `onSave(newValue)`,
  a function the parent provided, when the user explicitly confirms.
- **`EditableTable({ columns, rows, onSaveRow })`** — a fully data-driven
  table. `columns` describes *what* to render per column (including an
  optional custom `render(row)` function per column, for things like
  showing a colored tier label instead of raw text); `rows` is the actual
  data; clicking a row makes just that row's editable cells turn into
  inputs/selects, with the same confirm/cancel-via-draft pattern as
  `InlineEditNumber`.
- **`EditOverlayButton({ title, fields, initial, onSave, trigger })`** — a
  button that opens a modal-style overlay (a dimmed backdrop plus a
  floating panel) with one input per entry in `fields`, and calls
  `onSave(cleanedValues)` if the user clicks Save, or discards everything
  if they click Cancel or click the dimmed backdrop
  (`<div className="overlay-backdrop" onClick={cancel}>` — clicking the
  backdrop itself, not the panel, triggers cancel; a nested
  `onClick={(e) => e.stopPropagation()}` on the panel is what stops a click
  *inside* the panel from also being treated as a backdrop click and
  closing it accidentally).

All three share one contract, stated in the file's own top comment: *"nothing
in the parent's data changes until the user explicitly confirms."* That
consistency is what makes them safe to reuse in different contexts without
each usage needing to re-explain how they behave.

These three components are consumed in three different files —
`InPageEditing.jsx` (demo page), `Dashboard.jsx`'s Alerts tab (real usage),
and `StayOnPage.jsx` (a third, independent usage) — see
`CONCEPTS_GUIDE.md` §9, Example B for the specific call sites.

---

## `src/pages/` — one file per route

Each file here is wired to exactly one `<Route path="..." element={<X />} />`
in `App.jsx`.

### `Home.jsx`
The landing page — no forms, no data fetching, mostly static marketing-style
content built from small local arrays (`severity`, `features`,
`stakeholders`, `steps`) mapped into JSX, matching the section order
specified in `design.md` §4 (Hero → severity legend → features grid →
stakeholder chips → "how it works" → final CTA). Two things worth calling
out:
- `<IndiaHeatmapSVG />` — a small local component at the bottom of the file
  that renders a hand-authored inline SVG (an abstract India outline with a
  few colored dots representing hotspots) — a good example of a component
  that exists purely to keep a chunk of markup (here, SVG path data) out of
  the way of the main component's more important logic.
- The final CTA's `<form onSubmit={(e) => { e.preventDefault(); window.location.href = "/report"; }}>`
  is a deliberately simple "redirect on submit" form — no validation here
  because its only real field is a free-text city name meant to route the
  visitor to the *real* form (`ReportForm.jsx`), not to be validated itself.

### `ReportForm.jsx`, `Login.jsx`, `Register.jsx`
The three form pages — covered exhaustively in `CONCEPTS_GUIDE.md` §11
(Form Handling & Validation) and in `IMPLEMENTATION.md` (regex-level
detail) and `EXPLANATION.md` (which lab-activity requirement each one
satisfies). Structurally, all three follow the identical shape: one or more
`useState` calls for field values → a local `validate(...)` pure function
→ a `handleSubmit` that calls `preventDefault()`, runs `validate`, and
branches on whether the result is empty → JSX that renders an error summary
banner, per-field inline errors via a local `FieldError` component, and a
success banner on a clean submission.

What differs between the three is *how strict* the validation is —
`ReportForm.jsx` is the most thorough (15 fields, 13 input types,
heavy regex), `Login.jsx` has the strongest password policy (with a live
strength checklist), and `Register.jsx` is deliberately minimal, matching
one specific lab activity's exact wording ("name not empty, email contains
@, password ≥ 6 characters"). Reading these three files together, in that
order, is the fastest way to see the same pattern applied at three
different strictness levels.

### `Dashboard.jsx`
The most structurally complex page — a tabbed console. Its shape:
1. `useSearchParams()` reads/writes the `?tab=` query string as the
   "current tab" state (see `CONCEPTS_GUIDE.md` §7, Strategy C).
2. A `useEffect([])` fires two API calls on mount (live regional
   temperatures, and a short forecast for one region), storing results in
   `regionReadingsLive` / `forecastLive` state, which get passed down as
   props to whichever tab is currently showing.
3. Four small tab components are defined **inside this same file**, below
   the main `Dashboard` function: `LiveMapTab`, `AlertsTab`,
   `ForecastTab`, `ReportsTab`. Conditional rendering (`{active === "..." && <Tab />}`)
   shows exactly one of them at a time.
4. `AlertsTab` is the one real, non-demo consumer of the `InPageEdit.jsx`
   widgets — an operator could use it to tune the global auto-escalation
   threshold (`InlineEditNumber`), edit each region's threshold/tier in
   bulk (`EditableTable`), or rewrite one alert's message
   (`EditOverlayButton`), all live, all without leaving the dashboard.
5. Two tiny local helper components, `StatCard` and `Badge`... wait,
   `Badge` is **not** local anymore — it's imported at the top
   (`import Badge from "../components/Badge.jsx";`) — only `StatCard` (the
   four KPI number cards at the top of the page) remains local to this
   file, since nothing else in the app currently needs a "big number +
   label" card.

### `InPageEditing.jsx`
A dedicated showcase/demo page for the three `InPageEdit.jsx` widgets,
using the exact sample data described in the design wireframe (Mumbai/Pune/
Nagpur city table, a Mumbai district alert policy). Its own top-of-file
comment is explicit that this page exists to demonstrate the patterns in
isolation, while `Dashboard.jsx`'s Alerts tab is where the *same* components
are used for a real purpose — each pattern's block on this page even links
directly to where it's used for real (`<Link to="/dashboard?tab=alerts">Dashboard → Alerts tab</Link>`).

### `StayOnPage.jsx`
Demonstrates two more things: **drag-and-drop reordering** (using the raw
HTML5 Drag and Drop API — `draggable`, `onDragStart`, `onDragEnter`,
`e.dataTransfer` — wired up via ordinary React event props) of a row of
"widget" cards, and **state persistence across page reloads** via
`localStorage` (see `CONCEPTS_GUIDE.md` §7, Strategy D). It also reuses
`InlineEditNumber` and `EditOverlayButton` from `InPageEdit.jsx` a third
time, for its own threshold-configuration UI, and uses `useRef` (`dragItem`,
`dragNode`) — a hook that, unlike `useState`, lets you hold onto a mutable
value **that does not trigger a re-render when it changes** — exactly
right for tracking "which item is currently being dragged" bookkeeping,
which is transient interaction state, not something that should cause
extra re-renders every time it's touched.

### `NotFound.jsx`
The smallest page in the project (15 lines) — the catch-all `path="*"`
route from `App.jsx`. Static JSX showing an "ERR_ROUTE_NOT_FOUND" eyebrow
(reusing the same visual language as the form validation error codes, per
`design.md`'s note that unmatched routes should use "the same `ERR_`
error-code visual language as the form") and a `<Link to="/">Back to Home</Link>`.

---

## How a single click travels through this codebase — one worked example

To tie the whole structure together, here's exactly what happens, file by
file, when a user clicks **"Dashboard Login"** in the navbar, then
successfully logs in:

1. **`Navbar.jsx`** — the button's `onClick={() => navigate("/login")}`
   fires. `navigate` came from `useNavigate()`, a hook provided by
   `react-router-dom` because `Navbar` is rendered somewhere inside the
   `<BrowserRouter>` set up in `main.jsx`.
2. **React Router** (inside `react-router-dom`, not this project's code)
   updates the browser's URL to `/login` without a full page reload, and
   tells `<Routes>` in `App.jsx` to re-evaluate which `<Route>` matches.
3. **`App.jsx`** — `<Route path="/login" element={<Login />} />` now
   matches, so `<Login />` mounts in place of whatever was there before,
   while `<Navbar />`, `<Ticker />`, and `<Footer />` stay exactly as they
   were (they're outside `<Routes>`).
4. **`Login.jsx`** mounts fresh: `useState` initializes `loginId`,
   `password`, etc. to their empty starting values. The user types; every
   keystroke fires an `onChange` handler that filters/stores the new value
   via `setLoginId(...)`/`setPassword(...)`, each of which triggers a
   re-render showing the updated input and the live password-strength
   checklist.
5. The user clicks **Sign In** — the `<form>`'s `onSubmit={handleSubmit}`
   fires, `e.preventDefault()` stops a page reload, `validate(loginId, password)`
   runs (a pure function local to `Login.jsx`), and — assuming both fields
   pass their regex checks — `setErrors({})` and `setSubmitted(true)` cause
   a green success banner and a "Continue to Home →" button to appear
   (conditional rendering again).
6. Clicking **"Continue to Home →"** calls `navigate("/")` (the same
   `useNavigate()` hook, called again), which sends the app back to
   `App.jsx`'s `<Route path="/" element={<Home />} />`, completing the
   loop.

Every step above is a small piece of one of the twelve concepts covered in
`CONCEPTS_GUIDE.md`, working together — routing, state, event handling,
conditional rendering, and form validation, all in one short user journey.

---

## Where to go next

- **[`CONCEPTS_GUIDE.md`](CONCEPTS_GUIDE.md)** — the same codebase, read
  concept-by-concept instead of file-by-file (JSX, Props, Hooks,
  Conditional Rendering, Event Handling, State Management, CSS Modules,
  Component Reusability, Promises/Async-Await, Form Validation, API
  Integration), each with real code from this project.
- **[`EXPLANATION.md`](EXPLANATION.md)** — maps this project's code to the
  specific lab activity requirements (Exp-3 forms, React Router).
- **[`IMPLEMENTATION.md`](IMPLEMENTATION.md)** — a deeper, viva-style
  walkthrough specifically of the validation logic and regex patterns.
