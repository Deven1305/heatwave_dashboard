import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge.jsx";
import { formatDateTime, liveApi } from "../api/live.js";
import usePageTitle from "../hooks/usePageTitle.js";

/**
 * Mobile companion (/m): a phone-sized list of the stored alerts with a bottom tab bar.
 *
 * It is the same React app (no separate native app) drawn outside the desktop Navbar/Ticker/Footer
 * shell (see App.jsx). Alerts come from the live API (read from MongoDB) and use the shared Badge.
 */

const TABS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "map", label: "Map", icon: "🗺" },
  { id: "report", label: "Report", icon: "✎" },
  { id: "alerts", label: "Alerts", icon: "⚠" },
  { id: "profile", label: "Profile", icon: "☺" },
];

const NAV_LINKS = [
  { to: "/", label: "ClimateIntel Home (desktop)" },
  { to: "/dashboard?tab=regions", label: "Regional Heat" },
  { to: "/dashboard?tab=alerts", label: "Alerts Console" },
  { to: "/report", label: "Report Observation" },
  { to: "/dashboard?tab=reports", label: "Field Reports" },
];

function AnnunciatorRow({ synced }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="m-annunciator">
      <span>● Alert service: {synced ? "connected" : "unavailable"}</span>
      <span className="mono">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
}

function RevealableMenu({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="m-menu-backdrop" onClick={onClose}>
      <nav className="m-menu-panel" onClick={(e) => e.stopPropagation()} aria-label="Mobile navigation">
        <div className="m-menu-head">
          <span>Menu</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">✗</button>
        </div>
        {NAV_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="m-menu-link" onClick={onClose}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function EmergencyBanner({ alert }) {
  if (!alert) return null;
  return (
    <div className="m-emergency-banner">
      <strong>⚠ {alert.tier.toUpperCase()}</strong> — {alert.region}: {alert.message}
    </div>
  );
}

export default function MobileHome() {
  usePageTitle("Alerts (mobile)");
  const [booting, setBooting] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [alerts, setAlerts] = useState([]);
  const [alertError, setAlertError] = useState("");
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // short start screen shown once at launch, before the alert list renders
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    liveApi.alerts("", 30).then(setAlerts).catch((cause) => setAlertError(cause.message || "Could not load alerts.")).finally(() => setLoadingAlerts(false));
  }, []);

  if (booting) {
    return (
      <div className="m-shell m-interstitial">
        <div className="m-interstitial-inner">
          <div className="logo-dot" style={{ margin: "0 auto 16px" }} />
          <div className="mono" style={{ fontSize: 13, letterSpacing: "0.05em" }}>Loading alert service…</div>
        </div>
      </div>
    );
  }

  const emergencyAlert = alerts.find((a) => a.tier === "Emergency" && a.status === "active");

  return (
    <div className="m-shell">
      <AnnunciatorRow synced={!alertError && !loadingAlerts} />

      <header className="m-header">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
          ☰
        </button>
        <h1 className="m-title">Heatwave Alerts</h1>
        <button className="icon-btn" aria-label="Notifications" title="Notifications">🔔</button>
      </header>

      <RevealableMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <EmergencyBanner alert={emergencyAlert} />

      <main className="m-list">
        {loadingAlerts && <div className="m-loading-more mono">Loading alerts…</div>}
        {alertError && <div className="m-loading-more mono">{alertError}</div>}
        {!loadingAlerts && !alertError && alerts.length === 0 && <div className="m-loading-more mono">No alerts are currently recorded.</div>}
        {alerts.map((a) => (
          <div className="m-alert-card" key={a.id}>
            <div className="m-alert-card-top">
              <span className="mono">{a.id}</span>
              <Badge tier={a.tier.toLowerCase()} />
            </div>
            <div className="m-alert-region">{a.region}</div>
            <div className="m-alert-message">{a.message}</div>
            <div className="m-alert-meta mono">{formatDateTime(a.issuedAt)} · {a.channel} · {a.status}</div>
          </div>
        ))}
      </main>

      <nav className="m-tabbar" aria-label="Primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`m-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
            aria-current={activeTab === t.id ? "page" : undefined}
          >
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
