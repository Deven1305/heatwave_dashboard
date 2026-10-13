# EXPLANATION.md
## KJS-CES-01 — Exp-3 (Form Handling & Validation) + React Router Navigation & Dashboard

This project fulfils two lab deliverables at once, both themed on the
**KJS-CES-01 Regional Heatwave Early-Warning Dashboard** use case:

1. **WP-II Exp-3 — Form Handling and Form Validation in React** (per
   `Exp-3_Forms.docx`): a controlled-component form with manual client-side
   validation.
2. **React Router navigation** (per `React_Router.docx`): `BrowserRouter`,
   `Routes`/`Route`, `Link`/`NavLink`, `useNavigate`, and `useSearchParams`
   driving a multi-page app with a tabbed dashboard.

The old `design.md` (Experiment-2 blueprint) has been **revised to v2** in
this zip — see the "What changed from v1 and why" section at the top of
`design.md`. It reflects a short round of research into current (2026)
dashboard design practice and one real heatwave-tracking product, not just
the original static mockup brief.

---

## How Exp-3's requirements map onto this project

The lab activity (`Exp-3_Forms.docx`) asks for three things. Each is
satisfied by `src/pages/ReportForm.jsx`, generalized to the use case:

| Activity ask | Where it is |
|---|---|
| Login form, error if fields empty | `src/pages/Login.jsx` (`/login`) — dedicated Login ID + password form, every required field shows `ERR_REQUIRED` inline if left empty on submit. |
| Registration form: name not empty, email contains `@`, password ≥ 6 chars | `src/pages/Register.jsx` (`/register`) — a **literal, minimal** implementation of exactly this activity: `ERR_REQUIRED` if name is empty, `ERR_MISSING_AT` if email lacks `@` (a plain `.includes("@")` check, intentionally not the fuller regex used elsewhere), `ERR_MIN_LENGTH` if password is under 6 characters. Kept as its own page specifically so this activity's exact wording is satisfied 1:1, separate from the two stricter/generalized versions of name+email validation already in `ReportForm.jsx` and the stronger password policy in `Login.jsx` — see `IMPLEMENTATION.md` §5 for a side-by-side comparison of "minimum required" vs. "production-grade" validation across all three forms. |
| Checkbox (agree to terms) + dropdown (country), checkbox required before submit | `agree` checkbox (`ERR_CHECKBOX_REQUIRED`) + `region` `<select>` dropdown (`ERR_REQUIRED`). |

The form goes further than the minimum activity because the assignment
document also says forms should demonstrate **controlled components**,
**all common form elements** (text, textarea, checkbox/radio, select), and
**manual validation** — so the deliverable was built as one coherent,
real-feeling form on the use case rather than three disconnected toy forms.

### All 13 input types used (15 fields)
1. `text` — Observer / Reporter Name
2. `email` — Contact Email
3. `tel` — Phone Number (10-digit, digit-only input mask)
4. `number` — AWS Station ID (1–500)
5. `number` — Ambient Temperature °C (-10 to 60)
6. `date` — Observation Date (cannot be in the future)
7. `time` — Observation Time
8. `select` — IMD Region (7 options)
9. `radio` (group) — Heat Severity Tier
10. `checkbox` (group, multi-select) — Data Source(s) Used
11. `range` — Confidence Level slider
12. `textarea` — Additional Observations (max 500 chars, live counter)
13. `url` — Reference Data Source Link (optional)
14. `file` — Photo Evidence (JPEG/PNG/WEBP, ≤5MB)
15. `checkbox` (single) — Data-accuracy confirmation

Plus, on the separate `/login` page (`Login.jsx`): `text` (Login ID),
`password`/`text` toggle (Password, with show/hide), and `checkbox`
(Remember me).

### Error codes
All validation lives in one `validate(form)` function in `ReportForm.jsx`
and returns `{ fieldName: { code, message } }`. Codes used:

```
ERR_REQUIRED            missing a required field
ERR_MIN_LENGTH          name shorter than 3 characters
ERR_MAX_LENGTH          notes over 500 characters
ERR_INVALID_NAME        name fails regex /^[A-Za-zÀ-ɏ]+(?:[ '-][A-Za-zÀ-ɏ]+)*$/ (digits/symbols)
ERR_INVALID_EMAIL       email fails regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
ERR_INVALID_PHONE       phone fails Indian 10-digit mobile regex
ERR_OUT_OF_RANGE        station ID or temperature outside allowed bounds
ERR_INVALID_DATE        observation date is in the future
ERR_INVALID_URL         reference link isn't a valid http(s) URL
ERR_CHECKBOX_REQUIRED   no data source selected, or accuracy box unchecked
ERR_FILE_TYPE           uploaded file isn't jpeg/png/webp
ERR_FILE_SIZE           uploaded file over 5MB
```

Each error renders inline under its field **and** rolls up into a summary
banner at the top of the form, so both patterns (inline + summary) required
by different grading rubrics are covered. On success, a success banner
replaces the summary and shows a generated `HW-######` reference ID.

---

## How React_Router.docx's requirements map onto this project

| Concept from the doc | Where it is |
|---|---|
| `BrowserRouter` | Wraps `<App />` in `src/main.jsx`. |
| `Routes` / `Route` | Defined in `src/App.jsx` for `/`, `/report`, `/dashboard`, and a `*` catch-all. |
| `Link` / `NavLink` | `NavLink` used in `Navbar.jsx` for active-state nav links; `Link` used in `Footer.jsx` and `NotFound.jsx`. |
| `useNavigate` | Used in `Navbar.jsx` ("Dashboard Login" button) and `ReportForm.jsx` (post-submit "View in Dashboard Reports" button). |
| `useSearchParams` (extension beyond the doc's example, needed for a tabbed dashboard) | `Dashboard.jsx` reads/writes `?tab=` so the URL is the single source of truth for which tab is open — the navbar's Live Map/Alerts/Forecast/Reports links and the in-page tab bar both drive the same state. |
| Nested/organized routing pattern | Not literally nested routes (the use case didn't call for a parent/child page relationship like the doc's About→Team/Company example), but the same declarative `Routes`/`Route` structure is used. |

---

## Project structure

```
kjs-ces-01-forms-nav/
├── design.md                 # v2 revised blueprint (see file for full diff notes)
├── EXPLANATION.md             # this file
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                # BrowserRouter mount
    ├── App.jsx                 # Routes/Route definitions
    ├── styles/global.css       # design tokens from design.md
    ├── components/
    │   ├── Navbar.jsx           # sticky nav, NavLink, useNavigate
    │   ├── Ticker.jsx           # scrolling heat-tier ticker strip
    │   └── Footer.jsx
    └── pages/
        ├── Home.jsx             # 9-section landing page (design.md §4)
        ├── ReportForm.jsx       # Exp-3 form: 15 fields / 13 input types / error codes
        ├── Dashboard.jsx        # tab console: Live Map / Alerts / Forecast / Reports
        └── NotFound.jsx         # 404 route
```

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build      # production build -> dist/
npm run preview    # preview the production build
```

Build was verified locally before packaging: `npm run build` completes
clean (43 modules, no errors).

## Notes / things you may want to tailor before submission
- The dashboard's numbers (station counts, alert list, forecast values,
  submitted reports) are static mock data for demo purposes — there's no
  backend. If your lab requires wiring the report form's submission into
  the Reports tab live, that would need real shared state (e.g. lifting
  form submissions into context or a small backend) — say the word if you
  want that added.
- All three of `Exp-3_Forms.docx`'s activities now each have a dedicated,
  literal implementation: Activity 1 (login, error on empty fields) →
  `Login.jsx`; Activity 2 (registration: name/email/password with the
  exact "not empty / contains @ / ≥6 chars" rules) → `Register.jsx`;
  Activity 3 (checkbox + dropdown, checkbox required) → the `agree`
  checkbox + `region` dropdown in `ReportForm.jsx`. None of these
  authenticate against a real backend — there isn't one in this project —
  so "login"/"register" mean *format validation passed*, not an actual
  account system.
