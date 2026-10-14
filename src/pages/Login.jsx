import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * KJS-CES-01 — Login gate for the Dashboard.
 * Demonstrates regex-based validation for a classic login-ID + password
 * pair, per the Exp-3 activity's registration/login example — separate
 * from ReportForm.jsx's field-report form.
 *
 * No backend exists in this project, so "login" is a client-side format
 * check only: if the Login ID and Password both satisfy their regex rules,
 * access is granted and the user is routed to /dashboard. This keeps the
 * focus on validation, matching the rest of the app's mock-data approach.
 */

const ERROR_CODES = {
  REQUIRED: "ERR_REQUIRED",
  INVALID_USERNAME: "ERR_INVALID_USERNAME",
  WEAK_PASSWORD: "ERR_WEAK_PASSWORD",
};

// Login ID: 4-20 chars, letters/digits/underscore/dot only.
// No spaces, no symbols like @ # $ % ! etc, no leading/trailing dot or underscore.
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_.]{2,18})[A-Za-z0-9]$/;

// Password strength rules, checked individually so each can be shown
// as its own red/green checklist item instead of one opaque regex.
const PW_RULES = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter (a-z)", test: (v) => /[a-z]/.test(v) },
  { key: "digit", label: "One number (0-9)", test: (v) => /\d/.test(v) },
  { key: "special", label: "One special character (!@#$%^&*...)", test: (v) => /[^A-Za-z0-9]/.test(v) },
  { key: "nospace", label: "No spaces", test: (v) => v.length > 0 && !/\s/.test(v) },
];

// A password is accepted only if it satisfies every rule above.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

function validate(loginId, password) {
  const errors = {};

  if (!loginId.trim()) {
    errors.loginId = { code: ERROR_CODES.REQUIRED, message: "Login ID is required." };
  } else if (!USERNAME_RE.test(loginId.trim())) {
    errors.loginId = {
      code: ERROR_CODES.INVALID_USERNAME,
      message:
        "Login ID must be 4-20 characters: letters, digits, underscore ( _ ) or dot ( . ) only — no spaces or other symbols, and it can't start or end with _ or .",
    };
  }

  if (!password) {
    errors.password = { code: ERROR_CODES.REQUIRED, message: "Password is required." };
  } else if (!PASSWORD_RE.test(password)) {
    errors.password = {
      code: ERROR_CODES.WEAK_PASSWORD,
      message: "Password doesn't meet all the requirements below.",
    };
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

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate(loginId, password);
    setErrors(validationErrors);
    setSubmitted(Object.keys(validationErrors).length === 0);
  };

  const handleContinue = () => navigate("/");

  const errCount = Object.keys(errors).length;

  return (
    <section className="form-page container login-page">
      <div className="form-header">
        <span className="eyebrow mono">DASHBOARD ACCESS</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Login</h1>
        <p style={{ color: "rgba(241,250,238,0.65)" }}>
          Sign in with a Login ID and password to continue to the site.
          Both fields are validated with regex before submission is accepted.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {submitted && errCount === 0 && (
          <div className="success-banner">
            ✅ <strong>Login accepted.</strong> Credentials matched the required format.
          </div>
        )}

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

        {/* Login ID */}
        <div className={`field ${errors.loginId ? "error" : ""}`}>
          <label>Login ID <span className="required">*</span></label>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.replace(/[^A-Za-z0-9_.]/g, ""))}
            placeholder="e.g. priya.nair"
            autoComplete="username"
          />
          <span className="hint">Letters, digits, underscore ( _ ) or dot ( . ) only — no spaces or symbols.</span>
          <FieldError error={errors.loginId} />
        </div>

        {/* Password */}
        <div className={`field ${errors.password ? "error" : ""}`}>
          <label>Password <span className="required">*</span></label>
          <div className="pw-field-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
              placeholder="Enter password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>

          <PasswordStrength value={password} />

          <ul className="pw-rules">
            {PW_RULES.map((rule) => (
              <li key={rule.key} className={rule.test(password) ? "met" : ""}>
                {rule.test(password) ? "✓" : "✗"} {rule.label}
              </li>
            ))}
          </ul>

          <FieldError error={errors.password} />
        </div>

        {/* Remember me */}
        <label className="checkbox-option" style={{ width: "fit-content" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember this Login ID on this device
        </label>

        <div className="form-footer">
          <span className={`form-status ${errCount > 0 ? "status-bad" : "status-ok"}`}>
            {errCount > 0
              ? `${errCount} validation error${errCount > 1 ? "s" : ""} pending`
              : submitted
              ? "Format valid — login accepted"
              : "Ready to sign in"}
          </span>
          <button type="submit" className="btn btn-primary">
            Sign In
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: "rgba(241,250,238,0.65)" }}>
        New here? <Link to="/register">Create an account</Link>
      </p>

      {submitted && errCount === 0 && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-outline-navy btn-ghost" onClick={handleContinue}>
            Continue to Home →
          </button>
        </div>
      )}
    </section>
  );
}

function PasswordStrength({ value }) {
  const metCount = PW_RULES.reduce((n, r) => n + (r.test(value) ? 1 : 0), 0);
  const pct = (metCount / PW_RULES.length) * 100;
  const color = pct < 40 ? "var(--red)" : pct < 100 ? "var(--amber)" : "#1a7a4c";
  return (
    <div className="pw-strength-track">
      <div className="pw-strength-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
