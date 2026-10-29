import React from "react";

// The search box used on the dashboard tabs. It doesn't remember the text itself: the page that uses it passes
// `value` in and gets every change back through onChange (the pages keep it in the address bar, which is why a
// refresh keeps your search). `status` is the little line under the box, like "2 of 30 cities".
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
