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

// The frame around every page: skip link, navigation bar, the scrolling ticker, then the page itself, then the footer.
// The <Routes> block is the list of pages: the address decides which one is shown.
//
// LiveDataProvider wraps everything on purpose. The ticker, the home page, the dashboard and the mobile page all need
// the same overview data, so it is fetched once here and shared, instead of every part asking the backend separately.
export default function App() {
  const location = useLocation();
  // /m (the phone page) draws its own status row, menu and bottom tab bar. If we also showed the desktop
  // navbar, ticker and footer around it we would get two of everything, so on that page we leave them out.
  const isMobileCompanion = location.pathname === "/m";

  return (
    <LiveDataProvider>
    <div className="app-shell">
      {/* Only visible when you tab to it. Lets keyboard and screen-reader users jump over the menu and the ticker */}
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
