import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { liveApi } from "../api/live.js";
import usePageTitle from "../hooks/usePageTitle.js";

// The observation form (/report): somebody on the ground tells us the temperature they measured or saw.
// On submit it is saved in MongoDB (POST /api/reports) and then listed on the dashboard's Reports tab.
//
// How the form works, in short:
//   - Every field is a "controlled" input: its value lives in the `form` state below and the input just shows it.
//   - validate() checks everything when you press Submit. Each problem gets a short code (ERR_REQUIRED,
//     ERR_INVALID_PHONE ...) and a sentence, shown under the field.
//   - The backend checks it all again. The checks here are for convenience, they don't protect anything,
//     because anyone can skip this page and call the API directly.
//   - A report is only a record. It doesn't change any reading, heat level or alert.

// The 7 regions to choose from. The spelling has to match live-api/config.js exactly, because the backend looks the region up by name.
const REGIONS = [
  "North-West India",
  "North-East India",
  "East India",
  "Central India",
  "West India",
  "South Interior Peninsula",
  "South Coastal (incl. Islands)",
];

// What the observer thinks the heat level is (their own judgement, not our calculation)
const SEVERITY_TIERS = [
  { value: "safe", label: "Safe" },
  { value: "watch", label: "Watch" },
  { value: "warning", label: "Warning" },
  { value: "emergency", label: "Emergency" },
];

// Where the observer got their reading from; they have to tick at least one
const DATA_SOURCES = [
  { value: "aws", label: "AWS Sensor" },
  { value: "satellite", label: "Satellite (INSAT-3D)" },
  { value: "cpcb", label: "CPCB Station" },
  { value: "manual", label: "Manual Field Reading" },
];

// A short code for each kind of mistake, shown next to the message so a problem can be named in a bug report
const ERROR_CODES = {
  REQUIRED: "ERR_REQUIRED",
  MIN_LENGTH: "ERR_MIN_LENGTH",
  MAX_LENGTH: "ERR_MAX_LENGTH",
  INVALID_NAME: "ERR_INVALID_NAME",
  INVALID_EMAIL: "ERR_INVALID_EMAIL",
  INVALID_PHONE: "ERR_INVALID_PHONE",
  OUT_OF_RANGE: "ERR_OUT_OF_RANGE",
  INVALID_DATE: "ERR_INVALID_DATE",
  INVALID_URL: "ERR_INVALID_URL",
  CHECKBOX_REQUIRED: "ERR_CHECKBOX_REQUIRED",
  FILE_TYPE: "ERR_FILE_TYPE",
  FILE_SIZE: "ERR_FILE_SIZE",
};

// A name may have letters (accented ones too), and single spaces, hyphens or apostrophes between the letters.
// That rejects things like "Ravi123" or "R@vi" even though they aren't empty.
const NAME_RE = /^[A-Za-zÀ-ɏ]+(?:[ '-][A-Za-zÀ-ɏ]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers: 10 digits, starting with 6, 7, 8 or 9
const URL_RE = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 5; // the form is stricter than the server, which allows up to 7 MB

// People type temperatures in all sorts of ways: "42", "42.5", "42 C", "42 degrees", "42°". Rather than reject
// those, we only insist the text STARTS with a number and ignore whatever follows it.
const TEMP_LEADING_NUMBER_RE = /^\s*(-?\d+(?:\.\d+)?)/;
function parseForgivingTemp(raw) {
  const m = TEMP_LEADING_NUMBER_RE.exec(String(raw ?? ""));
  return m ? Number(m[1]) : NaN;
}
// When the field loses focus it is tidied to "42.0 °C" (if it isn't a number, it is left as typed so the error can say so)
function normalizeTempDisplay(raw) {
  const n = parseForgivingTemp(raw);
  return Number.isFinite(n) ? `${n.toFixed(1)} °C` : raw;
}

// The station ID is typed as two boxes, a 2-letter state code and a 3-digit number (MH + 014), each checked on its own.
// They are joined as "MH-014" when the report is sent.
const STATE_CODE_RE = /^[A-Za-z]{2}$/;
const STATION_NUMBER_RE = /^\d{3}$/;

// What an empty form looks like. "Reset" puts the state back to this.
const initialForm = {
  observerName: "",
  email: "",
  phone: "",
  stationState: "",
  stationNumber: "",
  ambientTemp: "",
  obsDate: "",
  obsTime: "",
  region: "",
  severity: "",
  dataSources: [],
  confidence: 70,
  notes: "",
  referenceUrl: "",
  photo: null,
  agree: false,
};

// Today as "YYYY-MM-DD" in the visitor's own timezone. (toISOString would give the UTC date, which is
// yesterday for a few hours after midnight in India.) Used to stop people choosing a date in the future.
function todayISO() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

// Turns the chosen image file into text (a "data URL") that can travel inside the JSON body. Resolves to undefined when no file was chosen.
function readPhoto(file) {
  if (!file) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(new Error("The evidence image could not be read."));
    reader.readAsDataURL(file);
  });
}

// Checks the whole form and returns an object with one entry per wrong field: { fieldName: { code, message } }.
// An empty object means the form is fine. Fields are checked in the order they appear on the page.
function validate(form) {
  const errors = {};

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

  if (!form.email.trim()) {
    errors.email = { code: ERROR_CODES.REQUIRED, message: "Contact email is required." };
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = { code: ERROR_CODES.INVALID_EMAIL, message: "Enter a valid email address." };
  }

  if (!form.phone.trim()) {
    errors.phone = { code: ERROR_CODES.REQUIRED, message: "Phone number is required." };
  } else if (!PHONE_RE.test(form.phone.trim())) {
    errors.phone = { code: ERROR_CODES.INVALID_PHONE, message: "Enter a valid 10-digit Indian mobile number." };
  }

  if (form.stationState === "") {
    errors.stationState = { code: ERROR_CODES.REQUIRED, message: "State code is required." };
  } else if (!STATE_CODE_RE.test(form.stationState)) {
    errors.stationState = { code: ERROR_CODES.OUT_OF_RANGE, message: "State code must be exactly 2 letters (e.g. MH)." };
  }

  if (form.stationNumber === "") {
    errors.stationNumber = { code: ERROR_CODES.REQUIRED, message: "Station number is required." };
  } else if (!STATION_NUMBER_RE.test(form.stationNumber)) {
    errors.stationNumber = { code: ERROR_CODES.OUT_OF_RANGE, message: "Station number must be exactly 3 digits (e.g. 014)." };
  }

  if (form.ambientTemp === "") {
    errors.ambientTemp = { code: ERROR_CODES.REQUIRED, message: "Ambient temperature reading is required." };
  } else {
    const t = parseForgivingTemp(form.ambientTemp);
    if (!Number.isFinite(t)) {
      errors.ambientTemp = { code: ERROR_CODES.OUT_OF_RANGE, message: "Enter a temperature, e.g. 42, 42.5, 42 C, 42 degrees, or 42°." };
    } else if (t < -10 || t > 60) {
      errors.ambientTemp = { code: ERROR_CODES.OUT_OF_RANGE, message: "Temperature must be between -10°C and 60°C." };
    }
  }

  if (!form.obsDate) {
    errors.obsDate = { code: ERROR_CODES.REQUIRED, message: "Observation date is required." };
  } else if (form.obsDate > todayISO()) {
    errors.obsDate = { code: ERROR_CODES.INVALID_DATE, message: "Observation date cannot be in the future." };
  }

  if (!form.obsTime) {
    errors.obsTime = { code: ERROR_CODES.REQUIRED, message: "Observation time is required." };
  }

  if (!form.region) {
    errors.region = { code: ERROR_CODES.REQUIRED, message: "Select the IMD region." };
  }

  if (!form.severity) {
    errors.severity = { code: ERROR_CODES.REQUIRED, message: "Select a heat severity tier." };
  }

  if (form.dataSources.length === 0) {
    errors.dataSources = { code: ERROR_CODES.CHECKBOX_REQUIRED, message: "Select at least one data source." };
  }

  if (form.notes.length > 500) {
    errors.notes = { code: ERROR_CODES.MAX_LENGTH, message: "Notes must be under 500 characters." };
  }

  if (form.referenceUrl.trim() && !URL_RE.test(form.referenceUrl.trim())) {
    errors.referenceUrl = { code: ERROR_CODES.INVALID_URL, message: "Enter a valid URL starting with http(s)://" };
  }

  if (form.photo) {
    if (!ALLOWED_FILE_TYPES.includes(form.photo.type)) {
      errors.photo = { code: ERROR_CODES.FILE_TYPE, message: "Only JPEG, PNG, or WEBP images are allowed." };
    } else if (form.photo.size > MAX_FILE_MB * 1024 * 1024) {
      errors.photo = { code: ERROR_CODES.FILE_SIZE, message: `File must be under ${MAX_FILE_MB}MB.` };
    }
  }

  if (!form.agree) {
    errors.agree = { code: ERROR_CODES.CHECKBOX_REQUIRED, message: "You must confirm data accuracy to submit." };
  }

  return errors;
}

// The red line under a field: [CODE] message. Draws nothing when the field has no error.
function FieldError({ error }) {
  if (!error) return null;
  return (
    <span className="error-msg">
      <span className="error-code">[{error.code}]</span> {error.message}
    </span>
  );
}

export default function ReportForm() {
  usePageTitle("Report an observation");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [savedReport, setSavedReport] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const photoInput = useRef(null);

  // set("phone", "98...") updates one field and keeps the others
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // ticking a data source adds it to the list, ticking it again removes it
  const toggleDataSource = (value) => {
    setForm((f) => {
      const has = f.dataSources.includes(value);
      return {
        ...f,
        dataSources: has ? f.dataSources.filter((v) => v !== value) : [...f.dataSources, value],
      };
    });
  };

  // Submit: validate first; only a valid form is sent to the backend. If the backend refuses it (or is down),
  // the reason is shown at the top of the form and what the person typed is kept.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      setSaving(true);
      setSubmissionError("");
      try {
        const photo = await readPhoto(form.photo);
        const record = await liveApi.createReport({
          plotId: `${form.stationState}-${form.stationNumber}`, // "MH" + "014" -> "MH-014"
          region: form.region,
          status: `Reported ${form.severity} heat observation`,
          observerName: form.observerName.trim(),
          email: form.email.trim(),
          phone: form.phone,
          ambientTempC: parseForgivingTemp(form.ambientTemp),
          observedAt: `${form.obsDate}T${form.obsTime}`, // date and time boxes joined: "2026-10-29T12:30"
          dataSources: form.dataSources,
          confidence: form.confidence,
          notes: form.notes.trim(),
          referenceUrl: form.referenceUrl.trim() || undefined,
          photo,
        });
        setSavedReport(record.record);
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (cause) {
        setSubmitted(false);
        setSubmissionError(cause.message || "The report could not be saved.");
      } finally {
        setSaving(false);
      }
    } else {
      setSubmitted(false);
    }
  };

  // "Reset": empty everything. The file input is not controlled by React, so it has to be cleared by hand.
  const handleReset = () => {
    if (photoInput.current) photoInput.current.value = "";
    setForm(initialForm);
    setErrors({});
    setSubmitted(false);
    setSubmissionError("");
    setSavedReport(null);
  };

  const errCount = Object.keys(errors).length;

  return (
    <section className="form-page container">
      <div className="form-header">
        <span className="eyebrow mono">FIELD OBSERVATION</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Field Heat Observation Report</h1>
        <p style={{ color: "rgba(241,250,238,0.65)", maxWidth: "62ch" }}>
          Report the temperature you measured or saw at your location. Reports are saved in MongoDB and
          listed on the dashboard's Reports tab. They are a record for analysts and do not change the
          readings or alerts. Fields marked * are required.
        </p>
      </div>

      <form className="report-form" onSubmit={handleSubmit} noValidate>
        {submitted && errCount === 0 && (
          <div className="success-banner">
            ✅ <strong>Report submitted.</strong> Reference ID{" "}
            <span className="mono">{savedReport?.id}</span> has
            been logged for {form.region || "the selected region"}.
          </div>
        )}

        {submissionError && <div className="error-summary"><strong>Unable to save report.</strong> {submissionError}</div>}

        {errCount > 0 && (
          <div className="error-summary">
            <strong>{errCount} field{errCount > 1 ? "s" : ""} need attention:</strong>
            <ul>
              {Object.entries(errors).map(([field, err]) => (
                <li key={field}>
                  <span className="error-code mono">{err.code}</span> — {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* the fields, in order. Each one is a label, an input, and its FieldError */}
        {/* observer name */}
        <div className={`field ${errors.observerName ? "error" : ""}`}>
          <label>Observer / Reporter Name <span className="required">*</span></label>
          <input
            type="text"
            value={form.observerName}
            onChange={(e) => set("observerName", e.target.value.replace(/[^A-Za-zÀ-ɏ '-]/g, ""))}
            placeholder="e.g. Priya Nair"
          />
          <span className="hint">Letters only — no numbers or symbols.</span>
          <FieldError error={errors.observerName} />
        </div>

        {/* email (stored privately, never shown on the Reports tab) */}
        <div className={`field ${errors.email ? "error" : ""}`}>
          <label>Contact Email <span className="required">*</span></label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="observer@example.com"
          />
          <FieldError error={errors.email} />
        </div>

        {/* phone (also private) */}
        <div className={`field ${errors.phone ? "error" : ""}`}>
          <label>Phone Number <span className="required">*</span></label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
          />
          <FieldError error={errors.phone} />
        </div>

        {/* station ID: 2-letter state code + 3-digit number */}
        <div className={`field ${errors.stationState || errors.stationNumber ? "error" : ""}`}>
          <label>AWS Station ID <span className="required">*</span></label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={form.stationState}
              onChange={(e) => set("stationState", e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())}
              placeholder="MH"
              maxLength={2}
              style={{ width: 70, textTransform: "uppercase" }}
              aria-label="Station state code (2 letters)"
            />
            <span className="mono" style={{ alignSelf: "center" }}>—</span>
            <input
              type="text"
              value={form.stationNumber}
              onChange={(e) => set("stationNumber", e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder="014"
              maxLength={3}
              style={{ width: 90 }}
              aria-label="Station number (3 digits)"
            />
          </div>
          <span className="hint">State code (e.g. MH) + 3-digit station number (e.g. 014).</span>
          <FieldError error={errors.stationState} />
          <FieldError error={errors.stationNumber} />
        </div>

        {/* temperature, typed freely (see parseForgivingTemp) */}
        <div className={`field ${errors.ambientTemp ? "error" : ""}`}>
          <label>Ambient Temperature (°C) <span className="required">*</span></label>
          <input
            type="text"
            value={form.ambientTemp}
            onChange={(e) => set("ambientTemp", e.target.value)}
            onBlur={(e) => set("ambientTemp", normalizeTempDisplay(e.target.value))}
            placeholder="e.g. 42, 42.5, 42 C, 42 degrees, or 42°"
          />
          <span className="hint">Type it any way you like — normalizes to °C when you tab away.</span>
          <FieldError error={errors.ambientTemp} />
        </div>

        {/* date (not in the future) */}
        <div className={`field ${errors.obsDate ? "error" : ""}`}>
          <label>Observation Date <span className="required">*</span></label>
          <input
            type="date"
            aria-label="Observation date"
            max={todayISO()}
            value={form.obsDate}
            onChange={(e) => set("obsDate", e.target.value)}
          />
          <FieldError error={errors.obsDate} />
        </div>

        {/* time */}
        <div className={`field ${errors.obsTime ? "error" : ""}`}>
          <label>Observation Time <span className="required">*</span></label>
          <input
            type="time"
            aria-label="Observation time"
            value={form.obsTime}
            onChange={(e) => set("obsTime", e.target.value)}
          />
          <FieldError error={errors.obsTime} />
        </div>

        {/* region */}
        <div className={`field ${errors.region ? "error" : ""}`}>
          <label>IMD Region <span className="required">*</span></label>
          <select aria-label="IMD region" value={form.region} onChange={(e) => set("region", e.target.value)}>
            <option value="">Select region…</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <FieldError error={errors.region} />
        </div>

        {/* the observer's own idea of the heat level (pick one) */}
        <div className={`field full ${errors.severity ? "error" : ""}`}>
          <label>Observed Heat Severity Tier <span className="required">*</span></label>
          <div className="radio-group">
            {SEVERITY_TIERS.map((t) => (
              <label className="radio-option" key={t.value}>
                <input
                  type="radio"
                  name="severity"
                  value={t.value}
                  checked={form.severity === t.value}
                  onChange={(e) => set("severity", e.target.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
          <FieldError error={errors.severity} />
        </div>

        {/* where the reading came from (pick at least one) */}
        <div className={`field full ${errors.dataSources ? "error" : ""}`}>
          <label>Data Source(s) Used <span className="required">*</span></label>
          <div className="checkbox-group">
            {DATA_SOURCES.map((d) => (
              <label className="checkbox-option" key={d.value}>
                <input
                  type="checkbox"
                  checked={form.dataSources.includes(d.value)}
                  onChange={() => toggleDataSource(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
          <FieldError error={errors.dataSources} />
        </div>

        {/* how sure the observer is, 0 to 100 */}
        <div className="field full">
          <label>Confidence Level</label>
          <div className="range-wrap">
            <input
              type="range"
              aria-label="Confidence level in percent"
              min={0}
              max={100}
              step={5}
              value={form.confidence}
              onChange={(e) => set("confidence", Number(e.target.value))}
            />
            <span className="range-value mono">{form.confidence}%</span>
          </div>
          <span className="hint">How confident are you in this reading?</span>
        </div>

        {/* free notes, up to 500 characters */}
        <div className={`field full ${errors.notes ? "error" : ""}`}>
          <label>
            Additional Observations
            <span className="hint">{form.notes.length}/500</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Wind conditions, visible heat stress indicators, infrastructure notes…"
          />
          <FieldError error={errors.notes} />
        </div>

        {/* a link to a source, optional */}
        <div className={`field ${errors.referenceUrl ? "error" : ""}`}>
          <label>Reference Data Source Link (optional)</label>
          <input
            type="url"
            value={form.referenceUrl}
            onChange={(e) => set("referenceUrl", e.target.value)}
            placeholder="https://imdpune.gov.in/…"
          />
          <FieldError error={errors.referenceUrl} />
        </div>

        {/* a photo as evidence, optional */}
        <div className={`field ${errors.photo ? "error" : ""}`}>
          <label>Photo Evidence (optional)</label>
          <div className="file-drop">
            <input
              type="file"
              aria-label="Photo evidence"
              ref={photoInput}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => set("photo", e.target.files[0] || null)}
            />
            {form.photo && <div className="hint" style={{ marginTop: 6 }}>{form.photo.name}</div>}
          </div>
          <FieldError error={errors.photo} />
        </div>

        {/* confirmation that the details are correct; required */}
        <div className={`field full ${errors.agree ? "error" : ""}`}>
          <label className="checkbox-option" style={{ width: "fit-content" }}>
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => set("agree", e.target.checked)}
            />
            I confirm this reading is accurate to the best of my knowledge. <span className="required">*</span>
          </label>
          <FieldError error={errors.agree} />
        </div>

        <div className="form-footer">
          <span className={`form-status ${errCount > 0 ? "status-bad" : "status-ok"}`}>
            {errCount > 0
              ? `${errCount} validation error${errCount > 1 ? "s" : ""} pending`
              : submitted
              ? "All checks passed"
              : "Ready for submission"}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={handleReset}>
              Reset
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Submit Report"}
            </button>
          </div>
        </div>
      </form>

      {submitted && errCount === 0 && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-outline-navy btn-ghost" onClick={() => navigate("/dashboard?tab=reports")}>
            View in Dashboard Reports →
          </button>
        </div>
      )}
    </section>
  );
}
