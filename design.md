# design.md — Climate Intelligence System (KJS-CES-01)
### Regional Heatwave Early-Warning Dashboard — Reverse-Engineered Layout Blueprint (v2, refreshed)

> v1 was the Experiment-2 blueprint. This v2 revises the palette, density, and
> component behavior after reviewing current (2026) dashboard design practice —
> admin/ops dashboard roundups emphasizing restrained semantic color and
> generous whitespace, and real heatwave-tracking tools (e.g. the EuroMeteo
> Explorer heatwave tracker) that use a layer/tab-based console rather than a
> single static map. The 9-section landing page from v1 is kept, since it
> matches the Experiment-2 requirement; what changed is how the alert-tier
> system, dashboard, and form/interaction patterns are specified.

## 0. What changed from v1 and why
- **Semantic color discipline**: current dashboard guidance caps functional
  color at 3–5 meaning-bearing hues and pairs every color with a text label —
  never color alone. v1's four alert tiers are kept exactly (they are
  regulatory, not decorative) but every tier now always renders with a text
  badge (`SAFE` / `WATCH` / `WARNING` / `EMERGENCY`) next to the color, never
  color-only.
- **Tab-based console over static dashboard**: real heatwave trackers let a
  user switch between a temperature layer, a pressure layer, a wind layer,
  and per-station drill-down, rather than showing one fixed view. v2's
  dashboard adopts a **tab bar** (Live Map / Alerts / Forecast / Reports)
  driven by a URL query param, so a tab is linkable and matches the navbar's
  section links.
- **Executive-summary stat row**: 2026 admin-dashboard guidance favors a
  small set of large KPI cards with no scroll needed to see them, ahead of
  any detailed table or map. v2 adds a 4-card stat row (Active AWS Stations,
  Regions in Watch+, Alerts in 24h, Peak Heat Index) above the tab content.
- **Forms stay data-dense, not decorative**: the field-report form (Exp-3)
  intentionally breaks from "generous whitespace" minimalism, because it is a
  structured-data-entry surface, not a marketing surface — density here is
  correct, not a violation of the principle.

## 1. Product Summary
A public-facing early-warning platform that turns satellite (INSAT-3D
land surface temperature), ERA5 reanalysis, and CPCB ground-station data
into a city-level heat-risk map, 72-hour forecast, and multi-channel
alert system for municipal authorities, hospitals, field workers, and
residents. Field observers can also submit localized AWS/manual readings
through a validated report form, which feed the Reports tab of the console.

## 2. Color Palette (unchanged from v1 — functional, not decorative)
| Role | Color | Hex |
|---|---|---|
| Background (primary, deep monitoring-console navy) | Night Navy | `#0B132B` |
| Panel / card background (light, used on form surfaces) | Pale Mist | `#F1FAEE` |
| Watch (lowest alert tier) | Amber | `#F4A300` |
| Warning (mid alert tier) | Burnt Orange | `#F77F00` |
| Emergency (highest alert tier) | Alert Red | `#D62828` |
| Safe / normal reading | Cool Steel Blue | `#457B9D` |
| Text on dark | Off-white | `#F1FAEE` |
| Text on light | Navy | `#0B132B` |

*Every alert-tier color is always paired with its text label — WCAG AA
contrast, colorblind-safe by design, per current dashboard accessibility
guidance.*

## 3. Typography
- Headings: **Space Grotesk**, 600–700 — technical, instrument-panel feel
- Body: **IBM Plex Sans**, 400–500 — clear at small sizes for dense data
- Data / readouts (temperatures, timestamps, coordinates, error codes,
  reference IDs): **IBM Plex Mono**
- Base size 16px, Hero H1 46px

## 4. Landing Page Sections (top → bottom) — unchanged order from v1
1. **Navbar** — logo "ClimateIntel · Heatwave Monitoring" (left), links:
   Live Map · Alerts · Forecast · Reports (center, now deep-link into the
   dashboard's tab bar via `?tab=`), "Report Observation" and "Dashboard
   Login" (right). Sticky on scroll.
2. **Live heat ticker strip** — horizontal scrolling strip under the navbar,
   city : temperature : alert-tier, mono font, colored + labeled by tier.
   Pauses on hover.
3. **Hero** — "See the heat before it strikes.", 72-hour predictive alert
   sub-headline, two CTAs ("View Live Dashboard" primary, "How alerts work"
   ghost), right side: India silhouette heat-map card with hotspot dots +
   legend.
4. **Alert severity legend band** — full-width strip, four tiers with their
   heat-index threshold, as its own section (not merged into hero).
5. **Features grid (4 cards)** — 72-Hour Forecast & Alerts · Real-Time Heat
   Index Map · Historical Trend Analysis · Multi-Channel Alert Dispatch.
6. **"Built for" stakeholder row** — chips for Municipal Authorities,
   Hospitals & Health Workers, Field/Outdoor Workers, General Public.
7. **How it works** — 3-step flow: Satellite + ground-sensor feeds → AI risk
   model (CNN-LSTM) → Alerts pushed to dashboards & phones.
8. **Final CTA banner** — dark background, "Bring your city onto the
   monitoring network", city-name input + "Request Access" button (routes
   into the report form).
9. **Footer** — logo, tagline, link columns (Platform, Data Sources, Legal),
   data-source credits (INSAT-3D · ERA5 · CPCB · FIRMS), copyright.

## 5. Dashboard Console (new in v2)
- **Stat row**: 4 KPI cards, no scroll required — Active AWS Stations,
  Regions in Watch+, Alerts (24h), Peak Heat Index.
- **Tab bar**: Live Map · Alerts · Forecast · Reports — state lives in the
  URL (`/dashboard?tab=live-map`), so the navbar's section links and the
  in-page tab bar are the same state, and a tab is shareable/bookmarkable.
- **Live Map tab**: 7-region grid (IMD regions), each cell showing current
  reading, color, and tier badge.
- **Alerts tab**: table of recent dispatches — ID, region, severity badge,
  issued time, channel (SMS / App Push / Siren).
- **Forecast tab**: 72-hour card row (Today / +24h / +48h / +72h) with
  predicted high and tier badge.
- **Reports tab**: table of field-submitted reports coming from the Exp-3
  report form — ID, observer, region, severity, date.

## 6. Report Form (Exp-3 requirement, new in v2)
A field/AWS heat observation report, styled as a light "instrument card" on
the dark console (Pale Mist panel, Navy text) so it visually reads as a
data-entry surface distinct from the marketing sections above it.
- 15 controlled fields covering 13 distinct input types: text, email, tel,
  number (×2), date, time, select, radio group, checkbox group, range,
  textarea, url, file, and a single confirmation checkbox.
- Every validation failure returns a structured error code
  (`ERR_REQUIRED`, `ERR_INVALID_EMAIL`, `ERR_INVALID_PHONE`,
  `ERR_OUT_OF_RANGE`, `ERR_INVALID_DATE`, `ERR_MAX_LENGTH`,
  `ERR_INVALID_URL`, `ERR_CHECKBOX_REQUIRED`, `ERR_FILE_TYPE`,
  `ERR_FILE_SIZE`) shown inline under the field and rolled up into an error
  summary banner.
- On successful validation, a success banner with a generated reference ID
  replaces the error summary; the id is styled in mono like every other
  data readout in the system.

## 7. Navigation Behavior
- **React Router** (`react-router-dom` v6, `BrowserRouter`) drives all
  navigation — no dead `#` links.
- Navbar stays fixed/sticky while scrolling.
- Navbar's Live Map / Alerts / Forecast / Reports links navigate to
  `/dashboard?tab=<id>`, which the Dashboard page reads via
  `useSearchParams` to set the active tab — this is the same mechanism
  used by the in-page tab bar, so both stay in sync.
- "Report Observation" and "Dashboard Login" route to `/report` and
  `/dashboard` respectively via `useNavigate` / `Link`.
- Ticker strip scrolls continuously (CSS animation), pausing on hover.
- Unmatched routes render a "404 — Station Not Found" page instead of
  breaking, using the same `ERR_` error-code visual language as the form.

## 8. Must-Have Elements (checklist for AI validation)
- [x] Uses the alert-tier palette exactly — Watch/Warning/Emergency are
      visually distinguishable and always text-labeled, not color-only.
- [x] All 9 landing-page sections present, in the order listed.
- [x] Alert severity legend band is present as its own section.
- [x] Ticker strip is visibly distinct from the hero (separate row).
- [x] Navbar links actually navigate (React Router, no dead `#` links)
      and deep-link into dashboard tab state.
- [x] Dashboard tab bar reflects 2026 console-pattern research (tabs over
      a single static view; KPI row before detail).
- [x] Report form validates 15 fields across 13 input types with
      structured, testable error codes.

## Sources reviewed for the v2 refresh
- Admin/ops dashboard design roundups (2026): semantic-color restraint,
  KPI-row-first layout, subtle elevation over heavy shadows.
- Dashboard "Do's and Don'ts" guidance (2026): never rely on color alone —
  pair with text/icon/badge.
- A real heatwave-tracking tool (EuroMeteo Explorer, June 2026 European
  heatwave coverage): confirms a layer/tab-switchable console with
  per-station drill-down is the current real-world pattern for this
  exact problem domain, which is why the dashboard moved from a single
  static screen (v1) to a tabbed console (v2).
