import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * KJS-CES-01 — Exp-3 Activity 2: "Build a registration form with name,
 * email, and password. Validate that: Name is not empty / Email contains
 * @ / Password is at least 6 characters."
 *
 * This is deliberately the literal, minimal version of that activity —
 * three fields, three rules, exactly as worded in Exp-3_Forms.docx —
 * kept separate from ReportForm.jsx (which generalizes name/email
 * validation into a much stricter regex-based version for the heatwave
 * use case) and from Login.jsx (which uses a much stronger password
 * policy for signing back in). Comparing this file to those two is a
 * good way to see "minimum required validation" vs. "production-grade
 * validation" side by side.
 */

const ERROR_CODES = {
  REQUIRED: "ERR_REQUIRED",
  MISSING_AT: "ERR_MISSING_AT",
  MIN_LENGTH: "ERR_MIN_LENGTH",
};

function validate(name, email, password) {
  const errors = {};

  // Rule 1: Name is not empty.
  if (!name.trim()) {
    errors.name = { code: ERROR_CODES.REQUIRED, message: "Name is required." };
  }

  // Rule 2: Email contains "@" (the activity asks for exactly this check,
  // not a full email-shape regex — that stricter version lives in
  // ReportForm.jsx / Login.jsx).
  if (!email.trim()) {
    errors.email = { code: ERROR_CODES.REQUIRED, message: "Email is required." };
  } else if (!email.includes("@")) {
    errors.email = { code: ERROR_CODES.MISSING_AT, message: "Email must contain an '@' symbol." };
  }

  // Rule 3: Password is at least 6 characters.
  if (!password) {
    errors.password = { code: ERROR_CODES.REQUIRED, message: "Password is required." };
  } else if (password.length < 6) {
    errors.password = { code: ERROR_CODES.MIN_LENGTH, message: "Password must be at least 6 characters." };
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

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate(name, email, password);
    setErrors(validationErrors);
    setSubmitted(Object.keys(validationErrors).length === 0);
  };

  const errCount = Object.keys(errors).length;

  return (
    <section className="form-page container login-page">
      <div className="form-header">
        <span className="eyebrow mono">EXP-3 · ACTIVITY 2 — REGISTRATION FORM</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Create an Account</h1>
        <p style={{ color: "rgba(241,250,238,0.65)" }}>
          Name, email, and password — validated per the lab activity: name
          must not be empty, email must contain "@", password must be at
          least 6 characters.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {submitted && errCount === 0 && (
          <div className="success-banner">
            ✅ <strong>Account details valid.</strong> All three rules passed.
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

        {/* Name */}
        <div className={`field ${errors.name ? "error" : ""}`}>
          <label>Name <span className="required">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Nair"
          />
          <FieldError error={errors.name} />
        </div>

        {/* Email */}
        <div className={`field ${errors.email ? "error" : ""}`}>
          <label>Email <span className="required">*</span></label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <span className="hint">Must contain an "@" symbol.</span>
          <FieldError error={errors.email} />
        </div>

        {/* Password */}
        <div className={`field ${errors.password ? "error" : ""}`}>
          <label>Password <span className="required">*</span></label>
          <div className="pw-field-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
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
          <span className="hint">{password.length}/6 characters minimum</span>
          <FieldError error={errors.password} />
        </div>

        <div className="form-footer">
          <span className={`form-status ${errCount > 0 ? "status-bad" : "status-ok"}`}>
            {errCount > 0
              ? `${errCount} validation error${errCount > 1 ? "s" : ""} pending`
              : submitted
              ? "All checks passed"
              : "Ready to register"}
          </span>
          <button type="submit" className="btn btn-primary">
            Register
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, fontSize: 13, color: "rgba(241,250,238,0.65)" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>

      {submitted && errCount === 0 && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-outline-navy btn-ghost" onClick={() => navigate("/login")}>
            Continue to Login →
          </button>
        </div>
      )}
    </section>
  );
}
