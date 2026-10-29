import React from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle.js";

// Shown for any address that isn't a page of the site (the catch-all route in App.jsx).
export default function NotFound() {
  usePageTitle("Page not found");
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
