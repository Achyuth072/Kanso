const LAST_ACTIVE_KEY = "kagelin-last-active";

export function recordActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors (private browsing, quota).
  }
}

export function getIdleMs(): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return 0;
    return Date.now() - Number(raw);
  } catch {
    return 0;
  }
}
