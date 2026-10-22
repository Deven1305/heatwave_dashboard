import { useEffect, useState } from "react";

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Used for search boxes so the database is asked once the user pauses typing, not on every keystroke.
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // typing again cancels the pending update
  }, [value, delay]);
  return debounced;
}
