import React from "react";

// Text box with a clear button and a one-line status. Controlled: the parent keeps the text (in the URL).
export default function SearchBox({ value, onChange, placeholder, status }) {
  return (
    <div className="lv-search">
      <div className="lv-search-field">
        <span aria-hidden="true">⌕</span>
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Search" maxLength={80} />
        {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search">✕</button>}
      </div>
      {status && <span className="lv-search-status" role="status">{status}</span>}
    </div>
  );
}
