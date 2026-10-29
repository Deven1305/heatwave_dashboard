import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/global.css";
import "./styles/live.css";

// Where the React app starts. It is drawn inside the <div id="root"> in index.html.
// BrowserRouter is what lets the address bar decide which page is shown (/dashboard, /report ...).
// StrictMode only does extra checks while developing (you may see effects run twice); it does nothing in the built site.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
