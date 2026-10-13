# IMPLEMENTATION.md
## KJS-CES-01 — Exp-3 Form Validation & React Router Dashboard: full code walkthrough

This file is a line-by-line-level explanation of **exactly what is implemented,
where, and how** — written for revision/viva purposes. It complements
`EXPLANATION.md` (which maps the code to the lab activity's requirements) by
going deeper into the *mechanics* of the code itself, especially the form
validation logic and the newly added **name field regex validation**.

---

## 1. Project setup at a glance

```
kjs-ces-01-forms-nav/
├── index.html            # Vite entry HTML, mounts #root
├── package.json          # React 18 + react-router-dom + Vite
├── vite.config.js        # Vite + @vitejs/plugin-react
└── src/
    ├── main.jsx           # ReactDOM.createRoot + <BrowserRouter>
    ├── App.jsx             # <Routes> table (5 routes)
    ├── styles/global.css   # all styling (CSS variables/tokens + component classes)
    ├── components/
    │   ├── Navbar.jsx       # top nav bar, NavLink + useNavigate
    │   ├── Ticker.jsx        # decorative scrolling strip
    │   └── Footer.jsx
    └── pages/
        ├── Home.jsx           # landing page content
        ├── ReportForm.jsx      # ⭐ the Exp-3 field-report form
        ├── Login.jsx            # ⭐ Login ID + Password gate (regex validation)
        ├── Dashboard.jsx         # tabbed dashboard, driven by ?tab= query param
        └── NotFound.jsx           # catch-all 404 route
```

Stack: **React 18 (function components + hooks only, no class components)**,
**react-router-dom v6**, **Vite** as the dev server/bundler. No backend, no
form libraries (no Formik/React-Hook-Form/Yup) — validation is written by
hand with plain regex and comparisons, per the lab's "manual validation"
requirement.

Run it:
```bash
npm install
npm run dev      # http://localhost:5173
```

---

## 2. How the form is built — `src/pages/ReportForm.jsx`

### 2.1 Controlled components

Every input's value comes from React state, not the DOM. This is the
"controlled component" pattern the lab activity specifically asks for.

```jsx
const [form, setForm] = useState(initialForm);
```

`initialForm` is one object holding all 15 fields' starting values (empty
strings, `null`, `false`, or a default like `confidence: 70`). A single
helper writes into it immutably:

```jsx
const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
```

Every `<input>`/`<select>`/`<textarea>` follows the same two-line pattern:

```jsx
<input
  value={form.observerName}
  onChange={(e) => set("observerName", e.target.value)}
/>
```

`value={...}` makes React (not the browser) the single source of truth for
what's on screen; `onChange` is the only thing allowed to change it. This is
what "controlled" means — as opposed to an *uncontrolled* input where you'd
read `ref.current.value` only when needed.

Two fields have special handling beyond a plain pass-through:
- **Phone** strips everything but digits and caps at 10 chars as you type:
  `e.target.value.replace(/[^\d]/g, "").slice(0, 10)`.
- **Name** (new) strips everything except letters/space/hyphen/apostrophe as
  you type — see §3 below.

Checkbox groups (`dataSources`, multi-select) and radio groups (`severity`)
use small helper functions (`toggleDataSource`) instead of a raw `set()`
because their state shape is an array/enum, not a scalar.

### 2.2 Validation — the `validate(form)` function

All validation logic lives in **one pure function**, `validate(form)`
(`ReportForm.jsx` lines ~81–157). It is *not* run on every keystroke — it
runs once, when the form is submitted (see §2.3). It:

1. Takes the current `form` state object as input.
2. Returns an `errors` object shaped like:
   ```js
   { fieldName: { code: "ERR_...", message: "Human readable message" } }
   ```
3. Has **one `if`/`else if` block per field**, each independent, each
   pushing at most one error per field (first failing rule wins — e.g. a
   name that's both too short *and* invalid would only ever show the
   "required" or "min length" message before it gets to the regex check,
   because they're chained as `if / else if / else if`).

Being a pure function (no side effects, same input → same output) is
deliberate: it makes the validation logic independently testable and
reusable, and keeps rendering (JSX) separate from business rules.

### 2.3 Submit flow

```jsx
const handleSubmit = (e) => {
  e.preventDefault();                  // stop the browser's native GET/POST navigation
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

`e.preventDefault()` is essential — without it, the `<form>`'s default
behavior is to do a full-page reload / navigation, which would wipe all
React state. `noValidate` is also set on the `<form>` tag so the *browser's*
built-in validation bubbles (the little "please fill this field" popups)
never fire — we want **our** regex-based messages to be the only ones shown,
not a mix of native and custom validation UI.

**What happens when you click Submit ("fill form then what?"):**
1. `validate(form)` runs synchronously and returns an `errors` object.
2. `setErrors(validationErrors)` triggers a re-render.
3. **If there are errors:** every invalid field's wrapper `<div>` gets an
   `error` CSS class (red border, red glow), the `<FieldError>` component
   renders a red inline message right under that field, and an
   `error-summary` red banner listing *all* failing fields (with their
   `ERR_*` codes) appears at the top of the form. `submitted` stays `false`.
   Nothing is sent anywhere — the user just sees exactly what to fix.
2. **If there are zero errors:** `submitted` becomes `true`, the page
   smooth-scrolls to top, and a green `success-banner` replaces the error
   summary showing a randomly generated reference ID
   (`HW-` + 6 random digits). A button appears below the form to jump to
   `/dashboard?tab=reports` via `useNavigate()`. There is no backend, so
   "submitting" is simulated client-side — the point of the exercise is the
   *validation*, not persistence.
3. **Reset button** (`handleReset`) restores `initialForm`, clears
   `errors`, and clears `submitted` — a full clean slate.

### 2.4 Rendering errors

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

A tiny presentational component: renders nothing if there's no error for
that field, otherwise renders the structured `{code, message}` pair. Reused
under all 15 fields — `<FieldError error={errors.observerName} />` etc. — so
the error-rendering markup is written once, not copy-pasted 15 times.

Styling (`src/styles/global.css`):
```css
.error-msg {
  color: var(--red);       /* red text */
  font-family: var(--font-mono);
  font-size: 12px;
}
.field.error input,
.field.error select,
.field.error textarea {
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgba(214, 40, 40, 0.12); /* red glow ring */
}
```
`--red` is a CSS custom property defined once in `:root` at the top of
`global.css`, so every error indicator (inline message, summary banner,
input border) shares exactly one color value.

---

## 3. NEW: Regex-based Name validation (letters only — no numbers/symbols)

This is the change made in this session. Previously the **Observer /
Reporter Name** field only checked "not empty" (`ERR_REQUIRED`) and "at
least 3 characters" (`ERR_MIN_LENGTH`) — a string like `"Dev123"` or
`"D@v#n!!"` would have passed both checks and been accepted as a "valid"
name. That's now fixed with a real regex, at two layers:

### 3.1 The regex

```js
const NAME_RE = /^[A-Za-zÀ-ɏ]+(?:[ '-][A-Za-zÀ-ɏ]+)*$/;
```

Read left to right:
- `^` / `$` — anchor to the whole string (no partial match allowed).
- `[A-Za-zÀ-ɏ]+` — one or more letters. `A-Za-z` covers plain English
  letters; `À-ɏ` is a Unicode range covering accented Latin letters (é, ñ,
  ü, ø, etc.) so names like "José" or "Renée" aren't wrongly rejected.
- `(?:[ '-][A-Za-zÀ-ɏ]+)*` — a **non-capturing group**, repeated zero or
  more times, that allows a single space / apostrophe / hyphen followed by
  more letters. This is what allows multi-part names: `"Deven Sharma"`,
  `"Mary-Jane"`, `"O'Brien"` — but blocks two spaces in a row, a leading/
  trailing space, a name starting with a hyphen, digits anywhere, or any
  other symbol (`@ # $ % _ + = . , ! ?` etc.).

So `NAME_RE.test(...)` returns:
| Input | Result | Why |
|---|---|---|
| `"Deven Sharma"` | ✅ pass | letters + one space |
| `"O'Brien"` | ✅ pass | apostrophe allowed |
| `"Mary-Jane"` | ✅ pass | hyphen allowed |
| `"José"` | ✅ pass | accented letters covered by `À-ɏ` |
| `"Dev123"` | ❌ fail | digits not in the character class |
| `"D@v#n"` | ❌ fail | symbols not in the character class |
| `"  Dev"` | ❌ fail | leading space breaks the `^[A-Za-z...]` anchor |
| `"Dev  Sharma"` | ❌ fail | double space isn't matched by `[ '-]` (single char) |

### 3.2 Layer 1 — submit-time validation (authoritative check)

In `validate(form)`:
```js
if (!form.observerName.trim()) {
  errors.observerName = { code: ERROR_CODES.REQUIRED, message: "Observer name is required." };
} else if (form.observerName.trim().length < 3) {
  errors.observerName = { code: ERROR_CODES.MIN_LENGTH, message: "Name must be at least 3 characters." };
} else if (!NAME_RE.test(form.observerName.trim())) {
  errors.observerName = {
    code: ERROR_CODES.INVALID_NAME,
    message: "Name can only contain letters, spaces, hyphens ( - ) and apostrophes ( ' ) — no numbers or symbols.",
  };
}
```
A new error code, `ERR_INVALID_NAME`, was added to the `ERROR_CODES` map for
this. This block only runs (and can only show this specific red message)
once the name is non-empty and ≥3 characters — so the user always sees the
*most fundamental* problem first (empty → too short → wrong characters),
never several contradictory messages at once.

This is the check that actually **blocks submission** — even if a user
somehow got invalid characters into the field, the form will not report
`submitted = true` and no error-free state is reachable until the regex
passes. This is why it's called the "authoritative" layer.

### 3.3 Layer 2 — live input filtering (defence-in-depth / UX sugar)

On the `<input>` itself:
```jsx
<input
  type="text"
  value={form.observerName}
  onChange={(e) =>
    set("observerName", e.target.value.replace(/[^A-Za-zÀ-ɏ '-]/g, ""))
  }
  placeholder="e.g. Deven Sharma"
/>
<span className="hint">Letters only — no numbers or symbols.</span>
```
`e.target.value.replace(/[^A-Za-zÀ-ɏ '-]/g, "")` uses a **negated character
class** (`[^...]` = "match anything that is *not* one of these") to strip
out any disallowed character **as the user types**, before it ever reaches
`form.observerName`. Practically: if the user presses `5`, nothing appears
in the box at all — the digit is silently dropped, exactly like the
existing phone-number field already does for non-digits.

This mirrors a pattern already used for the phone field
(`e.target.value.replace(/[^\d]/g, "").slice(0, 10)`), so the codebase now
has **two consistent examples** of "filter as you type" + "regex-validate
on submit" for two different character classes (digits-only vs.
letters-only).

**Why both layers, if the live filter already prevents bad characters?**
Because the live filter only stops *newly typed* characters — pasted text
could momentarily contain something odd before the next keystroke, and more
importantly, this is a teaching example: showing the submit-time regex
check *and* its resulting red `ERR_INVALID_NAME` message is the whole point
of the "learning part" of the exercise, exactly as it is for email, phone,
URL, and file-type/size elsewhere in the same form. The live filter is a UX
nicety (fewer avoidable errors); the regex + error message on submit is the
graded validation behaviour.

### 3.4 What the user actually sees

1. Typing digits or symbols into the Name field: they simply don't appear
   (live filter), and a small grey hint under the field reads
   *"Letters only — no numbers or symbols."*
2. If the field is somehow left with only whitespace, or under 3 letters,
   or empty, the existing `ERR_REQUIRED` / `ERR_MIN_LENGTH` messages fire as
   before.
3. If — after the live filter — the field is still not fully alphabetic in
   the allowed pattern (e.g. edge cases reachable via programmatic paste),
   submitting shows, in red, directly under the Name field **and** in the
   red summary banner at the top:
   ```
   [ERR_INVALID_NAME] Name can only contain letters, spaces, hyphens ( - )
   and apostrophes ( ' ) — no numbers or symbols.
   ```
   styled via the existing `.error-msg { color: var(--red); }` /
   `.field.error input { border-color: var(--red); }` CSS already used by
   every other field's error state, so it's visually consistent with the
   rest of the form (no new CSS was needed).

---

## 4. NEW: Login page — `src/pages/Login.jsx`

A dedicated `/login` route was added (linked from the navbar's "Dashboard
Login" button, which previously jumped straight to `/dashboard` with no
gate at all). It follows the exact same controlled-component + `validate()`
+ `FieldError` pattern as `ReportForm.jsx`, applied to the classic
login-ID/password pair.

There is still no backend in this project, so "login" here means: **the
Login ID and Password are checked against regex rules; if both pass, access
is granted and the page routes to `/dashboard`.** No credentials are stored
or checked against a database — the point of this page, like the rest of
the app, is to demonstrate validation, not real authentication.

### 4.1 Login ID validation

```js
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_.]{2,18})[A-Za-z0-9]$/;
```
- First and last character must be a plain letter or digit (`[A-Za-z0-9]`)
  — this stops a Login ID from starting or ending with `_` or `.`.
- The middle section allows letters, digits, underscore, or dot, 2–18 of
  them — so total length works out to 4–20 characters.
- **No spaces, no `@ # $ % ! & * ( )` or any other symbol** are in the
  character class, so they simply cannot match.

Live filtering on the input strips anything outside
`[A-Za-z0-9_.]` as you type:
```jsx
onChange={(e) => setLoginId(e.target.value.replace(/[^A-Za-z0-9_.]/g, ""))}
```
Failing the regex on submit produces a red inline message with code
`ERR_INVALID_USERNAME`; an empty field produces `ERR_REQUIRED`.

| Input | Result |
|---|---|
| `deven.sharma` | ✅ |
| `dev_01` | ✅ |
| `dev` | ❌ too short (3 chars, min is 4) |
| `.deven` | ❌ starts with `.` |
| `deven sharma` | ❌ space stripped live, never even reaches the field |
| `deven@sharma` | ❌ `@` stripped live |

### 4.2 Password validation

Rather than one opaque "invalid password" message, the password's rules
are each defined separately and rendered as a live green/red checklist —
this is deliberately more informative than the report form's single-message
fields, since password rules are exactly the kind of thing a user needs to
see *before* they get it wrong:

```js
const PW_RULES = [
  { key: "length",  label: "At least 8 characters",                 test: (v) => v.length >= 8 },
  { key: "upper",   label: "One uppercase letter (A-Z)",             test: (v) => /[A-Z]/.test(v) },
  { key: "lower",   label: "One lowercase letter (a-z)",             test: (v) => /[a-z]/.test(v) },
  { key: "digit",   label: "One number (0-9)",                       test: (v) => /\d/.test(v) },
  { key: "special", label: "One special character (!@#$%^&*...)",    test: (v) => /[^A-Za-z0-9]/.test(v) },
  { key: "nospace", label: "No spaces",                              test: (v) => v.length > 0 && !/\s/.test(v) },
];
```
Each `{ key, label, test }` entry is mapped over twice in the JSX: once to
render the strength bar (`PasswordStrength` component, counts how many
rules currently pass out of 6 and fills a colored bar red→amber→green), and
once to render the `.pw-rules` checklist (`✓`/`✗` + green/grey text per
rule) — so the user sees, live, exactly which requirements are still
unmet, rather than guessing from one generic message.

The actual gate on submit is a single combined regex using **lookaheads**
— zero-width assertions that check a condition without consuming
characters, letting all four character-class requirements apply to the
*same* string simultaneously:

```js
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;
```
Read left to right:
- `(?=.*[a-z])` — lookahead: somewhere ahead there's a lowercase letter.
- `(?=.*[A-Z])` — somewhere ahead there's an uppercase letter.
- `(?=.*\d)` — somewhere ahead there's a digit.
- `(?=.*[^A-Za-z0-9\s])` — somewhere ahead there's a character that is
  *not* a letter, digit, or whitespace — i.e. a special character.
- `\S{8,}$` — after all four lookaheads pass (none of them consumed any
  characters), actually match 8-or-more **non-space** characters to the end
  of the string. This is also what blocks spaces anywhere in the password.

If the password fails, `ERR_WEAK_PASSWORD` is set and a red message reads
"Password doesn't meet all the requirements below" — pointing at the
checklist rather than repeating all the rules inline, since the checklist
is already visible and already colour-coded.

Live typing also strips whitespace immediately
(`e.target.value.replace(/\s/g, "")`), and a **Show/Hide** toggle button
swaps the input's `type` between `"password"` (dots) and `"text"` (plain)
so the user can proofread what they typed — a common, expected login-form
affordance.

| Password | Passes? | Why |
|---|---|---|
| `Passw0rd!` | ✅ | 9 chars, upper, lower, digit, `!` |
| `password` | ❌ | no uppercase, no digit, no special char |
| `PASSWORD1` | ❌ | no lowercase, no special char |
| `Pass 123!` | ❌ | contains a space |
| `P@ss1` | ❌ | only 5 characters, needs ≥8 |

### 4.3 Submit flow

Identical shape to `ReportForm.jsx`: `handleSubmit` calls
`e.preventDefault()`, runs `validate(loginId, password)`, and either shows
the red `error-summary` banner (errors present) or the green
`success-banner` plus a **"Continue to Home →"** button that calls
`navigate("/")` (all valid). `noValidate` is set on the `<form>`
for the same reason as the report form — so only the custom regex-driven
messages are shown, never the browser's native validation bubbles.

### 4.4 Wiring into the app

- `src/App.jsx` — added `<Route path="/login" element={<Login />} />`.
- `src/components/Navbar.jsx` — the existing "Dashboard Login" button used
  to call `navigate("/dashboard")` directly (no gate at all). It now calls
  `navigate("/login")`, so the button's label finally matches its
  behaviour — you land on the login form first, and only reach the
  dashboard after submitting a validly-formatted Login ID and Password.
- `src/styles/global.css` — added `input[type="password"]` to the shared
  field-styling selector list (it was missing, so a raw password input
  would've rendered unstyled), plus a new `.login-page` / `.login-form` /
  `.pw-*` block for the single-column login layout, show/hide button, and
  strength bar/checklist — all built from the same `--red` / `--amber`
  design tokens already used everywhere else, so it looks like part of the
  same app rather than a bolted-on page.

---

## 5. NEW: Registration page — `src/pages/Register.jsx`

`Exp-3_Forms.docx`'s **Activity 2** literally asks for: *"Build a
registration form with name, email, and password. Validate that: Name is
not empty / Email contains @ / Password is at least 6 characters."*

Until now, that activity was only satisfied indirectly — `ReportForm.jsx`
generalizes name+email into stricter regex checks, but has no password
field at all (this is a public field-report form, not an account system).
So a **separate, minimal `Register.jsx` page** was added at `/register`
that implements Activity 2 exactly as worded, nothing more:

```js
function validate(name, email, password) {
  const errors = {};

  if (!name.trim()) {
    errors.name = { code: ERROR_CODES.REQUIRED, message: "Name is required." };
  }

  if (!email.trim()) {
    errors.email = { code: ERROR_CODES.REQUIRED, message: "Email is required." };
  } else if (!email.includes("@")) {
    errors.email = { code: ERROR_CODES.MISSING_AT, message: "Email must contain an '@' symbol." };
  }

  if (!password) {
    errors.password = { code: ERROR_CODES.REQUIRED, message: "Password is required." };
  } else if (password.length < 6) {
    errors.password = { code: ERROR_CODES.MIN_LENGTH, message: "Password must be at least 6 characters." };
  }

  return errors;
}
```

Three things worth noting about why this is written the way it is:

1. **Email check is `.includes("@")`, not a regex.** Every other email
   field in the app (`ReportForm.jsx`, and implicitly the Login ID concept)
   uses a real regex (`EMAIL_RE`). Here it's deliberately the plain
   substring check the activity literally asks for — "contains @" — so
   this file is the answer key for that exact line item, not an improved
   version of it.
2. **Password check is `password.length < 6`, not a strength regex.**
   `Login.jsx`'s password (§4.2) requires 8+ chars, mixed case, digit, and
   special character via `PASSWORD_RE`. This form only requires 6+
   characters of anything, again matching the activity's literal wording.
   A live hint (`{password.length}/6 characters minimum`) and a show/hide
   toggle mirror the UX niceties from `Login.jsx` without adding any extra
   *validation* rules.
3. **Name has no regex restriction here.** Unlike `ReportForm.jsx`'s
   Observer Name (§3, letters-only via `NAME_RE`), this Name field only
   checks "not empty" — again, purely because that's all Activity 2 asks
   for. Typing digits/symbols into *this* Name field is allowed on
   purpose, to keep this page a faithful 1:1 implementation of the
   worksheet rather than importing rules from elsewhere in the app.

### 5.1 Comparing all three forms' name/email/password rules

This side-by-side is the fastest way to see "minimum activity requirement"
vs. "generalized/production-style validation" used elsewhere in the same
codebase:

| Field | `Register.jsx` (literal activity) | `ReportForm.jsx` / `Login.jsx` (generalized) |
|---|---|---|
| Name | not empty only | `ReportForm.jsx`: not empty, ≥3 chars, letters/space/hyphen/apostrophe only via `NAME_RE` |
| Email | not empty, contains `@` (`.includes`) | `ReportForm.jsx`: not empty, matches `EMAIL_RE` (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) |
| Password | not empty, ≥6 characters (`.length`) | `Login.jsx`: not empty, ≥8 chars + upper + lower + digit + special char + no spaces via `PASSWORD_RE`, with a live strength bar/checklist |

### 5.2 Wiring and cross-links

- `src/App.jsx` — added `<Route path="/register" element={<Register />} />`.
- `src/components/Footer.jsx` — "Platform" link list now includes `Login`
  and `Register` links (`Link to="/login"`, `Link to="/register"`).
- `Login.jsx` — added "New here? Create an account" linking to `/register`.
- `Register.jsx` — added "Already have an account? Sign in" linking to
  `/login`, and on successful validation shows "Continue to Login →".
- Both use the same `.login-page` / `.login-form` CSS from §4.4 — no new
  styles were needed for this page.

---

## 6. All 15 report-form fields and their validation rules (current, post-update)

| # | Field | Input type | Rule(s) | Error code(s) |
|---|---|---|---|---|
| 1 | Observer / Reporter Name | `text` | required, ≥3 chars, **letters/space/hyphen/apostrophe only (regex)** | `ERR_REQUIRED`, `ERR_MIN_LENGTH`, **`ERR_INVALID_NAME`** |
| 2 | Contact Email | `email` | required, regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `ERR_REQUIRED`, `ERR_INVALID_EMAIL` |
| 3 | Phone Number | `tel` | required, exact 10-digit Indian mobile regex `^[6-9]\d{9}$`, digit-only live filter | `ERR_REQUIRED`, `ERR_INVALID_PHONE` |
| 4 | AWS Station ID | `number` | required, 1–500 | `ERR_REQUIRED`, `ERR_OUT_OF_RANGE` |
| 5 | Ambient Temperature (°C) | `number` | required, -10 to 60 | `ERR_REQUIRED`, `ERR_OUT_OF_RANGE` |
| 6 | Observation Date | `date` | required, not in the future | `ERR_REQUIRED`, `ERR_INVALID_DATE` |
| 7 | Observation Time | `time` | required | `ERR_REQUIRED` |
| 8 | IMD Region | `select` | required | `ERR_REQUIRED` |
| 9 | Heat Severity Tier | `radio` group | required (one of 4) | `ERR_REQUIRED` |
| 10 | Data Source(s) Used | `checkbox` group | at least one checked | `ERR_CHECKBOX_REQUIRED` |
| 11 | Confidence Level | `range` | none (always valid, 0–100 by construction) | — |
| 12 | Additional Observations | `textarea` | ≤500 chars | `ERR_MAX_LENGTH` |
| 13 | Reference Data Source Link | `url` | optional; if present, regex `^(https?:\/\/)[^\s/$.?#].[^\s]*$` | `ERR_INVALID_URL` |
| 14 | Photo Evidence | `file` | optional; if present, must be jpeg/png/webp and ≤5MB | `ERR_FILE_TYPE`, `ERR_FILE_SIZE` |
| 15 | Data-accuracy confirmation | `checkbox` (single) | must be checked | `ERR_CHECKBOX_REQUIRED` |

---

## 7. Routing — `src/App.jsx`, `src/main.jsx`, and the Login → Dashboard flow

```jsx
// main.jsx
<BrowserRouter>
  <App />
</BrowserRouter>
```
`BrowserRouter` enables HTML5 history-API-based client-side routing (clean
URLs, no `#`). It has to wrap `<App>` so that everything inside — `Routes`,
`Link`, `useNavigate`, etc. — has access to router context.

```jsx
// App.jsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/report" element={<ReportForm />} />
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```
`Routes` picks the **first** `Route` whose `path` matches the current URL
and renders its `element`. `path="*"` is a catch-all — matches anything not
matched above — used for the 404 page.

- **`Navbar.jsx`** uses `NavLink` (not plain `Link`) so it can apply an
  `active` CSS class automatically to whichever nav item matches the
  current route, and calls `useNavigate()` to programmatically send the
  "Dashboard Login" button to `/login` (not straight to `/dashboard`
  anymore).
- **`Login.jsx`** calls `useNavigate()` too — after the Login ID + Password
  both pass validation, "Continue to Home →" calls
  `navigate("/dashboard")`.
- **`ReportForm.jsx`** also calls `useNavigate()` — after a successful
  submission, "View in Dashboard Reports →" calls
  `navigate("/dashboard?tab=reports")`.
- **`Dashboard.jsx`** uses `useSearchParams()` to read/write the `?tab=`
  query string, so which dashboard tab is open is driven entirely by the
  URL (shareable/bookmarkable/back-button-friendly), rather than by local
  `useState` that would be lost on navigation.

The end-to-end flow is now: **Navbar → "Dashboard Login" → `/login` →
(valid Login ID + Password) → "Continue to Home →" → `/` (Home page).**
Going to `/dashboard` directly by typing the URL still works (there's no
real auth/session, so nothing is actually "locked") — the point of this
exercise is the validation on the login form itself, not access control.

---

## 8. Quick reference — file → responsibility

| File | Responsibility |
|---|---|
| `src/pages/ReportForm.jsx` | The Exp-3 field-report form: form state, `validate()`, submit/reset handlers, all 15 field JSX blocks, `FieldError` component |
| `src/pages/Login.jsx` | Login ID + Password gate: `USERNAME_RE`, `PASSWORD_RE`, live strength checklist, `FieldError` component |
| `src/pages/Register.jsx` | Exp-3 Activity 2 literal implementation: name/email/password with `.includes("@")` and `length < 6` checks |
| `src/styles/global.css` | Design tokens (`--red`, `--steel`, `--amber`, fonts, etc.) and every component class (`.field`, `.error-msg`, `.error-summary`, `.success-banner`, `.login-form`, `.pw-*`, buttons, layout) |
| `src/App.jsx` | Route table |
| `src/main.jsx` | React root + `BrowserRouter` |
| `src/components/Navbar.jsx` | Site nav, `NavLink` active states, `useNavigate` (now routes "Dashboard Login" through `/login`) |
| `src/components/Ticker.jsx` | Decorative scrolling heat-tier strip (no logic of note) |
| `src/components/Footer.jsx` | Static footer, `Link`s |
| `src/pages/Home.jsx` | Landing page sections |
| `src/pages/Dashboard.jsx` | Tabbed dashboard, `useSearchParams` |
| `src/pages/NotFound.jsx` | 404 catch-all route |

---

## 9. Verified working

`npm run build` was run after the name-regex change, the new Login page,
and the new Register page, and completed cleanly each time (currently 43
modules transformed, no errors, no warnings). The dev server
(`npm run dev`) serves the app at `http://localhost:5173`; the login gate
is at `http://localhost:5173/login`, registration at
`http://localhost:5173/register`.
