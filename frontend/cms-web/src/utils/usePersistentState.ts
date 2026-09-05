import { useState, useEffect } from 'react';

export function usePersistentState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`cms_store_${key}`);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback to initialValue
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`cms_store_${key}`, JSON.stringify(state));
    } catch {
      // Ignore write errors
    }
  }, [key, state]);

  return [state, setState];
}
