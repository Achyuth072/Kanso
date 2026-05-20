import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";

describe("uiStore Hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store state by clearing it manually if needed,
    // but since it's a persistent store, we mainly care about hydration.
    vi.resetModules();
  });

  it("should initialize with default values when localStorage is empty", () => {
    const state = useUiStore.getState();
    expect(state.timeFormat).toBe("system");
    expect(state.viewMode).toBe("grid");
    expect(state.sortBy).toBe("date");
  });

  it("should rehydrate values from localStorage and set _hasHydrated to true", async () => {
    const savedState = {
      state: {
        timeFormat: "24h",
        viewMode: "list",
        sortBy: "priority",
      },
      version: 0,
    };
    localStorage.setItem("kanso-ui-state", JSON.stringify(savedState));
    await useUiStore.persist.rehydrate();

    // We need to wait for hydration
    // In jsdom/vitest, we might need to trigger it or just wait
    let state = useUiStore.getState();

    // If it's already hydrated, great. If not, wait.
    if (!state._hasHydrated) {
      await new Promise((resolve) => {
        const unsub = useUiStore.subscribe((s) => {
          if (s._hasHydrated) {
            unsub();
            resolve(true);
          }
        });
        // Timeout just in case
        setTimeout(() => {
          unsub();
          resolve(false);
        }, 1000);
      });
    }

    state = useUiStore.getState();
    expect(state._hasHydrated).toBe(true);
    expect(state.timeFormat).toBe("24h");
    expect(state.viewMode).toBe("list");
  });
});
