import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Ticker from "./components/Ticker.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import ReportForm from "./pages/ReportForm.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import InPageEditing from "./pages/InPageEditing.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import StayOnPage from "./pages/StayOnPage.jsx";
import MobileHome from "./pages/MobileHome.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  const location = useLocation();
  // Item 5 (Mobile companion) is its own compact page — it renders its own
  // annunciator row / hamburger menu / bottom tab bar, so it opts out of
  // the desktop Navbar/Ticker/Footer shell instead of nesting inside it.
  const isMobileCompanion = location.pathname === "/m";

  return (
    <div className="app-shell">
      {!isMobileCompanion && <Navbar />}
      {!isMobileCompanion && <Ticker />}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/editing-demo" element={<InPageEditing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stay-on-page" element={<StayOnPage />} />
          <Route path="/m" element={<MobileHome />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isMobileCompanion && <Footer />}
    </div>
  );
}
