// Storage boundary: UI hooks subscribe here; a backend can replace this adapter.
export const DEMO_STORAGE_EVENT = "rehabverse-data-changed";
export function readStored(key: string, legacySession = false): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(key);
    if (value !== null || !legacySession) return value;
    return sessionStorage.getItem(key);
  } catch { return null; }
}
export function writeStored(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(DEMO_STORAGE_EVENT));
}
export function subscribeStorage(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(DEMO_STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(DEMO_STORAGE_EVENT, listener);
  };
}
export function parseStored(raw: string | null): unknown {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function localDataStatus(): "ready" | "unavailable" {
  try { window.localStorage.getItem("rehabverse-storage-check"); return "ready"; }
  catch { return "unavailable"; }
}
