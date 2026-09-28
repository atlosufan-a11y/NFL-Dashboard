import { useEffect, useState } from "react";

// State persisted to localStorage. Storage can be unavailable (private
// windows, blocked site data), so every access is guarded and the app keeps
// working in memory.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);

  return [value, setValue];
}
