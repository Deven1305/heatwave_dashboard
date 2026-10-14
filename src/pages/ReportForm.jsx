import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { nodeApi } from "../api/backend.js";

/**
 * KJS-CES-01 — Exp-3: Form Handling & Form Validation in React
 * Use case: Field Heat Observation & AWS Station Report submission.
 *
 * Demonstrates (per Exp-3 lab activity):
 *  - Controlled components (all fields driven by state)
 *  - 13 distinct HTML input types
 *  - Manual client-side validation with structured error codes
 *  - onSubmit + event.preventDefault()
 */

const REGIONS = [
  "North-West India",
  "North-East India",
  "East India",
  "Central India",
  "West India",
  "South Interior Peninsula",
  "South Coastal (incl. Islands)",
];

const SEVERITY_TIERS = [
  { value: "safe", label: "Safe" },
  { value: "watch", label: "Watch" },
  { value: "warning", label: "Warning" },
  { value: "emergency", label: "Emergency" },
];

const DATA_SOURCES = [
  { value: "aws", label: "AWS Sensor" },
  { value: "satellite", label: "Satellite (INSAT-3D)" },
  { value: "cpcb", label: "CPCB Station" },
  { value: "manual", label: "Manual Field Reading" },
];

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

// Letters (incl. accented), spaces, hyphens and apostrophes only — blocks
// digits and symbols (e.g. "Ravi123", "R@vi", "Ravi_Sharma") from being a
// "valid" name even though they are non-empty.
const NAME_RE = /^[A-Za-zÀ-ɏ]+(?:[ '-][A-Za-zÀ-ɏ]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile
const URL_RE = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 5;

// Item 3a — Forgiving Format: accepts "42", "42.5", "42 C", "42 degrees",
// "42°" (and similar) by only requiring a leading number; everything after
// it is ignored rather than rejected.
const TEMP_LEADING_NUMBER_RE = /^\s*(-?\d+(?:\.\d+)?)/;
function parseForgivingTemp(raw) {
  const m = TEMP_LEADING_NUMBER_RE.exec(String(raw ?? ""));
  return m ? Number(m[1]) : NaN;
}
function normalizeTempDisplay(raw) {
  const n = parseForgivingTemp(raw);
  return Number.isFinite(n) ? `${n.toFixed(1)} °C` : raw;
}

// Item 3b — Structured Format: AWS Station ID split into an independently
// validated 2-letter state code and 3-digit station number.
const STATE_CODE_RE = /^[A-Za-z]{2}$/;
const STATION_NUMBER_RE = /^\d{3}$/;

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

function todayISO() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function readPhoto(file) {
  if (!file) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(new Error("The evidence image could not be read."));
    reader.readAsDataURL(file);
  });
}

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

function FieldError({ error }) {
  if (!error) return null;
  return (
    <span className="error-msg">
      <span className="error-code">[{error.code}]</span> {error.message}
    </span>
  );
}

export default function ReportForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [savedReport, setSavedReport] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const photoInput = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDataSource = (value) => {
    setForm((f) => {
      const has = f.dataSources.includes(value);
      return {
        ...f,
        dataSources: has ? f.dataSources.filter((v) => v !== value) : [...f.dataSources, value],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      setSaving(true);
      setSubmissionError("");
      try {
        const photo = await readPhoto(form.photo);
        const record = await nodeApi.createReport({
          plotId: `${form.stationState}-${form.stationNumber}`,
          region: form.region,
          status: `Reported ${form.severity} heat observation`,
          observerName: form.observerName.trim(),
          email: form.email.trim(),
          phone: form.phone,
          ambientTempC: parseForgivingTemp(form.ambientTemp),
          observedAt: `${form.obsDate}T${form.obsTime}`,
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
        <span className="eyebrow mono">EXP-3 · FORM HANDLING &amp; VALIDATION</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Field Heat Observation Report</h1>
        <p style={{ color: "rgba(241,250,238,0.65)", maxWidth: "62ch" }}>
          Submit a localized AWS / field heat reading for the KJS-CES-01 Regional Heatwave
          Early-Warning system. All 15 fields below are controlled React components validated
          on submit, each failure returning a structured error code.
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

        {/* 1. text */}
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

        {/* 2. email */}
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

        {/* 3. tel */}
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

        {/* 4. structured pair (Item 3b): 2-letter state + 3-digit station number */}
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

        {/* 5. text, forgiving format (Item 3a) */}
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

        {/* 6. date */}
        <div className={`field ${errors.obsDate ? "error" : ""}`}>
          <label>Observation Date <span className="required">*</span></label>
          <input
            type="date"
            max={todayISO()}
            value={form.obsDate}
            onChange={(e) => set("obsDate", e.target.value)}
          />
          <FieldError error={errors.obsDate} />
        </div>

        {/* 7. time */}
        <div className={`field ${errors.obsTime ? "error" : ""}`}>
          <label>Observation Time <span className="required">*</span></label>
          <input
            type="time"
            value={form.obsTime}
            onChange={(e) => set("obsTime", e.target.value)}
          />
          <FieldError error={errors.obsTime} />
        </div>

        {/* 8. select */}
        <div className={`field ${errors.region ? "error" : ""}`}>
          <label>IMD Region <span className="required">*</span></label>
          <select value={form.region} onChange={(e) => set("region", e.target.value)}>
            <option value="">Select region…</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <FieldError error={errors.region} />
        </div>

        {/* 9. radio group */}
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

        {/* 10. checkbox group (multi) */}
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

        {/* 11. range */}
        <div className="field full">
          <label>Confidence Level</label>
          <div className="range-wrap">
            <input
              type="range"
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

        {/* 12. textarea */}
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

        {/* 13. url */}
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

        {/* 14. file */}
        <div className={`field ${errors.photo ? "error" : ""}`}>
          <label>Photo Evidence (optional)</label>
          <div className="file-drop">
            <input
              type="file"
              ref={photoInput}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => set("photo", e.target.files[0] || null)}
            />
            {form.photo && <div className="hint" style={{ marginTop: 6 }}>{form.photo.name}</div>}
          </div>
          <FieldError error={errors.photo} />
        </div>

        {/* 15. checkbox single */}
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
