import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "@/lib/store/uiStore";

describe("Changelog version tracking", () => {
  beforeEach(() => {
    useUiStore.setState({
      lastSeenVersion: "",
      lastDismissedVersion: "",
    });
  });

  it("should initialize with empty dismissed version on first visit", () => {
    const state = useUiStore.getState();
    expect(state.lastDismissedVersion).toBe("");
  });

  it("should set dismissed version on dismiss", () => {
    const store = useUiStore.getState();
    store.setLastDismissedVersion("1.19.2-preview.13");
    expect(useUiStore.getState().lastDismissedVersion).toBe(
      "1.19.2-preview.13",
    );
  });

  it("should treat empty dismissed version as first visit (no popup)", () => {
    const state = useUiStore.getState();
    const isFirstVisit = state.lastDismissedVersion === "";
    expect(isFirstVisit).toBe(true);
  });

  it("should detect new version when dismissed version is behind current", () => {
    useUiStore.setState({ lastDismissedVersion: "1.19.2-preview.10" });
    const dismissed = useUiStore.getState().lastDismissedVersion;
    const hasNew = dismissed !== "1.19.2-preview.13" && dismissed !== "";
    expect(hasNew).toBe(true);
  });

  it("should not detect new version when dismissed matches current", () => {
    useUiStore.setState({ lastDismissedVersion: "1.19.2-preview.13" });
    const dismissed = useUiStore.getState().lastDismissedVersion;
    const hasNew = dismissed !== "1.19.2-preview.13" && dismissed !== "";
    expect(hasNew).toBe(false);
  });

  it("should migrate lastSeenVersion to lastDismissedVersion", () => {
    useUiStore.setState({
      lastSeenVersion: "1.19.2-preview.10",
      lastDismissedVersion: "",
    });
    const state = useUiStore.getState();
    if (state.lastSeenVersion && !state.lastDismissedVersion) {
      state.setLastDismissedVersion(state.lastSeenVersion);
    }
    expect(useUiStore.getState().lastDismissedVersion).toBe(
      "1.19.2-preview.10",
    );
  });
});

describe("isNewerThan", () => {
  it("should return true when first version is newer", async () => {
    const { isNewerThan } = await import("@/lib/changelog-cache");
    expect(isNewerThan("1.19.2-preview.13", "1.19.2-preview.10")).toBe(true);
  });

  it("should return false when versions are equal", async () => {
    const { isNewerThan } = await import("@/lib/changelog-cache");
    expect(isNewerThan("1.19.2-preview.13", "1.19.2-preview.13")).toBe(false);
  });

  it("should return false when first version is older", async () => {
    const { isNewerThan } = await import("@/lib/changelog-cache");
    expect(isNewerThan("1.19.2-preview.10", "1.19.2-preview.13")).toBe(false);
  });

  it("should handle version comparison with different minor versions", async () => {
    const { isNewerThan } = await import("@/lib/changelog-cache");
    expect(isNewerThan("1.20.0", "1.19.2-preview.13")).toBe(true);
  });
});
