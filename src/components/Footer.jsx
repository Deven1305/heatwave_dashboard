import React from "react";
import { Link } from "react-router-dom";
export default function Footer() {
  return <footer className="footer"><div className="container">
    <div className="footer-grid">
      <div><div className="logo"><span className="logo-dot" />ClimateIntel</div><p>Regional observations and field decision support in one workspace.</p></div>
      <div><h5>Workspace</h5><ul><li><Link to="/dashboard">Dashboard</Link></li><li><Link to="/dashboard?tab=forecast">Weather forecast</Link></li><li><Link to="/report">Report an observation</Link></li><li><Link to="/m">Mobile companion</Link></li></ul></div>
      <div><h5>Connected data</h5><ul><li>Regional records and alerts</li><li>Stored field telemetry and reports</li><li><a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo weather forecast</a></li></ul></div>
      <div><h5>Data context</h5><p>Field and regional readings come from stored backend records. Forecasts are requested from Open-Meteo. Recommendations are rule based; notification delivery is not connected.</p></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} ClimateIntel · KJS-CES-01</span><span>Observe · Review · Respond</span></div>
  </div></footer>;
}
