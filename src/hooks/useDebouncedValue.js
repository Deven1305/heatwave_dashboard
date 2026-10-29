import { useEffect, useState } from "react";

// Returns `value`, but only once it has stayed the same for `delay` milliseconds.
// The Alerts and Reports search boxes use it, so the database is asked when the person pauses, not on every letter.
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // typing again cancels the pending update
  }, [value, delay]);
  return debounced;
}
