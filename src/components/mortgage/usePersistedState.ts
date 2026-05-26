import { useState, useEffect } from "react";

const LS_PREFIX = "smf_mtg_";

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(LS_PREFIX + key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      /* ignore */
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
