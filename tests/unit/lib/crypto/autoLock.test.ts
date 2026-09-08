import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordActivity, getIdleMs } from "@/lib/crypto/autoLock";

describe("autoLock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("reports zero idle time when nothing has been recorded yet", () => {
    expect(getIdleMs()).toBe(0);
  });

  it("reports near-zero idle time right after recording activity", () => {
    recordActivity();
    expect(getIdleMs()).toBeLessThan(50);
  });

  it("reports elapsed time since the last recorded activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordActivity();

    vi.setSystemTime(90_000);
    expect(getIdleMs()).toBe(90_000);
  });
});
