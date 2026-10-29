import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

// The bar at the top: logo, one link for each dashboard tab, and the "+ New observation" button.
// The links are the same tabs as on the dashboard page, so keep the two lists in step if a tab is added.
const dashLinks = [
  { label: "Overview", tab: "overview" },
  { label: "Regions", tab: "regions" },
  { label: "Stations", tab: "stations" },
  { label: "Alerts", tab: "alerts" },
  { label: "Reports", tab: "reports" },
  { label: "Forecast", tab: "forecast" },
  { label: "Data", tab: "data" },
];

export default function Navbar() {
  const location = useLocation();
  // which tab is open is read from the address (?tab=regions); no tab in the address means the overview
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
          </ul>
        </nav>

        <Link className="btn btn-primary nav-report" to="/report">+ New observation</Link>
      </div>
    </header>
  );
}
