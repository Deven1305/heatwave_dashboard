import { useEffect } from "react";

// Sets the text on the browser tab for the current page, e.g. "Regions · Dashboard · ClimateIntel".
// It is not just cosmetic: screen readers announce the title when a page opens, and the browser history list becomes readable.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ClimateIntel` : "ClimateIntel · Heatwave Monitoring";
  }, [title]);
}
