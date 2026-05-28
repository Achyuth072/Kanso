import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";

describe("useUiStore", () => {
  beforeEach(() => {
    // Reset state before each test
    useUiStore.setState({
      isProjectsOpen: true,
      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
      hapticsEnabled: true,
      isShortcutsHelpOpen: false,
    });
  });

  it("should have correct initial values", () => {
    const state = useUiStore.getState();
    expect(state.isProjectsOpen).toBe(true);
    expect(state.sortBy).toBe("date");
    expect(state.viewMode).toBe("list");
  });

  it("should toggle projects visibility", () => {
    useUiStore.getState().toggleProjectsOpen();
    expect(useUiStore.getState().isProjectsOpen).toBe(false);

    useUiStore.getState().toggleProjectsOpen();
    expect(useUiStore.getState().isProjectsOpen).toBe(true);
  });

  it("should update sort options", () => {
    useUiStore.getState().setSortBy("priority");
    expect(useUiStore.getState().sortBy).toBe("priority");
  });

  it("should update view mode", () => {
    useUiStore.getState().setViewMode("board");
    expect(useUiStore.getState().viewMode).toBe("board");
  });

  it("should handle haptics toggle", () => {
    useUiStore.getState().setHapticsEnabled(false);
    expect(useUiStore.getState().hapticsEnabled).toBe(false);
  });

  it("should handle shortcuts help dialog toggle", () => {
    useUiStore.getState().setShortcutsHelpOpen(true);
    expect(useUiStore.getState().isShortcutsHelpOpen).toBe(true);

    // Test functional update
    useUiStore.getState().setShortcutsHelpOpen((prev) => !prev);
    expect(useUiStore.getState().isShortcutsHelpOpen).toBe(false);
  });

  describe("isFullscreen", () => {
    it("should default to false", () => {
      expect(useUiStore.getState().isFullscreen).toBe(false);
    });

    it("should allow setting fullscreen state", () => {
      useUiStore.getState().setIsFullscreen(true);
      expect(useUiStore.getState().isFullscreen).toBe(true);

      useUiStore.getState().setIsFullscreen(false);
      expect(useUiStore.getState().isFullscreen).toBe(false);
    });
  });

  describe("isSynced", () => {
    it("should default to false", () => {
      expect(useUiStore.getState().isSynced).toBe(false);
    });

    it("should allow setting sync state", () => {
      useUiStore.getState().setIsSynced(true);
      expect(useUiStore.getState().isSynced).toBe(true);

      useUiStore.getState().setIsSynced(false);
      expect(useUiStore.getState().isSynced).toBe(false);
    });
  });
});
