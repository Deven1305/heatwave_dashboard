import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const dashLinks = [
  { label: "Overview", tab: "overview" },
  { label: "Regional Heat", tab: "regions" },
  { label: "AWS Monitoring", tab: "field" },
  { label: "Alerts", tab: "alerts" },
  { label: "Reports", tab: "reports" },
  { label: "Forecast", tab: "forecast" },
];

export default function Navbar() {
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get("tab") || "overview";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="logo-dot" />
          ClimateIntel <span className="brand-caption">Heatwave monitoring</span>
        </NavLink>

        <nav aria-label="Main navigation">
          <ul className="nav-links">
            {dashLinks.map((l) => (
              <li key={l.tab}>
                <Link
                  to={`/dashboard?tab=${l.tab}`}
                  className={location.pathname === "/dashboard" && activeTab === l.tab ? "active" : ""}
                  aria-current={location.pathname === "/dashboard" && activeTab === l.tab ? "page" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <NavLink to="/report" className={({ isActive }) => (isActive ? "active" : "")}>
                Report Observation
              </NavLink>
            </li>
          </ul>
        </nav>

        <Link className="btn btn-primary nav-report" to="/report">+ New observation</Link>
      </div>
    </header>
  );
}
