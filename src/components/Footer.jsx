import React from "react";
import { Link } from "react-router-dom";
// The footer shown on every page except the mobile one. It carries the credit for Open-Meteo, which its CC BY 4.0
// licence requires, and a plain-words note about what the data is and isn't. Don't remove either.
// The headings are <h2> (not <h5>) so the page's heading order stays correct for screen readers; the CSS keeps them small.
export default function Footer() {
  return <footer className="footer"><div className="container">
    <div className="footer-grid">
      <div><div className="logo"><span className="logo-dot" />ClimateIntel</div><p>Live heat monitoring for India: real weather, stored history, automatic alerts.</p></div>
      <div><h2 className="footer-title">Workspace</h2><ul><li><Link to="/dashboard">Dashboard</Link></li><li><Link to="/dashboard?tab=forecast">Forecast</Link></li><li><Link to="/report">Report an observation</Link></li><li><Link to="/m">Mobile companion</Link></li></ul></div>
      <div><h2 className="footer-title">Data</h2><ul><li>Weather: <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0)</li><li>Stored in MongoDB: readings, daily values, alerts, reports</li></ul></div>
      <div><h2 className="footer-title">Data context</h2><p>Model data for 30 representative cities, collected every 30 minutes. Not IMD station measurements. Heat levels are indicative, not official warnings; notification delivery is not connected.</p></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} ClimateIntel · KJS-CES-01</span><span>Observe · Review · Respond</span></div>
  </div></footer>;
}
