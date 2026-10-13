# CONCEPTS_GUIDE.md
## Every required React concept, explained from zero, with real examples from this project

This file assumes you are seeing these terms for the first time. Each section
explains the idea in plain English first, then shows the **actual code from
this project** that demonstrates it, with a line-by-line breakdown. Read it
top to bottom, or jump to whichever concept you need.

Checklist of what this file proves is implemented:

| # | Concept | Implemented? | Main file(s) |
|---|---|---|---|
| 1 | JSX | ✅ | every `.jsx` file |
| 2 | Props | ✅ | `Badge.jsx`, `InPageEdit.jsx`, `Dashboard.jsx` |
| 3 | Hooks — `useState` | ✅ | every page/form |
| 4 | Hooks — `useEffect` | ✅ | `Ticker.jsx`, `Dashboard.jsx`, `StayOnPage.jsx` |
| 5 | Conditional Rendering | ✅ | `ReportForm.jsx`, `Dashboard.jsx` |
| 6 | Event Handling | ✅ | every form/page |
| 7 | State Management | ✅ | every page (local + URL-based) |
| 8 | CSS Modules (Imported CSS) | ✅ | `Badge.jsx` + `Badge.module.css` |
| 9 | Component Reusability | ✅ | `InPageEdit.jsx`, `Badge.jsx` |
| 10 | Promises & Async/Await | ✅ | `src/api/weather.js` |
| 11 | Form Handling & Validation | ✅ | `ReportForm.jsx`, `Login.jsx`, `Register.jsx` |
| 12 | API Integration | ✅ | `src/api/weather.js` + `Ticker.jsx` + `Dashboard.jsx` |

---

## 1. JSX — writing HTML-like code inside JavaScript

**What it is, in plain words:** Normally, JavaScript can't contain HTML tags
— `const x = <div>hi</div>;` would be a syntax error in plain JS. JSX is a
special syntax extension (used only inside React files) that *lets* you
write HTML-looking markup directly inside your JavaScript/component
functions. A tool called a "transpiler" (Vite uses one automatically, via
the `@vitejs/plugin-react` plugin in `vite.config.js`) converts that markup
into plain `React.createElement(...)` calls before the browser ever sees it.
You never have to think about that conversion — you just write what looks
like HTML, but you're allowed to drop into `{ }` and write real JavaScript
expressions anywhere inside it.

**Where it is in this project:** literally every `.jsx` file. Here's a
small, clear example from [`src/pages/NotFound.jsx`](src/pages/NotFound.jsx):

```jsx
export default function NotFound() {
  return (
    <section className="section container" style={{ textAlign: "center", padding: "100px 0" }}>
      <span className="eyebrow mono" style={{ color: "var(--red)" }}>ERR_ROUTE_NOT_FOUND</span>
      <h1 style={{ fontSize: 36, marginTop: 10 }}>404 — Station Not Found</h1>
      <p style={{ color: "rgba(241,250,238,0.6)", marginBottom: 24 }}>
        This monitoring endpoint doesn't exist in the routing table.
      </p>
      <Link to="/" className="btn btn-primary">Back to Home</Link>
    </section>
  );
}
```

What to notice:
- `<section>`, `<span>`, `<h1>`, `<p>` look exactly like HTML tags — that's
  the JSX part.
- `<Link to="/" ...>` is **not** a real HTML tag — it's a React *component*
  (from the router library) being used exactly like an HTML tag. JSX treats
  a tag starting with a **lowercase** letter (`<div>`) as a real HTML
  element, and a tag starting with an **uppercase** letter (`<Link>`,
  `<Navbar>`) as a React component you wrote or imported. This is the rule
  that lets React tell "build-in HTML" and "your own components" apart.
- `className` is used instead of HTML's `class` (because `class` is a
  reserved word in JavaScript).
- `style={{ textAlign: "center", padding: "100px 0" }}` — the outer `{ }`
  means "insert a JavaScript expression here", and the inner `{ }` is a
  plain JS **object** — so `style` in JSX always takes an *object* of
  camelCase CSS properties (`textAlign`, not `text-align`), not a CSS
  string like plain HTML's `style="text-align:center"`.

A second example showing JSX **embedding a JavaScript expression** directly
in text, from [`src/pages/ReportForm.jsx:239`](src/pages/ReportForm.jsx#L239):

```jsx
<strong>{errCount} field{errCount > 1 ? "s" : ""} need attention:</strong>
```
- `{errCount}` inserts the current value of the `errCount` variable.
- `{errCount > 1 ? "s" : ""}` inserts the *result* of a ternary expression —
  if there's more than one error, it prints "s" (making "fields"), otherwise
  nothing (keeping "field"). Anything inside `{ }` in JSX is real,
  evaluated JavaScript — not a template string, not text.

---

## 2. Props — passing data from a parent component into a child component

**What it is, in plain words:** A React component is just a JavaScript
function. Like any function, it can take **arguments** — in React these are
called **props** (short for "properties"), and they always arrive as a
single object. Props are how a parent component hands data *down* to a
child component. The child cannot change its own props — data only flows
one direction (parent → child), which is what makes React apps predictable.

**Where it is in this project:** the clearest example is the new
[`src/components/Badge.jsx`](src/components/Badge.jsx), a small reusable
component:

```jsx
export default function Badge({ tier }) {
  const tierClass = styles[tier] || "";
  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {tier ? tier.toUpperCase() : ""}
    </span>
  );
}
```

- `function Badge({ tier })` — the `{ tier }` is **object destructuring**
  applied directly in the function's parameter list. It means: "this
  function receives one object (its props), immediately pull the `tier`
  field out of it, and call that value `tier` inside the function body."
  Without destructuring you'd write `function Badge(props) { ... props.tier ... }`
  — destructuring is just a shortcut for the same thing.
- Every place `<Badge tier="warning" />` gets written, React calls
  `Badge({ tier: "warning" })` under the hood.

You can see it being **called with different prop values** four separate
times in [`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx), each time the
`tier` prop is a different string coming from data:

```jsx
<Badge tier={r.tier} />         {/* inside LiveMapTab, per region */}
<Badge tier={a.tier} />         {/* inside AlertsTab, per alert row */}
<Badge tier={f.tier} />         {/* inside ForecastTab, per forecast day */}
<Badge tier={r.tier} />         {/* inside ReportsTab, per submitted report */}
```

One component definition, four call sites, each passing a **different
value** for the same prop — that's the entire point of props: write the
rendering logic once, feed it different data every time you use it.

A second, richer example — `InlineEditNumber` in
[`src/components/InPageEdit.jsx`](src/components/InPageEdit.jsx) takes six
props at once:

```jsx
export function InlineEditNumber({ label, value, unit = "", min = -100, max = 100, onSave }) {
```
- `label`, `value`, `min`, `max` are plain data props (strings/numbers).
- `unit = ""`, `min = -100`, `max = 100` show **default prop values** — if
  the parent doesn't pass `unit`, it silently becomes `""` instead of
  `undefined`.
- `onSave` is a **function prop** — the parent hands the child a callback
  function, and the child calls `onSave(newValue)` when the user confirms an
  edit. This is how a child can "talk back" to its parent despite props only
  flowing one direction: the parent gives the child a function to call, and
  the child calls it with whatever data it wants to send back up. See it
  used in [`src/pages/InPageEditing.jsx:61`](src/pages/InPageEditing.jsx#L61):
  ```jsx
  <InlineEditNumber label="Emergency Threshold" value={emergencyThreshold} unit="°C" min={-10} max={60} onSave={setEmergencyThreshold} />
  ```
  Here the prop `onSave` is literally the parent's own `setEmergencyThreshold`
  state-setter function (see Concept 3 below) — so when the child calls
  `onSave(72)`, it is actually calling `setEmergencyThreshold(72)`, updating
  the *parent's* state.

---

## 3. Hooks — `useState`

**What it is, in plain words:** A plain JavaScript function can't
"remember" anything between calls — every time it runs, its local variables
start fresh. But a React component needs to remember things (what's typed
in a text box, whether a checkbox is checked, whether a menu is open) and
**re-render itself on screen whenever that remembered value changes**.
`useState` is the hook (a special React function, always starting with
`use`) that gives a function component this memory.

```js
const [value, setValue] = useState(initialValue);
```
- `useState(initialValue)` returns an **array with exactly two items**, and
  `const [value, setValue] = ...` is **array destructuring** — it names the
  first item `value` and the second `setValue` (you can name them anything;
  the *position* is what matters, not the name).
- `value` is the current stored value (starts as `initialValue`).
- `setValue` is a function — call `setValue(newThing)` and two things
  happen: (1) the stored value becomes `newThing`, and (2) React
  re-renders the component so the screen reflects the new value.
- **Important rule:** you never do `value = newThing` directly. State in
  React is only ever changed by calling its setter function — that's what
  tells React to re-render.

**Where it is in this project:** the whole [`src/pages/ReportForm.jsx`](src/pages/ReportForm.jsx)
form is built on it:

```js
const [form, setForm] = useState(initialForm);
const [errors, setErrors] = useState({});
const [submitted, setSubmitted] = useState(false);
```
Three independent pieces of memory: the form's field values, the current
validation errors, and whether the form was successfully submitted. Every
keystroke in every input calls `setForm(...)`, which triggers React to
re-render the form with the new values on screen — that's what makes typing
"work" at all.

A lazy-initializer variant (running a function only once, on first render,
instead of every render) appears in
[`src/pages/StayOnPage.jsx:27`](src/pages/StayOnPage.jsx#L27):
```js
const [widgets, setWidgets] = useState(() => load("kjs_widgets_order", DEFAULT_WIDGETS));
```
Passing a **function** to `useState` (instead of a plain value) tells React
"only run this to compute the starting value once, not on every re-render"
— useful here because `load(...)` reads from `localStorage`, which is
slightly expensive to do on every single render.

---

## 4. Hooks — `useEffect`

**What it is, in plain words:** Some things a component needs to do are not
part of rendering JSX — fetching data from a server, starting a timer,
reading/writing `localStorage`, subscribing to something. These are called
**side effects**. `useEffect` lets you say "after this component renders,
also run this extra code" — and, importantly, "run it again whenever these
specific values change" (or "run it exactly once, when the component first
appears").

```js
useEffect(() => {
  // side-effect code
  return () => {
    // optional cleanup code, runs before the next effect or on unmount
  };
}, [dependencies]);
```

**Where it is in this project — three different patterns:**

**Pattern A — run once on mount, to fetch data.**
[`src/components/Ticker.jsx:46`](src/components/Ticker.jsx#L46):
```js
useEffect(() => {
  let mounted = true;
  fetchTemperaturesForCities(CITY_COORDS).then((res) => {
    if (mounted && res && res.length) setLiveData(res);
  }).catch(() => {
    // silent failure: components will fall back to commented dummy data
  });
  return () => (mounted = false);
}, []);
```
- The **empty array `[]`** as the second argument means "run this effect
  exactly once, right after the component's first render, and never again."
- Inside, it calls the weather API (see Concept 10/12 below) and, once the
  data arrives, calls `setLiveData(res)` to store it in state — which
  triggers a re-render showing the real data instead of placeholders.
- `let mounted = true` plus `return () => (mounted = false)` is a **cleanup
  function** — if the user navigates away before the fetch finishes, this
  flips `mounted` to `false`, and the `if (mounted && ...)` check stops the
  component from trying to update state on a component that no longer
  exists (which would otherwise print a React warning).

**Pattern B — re-run whenever a specific value changes.**
[`src/pages/StayOnPage.jsx:32`](src/pages/StayOnPage.jsx#L32):
```js
useEffect(() => persist("kjs_widgets_order", widgets), [widgets]);
useEffect(() => persist("kjs_global_threshold", globalThreshold), [globalThreshold]);
```
- The dependency array here is `[widgets]` (not empty) — this effect
  re-runs *every time `widgets` changes*, saving the latest value to
  `localStorage` so it survives a page refresh. The second line does the
  same for `globalThreshold`, independently.

**Pattern C — re-run when a prop/derived value arrives later.**
[`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx), inside `AlertsTab`:
```js
useEffect(() => {
  if (live && live.length) setRegionThresholds(live.map((r) => ({ id: r.region, ... })));
}, [live]);
```
`live` is data that starts as `null` and gets filled in later once the API
call in the parent (`Dashboard`) finishes and passes it down as a prop.
This effect watches `live` and, the moment it stops being empty, transforms
it into the shape the editable table needs.

**Why `useEffect` and not just "call the fetch directly in the component
body"?** Because a component function runs on *every* render, and calling
`fetch(...)` directly in the body would fire a brand-new network request on
every single re-render — including the very re-render the fetch itself
causes when it finishes. `useEffect` with a dependency array is what limits
"when should this side-effect actually re-run" to only when you say it
should.

---

## 5. Conditional Rendering — showing different JSX depending on state

**What it is, in plain words:** Since JSX is just JavaScript, you can use
normal JavaScript logic — `if`, ternaries (`cond ? a : b`), and the `&&`
operator — to decide **what to render**, or whether to render anything at
all.

**Pattern A — `&&` to render "only if true".**
[`src/pages/ReportForm.jsx:229`](src/pages/ReportForm.jsx#L229):
```jsx
{submitted && errCount === 0 && (
  <div className="success-banner">
    ✅ <strong>Report submitted.</strong> ...
  </div>
)}
```
In JavaScript, `a && b` evaluates to `b` if `a` is truthy, or to `a` itself
if `a` is falsy. React renders `false`/`null`/`undefined` as *nothing at
all*. So: if `submitted` is `true` **and** `errCount === 0` is `true`, the
`<div>` renders; otherwise the whole expression evaluates to `false`, and
React shows nothing there. This is the most common conditional-rendering
pattern in the app — it's used for the error summary banner right below it
too (`{errCount > 0 && (...)}`).

**Pattern B — ternary, for "render A or render B".**
[`src/pages/Login.jsx:156`](src/pages/Login.jsx#L156):
```jsx
{showPassword ? "HIDE" : "SHOW"}
```
Straightforward: if `showPassword` is `true`, show the text "HIDE";
otherwise show "SHOW". Used for the password show/hide toggle button.

**Pattern C — comparing a piece of state to decide which whole "tab" of
content to show.** [`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx):
```jsx
{active === "live-map" && <LiveMapTab live={regionReadingsLive} />}
{active === "alerts" && <AlertsTab live={regionReadingsLive} />}
{active === "forecast" && <ForecastTab live={forecastLive} />}
{active === "reports" && <ReportsTab />}
```
Only one of these four lines ever actually renders something — the other
three evaluate to `false` and render nothing — because `active` can only
equal one string at a time. This is how the whole tabbed dashboard UI
works: change `active`, and a completely different block of JSX appears.

**Pattern D — a function that returns `null` to render nothing.**
[`src/pages/ReportForm.jsx:169`](src/pages/ReportForm.jsx#L169):
```jsx
function FieldError({ error }) {
  if (!error) return null;
  return (
    <span className="error-msg">
      <span className="error-code">[{error.code}]</span> {error.message}
    </span>
  );
}
```
`return null` is React's official way of saying "render nothing here" from
inside a component (as opposed to `&&`, which is used inline in the middle
of other JSX). `<FieldError error={errors.email} />` is placed under every
single field in the form — most of the time `errors.email` is `undefined`
(no error), so `FieldError` just renders nothing, and the moment there *is*
an error object there, it appears.

**Pattern E — conditional CSS classes.**
[`src/pages/ReportForm.jsx:251`](src/pages/ReportForm.jsx#L251):
```jsx
<div className={`field ${errors.observerName ? "error" : ""}`}>
```
This builds the `className` string itself conditionally — normally it's
just `"field"`, but if there's a validation error for this field, it
becomes `"field error"`, which is what actually triggers the red border/red
glow styling defined in `global.css`.

---

## 6. Event Handling — responding to what the user does

**What it is, in plain words:** In JSX, you attach a function to a DOM
event by passing it as a prop whose name starts with `on` and is
camelCased — `onClick`, `onChange`, `onSubmit`, `onKeyDown`, `onDragStart`,
etc. React calls your function with an **event object** (usually named `e`)
whenever that interaction happens.

**`onChange` — the backbone of every input in this app.**
[`src/pages/ReportForm.jsx:253`](src/pages/ReportForm.jsx#L253):
```jsx
<input
  type="text"
  value={form.observerName}
  onChange={(e) => set("observerName", e.target.value.replace(/[^A-Za-zÀ-ɏ '-]/g, ""))}
/>
```
- `e.target` is the actual `<input>` DOM element that fired the event;
  `e.target.value` is whatever text is currently in the box.
- Every keystroke fires `onChange`, which here strips out disallowed
  characters and calls `set(...)` (a small helper — see Concept 7) to
  update state, which then flows back into `value={form.observerName}` —
  completing the loop that makes this a *controlled* input.

**`onSubmit` on the `<form>` tag, plus `e.preventDefault()`.**
[`src/pages/ReportForm.jsx:196`](src/pages/ReportForm.jsx#L196):
```jsx
const handleSubmit = (e) => {
  e.preventDefault();
  const validationErrors = validate(form);
  setErrors(validationErrors);
  if (Object.keys(validationErrors).length === 0) {
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    setSubmitted(false);
  }
};
```
`e.preventDefault()` is essential: a plain HTML `<form>`'s default behavior
on submit is to reload the entire page (or navigate somewhere), which would
wipe out all of React's in-memory state. Calling `preventDefault()` stops
that browser default so the app can handle the submission itself in
JavaScript.

**`onClick` for buttons, including calling a function with an argument.**
[`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx):
```jsx
<button key={t.id} className={`tab-btn ${active === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
```
Notice `onClick={() => setTab(t.id)}` — an **arrow function wrapping the
call**, not `onClick={setTab(t.id)}`. If you wrote it without the arrow
function, `setTab(t.id)` would execute *immediately* while rendering (which
is wrong — you'd get an infinite re-render loop). Wrapping it in
`() => ...` creates a new function that React only calls later, at the
actual moment of the click.

**`onKeyDown` — responding to specific keys.**
[`src/components/InPageEdit.jsx:71`](src/components/InPageEdit.jsx#L71):
```jsx
onKeyDown={(e) => {
  if (e.key === "Enter") confirm();
  if (e.key === "Escape") cancel();
}}
```
`e.key` tells you which key was pressed as a string; this lets Enter
confirm an inline edit and Escape cancel it, just like a native app.

**`onDragStart` / `onDragEnter` — the HTML5 Drag-and-Drop API.**
[`src/pages/StayOnPage.jsx:36`](src/pages/StayOnPage.jsx#L36) reorders
dashboard widgets by dragging them, using the browser's native drag events
(`dataTransfer`, etc.) wired up as ordinary React event-handler props in
exactly the same `onX={...}` style as everything above.

---

## 7. State Management — how data is stored, updated, and shared

**What it is, in plain words:** "State" is any data that can change over
time and that the UI needs to reflect. "State management" is about
*deciding where a piece of state should live* and *how it flows to the
parts of the UI that need it*. This project uses three different state
strategies, each for a different reason:

**Strategy A — local component state (`useState`), for data only that one
component cares about.** Most of the app: a form's field values, whether a
password is shown, which dashboard widget is expanded. See Concept 3 above.

**Strategy B — "lifting state up" — moving state to the nearest shared
parent so multiple children can use it.**
[`src/pages/InPageEditing.jsx`](src/pages/InPageEditing.jsx) owns the state
(`emergencyThreshold`, `cities`, `districtAlert`), and *passes both the
current value and a setter function down* to the reusable editing
components as props:
```js
const [emergencyThreshold, setEmergencyThreshold] = useState(45);
// ...
<InlineEditNumber ... value={emergencyThreshold} onSave={setEmergencyThreshold} />
```
`InlineEditNumber` itself has **no idea** what "emergency threshold" even
means — it just knows "I have a number, and a function to call when the
user confirms a new one." The actual meaning and storage live in the
parent. This is the standard React pattern for sharing state between
sibling/reusable components without a global store.

**Strategy C — the URL itself as the source of state, via
`useSearchParams`.** [`src/pages/Dashboard.jsx:56`](src/pages/Dashboard.jsx#L56):
```js
const [params, setParams] = useSearchParams();
const active = params.get("tab") || "live-map";
const setTab = (id) => setParams({ tab: id });
```
Instead of `useState("live-map")`, the "which tab is open" state is read
straight out of the URL's query string (`?tab=alerts`). Why: this makes the
current tab **shareable and bookmarkable** (send someone a link to
`/dashboard?tab=alerts` and they land directly on that tab), and it means
the navbar's links and the in-page tab buttons are automatically always in
sync — they're both just reading/writing the same URL, there's no separate
copy of "which tab" to keep synchronized.

**Strategy D — state persisted outside React entirely, in
`localStorage`.** [`src/pages/StayOnPage.jsx:17`](src/pages/StayOnPage.jsx#L17):
```js
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
```
Combined with the `useEffect` calls from Concept 4 (Pattern B), this makes
the widget order and threshold **survive a full page reload** — something
`useState` alone can never do, since a page reload wipes all JavaScript
memory. `useState` holds the *live, in-memory* copy that React renders from;
`localStorage` is the *durable* backup, kept in sync via `useEffect`.

**Immutable updates — the rule underlying all of the above.** State is
never mutated directly; a *new* object/array is always created:
```js
const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
```
`{ ...f, [key]: value }` spreads all existing fields of `f` into a **new**
object, then overwrites just one field (`[key]: value` — a *computed
property name*, meaning "use the string stored in the `key` variable as the
property name"). This never touches the original `f` object. React relies
on this: it decides whether to re-render partly by comparing whether the
state reference changed, so mutating the old object in place can cause
React to silently miss an update.

---

## 8. CSS Modules (Imported CSS)

**What it is, in plain words:** Normally, CSS class names are **global** —
if two different files both define `.badge { ... }`, whichever one loads
last wins, and they silently clash. A **CSS Module** is a `.module.css`
file (the `.module.css` filename suffix is what makes it special) whose
class names are automatically renamed by the build tool (Vite, here) into
unique, scoped names — so a `.badge` class in `Badge.module.css` can never
collide with a `.badge` class anywhere else in the whole app, even if both
exist. You import the module like a JavaScript object, where each key is
one of your class names.

**Where it is in this project:**
[`src/components/Badge.module.css`](src/components/Badge.module.css):
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  width: fit-content;
}

.safe    { background: rgba(69, 123, 157, 0.18); color: var(--steel); }
.watch   { background: rgba(244, 163, 0, 0.18);  color: var(--amber); }
.warning { background: rgba(247, 127, 0, 0.18);  color: var(--orange); }
.emergency { background: rgba(214, 40, 40, 0.18); color: var(--red); }
```

And [`src/components/Badge.jsx`](src/components/Badge.jsx), which imports
it:
```jsx
import styles from "./Badge.module.css";

export default function Badge({ tier }) {
  const tierClass = styles[tier] || "";
  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {tier ? tier.toUpperCase() : ""}
    </span>
  );
}
```
- `import styles from "./Badge.module.css"` — this is the CSS Modules
  syntax. `styles` is now a plain JavaScript object, automatically built by
  Vite, that looks roughly like
  `{ badge: "_badge_a1b2c3", safe: "_safe_x9y8z7", watch: "...", ... }` —
  the exact hashed names don't matter and are different on every build;
  what matters is that they're guaranteed unique.
- `styles.badge` gives you the real (scoped) class name for `.badge`.
- `styles[tier]` is the same idea but with a **variable** key — since
  `tier` is a prop like `"warning"`, `styles[tier]` looks up
  `styles["warning"]`, i.e. the scoped name for the `.warning` rule. This
  is exactly how a JavaScript object is normally indexed by a
  runtime-computed string.
- `styles[tier] || ""` — if `tier` were ever something with no matching CSS
  class (or `undefined`), this falls back to an empty string instead of
  putting the literal text `"undefined"` into the `className`.

**Why this project also still has a `global.css`, and how the two
coexist:** `src/styles/global.css` (imported once, in `src/main.jsx`) holds
the shared design system — color variables (`--steel`, `--amber`, etc.),
fonts, and the vast majority of component classes (`.field`, `.btn`,
`.navbar`, and so on) that are deliberately meant to be reused verbatim,
by class name, across many files. CSS Modules are the right tool
specifically when you want a component's styling to be **guaranteed
isolated** — `Badge.jsx` is a good example because "badge" is a generic
enough class name that it could easily clash with something else added to
`global.css` later; scoping it via a CSS Module removes that risk entirely,
while everything still shares the same `--steel` / `--amber` / `--orange` /
`--red` color variables, because CSS custom properties (variables) defined
on `:root` are visible from *any* stylesheet, module or not — variable
scoping and class-name scoping are two independent things.

---

## 9. Component Reusability

**What it is, in plain words:** Instead of writing near-identical JSX/logic
in five different places, you write it **once**, as its own component, and
use it five times with different props. This is the single biggest reason
React apps stay maintainable as they grow.

**Example A — `Badge`, reused across four different dashboard tabs.**
Already shown above (Concept 2): `Badge.jsx` is defined once and called
with a different `tier` prop in `LiveMapTab`, `AlertsTab`, `ForecastTab`,
and `ReportsTab` inside [`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx).
Before this project's CSS Modules pass, `Badge` was a small function
copy-pasted only *inside* `Dashboard.jsx`; it's now its own file precisely
so it could carry its own CSS Module and, going forward, be imported into
any other page without dragging `Dashboard.jsx` along with it.

**Example B — the three "in-page editing" components, reused across two
completely different pages.** [`src/components/InPageEdit.jsx`](src/components/InPageEdit.jsx)
exports three components — `InlineEditNumber`, `EditableTable`,
`EditOverlayButton` — each fully generic (they know nothing about
"heatwaves" or "thresholds", only about numbers/rows/fields via props).
They are imported and reused in two unrelated places:
- [`src/pages/InPageEditing.jsx`](src/pages/InPageEditing.jsx) — a demo
  page showing all three patterns with sample data.
- [`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx)'s Alerts tab — the
  *real* usage, editing actual alert thresholds/messages.
- [`src/pages/StayOnPage.jsx`](src/pages/StayOnPage.jsx) — reuses
  `InlineEditNumber` and `EditOverlayButton` again, a third time, for its
  own auto-escalation threshold widget.

Same component code, three unrelated call sites, zero duplication.

**Example C — `FieldError`, a tiny reusable "presentational" component,
repeated inside each form file.** `ReportForm.jsx`, `Login.jsx`, and
`Register.jsx` each define their own small local `FieldError` component:
```jsx
function FieldError({ error }) {
  if (!error) return null;
  return (
    <span className="error-msg">
      <span className="error-code">[{error.code}]</span> {error.message}
    </span>
  );
}
```
Within each *single* file, this is reused many times — e.g. in
`ReportForm.jsx` it's placed under all 15 fields
(`<FieldError error={errors.observerName} />`, `<FieldError error={errors.email} />`,
...) — one small component, fifteen call sites, instead of writing that
`{error && <span>...}` block out longhand fifteen times. (It is currently
defined separately per-file rather than imported from one shared file —
worth knowing if you want to tidy it further: it could be moved into its
own `FieldError.jsx` and imported by all three forms, the same way `Badge`
was just extracted.)

**Example D — `Row` inside `Ticker.jsx`.**
[`src/components/Ticker.jsx:30`](src/components/Ticker.jsx#L30) defines a
tiny local component and renders it **twice** with different `keyPrefix`
props, to create the seamless infinite-scroll illusion (two identical
copies of the data, side by side, scrolled together):
```jsx
<Row data={dataToShow} keyPrefix="a" />
<Row data={dataToShow} keyPrefix="b" />
```

---

## 10. Promises and Async/Await in JavaScript

**What it is, in plain words:** Some operations (like a network request)
don't finish instantly — the browser has to send a request and wait for a
reply, which might take anywhere from milliseconds to seconds. A
**Promise** is a JavaScript object representing "a value that will exist
*eventually*" — it's either still pending, or it has **resolved**
(succeeded, with a value) or **rejected** (failed, with an error).
**`async`/`await`** is newer syntax that lets you write promise-based code
that *looks* like ordinary top-to-bottom synchronous code, instead of
chaining `.then(...)` calls.

**Where it is in this project:** all of
[`src/api/weather.js`](src/api/weather.js), the file responsible for
talking to the live weather API:

```js
export async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const json = await res.json();
  return json.current_weather;
}
```
- `async function` — marking a function `async` does two things: (1) it
  lets you use `await` inside it, and (2) it makes the function
  **automatically return a Promise**, even though the `return` statement
  just returns a plain value (`json.current_weather`) — callers of this
  function always get back a Promise wrapping that value.
- `fetch(url)` — the browser's built-in function for making an HTTP
  request. It returns a Promise almost immediately (before the response
  has actually arrived).
- `await fetch(url)` — "pause this function right here (without freezing
  the rest of the page/app) until that Promise resolves, then continue with
  the resolved value." So `res` is not a Promise — it's the actual
  `Response` object, once the request completes.
- `if (!res.ok) throw new Error(...)` — `res.ok` is `true` only for
  successful HTTP status codes (200–299); if the server returned an error
  status, this throws, which turns the Promise this `async` function
  returns into a **rejected** one, so callers' `.catch(...)` will fire.
- `await res.json()` — parsing the response body as JSON is *also*
  asynchronous (reading the whole response can take a moment), so it's
  awaited too.

**Chaining multiple async calls, and handling failure per-item, with
`Promise.all`.** [`src/api/weather.js:16`](src/api/weather.js#L16):
```js
export async function fetchTemperaturesForCities(cityList) {
  const promises = cityList.map(async (c) => {
    try {
      const w = await fetchCurrentWeather(c.lat, c.lon);
      const tempC = typeof w.temperature === "number" ? w.temperature : parseFloat(w.temperature);
      const tier = tempC >= 44 ? "emergency" : tempC >= 40 ? "warning" : tempC >= 38 ? "watch" : "safe";
      return { city: c.city, temp: `${tempC.toFixed(1)}°C`, tier };
    } catch (e) {
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
}
```
- `cityList.map(async (c) => {...})` calls the weather API **once per
  city**, in parallel — `.map` with an `async` callback produces an array
  of Promises (not an array of results yet), stored in `promises`.
  `try { ... } catch (e) { return null; }` means if *one* city's fetch
  fails (e.g. the network hiccups), that single Promise still resolves —
  just to `null` — instead of the whole batch blowing up.
- `await Promise.all(promises)` — `Promise.all` takes an *array of
  Promises* and returns a single Promise that resolves once **every** one
  of them has resolved (or rejects immediately if any of them reject — but
  since each one already catches its own errors and returns `null`
  instead, nothing here ever actually rejects). `await`-ing it pauses until
  every city's request has finished, then gives you back a plain array of
  results, in the same order the cities were given.
- `results.filter(Boolean)` — drops any `null` entries (failed cities) from
  the final array. `Boolean` used as the filter function is a common
  shorthand for "keep only truthy values."

**Consuming a Promise-returning function with `.then()`/`.catch()`
instead of `await`** (both styles appear in this codebase, and both are
valid — `await` is used *inside* `async` functions, `.then()`/`.catch()` is
used when you're *not* inside an `async` function, such as directly inside
a `useEffect` callback, which cannot itself be declared `async`):
[`src/components/Ticker.jsx:49`](src/components/Ticker.jsx#L49):
```js
fetchTemperaturesForCities(CITY_COORDS).then((res) => {
  if (mounted && res && res.length) setLiveData(res);
}).catch(() => {
  // silent failure: components will fall back to commented dummy data
});
```
`.then(callback)` runs `callback` once the Promise resolves, with the
resolved value as its argument. `.catch(callback)` runs only if the Promise
rejects. This is functionally the same idea as `await` + `try/catch`, just
written in the "promise chain" style rather than the "looks synchronous"
style.

---

## 11. Form Handling and Validation

**What it is, in plain words:** "Form handling" covers everything about
capturing what a user types/selects/checks, and reacting when they submit.
"Validation" is checking that what they entered is actually acceptable
*before* treating the submission as successful, and showing clear feedback
when it isn't.

This project has **three full forms**, each demonstrating the same overall
pattern at a different level of strictness — see
[`IMPLEMENTATION.md`](IMPLEMENTATION.md) §5 for a full side-by-side, but the
short version:

- **`ReportForm.jsx`** — 15 fields, 13 distinct HTML input types, the most
  thorough validation (regex for name/email/phone/URL, numeric range
  checks, date-in-the-past check, file type/size checks, checkbox-required
  checks).
- **`Login.jsx`** — Login ID + password, with a **live password-strength
  checklist** rendered from an array of rule objects.
- **`Register.jsx`** — deliberately the *minimum* version (name not empty /
  email contains `@` / password ≥ 6 characters), matching a specific lab
  activity's exact wording.

**The core pattern, shown once (from `ReportForm.jsx`):**

**Step 1 — controlled inputs** (state is the single source of truth for
what's on screen — see Concept 6's `onChange` example above). Every input
looks like:
```jsx
<input value={form.email} onChange={(e) => set("email", e.target.value)} />
```

**Step 2 — a pure validation function**, run only at submit time, not on
every keystroke: [`src/pages/ReportForm.jsx:86`](src/pages/ReportForm.jsx#L86):
```js
function validate(form) {
  const errors = {};

  if (!form.email.trim()) {
    errors.email = { code: ERROR_CODES.REQUIRED, message: "Contact email is required." };
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = { code: ERROR_CODES.INVALID_EMAIL, message: "Enter a valid email address." };
  }
  // ... one very similar if/else-if block per field ...

  return errors;
}
```
- It's a **pure function**: given the same `form` object, it always returns
  the same `errors` object, and it doesn't change anything outside itself
  (no `setState` calls inside `validate`). This makes it easy to reason
  about and easy to test in isolation.
- Each field gets its own `if / else if` chain, so **only the first
  failing rule for that field is reported** — e.g. a name that's both empty
  *and* would (if non-empty) fail the letters-only regex only ever shows
  "required", never both messages at once, because the `else if` branches
  below the first failing check are never reached.
- Every entry in `errors` is a structured `{ code, message }` object, not
  just a string — `code` (like `"ERR_INVALID_EMAIL"`) is meant for
  tests/logs/graders to check against reliably; `message` is the
  human-readable text actually shown on screen.

**Step 3 — the regex patterns doing the real checking**, e.g.
[`src/pages/ReportForm.jsx:57-60`](src/pages/ReportForm.jsx#L57):
```js
const NAME_RE = /^[A-Za-zÀ-ɏ]+(?:[ '-][A-Za-zÀ-ɏ]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const URL_RE = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
```
A **regular expression (regex)** is a compact pattern language for
matching strings. `EMAIL_RE.test("x@y.com")` returns `true`/`false`
depending on whether the string matches the pattern. Full explanations of
each of these exact patterns (with pass/fail examples for tricky inputs
like `"José"` or `"Mary-Jane"`) live in
[`IMPLEMENTATION.md`](IMPLEMENTATION.md) §3–§4 — this file focuses on *why*
the technique is used, that one is the character-by-character reference.

**Step 4 — on submit, run validation, then branch on the result:**
```js
const handleSubmit = (e) => {
  e.preventDefault();
  const validationErrors = validate(form);
  setErrors(validationErrors);
  if (Object.keys(validationErrors).length === 0) {
    setSubmitted(true);
  } else {
    setSubmitted(false);
  }
};
```
`Object.keys(validationErrors).length === 0` — an object with zero
properties has an empty `Object.keys(...)` array, so this is the standard
JavaScript idiom for "is this object empty?"

**Step 5 — showing errors, both inline and as a summary** (this is
Conditional Rendering, Concept 5, applied specifically to validation):
every field shows `<FieldError error={errors.fieldName} />` right under
itself, **and** a rolled-up `error-summary` banner lists every failing
field at the top of the form — so the user sees both "what's wrong with
*this* field, right here" and "everything I still need to fix, at a
glance," at the same time.

**A different, "live" validation style — the password checklist.**
[`src/pages/Login.jsx:28`](src/pages/Login.jsx#L28):
```js
const PW_RULES = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (v) => /[A-Z]/.test(v) },
  // ...
];
```
Each rule is `{ key, label, test }` — `test` is a **function stored as
data**. The JSX maps over this array *twice*: once to build a colored
strength bar (counting how many `test(password)` calls currently return
`true`), and once to render a `✓`/`✗` checklist — so validation feedback
updates live, on every keystroke, rather than only appearing after Submit.
This is deliberately different from the "only validate on submit" pattern
used for most of `ReportForm.jsx`'s fields, because password rules are
exactly the kind of thing a user benefits from seeing *before* getting them
wrong.

---

## 12. API Integration

**What it is, in plain words:** "API integration" means your app talks to
an external service over the network to get real data, instead of using
data you typed into the source code by hand. This project talks to
**Open-Meteo** (`https://open-meteo.com`), a free public weather API that
needs no API key/login.

**The dedicated API module — [`src/api/weather.js`](src/api/weather.js).**
Keeping all `fetch(...)` calls in one small file, instead of scattering
them inside components, means: (1) any component that needs weather data
just imports a plain function and doesn't need to know the URL format or
error handling itself, and (2) if the weather provider ever changed, only
this one file would need to change.

Three exported functions, all covered in Concept 10 above:
- `fetchCurrentWeather(lat, lon)` — one city's current temperature.
- `fetchTemperaturesForCities(cityList)` — many cities at once, in
  parallel, tolerant of individual failures.
- `fetchRegionForecast(lat, lon)` — a multi-day forecast for one location.

**Consumer 1 — the scrolling ticker strip.**
[`src/components/Ticker.jsx`](src/components/Ticker.jsx) calls
`fetchTemperaturesForCities` once, inside a `useEffect` with an empty
dependency array (Concept 4, Pattern A), for eight hardcoded Indian cities'
coordinates (`CITY_COORDS`). While the request is in flight, it shows
placeholder `"--°C"` values:
```js
const dataToShow = liveData || CITY_COORDS.map((c) => ({ city: c.city, temp: "--°C", tier: "safe" }));
```
`liveData || fallback` — before the API responds, `liveData` is still
`null` (falsy), so the fallback placeholder array is used; the instant
`setLiveData(res)` runs inside the `.then(...)`, `liveData` becomes a real
array (truthy), and `dataToShow` switches over to it on the next render.

**Consumer 2 — the dashboard.** [`src/pages/Dashboard.jsx`](src/pages/Dashboard.jsx)
calls **both** `fetchTemperaturesForCities` (for the Live Map tab's
7-region grid) and `fetchRegionForecast` (for the Forecast tab), again
inside a `useEffect([])`. Each tab component (`LiveMapTab`, `ForecastTab`)
receives the live data as a **prop** and falls back to a hardcoded array
(`FALLBACK_REGIONS`, `forecastFallback`) if the live data hasn't arrived
yet (or the request failed):
```js
function LiveMapTab({ live }) {
  const rows = live && live.length ? live : FALLBACK_REGIONS;
  ...
}
```
This "start with a safe fallback, swap to live data once it arrives"
pattern appears everywhere the app calls this API — it means the UI is
never blank or broken while waiting on the network, and still works
(showing clearly-fake demo numbers) even if the API is unreachable
entirely, since every fetch call ends in a silent `.catch(() => {})`.

**No API key, no backend of its own.** Open-Meteo's free tier requires no
authentication, so there's no secret key to protect — this project has no
server component at all (see `EXPLANATION.md`/`IMPLEMENTATION.md`'s notes
on "no backend"); the browser calls Open-Meteo's public endpoint directly
from `fetch(...)`.

---

## Where to go next

- **[`CODEBASE_GUIDE.md`](CODEBASE_GUIDE.md)** — a file-by-file,
  folder-by-folder walkthrough of the entire project: what each file
  contains, why it's structured the way it is, and how the pieces connect.
- **[`EXPLANATION.md`](EXPLANATION.md)** — maps this project's code to the
  specific lab activity requirements (Exp-3 forms, React Router).
- **[`IMPLEMENTATION.md`](IMPLEMENTATION.md)** — a deeper, viva-style
  walkthrough specifically of the validation logic and regex patterns.
