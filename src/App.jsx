import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Ticker from "./components/Ticker.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import ReportForm from "./pages/ReportForm.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MobileHome from "./pages/MobileHome.jsx";
import NotFound from "./pages/NotFound.jsx";
import { LiveDataProvider } from "./context/LiveData.jsx";

/**
 * Application frame: skip link, navigation bar, temperature ticker, the current page, footer.
 * LiveDataProvider wraps everything so the ticker, home page, dashboard and mobile page share ONE copy of the live data.
 * The mobile companion (/m) draws its own compact layout, so it skips the desktop navbar, ticker and footer.
 */
export default function App() {
  const location = useLocation();
  // The mobile companion is its own compact page: it draws its own status row, menu and bottom tab bar,
  // so it opts out of the desktop Navbar/Ticker/Footer shell instead of nesting inside it.
  const isMobileCompanion = location.pathname === "/m";

  return (
    <LiveDataProvider>
    <div className="app-shell">
      {/* keyboard users can jump past the navigation and ticker straight to the page */}
      <a className="skip-link" href="#main">Skip to content</a>
      {!isMobileCompanion && <Navbar />}
      {!isMobileCompanion && <Ticker />}
      <main id="main" tabIndex={-1} style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/m" element={<MobileHome />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isMobileCompanion && <Footer />}
    </div>
    </LiveDataProvider>
  );
}
