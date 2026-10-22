import { useEffect } from "react";

// Sets the browser tab / window title for the current page ("Regions · ClimateIntel").
// Screen-reader users hear the title when a page loads, and it makes browser history readable.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ClimateIntel` : "ClimateIntel · Heatwave Monitoring";
  }, [title]);
}
