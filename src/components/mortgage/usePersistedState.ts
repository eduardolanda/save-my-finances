import { useState, useEffect, useRef } from "react";
import { getSetting, setSetting } from "../../db";

const DB_PREFIX = "smf_mtg_";

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const ready = useRef(false);

  // Load from Dexie on mount; migrate from localStorage if needed
  useEffect(() => {
    getSetting(DB_PREFIX + key).then((stored) => {
      if (stored !== null) {
        try {
          setValue(JSON.parse(stored) as T);
        } catch {
          /* ignore */
        }
      } else {
        // One-time migration from localStorage
        const lsVal = localStorage.getItem(DB_PREFIX + key);
        if (lsVal !== null) {
          try {
            setValue(JSON.parse(lsVal) as T);
            localStorage.removeItem(DB_PREFIX + key);
          } catch {
            /* ignore */
          }
        }
      }
      ready.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to Dexie on change (only after initial load)
  useEffect(() => {
    if (!ready.current) return;
    setSetting(DB_PREFIX + key, JSON.stringify(value)).catch(() => {});
  }, [key, value]);

  return [value, setValue];
}
